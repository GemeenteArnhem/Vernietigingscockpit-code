import type { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../../shared/db/prisma.service.js";
import { schrijfAuditEvent, type AuditActor } from "../audit/audit-keten.js";
import { verifieerTaakKeten } from "../audit/audit.service.js";
import { eersteStartdatum, planUitvoering, volgendeStartdatum } from "../taakdefinities/planning.js";
import type { WorkflowService } from "../workflow/workflow.service.js";
import { BestandArchiefAdapter, type ArchiefAdapter } from "./archief-adapter.js";

// Uitvoeren van een archivering door de worker (CC-18): pakket samenstellen uit de eigen
// database (laatste verklaring, CSV-bijlage, volledig auditlog), via de adapter wegzetten
// en de taak naar `archief` laten gaan.

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
    const [taak, verklaring, events] = await Promise.all([
      db.taakinstantie.findUniqueOrThrow({
        where: { id: taakinstantieId },
        select: { id: true, naam: true, lijstHash: true, afgerondOp: true },
      }),
      db.verklaring.findFirst({ where: { taakinstantieId }, orderBy: { versie: "desc" } }),
      db.auditEvent.findMany({ where: { taakinstantieId }, orderBy: { id: "asc" } }),
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
    const adapter = this.adapter();
    const resultaat = await adapter.archiveer({
      taakinstantieId,
      archiveringId,
      bestanden: [
        { naam: "verklaring.pdf", inhoud: Buffer.from(verklaring.pdf), contentType: "application/pdf" },
        { naam: "bijlage.csv", inhoud: Buffer.from(verklaring.csv), contentType: "text/csv; charset=utf-8" },
        {
          naam: "auditlog.json",
          inhoud: Buffer.from(JSON.stringify(auditlog, null, 2), "utf8"),
          contentType: "application/json",
        },
      ],
      manifest: {
        soort: "vernietigingsdossier",
        taak: { id: taak.id, naam: taak.naam, afgerondOp: taak.afgerondOp?.toISOString() ?? null },
        archiveringId,
        aangevraagdDoor: archivering.aangevraagdDoor,
        gearchiveerdOp: new Date().toISOString(),
        verklaring: { versie: verklaring.versie, pdfSha256: verklaring.pdfSha256, csvSha256: verklaring.csvSha256, pdfa: "PDF/A-2b" },
        lijstHash: taak.lijstHash,
        auditlog: { aantalEvents: keten.aantalEvents, laatsteHash: keten.laatsteHash, intact: keten.intact },
      },
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
          manifestSha256: resultaat.manifestSha256,
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
            manifestSha256: resultaat.manifestSha256,
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
        actie: "ARCHIVING_FAILED",
        entiteitType: "taakinstantie",
        entiteitId: archivering.taakinstantieId,
        details: { archiveringId, fout },
      });
    });
  }
}
