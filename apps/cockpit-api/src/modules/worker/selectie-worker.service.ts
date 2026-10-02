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

type SelectieStartPayload = {
  selectieId: string;
  peildatum?: string | null;
};

type VernietigingStartPayload = {
  taakinstantieId: string;
  selectieId: string;
  kandidaten: Array<{
    kandidaatId: string;
    bronId: string;
  }>;
};

type StekkerSelectieResponse = {
  selectieId?: string;
  selectiestatus?: string;
  status?: string;
  peildatum?: string;
  selectietijdstip?: string;
  totaalKandidaten?: number;
  totaalObjecten?: number;
  totaalBetrokkenen?: number;
  stekkerversie?: string;
  configuratieversie?: string;
  apiVersie?: string;
  foutmelding?: string;
};

type StekkerKandidaat = {
  vernietigingskandidaatId?: string;
  omschrijving?: string;
  classificatieschema?: string;
  classificatiesleutel?: string;
  classificatieomschrijving?: string;
  selectielijst?: string;
  grondslag?: string;
  grondslagAfwijkend?: string;
  resultaat?: string;
  bewaartermijn?: string;
  waardering?: string;
  begindatum?: string;
  einddatum?: string;
  vernietigingsdatum?: string;
  aantalObjecten?: number;
  aantalBetrokkenen?: number;
  bronIdNaam?: string;
  bronId?: string;
  relatieType?: string;
  relatieId?: string;
};

type StekkerObjectenResponse = {
  selectieId: string;
  offset: number;
  limit: number;
  totaal: number;
  items: StekkerKandidaat[];
};

type StekkerVernietigingResponse = {
  vernietigingId: string;
  selectieId: string;
  status: string;
  starttijd?: string;
  eindtijd?: string;
  totaalKandidaten?: number;
  totaalObjecten?: number;
  totaalBatches?: number;
  ontvangenBatches?: number;
  succesvolVernietigd?: number;
  mislukt?: number;
  overgeslagen?: number;
  gewijzigd?: number;
  nietGevonden?: number;
  aantalWaarschuwingen?: number;
  aantalFouten?: number;
};

type StekkerVernietigingResultaat = {
  vernietigingskandidaatId?: string;
  bronId?: string;
  resultaat?: string;
  foutcode?: string;
  foutmelding?: string;
  bronstatus?: string;
  batchNummer?: number;
  logReference?: string;
  correlatieId?: string;
};

type StekkerBatchResultaat = {
  batchNummer: number;
  resultaten: StekkerVernietigingResultaat[];
};

@Injectable()
export class SelectieWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SelectieWorkerService.name);
  private intervalHandle: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService
  ) {}

  onModuleInit() {
    const enabled = this.config.get<string>("SELECTIE_WORKER_ENABLED") !== "false";

    if (!enabled) {
      this.logger.log("Selectieworker staat uit via SELECTIE_WORKER_ENABLED=false.");
      return;
    }

    const intervalMs =
      Number(this.config.get<string>("SELECTIE_WORKER_INTERVAL_MS")) || 5000;

    this.intervalHandle = setInterval(() => {
      void this.tick();
    }, intervalMs);
    void this.tick();
    this.logger.log(`Selectieworker gestart met interval ${intervalMs}ms.`);
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private async tick() {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      await this.processStartJobs();
      await this.pollRunningSelecties();
      await this.importReadySelecties();
      await this.processVernietigingStartJobs();
      await this.pollRunningVernietigingen();
    } catch (error) {
      this.logger.warn(`Selectieworker tick mislukt: ${describeError(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async processStartJobs() {
    const jobs = await this.prisma.client.outbox.findMany({
      where: {
        queue: "selectie",
        jobNaam: "selectie:start",
        verzondenOp: null,
      },
      orderBy: {
        aangemaaktOp: "asc",
      },
      take: 10,
    });

    for (const job of jobs) {
      const payload = job.payload as SelectieStartPayload;

      try {
        const selectie = await this.prisma.client.selectie.findUniqueOrThrow({
          where: { id: payload.selectieId },
          include: {
            stekkerConfiguratie: true,
          },
        });
        const response = await this.postSelectie(
          selectie.stekkerConfiguratie.baseUrl,
          payload.peildatum
        );
        const status = normalizeStatus(response);

        await this.prisma.client.$transaction([
          this.prisma.client.selectie.update({
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
              fout: status === "FAILED" ? response.foutmelding ?? null : null,
            },
          }),
          this.prisma.client.outbox.update({
            where: { id: job.id },
            data: {
              verzondenOp: new Date(),
            },
          }),
        ]);
      } catch (error) {
        await this.prisma.client
          .$transaction([
            this.prisma.client.selectie.update({
              where: { id: payload.selectieId },
              data: {
                status: "FAILED",
                fout: describeError(error),
              },
            }),
            this.prisma.client.outbox.update({
              where: { id: job.id },
              data: {
                verzondenOp: new Date(),
              },
            }),
          ])
          .catch(() => undefined);
        this.logger.warn(`selectie:start ${job.id} mislukt: ${describeError(error)}`);
      }
    }
  }

  private async pollRunningSelecties() {
    const selecties = await this.prisma.client.selectie.findMany({
      where: {
        externSelectieId: {
          not: null,
        },
        status: {
          in: ["AANGEVRAAGD", "RUNNING"],
        },
      },
      include: {
        stekkerConfiguratie: true,
      },
      take: 20,
    });

    for (const selectie of selecties) {
      if (!selectie.externSelectieId) {
        continue;
      }

      try {
        const response = await this.getSelectie(
          selectie.stekkerConfiguratie.baseUrl,
          selectie.externSelectieId
        );
        const status = normalizeStatus(response);

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
            fout: status === "FAILED" ? response.foutmelding ?? null : null,
          },
        });
      } catch (error) {
        await this.prisma.client.selectie
          .update({
            where: { id: selectie.id },
            data: {
              status: "FAILED",
              fout: describeError(error),
            },
          })
          .catch(() => undefined);
        this.logger.warn(
          `poll selectie ${selectie.id} mislukt: ${describeError(error)}`
        );
      }
    }
  }

  private async importReadySelecties() {
    const selecties = await this.prisma.client.selectie.findMany({
      where: {
        externSelectieId: {
          not: null,
        },
        status: "READY",
      },
      include: {
        stekkerConfiguratie: true,
        taakinstantie: {
          select: {
            id: true,
          },
        },
      },
      take: 5,
    });

    for (const selectie of selecties) {
      if (!selectie.externSelectieId) {
        continue;
      }

      try {
        const imported = await this.importSelectieKandidaten({
          selectieId: selectie.id,
          externSelectieId: selectie.externSelectieId,
          baseUrl: selectie.stekkerConfiguratie.baseUrl,
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

          const remaining = await tx.selectie.count({
            where: {
              taakinstantieId: selectie.taakinstantie.id,
              status: {
                not: "GEIMPORTEERD",
              },
            },
          });

          if (remaining === 0) {
            await tx.taakinstantie.update({
              where: { id: selectie.taakinstantie.id },
              data: {
                status: "beoordeling",
                stapSinds: new Date(),
                gestartOp: new Date(),
              },
            });
          }
        });
      } catch (error) {
        await this.prisma.client.selectie.update({
          where: { id: selectie.id },
          data: {
            status: "FAILED",
            fout: describeError(error),
          },
        });
        this.logger.warn(
          `import selectie ${selectie.id} mislukt: ${describeError(error)}`
        );
      }
    }
  }

  private async importSelectieKandidaten(input: {
    selectieId: string;
    externSelectieId: string;
    baseUrl: string;
  }) {
    const limit = 500;
    let offset = 0;
    let imported = 0;
    let total: number | null = null;

    do {
      const page = await this.getObjecten(input.baseUrl, input.externSelectieId, {
        offset,
        limit,
      });

      total = page.totaal;

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

  private async processVernietigingStartJobs() {
    const jobs = await this.prisma.client.outbox.findMany({
      where: {
        queue: "vernietiging",
        jobNaam: "vernietiging:start",
        verzondenOp: null,
      },
      orderBy: {
        aangemaaktOp: "asc",
      },
      take: 5,
    });

    for (const job of jobs) {
      const payload = job.payload as unknown as VernietigingStartPayload;

      try {
        const selectie = await this.prisma.client.selectie.findUniqueOrThrow({
          where: { id: payload.selectieId },
          include: {
            stekkerConfiguratie: true,
          },
        });

        if (!selectie.externSelectieId) {
          throw new Error("Selectie mist externSelectieId voor vernietiging.");
        }

        if (payload.kandidaten.length === 0) {
          throw new Error("Vernietigingsopdracht bevat geen kandidaten.");
        }

        const vernietiging = await this.postVernietiging(
          selectie.stekkerConfiguratie.baseUrl,
          {
            selectieId: selectie.externSelectieId,
            cockpitTaakId: payload.taakinstantieId,
            besluitReferentie: `taak-${payload.taakinstantieId}`,
            vernietigingsdossierId: payload.taakinstantieId,
          },
          `vernietiging-start-${payload.selectieId}`
        );
        const batches = chunk(payload.kandidaten, 100);

        for (const [index, batch] of batches.entries()) {
          await this.postVernietigingBatch(
            selectie.stekkerConfiguratie.baseUrl,
            vernietiging.vernietigingId,
            {
              batchNummer: index + 1,
              objecten: batch.map((kandidaat) => ({
                vernietigingskandidaatId: kandidaat.kandidaatId,
                bronId: kandidaat.bronId,
              })),
            },
            `vernietiging-batch-${vernietiging.vernietigingId}-${index + 1}`
          );
        }

        const vrijgegeven = await this.postVernietigingVrijgeven(
          selectie.stekkerConfiguratie.baseUrl,
          vernietiging.vernietigingId,
          {
            aantalBatches: batches.length,
            aantalKandidaten: payload.kandidaten.length,
          },
          `vernietiging-vrijgeven-${vernietiging.vernietigingId}`
        );
        const resultaten = isVernietigingAfgerond(vrijgegeven.status)
          ? await this.importVernietigingResultaten(
              selectie.stekkerConfiguratie.baseUrl,
              vrijgegeven.vernietigingId
            )
          : null;
        const resultaatPayload = {
          ...vrijgegeven,
          ...(resultaten ? { resultaten } : {}),
        };

        await this.prisma.client.$transaction([
          this.prisma.client.selectie.update({
            where: { id: selectie.id },
            data: {
              externVernietigingId: vrijgegeven.vernietigingId,
              vernietigingStatus: vrijgegeven.status,
              vernietigingGestartOp: parseDate(vrijgegeven.starttijd),
              vernietigingAfgerondOp: parseDate(vrijgegeven.eindtijd),
              vernietigingResultaat: resultaatPayload as Prisma.InputJsonValue,
              fout:
                vrijgegeven.status === "FAILED"
                  ? "Vernietiging mislukt."
                  : selectie.fout,
            },
          }),
          this.prisma.client.outbox.update({
            where: { id: job.id },
            data: {
              verzondenOp: new Date(),
            },
          }),
        ]);

        await this.updateTaakStatusNaVernietiging(payload.taakinstantieId);
      } catch (error) {
        await this.prisma.client.selectie
          .update({
            where: { id: payload.selectieId },
            data: {
              vernietigingStatus: "FAILED",
              fout: describeError(error),
            },
          })
          .catch(() => undefined);
        this.logger.warn(
          `vernietiging:start ${job.id} mislukt: ${describeError(error)}`
        );
      }
    }
  }

  private async pollRunningVernietigingen() {
    const selecties = await this.prisma.client.selectie.findMany({
      where: {
        externVernietigingId: {
          not: null,
        },
        vernietigingStatus: {
          in: ["IDLE", "RUNNING"],
        },
      },
      include: {
        stekkerConfiguratie: true,
      },
      take: 20,
    });

    for (const selectie of selecties) {
      if (!selectie.externVernietigingId) {
        continue;
      }

      try {
        const response = await this.getVernietiging(
          selectie.stekkerConfiguratie.baseUrl,
          selectie.externVernietigingId
        );
        const resultaten =
          isVernietigingAfgerond(response.status)
            ? await this.importVernietigingResultaten(
                selectie.stekkerConfiguratie.baseUrl,
                selectie.externVernietigingId
              )
            : null;

        await this.prisma.client.selectie.update({
          where: { id: selectie.id },
          data: {
            vernietigingStatus: response.status,
            vernietigingGestartOp:
              parseDate(response.starttijd) ?? selectie.vernietigingGestartOp,
            vernietigingAfgerondOp:
              parseDate(response.eindtijd) ?? selectie.vernietigingAfgerondOp,
            vernietigingResultaat: {
              ...response,
              ...(resultaten ? { resultaten } : {}),
            } as Prisma.InputJsonValue,
          },
        });

        await this.updateTaakStatusNaVernietiging(selectie.taakinstantieId);
      } catch (error) {
        this.logger.warn(
          `poll vernietiging ${selectie.id} mislukt: ${describeError(error)}`
        );
      }
    }
  }

  private async importVernietigingResultaten(baseUrl: string, vernietigingId: string) {
    const batches = await this.getVernietigingBatches(baseUrl, vernietigingId);

    return batches.flatMap((batch) =>
      batch.resultaten.map((resultaat) => ({
        ...resultaat,
        batchNummer: resultaat.batchNummer ?? batch.batchNummer,
      }))
    );
  }

  private async updateTaakStatusNaVernietiging(taakinstantieId: string) {
    const open = await this.prisma.client.selectie.count({
      where: {
        taakinstantieId,
        kandidaten: {
          some: {
            beoordeling: "AKKOORD",
          },
        },
        OR: [
          {
            vernietigingStatus: null,
          },
          {
            vernietigingStatus: {
              in: ["IDLE", "RUNNING"],
            },
          },
        ],
      },
    });

    if (open > 0) {
      return;
    }

    await this.prisma.client.taakinstantie.updateMany({
      where: {
        id: taakinstantieId,
        status: "uitvoering",
      },
      data: {
        status: "resultaat",
        stapSinds: new Date(),
        afgerondOp: new Date(),
      },
    });
  }

  private async postSelectie(baseUrl: string, peildatum?: string | null) {
    const dateOnly = formatDateOnly(peildatum);

    return this.requestSelectie(`${baseUrl}/selecties`, {
      method: "POST",
      body: JSON.stringify(dateOnly ? { peildatum: dateOnly } : {}),
    });
  }

  private async getSelectie(baseUrl: string, selectieId: string) {
    return this.requestSelectie(
      `${baseUrl}/selecties/${encodeURIComponent(selectieId)}`,
      {
        method: "GET",
      }
    );
  }

  private async getObjecten(
    baseUrl: string,
    selectieId: string,
    paging: { offset: number; limit: number }
  ) {
    return this.requestJson<StekkerObjectenResponse>(
      `${baseUrl}/selecties/${encodeURIComponent(
        selectieId
      )}/objecten?offset=${paging.offset}&limit=${paging.limit}`,
      {
        method: "GET",
      }
    );
  }

  private async postVernietiging(
    baseUrl: string,
    body: {
      selectieId: string;
      cockpitTaakId: string;
      besluitReferentie: string;
      vernietigingsdossierId: string;
    },
    idempotencyKey: string
  ) {
    return this.requestVernietiging(`${baseUrl}/vernietigingen`, {
      method: "POST",
      headers: mutationHeaders(idempotencyKey),
      body: JSON.stringify(body),
    });
  }

  private async postVernietigingBatch(
    baseUrl: string,
    vernietigingId: string,
    body: {
      batchNummer: number;
      objecten: Array<{
        vernietigingskandidaatId: string;
        bronId: string;
      }>;
    },
    idempotencyKey: string
  ) {
    return this.requestJson<unknown>(
      `${baseUrl}/vernietigingen/${encodeURIComponent(
        vernietigingId
      )}/batches`,
      {
        method: "POST",
        headers: mutationHeaders(idempotencyKey),
        body: JSON.stringify(body),
      }
    );
  }

  private async postVernietigingVrijgeven(
    baseUrl: string,
    vernietigingId: string,
    body: {
      aantalBatches: number;
      aantalKandidaten: number;
    },
    idempotencyKey: string
  ) {
    return this.requestVernietiging(
      `${baseUrl}/vernietigingen/${encodeURIComponent(
        vernietigingId
      )}/vrijgeven`,
      {
        method: "POST",
        headers: mutationHeaders(idempotencyKey),
        body: JSON.stringify(body),
      }
    );
  }

  private async getVernietiging(baseUrl: string, vernietigingId: string) {
    return this.requestVernietiging(
      `${baseUrl}/vernietigingen/${encodeURIComponent(vernietigingId)}`,
      {
        method: "GET",
      }
    );
  }

  private async getVernietigingBatches(baseUrl: string, vernietigingId: string) {
    return this.requestJson<StekkerBatchResultaat[]>(
      `${baseUrl}/vernietigingen/${encodeURIComponent(
        vernietigingId
      )}/batches`,
      {
        method: "GET",
      }
    );
  }

  private async requestSelectie(url: string, init: RequestInit) {
    return this.requestJson<StekkerSelectieResponse>(url, init);
  }

  private async requestVernietiging(url: string, init: RequestInit) {
    return this.requestJson<StekkerVernietigingResponse>(url, init);
  }

  private async requestJson<T>(url: string, init: RequestInit) {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    const body = (await response.json()) as T;

    if (!response.ok) {
      throw new Error(
        `${response.status} ${response.statusText}: ${JSON.stringify(body)}`
      );
    }

    return body;
  }
}

function normalizeStatus(response: StekkerSelectieResponse) {
  const rawStatus = response.selectiestatus ?? response.status;
  const status = rawStatus?.trim().toUpperCase().replace(/[\s-]+/g, "_");

  if (response.foutmelding && !status) {
    return "FAILED";
  }

  switch (status) {
    case "GEIMPORTEERD":
    case "READY":
    case "COMPLETED":
    case "COMPLETE":
    case "VOLTOOID":
      return "READY";
    case "AANGEVRAAGD":
    case "QUEUED":
    case "PENDING":
      return "AANGEVRAAGD";
    case "RUNNING":
    case "BEZIG":
    case "PROCESSING":
      return "RUNNING";
    case "FAILED":
    case "FAIL":
    case "ERROR":
    case "FOUT":
    case "MISLUKT":
    case "FETCH_FAILED":
      return "FAILED";
    default:
      return response.foutmelding ? "FAILED" : (rawStatus ?? "RUNNING");
  }
}

function isVernietigingAfgerond(status: string) {
  return status === "COMPLETED" || status === "PARTIAL" || status === "FAILED";
}

function mutationHeaders(idempotencyKey: string) {
  return {
    "Idempotency-Key": idempotencyKey,
    "X-Correlation-ID": idempotencyKey,
  };
}

function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDateOnly(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = parseDate(value);

  return date?.toISOString().slice(0, 10) ?? null;
}

function mapKandidaatData(
  selectieId: string,
  kandidaat: StekkerKandidaat
): Prisma.VernietigingskandidaatUncheckedCreateInput {
  return {
    selectieId,
    kandidaatId: requiredString(
      kandidaat.vernietigingskandidaatId,
      "vernietigingskandidaatId"
    ),
    bronId: requiredString(kandidaat.bronId, "bronId"),
    bronIdNaam: kandidaat.bronIdNaam,
    omschrijving: requiredString(kandidaat.omschrijving, "omschrijving"),
    classificatieschema: kandidaat.classificatieschema,
    classificatiesleutel: kandidaat.classificatiesleutel,
    classificatieomschrijving: kandidaat.classificatieomschrijving,
    selectielijst: kandidaat.selectielijst,
    grondslag: kandidaat.grondslag,
    grondslagAfwijkend: kandidaat.grondslagAfwijkend,
    resultaat: kandidaat.resultaat,
    bewaartermijn: kandidaat.bewaartermijn,
    waardering: kandidaat.waardering,
    begindatum: parseDate(kandidaat.begindatum),
    einddatum: parseDate(kandidaat.einddatum),
    vernietigingsdatum: parseDate(kandidaat.vernietigingsdatum),
    aantalObjecten: kandidaat.aantalObjecten ?? 0,
    aantalBetrokkenen: kandidaat.aantalBetrokkenen ?? 0,
    relatieType: kandidaat.relatieType,
    relatieId: kandidaat.relatieId,
    bron: kandidaat as Prisma.InputJsonValue,
  };
}

function requiredString(value: string | undefined, field: string) {
  if (!value?.trim()) {
    throw new Error(`Stekkerobject mist verplicht veld ${field}.`);
  }

  return value.trim();
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    const cause = formatErrorCause(error.cause);

    return cause ? `${error.message}: ${cause}` : error.message;
  }

  return "Onbekende fout.";
}

function formatErrorCause(cause: unknown): string | null {
  if (!cause) {
    return null;
  }

  if (cause instanceof Error) {
    return cause.message;
  }

  if (typeof cause === "object") {
    const details = cause as {
      code?: unknown;
      errno?: unknown;
      syscall?: unknown;
      address?: unknown;
      port?: unknown;
      message?: unknown;
    };
    const parts = [
      details.code,
      details.errno,
      details.syscall,
      details.address,
      details.port,
      details.message,
    ]
      .filter((part): part is string | number => {
        return typeof part === "string" || typeof part === "number";
      })
      .map(String);

    return parts.length > 0 ? parts.join(" ") : JSON.stringify(cause);
  }

  return String(cause);
}
