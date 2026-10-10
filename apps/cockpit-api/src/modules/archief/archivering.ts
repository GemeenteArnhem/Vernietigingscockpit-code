import { gunzipSync } from "node:zlib";
import type { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../../shared/db/prisma.service.js";
import { schrijfAuditEvent, type AuditActor } from "../audit/audit-keten.js";
import type { AuditEventType } from "../audit/audit-eventtypen.js";
import { verifieerTaakKeten } from "../audit/audit.service.js";
import { eersteStartdatum, planUitvoering, volgendeStartdatum } from "../taakdefinities/planning.js";
import type { WorkflowService } from "../workflow/workflow.service.js";
import { BESLUIT_EVENTTYPEN, besluitTekst, ROLNAMEN } from "../verklaring/verklaring-maker.js";
import { BestandArchiefAdapter, type ArchiefAdapter, type ArchiefBestand } from "./archief-adapter.js";
import { leesDossierKandidaten, vernietigingsmethodeVan, zorgdragerVan } from "./dossier-gegevens.js";
import { kandidaatXml, kandidaatXmlNaam, maakDossier, sha256, specificatieNaam } from "./mdto-dossier.js";

// Uitvoeren van een archivering door de worker (CC-18): pakket samenstellen uit de eigen
// database, via de adapter wegzetten en de taak naar `archief` laten gaan. Het pakket is
// MDTO-XML 1.0.1 (ADR-0005 §7): het dossier met verklaring, vernietigingslijst (CSV),
// besluitvorming en auditlog, per aangeboden kandidaat de MDTO-beschrijving (kandidaten/)
// en per vernietigde kandidaat de specificatie van de stekker (specificaties/).

export function archiefAdapterVan(config: ConfigService): ArchiefAdapter {
  const pad = config.get<string>("ARCHIEF_PAD")?.trim();

  if (!pad) {
    throw new Error("ARCHIEF_PAD is niet geconfigureerd voor archivering.");
  }

  return new BestandArchiefAdapter(pad);
}

export class ArchiveringVerwerker {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: WorkflowService,
    private readonly adapter: () => ArchiefAdapter
  ) {}

  async archiveer(archiveringId: string, actor: AuditActor) {
    const db = this.prisma.client;
    const archivering = await db.archivering.findUniqueOrThrow({ where: { id: archiveringId } });

    if (archivering.status !== "PENDING") {
      return archivering; // al afgerond bij een eerdere poging
    }

    const taakinstantieId = archivering.taakinstantieId;
    const [taak, verklaring, events, kandidaten] = await Promise.all([
      db.taakinstantie.findUniqueOrThrow({
        where: { id: taakinstantieId },
        select: { id: true, naam: true, lijstHash: true, afgerondOp: true, archiefvormer: true, taakdefinitie: { select: { naam: true } } },
      }),
      db.verklaring.findFirst({ where: { taakinstantieId }, orderBy: { versie: "desc" } }),
      db.auditEvent.findMany({ where: { taakinstantieId }, orderBy: { id: "asc" } }),
      leesDossierKandidaten(db, taakinstantieId),
    ]);

    if (!verklaring) {
      throw new Error("Er is nog geen vernietigingsverklaring om te archiveren.");
    }

    const keten = await verifieerTaakKeten(this.prisma, taakinstantieId);
    const auditlog = events.map((event) => ({
      ...event,
      id: event.id.toString(),
      tijdstip: event.tijdstip.toISOString(),
    }));
    const zorgdrager = zorgdragerVan(taak);
    const besluitEventtypen: readonly string[] = [...BESLUIT_EVENTTYPEN, "Bevriezing"];
    const besluiten = events
      .filter((event) => event.entiteitType === "taakinstantie" && besluitEventtypen.includes(event.eventType))
      .map((event) => ({
        eventType: event.eventType as AuditEventType,
        tijdstip: event.tijdstip.toISOString(),
        actor:
          event.actorType === "system"
            ? "Vernietigingscockpit"
            : `${event.actorNaam ?? "-"}${event.rol ? ` (${ROLNAMEN[event.rol] ?? event.rol})` : ""}`,
        resultaat: event.eventType === "Bevriezing" ? "Lijst bevroren bij vrijgave" : besluitTekst(event.eventType, event.rol),
      }));
    const bevriezing = besluiten.filter((besluit) => besluit.eventType === "Bevriezing").at(-1);

    const { bestanden, dossierXml } = maakDossier({
      taak: {
        id: taak.id,
        naam: taak.naam,
        taakdefinitie: taak.taakdefinitie.naam,
        aangemaaktOp: (events[0]?.tijdstip ?? new Date()).toISOString(),
      },
      zorgdrager,
      gearchiveerdOp: new Date().toISOString(),
      verklaring: { pdf: Buffer.from(verklaring.pdf), versie: verklaring.versie, gegenereerdOp: verklaring.gegenereerdOp.toISOString() },
      vernietigingslijst: {
        csv: Buffer.from(verklaring.csv),
        lijstHash: taak.lijstHash,
        bevrorenOp: bevriezing?.tijdstip ?? null,
        aantalKandidaten: kandidaten.length,
      },
      auditlog: {
        json: Buffer.from(JSON.stringify(auditlog, null, 2), "utf8"),
        aantalEvents: keten.aantalEvents,
        laatsteHash: keten.laatsteHash,
        intact: keten.intact,
      },
      besluiten,
    });

    const adapter = this.adapter();
    const resultaat = await adapter.archiveer({
      taakinstantieId,
      archiveringId,
      bestanden: [...bestanden, ...kandidaatBestanden(kandidaten, zorgdrager)],
      dossierXml,
    });

    // Vastleggen en de taak afronden in één transactie.
    return db.$transaction(async (tx) => {
      const { count } = await tx.archivering.updateMany({
        where: { id: archiveringId, status: "PENDING" },
        data: {
          status: "SUCCESS",
          adapter: adapter.naam,
          verklaringVersie: verklaring.versie,
          locatie: resultaat.locatie,
          dossierSha256: resultaat.dossierSha256,
          openzaakZaakId: resultaat.openzaakZaakId ?? null,
          fout: null,
          afgerondOp: new Date(),
        },
      });

      if (count === 1) {
        await this.workflow.transition(tx, {
          taakinstantieId,
          actie: "archiveren",
          actor,
          details: {
            archiveringId,
            aangevraagdDoor: archivering.aangevraagdDoor,
            adapter: adapter.naam,
            locatie: resultaat.locatie,
            dossierSha256: resultaat.dossierSha256,
            verklaringVersie: verklaring.versie,
          },
        });

        // Terugkerende taak: de volgende cyclus klaarzetten (planning.ts).
        await this.planVolgendeCyclus(tx, taakinstantieId, actor);
      }

      return tx.archivering.findUniqueOrThrow({ where: { id: archiveringId } });
    });
  }

  private async planVolgendeCyclus(tx: Prisma.TransactionClient, taakinstantieId: string, actor: AuditActor) {
    const taak = await tx.taakinstantie.findUniqueOrThrow({
      where: { id: taakinstantieId },
      select: {
        geplandOp: true,
        taakdefinitie: {
          select: {
            id: true,
            naam: true,
            frequentie: true,
            startmaand: true,
            actief: true,
            verwijderdOp: true,
            recordmanagerId: true,
            proceseigenaarId: true,
            archivarisId: true,
          },
        },
      },
    });
    const definitie = taak.taakdefinitie;

    if (!definitie.actief || definitie.verwijderdOp) {
      return;
    }

    const vandaag = new Date();
    const startdatum = taak.geplandOp
      ? volgendeStartdatum(definitie.frequentie, definitie.startmaand, taak.geplandOp, vandaag)
      : eersteStartdatum(definitie.frequentie, definitie.startmaand, vandaag);

    if (startdatum) {
      await planUitvoering(tx, actor, definitie, startdatum);
    }
  }

  // Definitief mislukt (na het retrybeleid): vastleggen, zodat de RM opnieuw kan archiveren.
  async mislukt(archiveringId: string, fout: string, actor: AuditActor) {
    await this.prisma.client.$transaction(async (tx) => {
      const archivering = await tx.archivering.update({
        where: { id: archiveringId },
        data: { status: "FAILED", fout, afgerondOp: new Date() },
      });
      await schrijfAuditEvent(tx, actor, {
        taakinstantieId: archivering.taakinstantieId,
        eventType: "Archivering mislukt",
        entiteitType: "taakinstantie",
        entiteitId: archivering.taakinstantieId,
        details: { archiveringId, fout },
      });
    });
  }
}

// Per aangeboden kandidaat de MDTO-beschrijving en per vernietigde kandidaat de specificatie
// van de stekker. De specificatie wordt vóór het wegzetten gecontroleerd op de SHA-256 die
// bij ontvangst is vastgelegd.
function kandidaatBestanden(
  kandidaten: Awaited<ReturnType<typeof leesDossierKandidaten>>,
  zorgdrager: ReturnType<typeof zorgdragerVan>
): ArchiefBestand[] {
  return kandidaten
    .filter((kandidaat) => kandidaat.beoordeling === "AKKOORD")
    .flatMap((kandidaat) => {
      const bestanden: ArchiefBestand[] = [
        {
          naam: kandidaatXmlNaam(kandidaat),
          inhoud: Buffer.from(kandidaatXml(kandidaat, zorgdrager, vernietigingsmethodeVan(kandidaat)), "utf8"),
          contentType: "application/xml",
        },
      ];
      const resultaat = kandidaat.uitvoeringsresultaten[0];

      if (resultaat?.specificatie) {
        const xml = gunzipSync(Buffer.from(resultaat.specificatie));

        if (sha256(xml) !== resultaat.specificatieSha256) {
          throw new Error(`De specificatie van kandidaat ${kandidaat.kandidaatId} komt niet overeen met de vastgelegde SHA-256.`);
        }

        bestanden.push({ naam: specificatieNaam(kandidaat), inhoud: xml, contentType: "application/xml" });
      }

      return bestanden;
    });
}
