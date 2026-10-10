import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { ConflictException, Logger } from "@nestjs/common";
import type { Outbox, Prisma } from "@prisma/client";
import type { PrismaService } from "../../shared/db/prisma.service.js";
import { schrijfAuditEvent } from "../audit/audit-keten.js";
import type { IdentificatieGegevens } from "@vernietigingscockpit/stekker-client";
import type { StekkerClient, StekkerUitvoeringsresultaat, StekkerVernietiging } from "../stekker/stekker-client.js";
import type { WorkflowService } from "../workflow/workflow.service.js";
import { claimVernietigingen, ClaimVerlorenFout, geefVernietigingVrij, type Claim, type ClaimSoort } from "./claim.js";
import { bepaalVervolg, type RetryConfig } from "./retrybeleid.js";
import {
  correlatieId,
  describeError,
  isVernietigingAfgerond,
  logRegel,
  jobNaFout,
  jobVerwerkt,
  parseDate,
  SYSTEEM,
  verbindingVan,
  vervolgToelichting,
} from "./worker-hulp.js";

// Uitvoering van een vernietiging (CC-8), in stappen die elk een eigen job zijn:
//   vernietiging:start     -> POST /vernietigingen, extern id direct vastleggen
//   vernietiging:batches   -> POST …/batches, per batch vastleggen dat hij is geaccepteerd
//   vernietiging:vrijgeven -> POST …/vrijgeven
// Daarna een statusvraag met backoff en, als de stekker klaar is, het ophalen van de
// resultaten met een integriteitscontrole. Voor elke vernietigde kandidaat haalt de worker
// daarna de MDTO-XML-specificatie op (Stekker API v2, ADR-0005 B-M2); pas als die er
// allemaal zijn, is de uitvoering afgerond.
//
// Elke stap leest eerst de eigen database en slaat over wat al is gebeurd. De
// Idempotency-Keys hangen aan het eigen vernietigingsrecord, zodat een herhaalde aanroep
// (na een fout of een gecrashte worker) bij de stekker niets dubbel doet.

export const UITVOERING_JOBS = ["vernietiging:start", "vernietiging:batches", "vernietiging:vrijgeven"] as const;
export type UitvoeringJob = (typeof UITVOERING_JOBS)[number];

export type PollConfig = { startMs: number; maxMs: number };

export function leesPollConfig(get: (sleutel: string) => string | undefined): PollConfig {
  const getal = (waarde: string | undefined, standaard: number) => {
    const n = Number(waarde);
    return Number.isInteger(n) && n > 0 ? n : standaard;
  };
  return { startMs: getal(get("WORKER_POLL_START_MS"), 2_000), maxMs: getal(get("WORKER_POLL_MAX_MS"), 60_000) };
}

export type WerkContext = {
  workerId: string;
  claim(limiet: number): Claim;
  verleng(soort: ClaimSoort, id: string): Promise<void>;
  claimdeJobs(queue: string, jobNaam: string, limiet: number): Promise<Outbox[]>;
  rondJobAf(tx: Prisma.TransactionClient, jobId: string, data: ReturnType<typeof jobVerwerkt> | ReturnType<typeof jobNaFout>): Promise<void>;
};

const vernietigingMetVerbinding = {
  selectie: { include: { stekkerConfiguratie: true } },
} satisfies Prisma.VernietigingInclude;

type VernietigingRecord = Prisma.VernietigingGetPayload<{ include: typeof vernietigingMetVerbinding }>;

export class UitvoeringVerwerker {
  private readonly logger = new Logger("Uitvoering");

  constructor(
    private readonly prisma: PrismaService,
    private readonly stekker: StekkerClient,
    private readonly workflow: WorkflowService,
    private readonly retry: RetryConfig,
    private readonly poll: PollConfig,
    private readonly werk: WerkContext
  ) {}

  // Een (mogelijk trage) externe aanroep binnen een geclaimde stap: de lease vooraf en
  // achteraf verlengen, zodat de aanroep zelf en het vastleggen erna elk een volle lease
  // hebben. Is de claim intussen van een ander, dan ClaimVerlorenFout.
  private async metLease<T>(soort: ClaimSoort, id: string, aanroep: () => Promise<T>) {
    await this.werk.verleng(soort, id);
    const resultaat = await aanroep();
    await this.werk.verleng(soort, id);
    return resultaat;
  }

  async verwerkRonde() {
    for (const jobNaam of UITVOERING_JOBS) {
      for (const job of await this.werk.claimdeJobs("vernietiging", jobNaam, 5)) {
        await this.verwerkJob(job, jobNaam);
      }
    }

    await this.pollVernietigingen();
  }

  private async verwerkJob(job: Outbox, stap: UitvoeringJob) {
    const { vernietigingId } = job.payload as { vernietigingId: string };

    try {
      const vernietiging = await this.prisma.client.vernietiging.findUniqueOrThrow({
        where: { id: vernietigingId },
        include: vernietigingMetVerbinding,
      });

      // Alleen een lopende uitvoering gaat verder; een mislukte wacht op 'opnieuw proberen'.
      if (vernietiging.status !== "LOPEND") {
        await this.prisma.client.$transaction((tx) => this.werk.rondJobAf(tx, job.id, jobVerwerkt(job.pogingen)));
        return;
      }

      if (stap === "vernietiging:start") {
        await this.start(job, vernietiging);
      } else if (stap === "vernietiging:batches") {
        await this.batches(job, vernietiging);
      } else {
        await this.vrijgeven(job, vernietiging);
      }
    } catch (error) {
      if (error instanceof ClaimVerlorenFout) {
        this.logger.warn(error.message);
        return;
      }

      await this.naFout(job, stap, vernietigingId, error);
    }
  }

  private async start(job: Outbox, vernietiging: VernietigingRecord) {
    if (vernietiging.externVernietigingId) {
      // Al gestart (de vervolgstap is toen in dezelfde transactie aangemaakt).
      await this.prisma.client.$transaction((tx) => this.werk.rondJobAf(tx, job.id, jobVerwerkt(job.pogingen)));
      return;
    }

    const externSelectieId = vernietiging.selectie.externSelectieId;

    if (!externSelectieId) {
      throw new Error("Selectie mist het selectie-id van de stekker.");
    }

    const antwoord = await this.metLease("outbox", job.id, () =>
      this.stekker.startVernietiging(
        verbindingVan(vernietiging.selectie.stekkerConfiguratie),
        {
          selectieId: externSelectieId,
          cockpitTaakId: vernietiging.taakinstantieId,
          besluitReferentie: vernietiging.besluitReferentie,
          vernietigingsdossierId: vernietiging.taakinstantieId,
        },
        `vernietiging-${vernietiging.id}`,
        correlatieId(vernietiging.taakinstantieId, job.id)
      )
    );

    await this.prisma.client.$transaction(async (tx) => {
      await tx.vernietiging.update({
        where: { id: vernietiging.id },
        data: { externVernietigingId: antwoord.vernietigingId, stekkerStatus: antwoord.status, fout: null },
      });
      await tx.outbox.create({
        data: {
          taakinstantieId: vernietiging.taakinstantieId,
          queue: "vernietiging",
          jobNaam: "vernietiging:batches",
          payload: { vernietigingId: vernietiging.id },
        },
      });
      await schrijfAuditEvent(tx, SYSTEEM, {
        taakinstantieId: vernietiging.taakinstantieId,
        eventType: "Uitvoering gestart",
        entiteitType: "taakinstantie",
        entiteitId: vernietiging.taakinstantieId,
        details: {
          vernietigingId: vernietiging.id,
          selectieId: vernietiging.selectieId,
          stekkerId: vernietiging.selectie.stekkerId,
          externVernietigingId: antwoord.vernietigingId,
          aantalKandidaten: vernietiging.aantalKandidaten,
        },
      });
      await this.werk.rondJobAf(tx, job.id, jobVerwerkt(job.pogingen));
    });
  }

  private async batches(job: Outbox, vernietiging: VernietigingRecord) {
    const externId = vernietiging.externVernietigingId;

    if (!externId) {
      throw new Error("Vernietiging heeft nog geen id van de stekker.");
    }

    // Alleen de batches die de stekker nog niet heeft geaccepteerd, in vaste volgorde.
    const open = await this.prisma.client.vernietigingBatch.findMany({
      where: { vernietigingId: vernietiging.id, geaccepteerdOp: null },
      orderBy: { batchNummer: "asc" },
      include: {
        resultaten: {
          orderBy: { kandidaat: { kandidaatId: "asc" } },
          include: { kandidaat: { select: { kandidaatId: true, identificatie: true } } },
        },
      },
    });

    for (const batch of open) {
      await this.metLease("outbox", job.id, () =>
        this.stekker.voegBatchToe(
          verbindingVan(vernietiging.selectie.stekkerConfiguratie),
          externId,
          {
            batchNummer: batch.batchNummer,
            // De identificatie letterlijk zoals de stekker hem bij de selectie leverde.
            vernietigingskandidaten: batch.resultaten.map((regel) => ({
              vernietigingskandidaatId: regel.kandidaat.kandidaatId,
              identificatie: regel.kandidaat.identificatie as unknown as IdentificatieGegevens[],
            })),
          },
          `vernietiging-${vernietiging.id}-batch-${batch.batchNummer}`,
          correlatieId(vernietiging.taakinstantieId, job.id)
        )
      );

      await this.prisma.client.$transaction(async (tx) => {
        await this.controleerClaim(tx, job.id);
        await tx.vernietigingBatch.updateMany({
          where: { id: batch.id, geaccepteerdOp: null },
          data: { geaccepteerdOp: new Date() },
        });
        await schrijfAuditEvent(tx, SYSTEEM, {
          taakinstantieId: vernietiging.taakinstantieId,
          eventType: "Batch aangeboden",
          entiteitType: "batch",
          entiteitId: batch.id,
          details: { vernietigingId: vernietiging.id, externVernietigingId: externId, batchNummer: batch.batchNummer, aantal: batch.aantal },
        });
      });
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.outbox.create({
        data: {
          taakinstantieId: vernietiging.taakinstantieId,
          queue: "vernietiging",
          jobNaam: "vernietiging:vrijgeven",
          payload: { vernietigingId: vernietiging.id },
        },
      });
      await this.werk.rondJobAf(tx, job.id, jobVerwerkt(job.pogingen));
    });
  }

  private async vrijgeven(job: Outbox, vernietiging: VernietigingRecord) {
    if (!vernietiging.vrijgegevenOp) {
      const externId = vernietiging.externVernietigingId;

      if (!externId) {
        throw new Error("Vernietiging heeft nog geen id van de stekker.");
      }

      const aantalBatches = await this.prisma.client.vernietigingBatch.count({ where: { vernietigingId: vernietiging.id } });
      const antwoord = await this.metLease("outbox", job.id, () =>
        this.stekker.geefVrij(
          verbindingVan(vernietiging.selectie.stekkerConfiguratie),
          externId,
          { aantalBatches, aantalKandidaten: vernietiging.aantalKandidaten },
          `vernietiging-${vernietiging.id}-vrijgeven`,
          correlatieId(vernietiging.taakinstantieId, job.id)
        )
      );

      await this.prisma.client.$transaction(async (tx) => {
        await tx.vernietiging.update({
          where: { id: vernietiging.id },
          data: {
            vrijgegevenOp: new Date(),
            stekkerStatus: antwoord.status,
            ...vernietigingsmethodeVan(antwoord),
            stekkerStarttijd: parseDate(antwoord.starttijd),
            volgendePollOp: new Date(),
            pollPogingen: 0,
            fout: null,
          },
        });
        await this.werk.rondJobAf(tx, job.id, jobVerwerkt(job.pogingen));
      });
      return;
    }

    await this.prisma.client.$transaction((tx) => this.werk.rondJobAf(tx, job.id, jobVerwerkt(job.pogingen)));
  }

  private async naFout(job: Outbox, stap: UitvoeringJob, vernietigingId: string, error: unknown) {
    const vervolg = bepaalVervolg(error, job.pogingen + 1, this.retry, new Date());
    const melding = `${describeError(error)}${vervolgToelichting(vervolg)}`;

    await this.prisma.client
      .$transaction(async (tx) => {
        await this.werk.rondJobAf(tx, job.id, jobNaFout(job.pogingen, vervolg, melding));

        // MISLUKT is een cockpitstatus: de taak blijft in uitvoering tot de recordmanager
        // opnieuw start; daarna gaat de uitvoering verder bij de stap die nog openstaat.
        const vernietiging = await tx.vernietiging.update({
          where: { id: vernietigingId },
          data: vervolg.status === "MISLUKT" ? { status: "MISLUKT", fout: melding } : { fout: melding },
          select: { taakinstantieId: true, selectieId: true },
        });

        if (vervolg.status === "MISLUKT") {
          await schrijfAuditEvent(tx, SYSTEEM, {
            taakinstantieId: vernietiging.taakinstantieId,
            eventType: "Uitvoering mislukt",
            entiteitType: "taakinstantie",
            entiteitId: vernietiging.taakinstantieId,
            details: {
              vernietigingId,
              selectieId: vernietiging.selectieId,
              stap,
              outboxId: job.id,
              pogingen: job.pogingen + 1,
              fout: melding,
            },
          });
        }
      })
      .catch((opslagFout: unknown) => {
        this.logger.error(logRegel(`${stap}: fout kon niet worden vastgelegd: ${describeError(opslagFout)}`, job));
      });
    this.logger.warn(logRegel(`${stap} mislukt (${vervolg.status}): ${melding}`, job));
  }

  // Statusvraag aan de stekker, met backoff; bij een afgeronde uitvoering de resultaten.
  private async pollVernietigingen() {
    const ids = await claimVernietigingen(this.prisma, this.werk.claim(20));

    for (const id of ids) {
      try {
        await this.pollEen(id);
      } catch (error) {
        if (error instanceof ClaimVerlorenFout) {
          this.logger.warn(error.message);
        } else {
          await this.naPollFout(id, error);
        }
      } finally {
        await geefVernietigingVrij(this.prisma, id, this.werk.workerId).catch(() => undefined);
      }
    }
  }

  private async pollEen(id: string) {
    const vernietiging = await this.prisma.client.vernietiging.findUniqueOrThrow({
      where: { id },
      include: vernietigingMetVerbinding,
    });
    const externId = vernietiging.externVernietigingId;

    if (!externId) {
      throw new Error("Vernietiging heeft nog geen id van de stekker.");
    }

    const verbinding = verbindingVan(vernietiging.selectie.stekkerConfiguratie);
    const corr = correlatieId(vernietiging.taakinstantieId, `poll-vernietiging-${vernietiging.id}`);
    const stand = await this.metLease("vernietiging", id, () => this.stekker.getVernietiging(verbinding, externId, corr));

    if (!isVernietigingAfgerond(stand.status)) {
      await this.prisma.client.vernietiging.updateMany({
        where: { id, status: "LOPEND", geclaimdDoor: this.werk.workerId },
        data: {
          stekkerStatus: stand.status,
          stekkerStarttijd: parseDate(stand.starttijd) ?? vernietiging.stekkerStarttijd,
          pollPogingen: vernietiging.pollPogingen + 1,
          volgendePollOp: this.volgendePoll(vernietiging.pollPogingen + 1),
          fout: null,
        },
      });
      return;
    }

    const batches = await this.metLease("vernietiging", id, () => this.stekker.getBatchResultaten(verbinding, externId, corr));
    const resultaten = batches.flatMap((batch) =>
      batch.resultaten.map((resultaat) => ({ ...resultaat, batchNummer: resultaat.batchNummer ?? batch.batchNummer }))
    );

    // 1. Resultaten vastleggen; bij een integriteitsfout direct afsluiten.
    const integer = await this.prisma.client.$transaction(async (tx) => {
      const problemen = await this.legResultatenVast(tx, vernietiging, resultaten);

      if (problemen.length === 0) {
        await this.controleerVernietigingClaim(tx, id);
        return true;
      }

      await this.sluitAf(tx, id, vernietiging, stand, {
        status: "INTEGRITEIT_MISLUKT",
        afgerondOp: null,
        fout: `Integriteitscontrole mislukt (INTEGRITY_CHECK_FAILED): ${problemen.slice(0, 5).join("; ")}.`,
      });
      await schrijfAuditEvent(tx, SYSTEEM, {
        taakinstantieId: vernietiging.taakinstantieId,
        eventType: "Uitvoering mislukt",
        entiteitType: "taakinstantie",
        entiteitId: vernietiging.taakinstantieId,
        details: { vernietigingId: id, reden: "INTEGRITY_CHECK_FAILED", problemen: problemen.slice(0, 20) },
      });
      return false;
    });

    if (!integer) {
      await this.rondTaakAf(vernietiging.taakinstantieId);
      return;
    }

    // 2. De MDTO-specificatie per vernietigde kandidaat. Gaat dit mis, dan blijft de
    //    uitvoering LOPEND en probeert de volgende statusvraag het opnieuw.
    await this.haalSpecificatiesOp(vernietiging, externId, verbinding, corr);

    // 3. Afsluiten.
    await this.prisma.client.$transaction((tx) =>
      this.sluitAf(tx, id, vernietiging, stand, {
        status: "AFGEROND",
        afgerondOp: new Date(),
        fout: stand.status === "FAILED" ? "Vernietiging mislukt bij de stekker." : null,
      })
    );

    await this.rondTaakAf(vernietiging.taakinstantieId);
  }

  // Uitvoering afsluiten, alleen als hij nog loopt en de claim nog van ons is.
  private async sluitAf(
    tx: Prisma.TransactionClient,
    id: string,
    vernietiging: VernietigingRecord,
    stand: StekkerVernietiging,
    data: { status: "AFGEROND" | "INTEGRITEIT_MISLUKT"; afgerondOp: Date | null; fout: string | null }
  ) {
    const { count } = await tx.vernietiging.updateMany({
      where: { id, status: "LOPEND", geclaimdDoor: this.werk.workerId },
      data: {
        ...data,
        stekkerStatus: stand.status,
        ...vernietigingsmethodeVan(stand),
        stekkerStarttijd: parseDate(stand.starttijd) ?? vernietiging.stekkerStarttijd,
        stekkerEindtijd: parseDate(stand.eindtijd),
      },
    });

    if (count === 0) {
      throw new ClaimVerlorenFout("vernietiging", id);
    }
  }

  private async controleerVernietigingClaim(tx: Prisma.TransactionClient, id: string) {
    const nogVanOns = await tx.vernietiging.count({ where: { id, status: "LOPEND", geclaimdDoor: this.werk.workerId } });

    if (nogVanOns === 0) {
      throw new ClaimVerlorenFout("vernietiging", id);
    }
  }

  // Specificaties ophalen voor de vernietigde kandidaten die er nog geen hebben: in brokken,
  // een paar tegelijk, met een verlengde lease per groep. De XML gaat gecomprimeerd in de
  // database, met de SHA-256 van de XML zelf.
  private async haalSpecificatiesOp(vernietiging: VernietigingRecord, externId: string, verbinding: ReturnType<typeof verbindingVan>, corr: string) {
    const BROK = 50;
    const TEGELIJK = 10;

    for (;;) {
      const open = await this.prisma.client.uitvoeringsresultaat.findMany({
        where: { vernietigingId: vernietiging.id, resultaat: "SUCCESS", specificatie: null },
        select: { id: true, kandidaat: { select: { kandidaatId: true } } },
        orderBy: { id: "asc" },
        take: BROK,
      });

      if (open.length === 0) {
        return;
      }

      const opgehaald: Array<{ id: string; xml: string }> = [];

      for (let i = 0; i < open.length; i += TEGELIJK) {
        // Heartbeat per groep: een trage stekker mag de lease niet laten verlopen.
        await this.werk.verleng("vernietiging", vernietiging.id);
        const deel = open.slice(i, i + TEGELIJK);
        opgehaald.push(
          ...(await Promise.all(
            deel.map(async (regel) => ({
              id: regel.id,
              xml: await this.stekker.getSpecificatie(verbinding, externId, regel.kandidaat.kandidaatId, corr),
            }))
          ))
        );
      }

      await this.prisma.client.$transaction(async (tx) => {
        await this.controleerVernietigingClaim(tx, vernietiging.id);

        for (const { id, xml } of opgehaald) {
          await tx.uitvoeringsresultaat.update({
            where: { id },
            data: {
              specificatie: gzipSync(Buffer.from(xml, "utf8")),
              specificatieSha256: createHash("sha256").update(xml, "utf8").digest("hex"),
            },
          });
        }
      });
      await this.werk.verleng("vernietiging", vernietiging.id);
    }
  }

  // Resultaten vastleggen per aangeboden kandidaat en controleren dat elke kandidaat
  // precies één resultaat heeft, in de batch waarin hij is aangeboden.
  private async legResultatenVast(
    tx: Prisma.TransactionClient,
    vernietiging: VernietigingRecord,
    resultaten: StekkerUitvoeringsresultaat[]
  ) {
    const regels = await tx.uitvoeringsresultaat.findMany({
      where: { vernietigingId: vernietiging.id },
      include: { kandidaat: { select: { kandidaatId: true } }, batch: { select: { id: true, batchNummer: true } } },
    });
    const perKandidaat = new Map(regels.map((regel) => [regel.kandidaat.kandidaatId, regel]));
    const gezien = new Set<string>();
    const problemen: string[] = [];
    const perBatch = new Map<string, { batchNummer: number; aantal: number; geslaagd: number }>();

    for (const resultaat of resultaten) {
      const sleutel = resultaat.vernietigingskandidaatId;
      const regel = perKandidaat.get(sleutel);

      if (!regel) {
        problemen.push(`resultaat voor onbekende kandidaat ${sleutel}`);
        continue;
      }
      if (gezien.has(sleutel)) {
        problemen.push(`meer dan één resultaat voor kandidaat ${sleutel}`);
        continue;
      }
      gezien.add(sleutel);

      if (resultaat.batchNummer !== undefined && resultaat.batchNummer !== regel.batch.batchNummer) {
        problemen.push(`kandidaat ${sleutel} gemeld in batch ${resultaat.batchNummer}, aangeboden in batch ${regel.batch.batchNummer}`);
      }
      if (regel.resultaat && regel.resultaat !== resultaat.resultaat) {
        problemen.push(`resultaat van kandidaat ${sleutel} gewijzigd van ${regel.resultaat} naar ${resultaat.resultaat}`);
        continue;
      }

      const telling = perBatch.get(regel.batch.id) ?? { batchNummer: regel.batch.batchNummer, aantal: 0, geslaagd: 0 };
      telling.aantal += 1;
      telling.geslaagd += resultaat.resultaat === "SUCCESS" ? 1 : 0;
      perBatch.set(regel.batch.id, telling);

      if (regel.resultaat) {
        continue; // al vastgelegd bij een eerdere poging
      }

      const eventTijd = resultaat.event ? parseDate(resultaat.event.eventTijd) : null;
      await tx.uitvoeringsresultaat.update({
        where: { id: regel.id },
        data: {
          resultaat: resultaat.resultaat,
          identificatie: resultaat.identificatie as unknown as Prisma.InputJsonValue,
          event: resultaat.event ? (resultaat.event as unknown as Prisma.InputJsonValue) : undefined,
          eventTijd,
          bronEventReferentie: resultaat.bronEventReferentie ?? null,
          foutcode: resultaat.foutcode ?? null,
          foutmelding: resultaat.foutmelding ?? null,
          bronstatus: resultaat.bronstatus ?? null,
          logReference: resultaat.logReference ?? null,
          correlatieId: resultaat.correlatieId ?? null,
          toelichting: resultaat.toelichting ?? null,
          ontvangenOp: new Date(),
        },
      });
      await schrijfAuditEvent(tx, SYSTEEM, {
        taakinstantieId: vernietiging.taakinstantieId,
        eventType: resultaat.resultaat === "SUCCESS" ? "Vernietigen" : "Niet vernietigd",
        entiteitType: "vernietigingskandidaat",
        entiteitId: regel.kandidaatId,
        details: {
          vernietigingId: vernietiging.id,
          batchNummer: regel.batch.batchNummer,
          kandidaatId: sleutel,
          resultaat: resultaat.resultaat,
          ...(eventTijd ? { eventTijd: eventTijd.toISOString() } : {}),
          ...(resultaat.foutcode ? { foutcode: resultaat.foutcode } : {}),
          ...(resultaat.foutmelding ? { foutmelding: resultaat.foutmelding } : {}),
          ...(resultaat.logReference ? { logReference: resultaat.logReference } : {}),
        },
      });
    }

    const ontbrekend = regels.filter((regel) => !gezien.has(regel.kandidaat.kandidaatId)).length;
    if (ontbrekend > 0) {
      problemen.push(`${ontbrekend} van ${regels.length} kandidaten zonder resultaat`);
    }

    if (problemen.length === 0) {
      // Alleen batches die het event nog niet hebben: een herhaalde statusvraag (bijvoorbeeld
      // terwijl de specificaties nog worden opgehaald) schrijft geen dubbele events.
      const alGemeld = new Set(
        (
          await tx.auditEvent.findMany({
            where: { taakinstantieId: vernietiging.taakinstantieId, eventType: "Batch verwerkt", entiteitId: { in: [...perBatch.keys()] } },
            select: { entiteitId: true },
          })
        ).map((event) => event.entiteitId)
      );

      for (const [batchId, telling] of [...perBatch.entries()]
        .filter(([batchId]) => !alGemeld.has(batchId))
        .sort(([, a], [, b]) => a.batchNummer - b.batchNummer)) {
        await schrijfAuditEvent(tx, SYSTEEM, {
          taakinstantieId: vernietiging.taakinstantieId,
          eventType: "Batch verwerkt",
          entiteitType: "batch",
          entiteitId: batchId,
          details: { vernietigingId: vernietiging.id, ...telling },
        });
      }
    }

    return problemen;
  }

  private async naPollFout(id: string, error: unknown) {
    const vernietiging = await this.prisma.client.vernietiging.findUnique({ where: { id } });

    if (!vernietiging) {
      return;
    }

    const vervolg = bepaalVervolg(error, vernietiging.pollPogingen + 1, { ...this.retry, maxPogingen: Number.MAX_SAFE_INTEGER }, new Date());
    const melding = `Status opvragen mislukt: ${describeError(error)}`;
    const pollJob = { id: `poll-vernietiging-${id}`, taakinstantieId: vernietiging.taakinstantieId };

    await this.prisma.client
      .$transaction(async (tx) => {
        const { count } = await tx.vernietiging.updateMany({
          where: { id, status: "LOPEND", geclaimdDoor: this.werk.workerId },
          data:
            vervolg.status === "MISLUKT"
              ? { status: "MISLUKT", fout: `${melding}${vervolgToelichting(vervolg)}` }
              : { fout: melding, pollPogingen: vernietiging.pollPogingen + 1, volgendePollOp: this.volgendePoll(vernietiging.pollPogingen + 1) },
        });

        if (count === 1 && vervolg.status === "MISLUKT") {
          await schrijfAuditEvent(tx, SYSTEEM, {
            taakinstantieId: vernietiging.taakinstantieId,
            eventType: "Uitvoering mislukt",
            entiteitType: "taakinstantie",
            entiteitId: vernietiging.taakinstantieId,
            details: { vernietigingId: id, stap: "status-opvragen", fout: melding },
          });
        }
      })
      .catch((opslagFout: unknown) => {
        this.logger.error(logRegel(`poll vernietiging: fout kon niet worden vastgelegd: ${describeError(opslagFout)}`, pollJob));
      });
    this.logger.warn(logRegel(`poll vernietiging mislukt: ${melding}`, pollJob));
  }

  private volgendePoll(poging: number) {
    return new Date(Date.now() + Math.min(this.poll.startMs * 2 ** Math.max(0, poging - 1), this.poll.maxMs));
  }

  // De taak gaat naar 'resultaat' als elke vernietiging is afgerond en er geen
  // uitvoeringsjob meer openstaat. Een mislukte of onvolledige uitvoering telt niet als klaar.
  private async rondTaakAf(taakinstantieId: string) {
    const [nietAfgerond, openJobs] = await Promise.all([
      this.prisma.client.vernietiging.count({ where: { taakinstantieId, status: { not: "AFGEROND" } } }),
      this.prisma.client.outbox.count({ where: { taakinstantieId, queue: "vernietiging", status: "OPEN" } }),
    ]);

    if (nietAfgerond > 0 || openJobs > 0) {
      return;
    }

    try {
      await this.prisma.client.$transaction(async (tx) => {
        await this.workflow.transition(tx, {
          taakinstantieId,
          actie: "uitvoering.voltooid",
          actor: SYSTEEM,
          extraData: { afgerondOp: new Date() },
        });
        // De vernietigingsverklaring maakt de worker als eigen job (CC-17), in dezelfde
        // transactie als de overgang: geen resultaat zonder verklaring-opdracht.
        await tx.outbox.create({
          data: {
            taakinstantieId,
            queue: "verklaring",
            jobNaam: "verklaring:genereer",
            payload: { taakinstantieId },
          },
        });
      });
    } catch (error) {
      // Al afgerond door een eerdere ronde of een andere worker: niets te doen.
      if (!(error instanceof ConflictException)) {
        throw error;
      }
    }
  }

  private async controleerClaim(tx: Prisma.TransactionClient, jobId: string) {
    const nogVanOns = await tx.outbox.count({ where: { id: jobId, geclaimdDoor: this.werk.workerId } });

    if (nogVanOns === 0) {
      throw new ClaimVerlorenFout("job", jobId);
    }
  }
}

// De wijze van vernietiging zoals de stekker die vanaf vrijgave meldt (ADR-0005, B-M4).
function vernietigingsmethodeVan(antwoord: StekkerVernietiging) {
  return {
    ...(antwoord.vernietigingsmethode
      ? { vernietigingsmethode: antwoord.vernietigingsmethode as unknown as Prisma.InputJsonValue }
      : {}),
    ...(antwoord.vernietigingsmethodeToelichting
      ? { vernietigingsmethodeToelichting: antwoord.vernietigingsmethodeToelichting }
      : {}),
  };
}
