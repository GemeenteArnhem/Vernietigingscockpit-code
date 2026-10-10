import { Logger } from "@nestjs/common";
import type { PrismaService } from "../../shared/db/prisma.service.js";
import { schrijfConfiguratieEvent, type AuditActor } from "../audit/audit-keten.js";
import { verifieerTaakKeten } from "../audit/audit.service.js";
import type { ArchiefAdapter } from "../archief/archief-adapter.js";
import { borgBewaartermijn, SLEUTEL_BEWAARTERMIJN } from "./bewaartermijn.js";
import { schrijfGrafsteen } from "./grafsteen.js";

// Verwijderen van werkkopieën na archivering (ADR-0006), volledig automatisch:
// 1. kandidaten zoeken: status archief, geslaagde archivering, termijn verstreken (klok en
//    termijn van de database);
// 2. per taak: de auditketen herberekenen en het gearchiveerde pakket opnieuw verifiëren;
//    mislukt de verificatie, dan 'Verificatie archief mislukt' en niets verwijderen;
// 3. in één transactie: grafsteen, configuratie-event 'Werkkopie verwijderd' en
//    verwijder_werkkopie(), die alle voorwaarden in de database nog eens controleert.

export const OPSCHONING_PER_RONDE = 50;

type Kandidaat = { taakinstantieId: string; archiveringId: string };

export type OpschoningUitkomst = {
  verwijderd: string[];
  verificatieMislukt: string[];
  overgeslagen: string[];
  mislukt: string[];
};

export class WerkkopieOpschoning {
  private readonly logger = new Logger(WerkkopieOpschoning.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapter: () => ArchiefAdapter,
    private readonly beginTermijn: string,
    private readonly actor: AuditActor
  ) {}

  async verwerk(heartbeat: () => Promise<void> = async () => undefined): Promise<OpschoningUitkomst> {
    await borgBewaartermijn(this.prisma, this.actor, this.beginTermijn);
    const uitkomst: OpschoningUitkomst = { verwijderd: [], verificatieMislukt: [], overgeslagen: [], mislukt: [] };

    for (const kandidaat of await this.kandidaten()) {
      await heartbeat();
      try {
        uitkomst[await this.verwijder(kandidaat)].push(kandidaat.taakinstantieId);
      } catch (error) {
        // Eén taak mag de rest niet tegenhouden; de transactie is teruggedraaid.
        this.logger.warn(`Werkkopie ${kandidaat.taakinstantieId}: verwijderen mislukt: ${error instanceof Error ? error.message : String(error)}`);
        uitkomst.mislukt.push(kandidaat.taakinstantieId);
      }
    }

    // Dan volgt een nieuwe poging volgens het retrybeleid van de job.
    if (uitkomst.mislukt.length > 0) {
      throw new Error(`Verwijderen van ${uitkomst.mislukt.length} werkkopie(ën) is mislukt: ${uitkomst.mislukt.join(", ")}.`);
    }

    return uitkomst;
  }

  private kandidaten() {
    return this.prisma.client.$queryRaw<Kandidaat[]>`
      SELECT t."id"::text AS "taakinstantieId", a."id"::text AS "archiveringId"
      FROM "taakinstantie" t
      JOIN LATERAL (
        SELECT * FROM "archivering"
        WHERE "taakinstantie_id" = t."id" AND "status" = 'SUCCESS'
        ORDER BY "afgerond_op" DESC NULLS LAST
        LIMIT 1
      ) a ON true
      JOIN "instelling" i ON i."sleutel" = ${SLEUTEL_BEWAARTERMIJN}
      WHERE t."status" = 'archief'
        AND a."afgerond_op" IS NOT NULL
        AND a."afgerond_op" + i."waarde"::interval <= now()
      ORDER BY a."afgerond_op" ASC
      LIMIT ${OPSCHONING_PER_RONDE}
    `;
  }

  private async verwijder({ taakinstantieId, archiveringId }: Kandidaat): Promise<keyof OpschoningUitkomst> {
    const db = this.prisma.client;
    const archivering = await db.archivering.findUniqueOrThrow({ where: { id: archiveringId } });
    const adapter = this.adapter();

    if (archivering.adapter !== adapter.naam || !archivering.locatie || !archivering.dossierSha256) {
      this.logger.warn(`Werkkopie ${taakinstantieId}: archivering ${archiveringId} is niet met adapter '${adapter.naam}' te verifiëren; overgeslagen.`);
      return "overgeslagen";
    }

    // Voorwaarde 5: de auditketen is intact (alle hashes herberekend).
    const keten = await verifieerTaakKeten(this.prisma, taakinstantieId);
    if (!keten.intact || !keten.laatsteHash) {
      this.logger.warn(`Werkkopie ${taakinstantieId}: de auditketen is niet intact; niet verwijderd.`);
      return "overgeslagen";
    }

    // Voorwaarde 3: het gearchiveerde pakket opnieuw verifiëren.
    let verificatie;
    try {
      verificatie = await adapter.verifieer(archivering.locatie, archivering.dossierSha256);
    } catch (error) {
      const fout = error instanceof Error ? error.message : String(error);
      await db.$transaction((tx) =>
        schrijfConfiguratieEvent(tx, this.actor, {
          eventType: "Verificatie archief mislukt",
          entiteitType: "taakinstantie",
          entiteitId: taakinstantieId,
          details: { archiveringId, locatie: archivering.locatie, fout },
        })
      );
      this.logger.warn(`Werkkopie ${taakinstantieId}: verificatie van het archiefpakket mislukt: ${fout}`);
      return "verificatieMislukt";
    }

    await db.$transaction(async (tx) => {
      const taak = await tx.taakinstantie.findUniqueOrThrow({
        where: { id: taakinstantieId },
        select: { taakdefinitieId: true, archiefvormer: true, lijstHash: true, afgerondOp: true },
      });
      const verklaring = await tx.verklaring.findFirst({
        where: { taakinstantieId },
        orderBy: { versie: "desc" },
        select: { versie: true, pdfSha256: true },
      });
      const termijn = await tx.instelling.findUniqueOrThrow({ where: { sleutel: SLEUTEL_BEWAARTERMIJN } });

      const grafsteen = await schrijfGrafsteen(tx, {
        taakinstantieId,
        taakdefinitieId: taak.taakdefinitieId,
        archiefvormer: taak.archiefvormer ?? {},
        archiveringId,
        archiefAdapter: archivering.adapter,
        archiefLocatie: archivering.locatie!,
        openzaakZaakId: archivering.openzaakZaakId,
        dossierSha256: archivering.dossierSha256!,
        verificatie,
        auditAantalEvents: keten.aantalEvents,
        auditLaatsteHash: keten.laatsteHash!,
        lijstHash: taak.lijstHash,
        verklaringPdfSha256: verklaring?.pdfSha256 ?? null,
        verklaringVersie: verklaring?.versie ?? null,
        afgerondOp: taak.afgerondOp,
        gearchiveerdOp: archivering.afgerondOp!,
        bewaartermijnWerkkopie: termijn.waarde,
      });

      await schrijfConfiguratieEvent(tx, this.actor, {
        eventType: "Werkkopie verwijderd",
        entiteitType: "taakinstantie",
        entiteitId: taakinstantieId,
        details: {
          grafsteenId: grafsteen.id.toString(),
          auditLaatsteHash: keten.laatsteHash,
          archiveringId,
          bewaartermijnWerkkopie: termijn.waarde,
        },
      });

      await tx.$executeRaw`SELECT verwijder_werkkopie(${taakinstantieId}::uuid, ${grafsteen.id}::bigint)`;
    });

    this.logger.log(`Werkkopie ${taakinstantieId} verwijderd (archivering ${archiveringId}).`);
    return "verwijderd";
  }
}
