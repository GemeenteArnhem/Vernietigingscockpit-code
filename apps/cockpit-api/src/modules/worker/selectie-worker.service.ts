import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../shared/db/prisma.service.js";
import { WorkflowService } from "../workflow/workflow.service.js";
import {
  claimJobs,
  claimSelecties,
  ClaimVerlorenFout,
  geefSelectieVrij,
  leesLeaseMs,
  maakWorkerId,
  verlengClaim,
  type ClaimSoort,
  type SelectieWerk,
} from "./claim.js";
import { bepaalVervolg, leesRetryConfig, type RetryConfig } from "./retrybeleid.js";
import { UITSLUITREDEN_WAARDERING } from "@vernietigingscockpit/api-contract";
import { schrijfAuditEvent } from "../audit/audit-keten.js";
import {
  StekkerClient,
  type StekkerKandidaat,
  type StekkerSelectie,
  type StekkerVerbinding,
} from "../stekker/stekker-client.js";
import { mapKandidaatData } from "./kandidaat-mapping.js";
import { leesPollConfig, UitvoeringVerwerker } from "./uitvoering.js";
import { VerklaringMaker } from "../verklaring/verklaring-maker.js";
import { archiefAdapterVan, ArchiveringVerwerker } from "../archief/archivering.js";
import { beginwaarde, ISO_DUUR } from "../werkkopie/bewaartermijn.js";
import { WerkkopieOpschoning } from "../werkkopie/opschoning.js";
import {
  correlatieId,
  describeError,
  logRegel,
  jobNaFout,
  jobVerwerkt,
  parseDate,
  SYSTEEM,
  verbindingVan,
  vervolgToelichting,
} from "./worker-hulp.js";

type SelectieStartPayload = {
  selectieId: string;
  peildatum?: string | null;
};

@Injectable()
export class SelectieWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SelectieWorkerService.name);
  private intervalHandle: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;
  private readonly retry: RetryConfig;
  private readonly workerId: string;
  private readonly leaseMs: number;
  private readonly uitvoering: UitvoeringVerwerker;
  private readonly verklaringMaker: VerklaringMaker;
  private readonly archivering: ArchiveringVerwerker;
  private readonly opschoning: WerkkopieOpschoning;
  private readonly opschoningInterval: string;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(StekkerClient) private readonly stekker: StekkerClient,
    @Inject(WorkflowService) private readonly workflow: WorkflowService
  ) {
    this.retry = leesRetryConfig((sleutel) => this.config.get<string>(sleutel));
    this.workerId = maakWorkerId(this.config.get<string>("WORKER_ID"));
    this.leaseMs = leesLeaseMs(this.config.get<string>("WORKER_LEASE_MS"));
    this.verklaringMaker = new VerklaringMaker(this.prisma, this.config);
    this.archivering = new ArchiveringVerwerker(this.prisma, this.workflow, () => archiefAdapterVan(this.config));
    this.opschoning = new WerkkopieOpschoning(
      this.prisma,
      () => archiefAdapterVan(this.config),
      beginwaarde(this.config.get<string>("WERKKOPIE_BEWAARTERMIJN")),
      SYSTEEM
    );
    this.opschoningInterval = this.config.get<string>("OPSCHONING_INTERVAL")?.trim() || "P1D";
    if (!ISO_DUUR.test(this.opschoningInterval)) {
      throw new Error(`OPSCHONING_INTERVAL moet een ISO 8601-duur zijn (bijv. P1D of PT1H), niet '${this.opschoningInterval}'.`);
    }
    this.uitvoering = new UitvoeringVerwerker(
      this.prisma,
      this.stekker,
      this.workflow,
      this.retry,
      leesPollConfig((sleutel) => this.config.get<string>(sleutel)),
      {
        workerId: this.workerId,
        claim: (limiet) => this.claim(limiet),
        verleng: (soort, id) => this.verleng(soort, id),
        claimdeJobs: (queue, jobNaam, limiet) => this.claimdeJobs(queue, jobNaam, limiet),
        rondJobAf: (tx, jobId, data) => this.rondJobAf(tx, jobId, data),
      }
    );
  }

  // In de API draait de worker standaard niet (CC-7): de worker is een eigen proces
  // (src/worker.ts). SELECTIE_WORKER_ENABLED=true zet hem toch in het API-proces aan,
  // bijvoorbeeld voor lokale ontwikkeling met één proces.
  onModuleInit() {
    if (this.config.get<string>("SELECTIE_WORKER_ENABLED") === "true") {
      this.start();
    }
  }

  start() {
    if (this.intervalHandle) {
      return;
    }

    const intervalMs =
      Number(this.config.get<string>("SELECTIE_WORKER_INTERVAL_MS")) || 5000;

    this.intervalHandle = setInterval(() => {
      void this.tick();
    }, intervalMs);
    void this.tick();
    this.logger.log(
      `Worker ${this.workerId} gestart met interval ${intervalMs}ms en lease ${this.leaseMs}ms.`
    );
  }

  // Bij afsluiten (SIGTERM): geen nieuwe rondes, en de lopende ronde netjes afmaken.
  async onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    await this.running;
  }

  private async tick() {
    if (this.running) {
      return;
    }

    this.running = this.verwerkRonde()
      .catch((error: unknown) => {
        this.logger.warn(`Worker-ronde mislukt: ${describeError(error)}`);
      })
      .finally(() => {
        this.running = null;
      });
    await this.running;
  }

  // Eén volledige verwerkingsronde; ook direct aanroepbaar vanuit tests.
  async verwerkRonde() {
    await this.processStartJobs();
    await this.pollRunningSelecties();
    await this.importReadySelecties();
    await this.uitvoering.verwerkRonde();
    await this.verwerkVerklaringJobs();
    await this.verwerkArchiefJobs();
    await this.verwerkOpschoning();
  }

  // Verwijderen van werkkopieën na archivering (ADR-0006): een periodieke job in de queue
  // `opschoning` (standaard dagelijks, OPSCHONING_INTERVAL). Alleen met een archieflocatie:
  // zonder archivering is er niets te verwijderen.
  private async verwerkOpschoning() {
    if (!this.config.get<string>("ARCHIEF_PAD")?.trim()) {
      return;
    }

    await this.planOpschoning();

    for (const job of await this.claimdeJobs("opschoning", "opschoning:werkkopieen", 1)) {
      try {
        const uitkomst = await this.opschoning.verwerk(() => this.verleng("outbox", job.id));
        await this.prisma.client.$transaction((tx) => this.rondJobAf(tx, job.id, jobVerwerkt(job.pogingen)));
        if (uitkomst.verwijderd.length || uitkomst.verificatieMislukt.length) {
          this.logger.log(
            `opschoning: ${uitkomst.verwijderd.length} werkkopie(ën) verwijderd, ${uitkomst.verificatieMislukt.length} keer verificatie mislukt.`
          );
        }
      } catch (error) {
        if (error instanceof ClaimVerlorenFout) {
          this.logger.warn(error.message);
          continue;
        }

        const vervolg = bepaalVervolg(error, job.pogingen + 1, this.retry, new Date());
        const melding = `${describeError(error)}${vervolgToelichting(vervolg)}`;

        await this.prisma.client
          .$transaction((tx) => this.rondJobAf(tx, job.id, jobNaFout(job.pogingen, vervolg, melding)))
          .catch((opslagFout: unknown) => {
            this.logger.error(logRegel(`opschoning: fout kon niet worden vastgelegd: ${describeError(opslagFout)}`, job));
          });
        this.logger.warn(logRegel(`opschoning mislukt (${vervolg.status}): ${melding}`, job));
      }
    }
  }

  // Er staat altijd precies één open opschoningsjob klaar: de eerste direct, daarna steeds
  // OPSCHONING_INTERVAL na de vorige (klok van de database).
  private async planOpschoning() {
    await this.prisma.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS vergrendeld FROM pg_advisory_xact_lock(hashtext(${"opschoning:planning"}::text))`;

      if (await tx.outbox.count({ where: { queue: "opschoning", status: "OPEN" } })) {
        return;
      }

      const eerder = await tx.outbox.count({ where: { queue: "opschoning" } });
      const [{ tijdstip }] = await tx.$queryRaw<Array<{ tijdstip: Date }>>`
        SELECT now() + (CASE WHEN ${eerder > 0} THEN ${this.opschoningInterval}::interval ELSE interval '0' END) AS tijdstip`;

      await tx.outbox.create({
        data: { queue: "opschoning", jobNaam: "opschoning:werkkopieen", payload: {}, volgendePogingOp: tijdstip },
      });
    });
  }

  // Vernietigingsverklaring maken (CC-17), met hetzelfde retrybeleid als de stekkerjobs:
  // is Gotenberg even weg, dan volgt een nieuwe poging met backoff.
  private async verwerkVerklaringJobs() {
    for (const job of await this.claimdeJobs("verklaring", "verklaring:genereer", 2)) {
      const { taakinstantieId } = job.payload as { taakinstantieId: string };

      try {
        await this.metLease("outbox", job.id, () => this.verklaringMaker.genereer(taakinstantieId, SYSTEEM));
        await this.prisma.client.$transaction((tx) => this.rondJobAf(tx, job.id, jobVerwerkt(job.pogingen)));
      } catch (error) {
        if (error instanceof ClaimVerlorenFout) {
          this.logger.warn(error.message);
          continue;
        }

        const vervolg = bepaalVervolg(error, job.pogingen + 1, this.retry, new Date());
        const melding = `${describeError(error)}${vervolgToelichting(vervolg)}`;

        await this.prisma.client
          .$transaction((tx) => this.rondJobAf(tx, job.id, jobNaFout(job.pogingen, vervolg, melding)))
          .catch((opslagFout: unknown) => {
            this.logger.error(logRegel(`verklaring:genereer: fout kon niet worden vastgelegd: ${describeError(opslagFout)}`, job));
          });
        this.logger.warn(logRegel(`verklaring:genereer mislukt (${vervolg.status}): ${melding}`, job));
      }
    }
  }

  // Archiveren van het dossier (CC-18). Lukt het na de nieuwe pogingen niet, dan staat de
  // archivering op FAILED en kan de recordmanager opnieuw archiveren.
  private async verwerkArchiefJobs() {
    for (const job of await this.claimdeJobs("archief", "archief:archiveer", 2)) {
      const { archiveringId } = job.payload as { archiveringId: string };

      try {
        await this.metLease("outbox", job.id, () => this.archivering.archiveer(archiveringId, SYSTEEM));
        await this.prisma.client.$transaction((tx) => this.rondJobAf(tx, job.id, jobVerwerkt(job.pogingen)));
      } catch (error) {
        if (error instanceof ClaimVerlorenFout) {
          this.logger.warn(error.message);
          continue;
        }

        const vervolg = bepaalVervolg(error, job.pogingen + 1, this.retry, new Date());
        const melding = `${describeError(error)}${vervolgToelichting(vervolg)}`;

        await this.prisma.client
          .$transaction((tx) => this.rondJobAf(tx, job.id, jobNaFout(job.pogingen, vervolg, melding)))
          .catch((opslagFout: unknown) => {
            this.logger.error(logRegel(`archief:archiveer: fout kon niet worden vastgelegd: ${describeError(opslagFout)}`, job));
          });

        if (vervolg.status === "MISLUKT") {
          await this.archivering.mislukt(archiveringId, melding, SYSTEEM).catch((opslagFout: unknown) => {
            this.logger.error(logRegel(`archief:archiveer: status kon niet worden vastgelegd: ${describeError(opslagFout)}`, job));
          });
        }
        this.logger.warn(logRegel(`archief:archiveer mislukt (${vervolg.status}): ${melding}`, job));
      }
    }
  }

  private async processStartJobs() {
    const jobs = await this.claimdeJobs("selectie", "selectie:start", 10);

    for (const job of jobs) {
      const payload = job.payload as SelectieStartPayload;

      try {
        const selectie = await this.prisma.client.selectie.findUniqueOrThrow({
          where: { id: payload.selectieId },
          include: {
            stekkerConfiguratie: true,
          },
        });
        const response = await this.metLease("outbox", job.id, () =>
          this.stekker.startSelectie(
            verbindingVan(selectie.stekkerConfiguratie),
            formatDateOnly(payload.peildatum),
            // Vaste sleutel per eigen selectierecord (ADR-0004): een herhaalde start na een
            // gemist antwoord levert bij de stekker dezelfde selectie op.
            `selectie-${selectie.id}`,
            correlatieId(job.taakinstantieId, job.id)
          )
        );
        const status = cockpitSelectieStatus(response);

        await this.prisma.client.$transaction(async (tx) => {
          await tx.selectie.update({
            where: { id: selectie.id },
            data: {
              externSelectieId: response.selectieId,
              status,
              peildatum: parseDate(response.peildatum) ?? selectie.peildatum,
              selectietijdstip:
                parseDate(response.selectietijdstip) ?? selectie.selectietijdstip,
              totaalKandidaten:
                response.totaalKandidaten ?? selectie.totaalKandidaten,
              totaalObjecten: response.totaalObjecten ?? selectie.totaalObjecten,
              totaalBetrokkenen:
                response.totaalBetrokkenen ?? selectie.totaalBetrokkenen,
              stekkerversie: response.stekkerversie,
              configuratieversie:
                response.configuratieversie ?? selectie.configuratieversie,
              apiVersie: response.apiVersie,
              fout: status === "FAILED" ? selectieFoutmelding(response) : null,
            },
          });
          await this.rondJobAf(tx, job.id, jobVerwerkt(job.pogingen));
        });
      } catch (error) {
        if (error instanceof ClaimVerlorenFout) {
          this.logger.warn(error.message);
          continue;
        }

        const vervolg = bepaalVervolg(error, job.pogingen + 1, this.retry, new Date());
        const melding = `${describeError(error)}${vervolgToelichting(vervolg)}`;

        await this.prisma.client
          .$transaction(async (tx) => {
            await tx.selectie.update({
              where: { id: payload.selectieId },
              // Bij een geplande nieuwe poging blijft de selectie AANGEVRAAGD; de fout is zichtbaar.
              data: vervolg.status === "MISLUKT" ? { status: "FAILED", fout: melding } : { fout: melding },
            });
            await this.rondJobAf(tx, job.id, jobNaFout(job.pogingen, vervolg, melding));
          })
          .catch((opslagFout: unknown) => {
            this.logger.error(logRegel(`selectie:start: fout kon niet worden vastgelegd: ${describeError(opslagFout)}`, job));
          });
        this.logger.warn(logRegel(`selectie:start mislukt (${vervolg.status}): ${melding}`, job));
      }
    }
  }

  private async pollRunningSelecties() {
    await this.metGeclaimdeSelecties("poll-selectie", 20, (selecties) => this.pollSelecties(selecties));
  }

  private async pollSelecties(ids: string[]) {
    const selecties = await this.prisma.client.selectie.findMany({
      where: { id: { in: ids } },
      include: {
        stekkerConfiguratie: true,
      },
    });

    for (const selectie of selecties) {
      if (!selectie.externSelectieId) {
        continue;
      }

      // Time-out per selectie (CC-16): na selectieMs zonder resultaat wordt het FAILED.
      const timeoutMs = leesSelectieTimeoutMs(selectie.stekkerConfiguratie.timeouts);
      const gestart = selectie.selectietijdstip?.getTime();

      if (gestart !== undefined && Date.now() - gestart > timeoutMs) {
        const melding = `Selectie niet binnen ${formatDuur(timeoutMs)} klaar bij de stekker (time-out). Herkansen kan via de cockpit.`;
        await this.prisma.client.selectie.update({
          where: { id: selectie.id },
          data: { status: "FAILED", fout: melding },
        });
        this.logger.warn(logRegel(melding, pollJob(selectie)));
        continue;
      }

      try {
        const externSelectieId = selectie.externSelectieId;
        const response = await this.metLease("selectie", selectie.id, () =>
          this.stekker.getSelectie(
            verbindingVan(selectie.stekkerConfiguratie),
            externSelectieId,
            correlatieId(selectie.taakinstantieId, `poll-selectie-${selectie.id}`)
          )
        );
        const status = cockpitSelectieStatus(response);

        await this.prisma.client.selectie.update({
          where: { id: selectie.id },
          data: {
            status,
            peildatum: parseDate(response.peildatum) ?? selectie.peildatum,
            selectietijdstip:
              parseDate(response.selectietijdstip) ?? selectie.selectietijdstip,
            totaalKandidaten:
              response.totaalKandidaten ?? selectie.totaalKandidaten,
            totaalObjecten: response.totaalObjecten ?? selectie.totaalObjecten,
            totaalBetrokkenen:
              response.totaalBetrokkenen ?? selectie.totaalBetrokkenen,
            stekkerversie: response.stekkerversie ?? selectie.stekkerversie,
            configuratieversie:
              response.configuratieversie ?? selectie.configuratieversie,
            apiVersie: response.apiVersie ?? selectie.apiVersie,
            fout: status === "FAILED" ? selectieFoutmelding(response) : null,
            pollFouten: 0,
            volgendePollOp: null,
          },
        });
      } catch (error) {
        if (error instanceof ClaimVerlorenFout) {
          this.logger.warn(error.message);
          continue;
        }

        // Een haperende statusvraag maakt de selectie niet direct FAILED (CC-16): tijdelijke
        // fouten opnieuw met backoff, definitieve fouten (4xx) of te veel op rij wel.
        const vervolg = bepaalVervolg(error, selectie.pollFouten + 1, this.retry, new Date());
        const melding = `Status opvragen mislukt: ${describeError(error)}${vervolgToelichting(vervolg)}`;

        await this.prisma.client.selectie
          .update({
            where: { id: selectie.id },
            data:
              vervolg.status === "MISLUKT"
                ? { status: "FAILED", fout: melding, pollFouten: selectie.pollFouten + 1 }
                : { fout: melding, pollFouten: selectie.pollFouten + 1, volgendePollOp: vervolg.volgendePogingOp },
          })
          .catch((opslagFout: unknown) => {
            this.logger.error(logRegel(`poll selectie: fout kon niet worden vastgelegd: ${describeError(opslagFout)}`, pollJob(selectie)));
          });
        this.logger.warn(logRegel(`poll selectie mislukt (${vervolg.status}): ${melding}`, pollJob(selectie)));
      }
    }
  }

  private async importReadySelecties() {
    await this.metGeclaimdeSelecties("import-selectie", 5, (selecties) => this.importSelecties(selecties));
  }

  private async importSelecties(ids: string[]) {
    const selecties = await this.prisma.client.selectie.findMany({
      where: { id: { in: ids } },
      include: {
        stekkerConfiguratie: true,
        taakinstantie: {
          select: {
            id: true,
          },
        },
      },
    });

    for (const selectie of selecties) {
      if (!selectie.externSelectieId) {
        continue;
      }

      try {
        const imported = await this.importSelectieKandidaten({
          taakinstantieId: selectie.taakinstantie.id,
          selectieId: selectie.id,
          externSelectieId: selectie.externSelectieId,
          verbinding: verbindingVan(selectie.stekkerConfiguratie),
          correlatieId: correlatieId(selectie.taakinstantie.id, `import-selectie-${selectie.id}`),
        });

        await this.prisma.client.$transaction(async (tx) => {
          await tx.selectie.update({
            where: { id: selectie.id },
            data: {
              status: "GEIMPORTEERD",
              geimporteerd: imported,
              fout: null,
            },
          });

          // Alle actieve selecties geïmporteerd? Vervangen selecties tellen niet mee.
          const remaining = await tx.selectie.count({
            where: {
              taakinstantieId: selectie.taakinstantie.id,
              status: {
                notIn: ["GEIMPORTEERD", "VERVANGEN"],
              },
            },
          });

          if (remaining === 0) {
            await this.workflow.transition(tx, {
              taakinstantieId: selectie.taakinstantie.id,
              actie: "selectie.voltooid",
              actor: SYSTEEM,
              details: { laatsteSelectieId: selectie.id },
              extraData: { gestartOp: new Date() },
            });
          }
        });
      } catch (error) {
        if (error instanceof ClaimVerlorenFout) {
          this.logger.warn(error.message);
          continue;
        }

        await this.prisma.client.selectie.update({
          where: { id: selectie.id },
          data: {
            status: "FAILED",
            fout: describeError(error),
          },
        });
        this.logger.warn(
          logRegel(`import selectie mislukt: ${describeError(error)}`, {
            id: `import-selectie-${selectie.id}`,
            taakinstantieId: selectie.taakinstantie.id,
          })
        );
      }
    }
  }

  // Kandidaten met een waardering anders dan V (Blijvend te bewaren of Nader te bepalen) sluit
  // het systeem direct uit, met een vaste reden en een audit-event (ADR-0005, B-M1). Alleen
  // kandidaten die nog niet zijn uitgesloten: een herhaalde import schrijft niets dubbel.
  private async sluitNietVUit(taakinstantieId: string, selectieId: string, kandidaten: StekkerKandidaat[]) {
    const nietV = kandidaten.filter((kandidaat) => kandidaat.waardering.begripCode !== "V");

    if (nietV.length === 0) {
      return;
    }

    await this.prisma.client.$transaction(async (tx) => {
      const open = await tx.vernietigingskandidaat.findMany({
        where: {
          selectieId,
          kandidaatId: { in: nietV.map((kandidaat) => kandidaat.vernietigingskandidaatId.trim()) },
          uitsluitReden: null,
        },
        select: { id: true, kandidaatId: true, waarderingBegripCode: true, waarderingBegripLabel: true },
      });

      for (const kandidaat of open) {
        const toelichting = `Waardering ${kandidaat.waarderingBegripCode} (${kandidaat.waarderingBegripLabel}) volgens de stekker; alleen V (Tijdelijk te bewaren) kan worden vernietigd.`;
        await tx.vernietigingskandidaat.update({
          where: { id: kandidaat.id },
          data: { beoordeling: "UITGESLOTEN", uitsluitReden: UITSLUITREDEN_WAARDERING, toelichting, beoordeeldOp: new Date() },
        });
        await schrijfAuditEvent(tx, SYSTEEM, {
          taakinstantieId,
          eventType: "Kandidaat uitgesloten",
          entiteitType: "vernietigingskandidaat",
          entiteitId: kandidaat.id,
          details: {
            kandidaatId: kandidaat.kandidaatId,
            beoordeling: "UITGESLOTEN",
            uitsluitReden: UITSLUITREDEN_WAARDERING,
            waardering: kandidaat.waarderingBegripCode,
            automatisch: true,
          },
        });
      }
    });
  }

  private async importSelectieKandidaten(input: {
    taakinstantieId: string;
    selectieId: string;
    externSelectieId: string;
    verbinding: StekkerVerbinding;
    correlatieId: string;
  }) {
    const limit = 500;
    let offset = 0;
    let imported = 0;
    let total: number | null = null;

    do {
      const page = await this.metLease("selectie", input.selectieId, () =>
        this.stekker.getKandidaten(
          input.verbinding,
          input.externSelectieId,
          { offset, limit },
          input.correlatieId
        )
      );

      total = page.totaal ?? null;

      if (page.items.length > 0) {
        await this.prisma.client.$transaction(
          page.items.map((kandidaat) =>
            this.prisma.client.vernietigingskandidaat.upsert({
              where: {
                selectieId_kandidaatId: {
                  selectieId: input.selectieId,
                  kandidaatId: requiredString(
                    kandidaat.vernietigingskandidaatId,
                    "vernietigingskandidaatId"
                  ),
                },
              },
              update: mapKandidaatData(input.selectieId, kandidaat),
              create: mapKandidaatData(input.selectieId, kandidaat),
            })
          )
        );
        await this.sluitNietVUit(input.taakinstantieId, input.selectieId, page.items);
      }

      imported += page.items.length;
      offset += page.items.length;
    } while (total !== null && imported < total && offset > 0);

    if (total !== null && imported !== total) {
      throw new Error(
        `Aantal geimporteerde kandidaten (${imported}) komt niet overeen met totaal (${total}).`
      );
    }

    return imported;
  }

  // Claimt open jobs (FOR UPDATE SKIP LOCKED + lease) en laadt ze in volgorde.
  private async claimdeJobs(queue: string, jobNaam: string, limiet: number) {
    const ids = await claimJobs(this.prisma, queue, jobNaam, this.claim(limiet));

    if (ids.length === 0) {
      return [];
    }

    return this.prisma.client.outbox.findMany({
      where: { id: { in: ids } },
      orderBy: { aangemaaktOp: "asc" },
    });
  }

  // Legt het einde van een job vast, maar alleen als de claim nog van deze worker is.
  // Anders rolt de transactie terug: een andere worker heeft de job overgenomen.
  private async rondJobAf(
    tx: Prisma.TransactionClient,
    jobId: string,
    data: ReturnType<typeof jobVerwerkt> | ReturnType<typeof jobNaFout>
  ) {
    const { count } = await tx.outbox.updateMany({
      where: { id: jobId, geclaimdDoor: this.workerId },
      data: { ...data, geclaimdTot: null, geclaimdDoor: null },
    });

    if (count === 0) {
      throw new ClaimVerlorenFout("job", jobId);
    }
  }

  private async metGeclaimdeSelecties(werk: SelectieWerk, limiet: number, verwerk: (ids: string[]) => Promise<void>) {
    const ids = await claimSelecties(this.prisma, werk, this.claim(limiet));

    if (ids.length === 0) {
      return;
    }

    try {
      await verwerk(ids);
    } finally {
      for (const id of ids) {
        await geefSelectieVrij(this.prisma, id, this.workerId).catch((error: unknown) => {
          this.logger.warn(`claim op selectie ${id} niet vrijgegeven: ${describeError(error)}`);
        });
      }
    }
  }

  private verleng(soort: ClaimSoort, id: string) {
    return verlengClaim(this.prisma, soort, id, this.workerId, this.leaseMs);
  }

  // Een (mogelijk trage) externe aanroep binnen een geclaimde stap: de lease vooraf en
  // achteraf verlengen, zodat de aanroep zelf en het vastleggen erna elk een volle lease
  // hebben. Is de claim intussen van een ander, dan ClaimVerlorenFout.
  private async metLease<T>(soort: ClaimSoort, id: string, aanroep: () => Promise<T>) {
    await this.verleng(soort, id);
    const resultaat = await aanroep();
    await this.verleng(soort, id);
    return resultaat;
  }

  private claim(limiet: number) {
    return { worker: this.workerId, leaseMs: this.leaseMs, nu: new Date(), limiet };
  }

}

const STANDAARD_SELECTIE_TIMEOUT_MS = 24 * 60 * 60 * 1000;

// stekker_configuratie.timeouts.selectieMs, standaard 24 uur.
export function leesSelectieTimeoutMs(timeouts: unknown) {
  const waarde =
    timeouts && typeof timeouts === "object" && !Array.isArray(timeouts)
      ? (timeouts as Record<string, unknown>).selectieMs
      : undefined;

  return typeof waarde === "number" && Number.isFinite(waarde) && waarde > 0 ? waarde : STANDAARD_SELECTIE_TIMEOUT_MS;
}

function formatDuur(ms: number) {
  const minuten = Math.round(ms / 60_000);
  return minuten >= 60 && minuten % 60 === 0 ? `${minuten / 60} uur` : `${minuten} minuten`;
}

// Logcontext van een statusvraag, met dezelfde correlatie-id als naar de stekker.
function pollJob(selectie: { id: string; taakinstantieId: string }) {
  return { id: `poll-selectie-${selectie.id}`, taakinstantieId: selectie.taakinstantieId };
}

// Spec-status naar de interne selectiestatus van de cockpit
// (AANGEVRAAGD/RUNNING/READY/GEIMPORTEERD/FAILED). De spec kent IDLE als 'nog niet gestart'.
function cockpitSelectieStatus(selectie: StekkerSelectie) {
  return selectie.status === "IDLE" ? "AANGEVRAAGD" : selectie.status;
}

// De spec geeft geen foutmelding bij een mislukte selectie, alleen aantalFouten.
function selectieFoutmelding(selectie: StekkerSelectie) {
  return `Selectie mislukt bij de stekker (aantalFouten: ${selectie.aantalFouten ?? "onbekend"}).`;
}

function formatDateOnly(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = parseDate(value);

  return date?.toISOString().slice(0, 10) ?? null;
}

function requiredString(value: string | undefined, field: string) {
  if (!value?.trim()) {
    throw new Error(`Stekkerobject mist verplicht veld ${field}.`);
  }

  return value.trim();
}

