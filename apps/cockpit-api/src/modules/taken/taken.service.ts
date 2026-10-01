import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentMedewerkerService } from "../auth/current-medewerker.service.js";
import { PrismaService } from "../../shared/db/prisma.service.js";
import { mapTaakSelectie, taakSelectieSelect } from "./selectie.dto.js";
import type {
  KandidaatBeoordeling,
  UpdateKandidaatBeoordelingInput,
} from "./beoordeling.dto.js";
import type {
  AccorderingBesluit,
  UpdateProceseigenaarAccorderingInput,
} from "./accordering.dto.js";

export type StartSelectieInput = {
  peildatum?: string | null;
};

@Injectable()
export class TakenService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CurrentMedewerkerService)
    private readonly currentMedewerker: CurrentMedewerkerService,
    @Inject(ConfigService) private readonly config: ConfigService
  ) {}

  async getSelectie(user: AuthUser, taakinstantieId: string) {
    const taak = await this.prisma.client.taakinstantie.findFirstOrThrow({
      where: {
        id: taakinstantieId,
        ...(await this.buildRecordmanagerAccessWhere(user)),
      },
      select: taakSelectieSelect,
    });

    return mapTaakSelectie(taak);
  }

  async startSelectie(
    user: AuthUser,
    taakinstantieId: string,
    input: StartSelectieInput
  ) {
    const currentMedewerkerId = await this.currentMedewerker.findForUser(user);

    if (!currentMedewerkerId) {
      throw new ForbiddenException(
        "De ingelogde gebruiker is niet gekoppeld aan een medewerker."
      );
    }

    const peildatum = parseOptionalDate(input.peildatum, "peildatum");
    const taak = await this.prisma.client.taakinstantie.findFirstOrThrow({
      where: {
        id: taakinstantieId,
        recordmanagerId: currentMedewerkerId,
      },
      select: {
        id: true,
        naam: true,
        status: true,
        peildatum: true,
        taakdefinitie: {
          select: {
            stekkers: {
              select: {
                stekkerId: true,
                selectieparameters: true,
                stekker: {
                  select: {
                    id: true,
                    naam: true,
                    actief: true,
                    configuraties: {
                      select: {
                        id: true,
                        versie: true,
                        verwachteApiMajor: true,
                      },
                      orderBy: {
                        versie: "desc",
                      },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
        selecties: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (taak.status !== "init") {
      throw new BadRequestException("Selectie kan alleen starten vanuit status init.");
    }

    if (taak.selecties.length > 0) {
      throw new BadRequestException("Voor deze taak is de selectie al gestart.");
    }

    const stekkers = taak.taakdefinitie.stekkers.filter(
      ({ stekker }) => stekker.actief
    );

    if (stekkers.length === 0) {
      throw new BadRequestException(
        "Deze taakdefinitie heeft geen actieve stekkers."
      );
    }

    if (stekkers.some(({ stekker }) => stekker.configuraties.length === 0)) {
      throw new BadRequestException(
        "Een of meer stekkers hebben nog geen configuratie."
      );
    }

    const effectievePeildatum = peildatum ?? taak.peildatum;
    const selectieIds = await this.prisma.client.$transaction(async (tx) => {
      const createdSelecties: string[] = [];

      for (const taakStekker of stekkers) {
        const configuratie = taakStekker.stekker.configuraties[0];
        const selectie = await tx.selectie.create({
          data: {
            taakinstantieId: taak.id,
            stekkerId: taakStekker.stekkerId,
            stekkerConfiguratieId: configuratie.id,
            status: "AANGEVRAAGD",
            peildatum: effectievePeildatum,
            selectietijdstip: new Date(),
            configuratieversie: String(configuratie.versie),
          },
          select: {
            id: true,
          },
        });

        createdSelecties.push(selectie.id);

        await tx.outbox.create({
          data: {
            taakinstantieId: taak.id,
            queue: "selectie",
            jobNaam: "selectie:start",
            payload: {
              taakinstantieId: taak.id,
              selectieId: selectie.id,
              stekkerId: taakStekker.stekkerId,
              stekkerConfiguratieId: configuratie.id,
              peildatum: formatDateOnly(effectievePeildatum),
              selectieparameters: taakStekker.selectieparameters,
            },
          },
        });
      }

      await this.createAuditEvent(tx, user, {
        taakinstantieId: taak.id,
        actie: "SELECTION_REQUESTED",
        entiteitType: "taakinstantie",
        entiteitId: taak.id,
        details: {
          selectieIds: createdSelecties,
          stekkers: stekkers.map(({ stekkerId }) => stekkerId),
          peildatum: formatDateOnly(effectievePeildatum),
        },
      });

      return createdSelecties;
    });

    const refreshed = await this.prisma.client.taakinstantie.findUniqueOrThrow({
      where: {
        id: taakinstantieId,
      },
      select: taakSelectieSelect,
    });

    return {
      ...mapTaakSelectie(refreshed),
      aangemaakteSelecties: selectieIds,
    };
  }

  async getKandidaten(user: AuthUser, taakinstantieId: string) {
    const where = await this.buildRecordmanagerAccessWhere(user);
    const taak = await this.prisma.client.taakinstantie.findFirstOrThrow({
      where: {
        id: taakinstantieId,
        ...where,
      },
      select: {
        id: true,
        naam: true,
        status: true,
        stapSinds: true,
        recordmanager: {
          select: {
            id: true,
            naam: true,
            email: true,
          },
        },
        proceseigenaar: {
          select: {
            id: true,
            naam: true,
            email: true,
          },
        },
        archivaris: {
          select: {
            id: true,
            naam: true,
            email: true,
          },
        },
      },
    });
    const kandidaten = await this.prisma.client.vernietigingskandidaat.findMany({
      where: {
        selectie: {
          taakinstantieId: taak.id,
        },
      },
      include: {
        selectie: {
          include: {
            stekkerConfiguratie: {
              include: {
                stekker: true,
              },
            },
          },
        },
      },
      orderBy: [
        {
          vernietigingsdatum: "asc",
        },
        {
          kandidaatId: "asc",
        },
      ],
    });

    return {
      taak: {
        id: taak.id,
        naam: taak.naam,
        status: taak.status,
        stapSinds: taak.stapSinds.toISOString(),
        verantwoordelijken: {
          recordmanager: taak.recordmanager,
          proceseigenaar: taak.proceseigenaar,
          archivaris: taak.archivaris,
        },
      },
      kandidaten: kandidaten.map((kandidaat) => ({
        id: kandidaat.id,
        kandidaatId: kandidaat.kandidaatId,
        bronId: kandidaat.bronId,
        bronIdNaam: kandidaat.bronIdNaam,
        omschrijving: kandidaat.omschrijving,
        classificatieschema: kandidaat.classificatieschema,
        classificatiesleutel: kandidaat.classificatiesleutel,
        classificatieomschrijving: kandidaat.classificatieomschrijving,
        selectielijst: kandidaat.selectielijst,
        grondslag: kandidaat.grondslag,
        grondslagAfwijkend: kandidaat.grondslagAfwijkend,
        resultaat: kandidaat.resultaat,
        bewaartermijn: kandidaat.bewaartermijn,
        waardering: kandidaat.waardering,
        begindatum: kandidaat.begindatum?.toISOString() ?? null,
        einddatum: kandidaat.einddatum?.toISOString() ?? null,
        vernietigingsdatum: kandidaat.vernietigingsdatum?.toISOString() ?? null,
        aantalObjecten: kandidaat.aantalObjecten,
        aantalBetrokkenen: kandidaat.aantalBetrokkenen,
        relatieType: kandidaat.relatieType,
        relatieId: kandidaat.relatieId,
        beoordeling: kandidaat.beoordeling,
        uitsluitReden: kandidaat.uitsluitReden,
        toelichting: kandidaat.toelichting,
        stekker: {
          id: kandidaat.selectie.stekkerConfiguratie.stekker.id,
          naam: kandidaat.selectie.stekkerConfiguratie.stekker.naam,
        },
      })),
    };
  }

  async getVernietigingsresultaten(user: AuthUser, taakinstantieId: string) {
    const where = await this.buildRecordmanagerAccessWhere(user);
    const taak = await this.prisma.client.taakinstantie.findFirstOrThrow({
      where: {
        id: taakinstantieId,
        ...where,
      },
      select: {
        id: true,
        naam: true,
        status: true,
        stapSinds: true,
        recordmanager: {
          select: {
            naam: true,
            email: true,
          },
        },
        proceseigenaar: {
          select: {
            naam: true,
            email: true,
          },
        },
        archivaris: {
          select: {
            naam: true,
            email: true,
          },
        },
        selecties: {
          include: {
            stekkerConfiguratie: {
              include: {
                stekker: true,
              },
            },
            kandidaten: {
              where: {
                beoordeling: "AKKOORD",
              },
              orderBy: [
                {
                  vernietigingsdatum: "asc",
                },
                {
                  kandidaatId: "asc",
                },
              ],
            },
          },
        },
      },
    });

    return {
      taak: {
        id: taak.id,
        naam: taak.naam,
        status: taak.status,
        stapSinds: taak.stapSinds.toISOString(),
        verantwoordelijken: {
          recordmanager: taak.recordmanager,
          proceseigenaar: taak.proceseigenaar,
          archivaris: taak.archivaris,
        },
      },
      resultaten: taak.selecties.flatMap((selectie) => {
        const resultaatByKandidaatId = getResultaatByKandidaatId(
          selectie.vernietigingResultaat
        );

        return selectie.kandidaten.map((kandidaat) => {
          const resultaat = resultaatByKandidaatId.get(kandidaat.kandidaatId);

          return {
            id: kandidaat.id,
            kandidaatId: kandidaat.kandidaatId,
            bronId: kandidaat.bronId,
            bronIdNaam: kandidaat.bronIdNaam,
            omschrijving: kandidaat.omschrijving,
            classificatiesleutel: kandidaat.classificatiesleutel,
            selectielijst: kandidaat.selectielijst,
            grondslag: kandidaat.grondslag,
            bewaartermijn: kandidaat.bewaartermijn,
            begindatum: kandidaat.begindatum?.toISOString() ?? null,
            einddatum: kandidaat.einddatum?.toISOString() ?? null,
            vernietigingsdatum:
              kandidaat.vernietigingsdatum?.toISOString() ?? null,
            aantalObjecten: kandidaat.aantalObjecten,
            aantalBetrokkenen: kandidaat.aantalBetrokkenen,
            vernietigingsstatus: normalizeVernietigingsresultaat(
              resultaat?.resultaat
            ),
            foutcode: asString(resultaat?.foutcode),
            foutmelding: asString(resultaat?.foutmelding),
            bronstatus: asString(resultaat?.bronstatus),
            logReference: asString(resultaat?.logReference),
            correlatieId: asString(resultaat?.correlatieId),
            stekker: {
              id: selectie.stekkerConfiguratie.stekker.id,
              naam: selectie.stekkerConfiguratie.stekker.naam,
            },
          };
        });
      }),
    };
  }

  async getUitvoering(user: AuthUser, taakinstantieId: string) {
    const where = await this.buildRecordmanagerAccessWhere(user);
    const taak = await this.prisma.client.taakinstantie.findFirstOrThrow({
      where: {
        id: taakinstantieId,
        ...where,
      },
      select: {
        id: true,
        naam: true,
        status: true,
        stapSinds: true,
        recordmanager: {
          select: {
            naam: true,
            email: true,
          },
        },
        proceseigenaar: {
          select: {
            naam: true,
            email: true,
          },
        },
        archivaris: {
          select: {
            naam: true,
            email: true,
          },
        },
        selecties: {
          include: {
            stekkerConfiguratie: {
              include: {
                stekker: true,
              },
            },
            _count: {
              select: {
                kandidaten: {
                  where: {
                    beoordeling: "AKKOORD",
                  },
                },
              },
            },
          },
          orderBy: {
            selectietijdstip: "asc",
          },
        },
      },
    });

    return {
      taak: {
        id: taak.id,
        naam: taak.naam,
        status: taak.status,
        stapSinds: taak.stapSinds.toISOString(),
        verantwoordelijken: {
          recordmanager: taak.recordmanager,
          proceseigenaar: taak.proceseigenaar,
          archivaris: taak.archivaris,
        },
      },
      stekkers: taak.selecties.map((selectie) => ({
        id: selectie.stekkerConfiguratie.stekker.id,
        naam: selectie.stekkerConfiguratie.stekker.naam,
        versie: selectie.configuratieversie,
        stekkerStatus: selectie.fout ? "FOUT" : "SUCCES",
        selectieId: selectie.id,
        externSelectieId: selectie.externSelectieId,
        externVernietigingId: selectie.externVernietigingId,
        vernietigingStatus: selectie.vernietigingStatus,
        vernietigingGestartOp:
          selectie.vernietigingGestartOp?.toISOString() ?? null,
        vernietigingAfgerondOp:
          selectie.vernietigingAfgerondOp?.toISOString() ?? null,
        aantalKandidaten: selectie._count.kandidaten,
        aantalObjecten: selectie.totaalObjecten,
        fout: selectie.fout,
        resultaatTellingen: getVernietigingResultaatTellingen(
          selectie.vernietigingResultaat
        ),
      })),
    };
  }

  async getVerklaring(user: AuthUser, taakinstantieId: string) {
    const latest = await this.getLatestVerklaring(user, taakinstantieId);

    if (latest) {
      return mapStoredVerklaring(latest);
    }

    const { metadata } = await this.buildVerklaringDocumentData(
      user,
      taakinstantieId
    );

    return {
      ...metadata,
      beschikbaar: false,
    };
  }

  async genereerVerklaring(user: AuthUser, taakinstantieId: string) {
    const currentMedewerkerId = await this.currentMedewerker.findForUser(user);

    if (!currentMedewerkerId) {
      throw new ForbiddenException(
        "De ingelogde gebruiker is niet gekoppeld aan een medewerker."
      );
    }

    const taak = await this.prisma.client.taakinstantie.findFirst({
      where: {
        id: taakinstantieId,
        recordmanagerId: currentMedewerkerId,
        status: "resultaat",
      },
      select: {
        id: true,
      },
    });

    if (!taak) {
      throw new BadRequestException(
        "Een verklaring kan alleen door de gekoppelde recordmanager worden gegenereerd vanuit status resultaat."
      );
    }

    const { metadata, csv } = await this.buildVerklaringDocumentData(
      user,
      taakinstantieId
    );
    const pdf = await this.generateVerklaringPdf(metadata);
    const pdfSha256 = createHash("sha256").update(pdf).digest("hex");
    const csvBuffer = Buffer.from(csv, "utf8");
    const csvSha256 = createHash("sha256").update(csvBuffer).digest("hex");

    const created = await this.prisma.client.$transaction(async (tx) => {
      const latest = await tx.verklaring.findFirst({
        where: {
          taakinstantieId,
        },
        orderBy: {
          versie: "desc",
        },
        select: {
          versie: true,
        },
      });
      const versie = (latest?.versie ?? 0) + 1;
      const verklaring = await tx.verklaring.create({
        data: {
          taakinstantieId,
          versie,
          status: "gegenereerd",
          pdf,
          pdfSha256,
          csv: csvBuffer,
          csvSha256,
          csvBestandsnaam: metadata.bijlage.bestandsnaam,
          metadata: metadata as Prisma.InputJsonValue,
          gegenereerdDoor: user.sub,
        },
      });

      await this.createAuditEvent(tx, user, {
        taakinstantieId,
        actie: "CERTIFICATE_GENERATED",
        entiteitType: "verklaring",
        entiteitId: verklaring.id,
        details: {
          versie,
          pdfSha256,
          csvSha256,
          aantalRegels: metadata.bijlage.aantalRegels,
        },
      });

      return verklaring;
    });

    return mapStoredVerklaring(created);
  }

  async getVerklaringPdf(user: AuthUser, taakinstantieId: string) {
    const verklaring = await this.getLatestVerklaring(user, taakinstantieId);

    if (!verklaring) {
      throw new BadRequestException(
        "Er is nog geen verklaring gegenereerd voor deze taak."
      );
    }

    return Buffer.from(verklaring.pdf);
  }

  async getVerklaringBijlageCsv(user: AuthUser, taakinstantieId: string) {
    const verklaring = await this.getLatestVerklaring(user, taakinstantieId);

    if (!verklaring) {
      throw new BadRequestException(
        "Er is nog geen verklaring gegenereerd voor deze taak."
      );
    }

    return Buffer.from(verklaring.csv).toString("utf8");
  }

  private async buildVerklaringDocumentData(
    user: AuthUser,
    taakinstantieId: string
  ) {
    const resultaten = await this.getVernietigingsresultaten(
      user,
      taakinstantieId
    );
    const csv = buildVernietigingsresultatenCsv(resultaten.resultaten);
    const csvSha256 = createHash("sha256").update(csv).digest("hex");
    const tellingen = getResultaatTellingen(resultaten.resultaten);

    return {
      csv,
      metadata: {
        taak: resultaten.taak,
        versie: 1,
        status: "concept",
        gegenereerdOp: new Date().toISOString(),
        bijlage: {
          bestandsnaam: `vernietigingsresultaten-${taakinstantieId}.csv`,
          contentType: "text/csv; charset=utf-8",
          aantalRegels: resultaten.resultaten.length,
          sha256: csvSha256,
        },
        tellingen,
      },
    };
  }

  private async generateVerklaringPdf(metadata: VerklaringMetadata) {
    const gotenbergUrl = this.config.get<string>("GOTENBERG_URL")?.trim();

    if (!gotenbergUrl) {
      throw new ServiceUnavailableException(
        "GOTENBERG_URL is niet geconfigureerd voor PDF-generatie."
      );
    }

    const form = new FormData();
    form.append(
      "files",
      new Blob([buildVerklaringHtml(metadata)], { type: "text/html" }),
      "index.html"
    );

    const convertUrl = getGotenbergChromiumHtmlUrl(gotenbergUrl);
    const response = await fetch(convertUrl, {
      method: "POST",
      headers: getGotenbergAuthHeaders(
        this.config.get<string>("GOTENBERG_USERNAME"),
        this.config.get<string>("GOTENBERG_PASSWORD")
      ),
      body: form,
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new ServiceUnavailableException(
        `PDF-generatie via Gotenberg is mislukt met status ${response.status}${
          details ? `: ${details}` : ""
        }.`
      );
    }

    return Buffer.from(await response.arrayBuffer());
  }

  private async getLatestVerklaring(user: AuthUser, taakinstantieId: string) {
    return this.prisma.client.verklaring.findFirst({
      where: {
        taakinstantieId,
        taakinstantie: await this.buildRecordmanagerAccessWhere(user),
      },
      orderBy: {
        versie: "desc",
      },
    });
  }

  async updateKandidaatBeoordeling(
    user: AuthUser,
    taakinstantieId: string,
    kandidaatId: string,
    input: UpdateKandidaatBeoordelingInput
  ) {
    const currentMedewerkerId = await this.currentMedewerker.findForUser(user);

    if (!currentMedewerkerId) {
      throw new ForbiddenException(
        "De ingelogde gebruiker is niet gekoppeld aan een medewerker."
      );
    }

    const beoordeling = parseKandidaatBeoordeling(input.beoordeling);
    const toelichting = normalizeOptionalText(input.toelichting);
    const uitsluitReden =
      beoordeling === "UITGESLOTEN"
        ? normalizeOptionalText(input.uitsluitReden) ?? toelichting
        : null;

    const kandidaat = await this.prisma.client.vernietigingskandidaat.findFirst({
      where: {
        id: kandidaatId,
        selectie: {
          taakinstantieId,
          taakinstantie: {
            recordmanagerId: currentMedewerkerId,
            status: "beoordeling",
          },
        },
      },
      select: {
        id: true,
        beoordeling: true,
        selectie: {
          select: {
            taakinstantieId: true,
          },
        },
      },
    });

    if (!kandidaat) {
      throw new BadRequestException(
        "Deze kandidaat kan niet worden beoordeeld vanuit de huidige taakstatus."
      );
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const result = await tx.vernietigingskandidaat.update({
        where: {
          id: kandidaat.id,
        },
        data: {
          beoordeling,
          uitsluitReden,
          toelichting,
          beoordeeldDoor: currentMedewerkerId,
          versie: {
            increment: 1,
          },
        },
        select: {
          id: true,
          beoordeling: true,
          uitsluitReden: true,
          toelichting: true,
          versie: true,
        },
      });

      await this.createAuditEvent(tx, user, {
        taakinstantieId,
        actie: "KANDIDAAT_BEOORDEELD",
        entiteitType: "vernietigingskandidaat",
        entiteitId: kandidaat.id,
        details: {
          vorigeBeoordeling: kandidaat.beoordeling,
          beoordeling,
          uitsluitReden,
          toelichting,
        },
      });

      return result;
    });

    return updated;
  }

  async beoordelingVoorleggen(user: AuthUser, taakinstantieId: string) {
    const currentMedewerkerId = await this.currentMedewerker.findForUser(user);

    if (!currentMedewerkerId) {
      throw new ForbiddenException(
        "De ingelogde gebruiker is niet gekoppeld aan een medewerker."
      );
    }

    const taak = await this.prisma.client.taakinstantie.findFirst({
      where: {
        id: taakinstantieId,
        recordmanagerId: currentMedewerkerId,
        status: "beoordeling",
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!taak) {
      throw new BadRequestException(
        "De beoordeling kan alleen vanuit status beoordeling worden voorgelegd."
      );
    }

    const [totaal, openstaand, akkoord, uitgesloten, retour] =
      await this.prisma.client.$transaction([
        this.prisma.client.vernietigingskandidaat.count({
          where: {
            selectie: {
              taakinstantieId,
            },
          },
        }),
        this.prisma.client.vernietigingskandidaat.count({
          where: {
            beoordeling: "OPGENOMEN",
            selectie: {
              taakinstantieId,
            },
          },
        }),
        this.prisma.client.vernietigingskandidaat.count({
          where: {
            beoordeling: "AKKOORD",
            selectie: {
              taakinstantieId,
            },
          },
        }),
        this.prisma.client.vernietigingskandidaat.count({
          where: {
            beoordeling: "UITGESLOTEN",
            selectie: {
              taakinstantieId,
            },
          },
        }),
        this.prisma.client.vernietigingskandidaat.count({
          where: {
            beoordeling: "RETOUR",
            selectie: {
              taakinstantieId,
            },
          },
        }),
      ]);

    if (totaal === 0) {
      throw new BadRequestException("Er zijn geen kandidaten om voor te leggen.");
    }

    if (openstaand > 0) {
      throw new BadRequestException(
        `Nog niet alle kandidaten zijn beoordeeld. Openstaand: ${openstaand}.`
      );
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const result = await tx.taakinstantie.update({
        where: {
          id: taak.id,
        },
        data: {
          status: "accordering_po",
          stapSinds: new Date(),
        },
        select: {
          id: true,
          status: true,
          stapSinds: true,
        },
      });

      await this.createAuditEvent(tx, user, {
        taakinstantieId,
        actie: "BEOORDELING_VOORGELEGD",
        entiteitType: "taakinstantie",
        entiteitId: taak.id,
        details: {
          totaal,
          akkoord,
          uitgesloten,
          retour,
        },
      });

      return result;
    });

    return {
      id: updated.id,
      status: updated.status,
      stapSinds: updated.stapSinds.toISOString(),
    };
  }

  async updateProceseigenaarAccordering(
    user: AuthUser,
    taakinstantieId: string,
    kandidaatId: string,
    input: UpdateProceseigenaarAccorderingInput
  ) {
    const currentMedewerkerId = await this.currentMedewerker.findForUser(user);

    if (!currentMedewerkerId) {
      throw new ForbiddenException(
        "De ingelogde gebruiker is niet gekoppeld aan een medewerker."
      );
    }

    const besluit = parseAccorderingBesluit(input.besluit);
    const toelichting = normalizeOptionalText(input.toelichting);
    const kandidaat = await this.prisma.client.vernietigingskandidaat.findFirst({
      where: {
        id: kandidaatId,
        selectie: {
          taakinstantieId,
          taakinstantie: {
            proceseigenaarId: currentMedewerkerId,
            status: "accordering_po",
          },
        },
      },
      select: {
        id: true,
        beoordeling: true,
      },
    });

    if (!kandidaat) {
      throw new BadRequestException(
        "Deze kandidaat kan niet door de proceseigenaar worden geaccordeerd vanuit de huidige taakstatus."
      );
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const result = await tx.vernietigingskandidaat.update({
        where: {
          id: kandidaat.id,
        },
        data:
          besluit === "RETOUR"
            ? {
                beoordeling: "RETOUR",
                toelichting,
                beoordeeldDoor: currentMedewerkerId,
                versie: {
                  increment: 1,
                },
              }
            : {
                toelichting,
                beoordeeldDoor: currentMedewerkerId,
                versie: {
                  increment: 1,
                },
              },
        select: {
          id: true,
          beoordeling: true,
          toelichting: true,
          versie: true,
        },
      });

      await this.createAuditEvent(tx, user, {
        taakinstantieId,
        actie: "ACCORDERING_PO_KANDIDAAT_BESLUIT",
        entiteitType: "vernietigingskandidaat",
        entiteitId: kandidaat.id,
        details: {
          besluit,
          vorigeBeoordeling: kandidaat.beoordeling,
          beoordeling: result.beoordeling,
          toelichting,
        },
      });

      return result;
    });

    return updated;
  }

  async proceseigenaarBesluiten(user: AuthUser, taakinstantieId: string) {
    const currentMedewerkerId = await this.currentMedewerker.findForUser(user);

    if (!currentMedewerkerId) {
      throw new ForbiddenException(
        "De ingelogde gebruiker is niet gekoppeld aan een medewerker."
      );
    }

    const taak = await this.prisma.client.taakinstantie.findFirst({
      where: {
        id: taakinstantieId,
        proceseigenaarId: currentMedewerkerId,
        status: "accordering_po",
      },
      select: {
        id: true,
      },
    });

    if (!taak) {
      throw new BadRequestException(
        "Proceseigenaar-accordering kan alleen vanuit status accordering_po worden afgerond."
      );
    }

    const [totaal, retour] = await this.prisma.client.$transaction([
      this.prisma.client.vernietigingskandidaat.count({
        where: {
          selectie: {
            taakinstantieId,
          },
        },
      }),
      this.prisma.client.vernietigingskandidaat.count({
        where: {
          beoordeling: "RETOUR",
          selectie: {
            taakinstantieId,
          },
        },
      }),
    ]);

    if (totaal === 0) {
      throw new BadRequestException("Er zijn geen kandidaten om te accorderen.");
    }

    const nieuweStatus = retour > 0 ? "beoordeling" : "accordering_archivaris";
    const actie =
      retour > 0 ? "ACCORDERING_PO_RETOUR" : "ACCORDERING_PO_AKKOORD";

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const result = await tx.taakinstantie.update({
        where: {
          id: taak.id,
        },
        data: {
          status: nieuweStatus,
          stapSinds: new Date(),
        },
        select: {
          id: true,
          status: true,
          stapSinds: true,
        },
      });

      await this.createAuditEvent(tx, user, {
        taakinstantieId,
        actie,
        entiteitType: "taakinstantie",
        entiteitId: taak.id,
        details: {
          totaal,
          retour,
          nieuweStatus,
        },
      });

      return result;
    });

    return {
      id: updated.id,
      status: updated.status,
      stapSinds: updated.stapSinds.toISOString(),
    };
  }

  async updateArchivarisAccordering(
    user: AuthUser,
    taakinstantieId: string,
    kandidaatId: string,
    input: UpdateProceseigenaarAccorderingInput
  ) {
    const currentMedewerkerId = await this.currentMedewerker.findForUser(user);

    if (!currentMedewerkerId) {
      throw new ForbiddenException(
        "De ingelogde gebruiker is niet gekoppeld aan een medewerker."
      );
    }

    const besluit = parseAccorderingBesluit(input.besluit);
    const toelichting = normalizeOptionalText(input.toelichting);
    const kandidaat = await this.prisma.client.vernietigingskandidaat.findFirst({
      where: {
        id: kandidaatId,
        selectie: {
          taakinstantieId,
          taakinstantie: {
            archivarisId: currentMedewerkerId,
            status: "accordering_archivaris",
          },
        },
      },
      select: {
        id: true,
        beoordeling: true,
      },
    });

    if (!kandidaat) {
      throw new BadRequestException(
        "Deze kandidaat kan niet door de archivaris worden geaccordeerd vanuit de huidige taakstatus."
      );
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const result = await tx.vernietigingskandidaat.update({
        where: {
          id: kandidaat.id,
        },
        data:
          besluit === "RETOUR"
            ? {
                beoordeling: "RETOUR",
                toelichting,
                beoordeeldDoor: currentMedewerkerId,
                versie: {
                  increment: 1,
                },
              }
            : {
                toelichting,
                beoordeeldDoor: currentMedewerkerId,
                versie: {
                  increment: 1,
                },
              },
        select: {
          id: true,
          beoordeling: true,
          toelichting: true,
          versie: true,
        },
      });

      await this.createAuditEvent(tx, user, {
        taakinstantieId,
        actie: "ACCORDERING_ARCHIVARIS_KANDIDAAT_BESLUIT",
        entiteitType: "vernietigingskandidaat",
        entiteitId: kandidaat.id,
        details: {
          besluit,
          vorigeBeoordeling: kandidaat.beoordeling,
          beoordeling: result.beoordeling,
          toelichting,
        },
      });

      return result;
    });

    return updated;
  }

  async archivarisBesluiten(user: AuthUser, taakinstantieId: string) {
    const currentMedewerkerId = await this.currentMedewerker.findForUser(user);

    if (!currentMedewerkerId) {
      throw new ForbiddenException(
        "De ingelogde gebruiker is niet gekoppeld aan een medewerker."
      );
    }

    const taak = await this.prisma.client.taakinstantie.findFirst({
      where: {
        id: taakinstantieId,
        archivarisId: currentMedewerkerId,
        status: "accordering_archivaris",
      },
      select: {
        id: true,
      },
    });

    if (!taak) {
      throw new BadRequestException(
        "Archivaris-accordering kan alleen vanuit status accordering_archivaris worden afgerond."
      );
    }

    const [totaal, retour] = await this.prisma.client.$transaction([
      this.prisma.client.vernietigingskandidaat.count({
        where: {
          selectie: {
            taakinstantieId,
          },
        },
      }),
      this.prisma.client.vernietigingskandidaat.count({
        where: {
          beoordeling: "RETOUR",
          selectie: {
            taakinstantieId,
          },
        },
      }),
    ]);

    if (totaal === 0) {
      throw new BadRequestException("Er zijn geen kandidaten om te accorderen.");
    }

    const nieuweStatus = retour > 0 ? "beoordeling" : "vrijgegeven";
    const actie =
      retour > 0
        ? "ACCORDERING_ARCHIVARIS_RETOUR"
        : "ACCORDERING_ARCHIVARIS_AKKOORD";

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const result = await tx.taakinstantie.update({
        where: {
          id: taak.id,
        },
        data: {
          status: nieuweStatus,
          stapSinds: new Date(),
        },
        select: {
          id: true,
          status: true,
          stapSinds: true,
        },
      });

      await this.createAuditEvent(tx, user, {
        taakinstantieId,
        actie,
        entiteitType: "taakinstantie",
        entiteitId: taak.id,
        details: {
          totaal,
          retour,
          nieuweStatus,
        },
      });

      return result;
    });

    return {
      id: updated.id,
      status: updated.status,
      stapSinds: updated.stapSinds.toISOString(),
    };
  }

  async vernietigingsopdracht(user: AuthUser, taakinstantieId: string) {
    const currentMedewerkerId = await this.currentMedewerker.findForUser(user);

    if (!currentMedewerkerId) {
      throw new ForbiddenException(
        "De ingelogde gebruiker is niet gekoppeld aan een medewerker."
      );
    }

    const taak = await this.prisma.client.taakinstantie.findFirst({
      where: {
        id: taakinstantieId,
        recordmanagerId: currentMedewerkerId,
        status: "vrijgegeven",
      },
      select: {
        id: true,
        selecties: {
          select: {
            id: true,
            stekkerId: true,
            externSelectieId: true,
            kandidaten: {
              where: {
                beoordeling: "AKKOORD",
              },
              select: {
                id: true,
                kandidaatId: true,
                bronId: true,
              },
            },
          },
        },
      },
    });

    if (!taak) {
      throw new BadRequestException(
        "Vernietigingsopdracht kan alleen vanuit status vrijgegeven worden gestart door de gekoppelde recordmanager."
      );
    }

    const opdrachtSelecties = taak.selecties
      .map((selectie) => ({
        selectieId: selectie.id,
        stekkerId: selectie.stekkerId,
        externSelectieId: selectie.externSelectieId,
        kandidaten: selectie.kandidaten,
      }))
      .filter((selectie) => selectie.kandidaten.length > 0);

    const totaalKandidaten = opdrachtSelecties.reduce(
      (total, selectie) => total + selectie.kandidaten.length,
      0
    );

    if (totaalKandidaten === 0) {
      throw new BadRequestException(
        "Er zijn geen akkoord bevonden kandidaten om te vernietigen."
      );
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const outboxIds: string[] = [];

      for (const selectie of opdrachtSelecties) {
        const outbox = await tx.outbox.create({
          data: {
            taakinstantieId: taak.id,
            queue: "vernietiging",
            jobNaam: "vernietiging:start",
            payload: {
              taakinstantieId: taak.id,
              selectieId: selectie.selectieId,
              stekkerId: selectie.stekkerId,
              externSelectieId: selectie.externSelectieId,
              kandidaten: selectie.kandidaten.map((kandidaat) => ({
                id: kandidaat.id,
                kandidaatId: kandidaat.kandidaatId,
                bronId: kandidaat.bronId,
              })),
            },
          },
          select: {
            id: true,
          },
        });

        outboxIds.push(outbox.id);
      }

      const result = await tx.taakinstantie.update({
        where: {
          id: taak.id,
        },
        data: {
          status: "uitvoering",
          stapSinds: new Date(),
        },
        select: {
          id: true,
          status: true,
          stapSinds: true,
        },
      });

      await this.createAuditEvent(tx, user, {
        taakinstantieId,
        actie: "VERNIETIGINGSOPDRACHT_GEGEVEN",
        entiteitType: "taakinstantie",
        entiteitId: taak.id,
        details: {
          totaalKandidaten,
          selecties: opdrachtSelecties.map((selectie) => ({
            selectieId: selectie.selectieId,
            stekkerId: selectie.stekkerId,
            aantalKandidaten: selectie.kandidaten.length,
          })),
          outboxIds,
        },
      });

      return result;
    });

    return {
      id: updated.id,
      status: updated.status,
      stapSinds: updated.stapSinds.toISOString(),
      totaalKandidaten,
      aantalOpdrachten: opdrachtSelecties.length,
    };
  }

  private async buildRecordmanagerAccessWhere(user: AuthUser) {
    if (user.roles.includes("auditor")) {
      return {};
    }

    const medewerkerId = await this.currentMedewerker.findForUser(user);

    if (!medewerkerId) {
      return { id: { equals: "00000000-0000-0000-0000-000000000000" } };
    }

    return {
      OR: [
        { recordmanagerId: medewerkerId },
        { proceseigenaarId: medewerkerId },
        { archivarisId: medewerkerId },
      ],
    };
  }

  private async createAuditEvent(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    event: {
      taakinstantieId: string;
      actie: string;
      entiteitType: string;
      entiteitId: string;
      details: Prisma.InputJsonValue;
    }
  ) {
    const previous = await tx.auditEvent.findFirst({
      orderBy: { id: "desc" },
      select: { hash: true },
    });
    const correlatieId = randomUUID();
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          vorigeHash: previous?.hash ?? null,
          actorId: user.sub,
          actie: event.actie,
          entiteitType: event.entiteitType,
          entiteitId: event.entiteitId,
          details: event.details,
          correlatieId,
        })
      )
      .digest("hex");

    await tx.auditEvent.create({
      data: {
        taakinstantieId: event.taakinstantieId,
        actorType: "user",
        actorId: user.sub,
        actorNaam: user.name ?? user.username,
        rol: user.roles.includes("recordmanager") ? "recordmanager" : undefined,
        actie: event.actie,
        entiteitType: event.entiteitType,
        entiteitId: event.entiteitId,
        details: event.details,
        correlatieId,
        vorigeHash: previous?.hash,
        hash,
      },
    });
  }
}

function parseOptionalDate(value: string | null | undefined, field: string) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} is geen geldige datum.`);
  }

  return date;
}

function formatDateOnly(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function parseKandidaatBeoordeling(value: string): KandidaatBeoordeling {
  if (value === "AKKOORD" || value === "UITGESLOTEN") {
    return value;
  }

  throw new BadRequestException(
    "beoordeling heeft geen geldige waarde voor de recordmanager."
  );
}

function parseAccorderingBesluit(value: string): AccorderingBesluit {
  if (value === "AKKOORD" || value === "RETOUR") {
    return value;
  }

  throw new BadRequestException("besluit heeft geen geldige waarde.");
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

type StoredVernietigingResultaat = {
  vernietigingskandidaatId?: unknown;
  resultaat?: unknown;
  foutcode?: unknown;
  foutmelding?: unknown;
  bronstatus?: unknown;
  logReference?: unknown;
  correlatieId?: unknown;
};

type VerklaringResultaatRij = {
  kandidaatId: string;
  bronId: string;
  bronIdNaam?: string | null;
  omschrijving: string;
  classificatiesleutel?: string | null;
  selectielijst?: string | null;
  grondslag?: string | null;
  bewaartermijn?: string | null;
  begindatum?: string | null;
  einddatum?: string | null;
  vernietigingsdatum?: string | null;
  aantalObjecten: number;
  aantalBetrokkenen: number;
  vernietigingsstatus: string;
  foutcode?: string | null;
  foutmelding?: string | null;
  bronstatus?: string | null;
  logReference?: string | null;
  correlatieId?: string | null;
  stekker: {
    naam: string;
  };
};

type VerklaringMetadata = {
  taak: {
    id: string;
    naam: string;
    status: string;
    stapSinds: string;
    verantwoordelijken: {
      recordmanager: {
        naam: string;
        email?: string | null;
      };
      proceseigenaar: {
        naam: string;
        email?: string | null;
      };
      archivaris: {
        naam: string;
        email?: string | null;
      };
    };
  };
  versie: number;
  status: string;
  gegenereerdOp: string;
  bijlage: {
    bestandsnaam: string;
    contentType: string;
    aantalRegels: number;
    sha256: string;
    pdfSha256?: string;
  };
  tellingen: {
    success: number;
    failed: number;
    notFound: number;
    skipped: number;
    changed: number;
    aantalObjecten: number;
    aantalBetrokkenen: number;
  };
};

type StoredVerklaring = {
  id: string;
  versie: number;
  status: string;
  metadata: Prisma.JsonValue;
  pdfSha256: string;
  csvSha256: string;
  csvBestandsnaam: string;
  gegenereerdOp: Date;
};

function mapStoredVerklaring(record: StoredVerklaring) {
  const metadata = record.metadata as VerklaringMetadata;

  return {
    ...metadata,
    id: record.id,
    beschikbaar: true,
    versie: record.versie,
    status: record.status,
    gegenereerdOp: record.gegenereerdOp.toISOString(),
    bijlage: {
      ...metadata.bijlage,
      bestandsnaam: record.csvBestandsnaam,
      sha256: record.csvSha256,
      pdfSha256: record.pdfSha256,
    },
  };
}

function buildVerklaringHtml(input: VerklaringMetadata) {
  const rows = [
    ["Taak", input.taak.naam],
    ["Status", input.status],
    ["Versie", input.versie],
    ["Gegenereerd op", input.gegenereerdOp],
    ["Recordmanager", input.taak.verantwoordelijken.recordmanager.naam],
    ["Proceseigenaar", input.taak.verantwoordelijken.proceseigenaar.naam],
    ["Archivaris", input.taak.verantwoordelijken.archivaris.naam],
    ["Succes", input.tellingen.success],
    ["Fout", input.tellingen.failed],
    ["Niet gevonden", input.tellingen.notFound],
    ["Overgeslagen", input.tellingen.skipped],
    ["Gewijzigd", input.tellingen.changed],
    ["Objecten", input.tellingen.aantalObjecten],
    ["Betrokkenen", input.tellingen.aantalBetrokkenen],
    ["CSV-bijlage", input.bijlage.bestandsnaam],
    ["CSV-regels", input.bijlage.aantalRegels],
    ["CSV SHA-256", input.bijlage.sha256],
  ];

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <title>Vernietigingsverklaring</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { color: #0f172a; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5; }
    h1 { font-size: 24px; margin: 0 0 18px; }
    h2 { border-bottom: 1px solid #cbd5e1; font-size: 16px; margin: 28px 0 10px; padding-bottom: 6px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 7px 8px; text-align: left; vertical-align: top; }
    th { color: #475569; font-weight: 700; width: 34%; }
    .muted { color: #475569; }
    .hash { font-family: Consolas, monospace; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <h1>Vernietigingsverklaring</h1>
  <p class="muted">Conceptverklaring voor de vernietigingscockpit. De CSV-bijlage bevat de volledige lijst met uitvoeringsresultaten.</p>
  <h2>Gegevens</h2>
  <table>
    <tbody>
      ${rows
        .map(
          ([label, value]) =>
            `<tr><th>${escapeHtml(label)}</th><td${
              label === "CSV SHA-256" ? ' class="hash"' : ""
            }>${escapeHtml(value)}</td></tr>`
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>`;
}

function buildVernietigingsresultatenCsv(rows: VerklaringResultaatRij[]) {
  const headers = [
    "kandidaat_id",
    "bron_id",
    "bron_id_naam",
    "omschrijving",
    "stekker",
    "classificatiesleutel",
    "selectielijst",
    "grondslag",
    "bewaartermijn",
    "begindatum",
    "einddatum",
    "vernietigingsdatum",
    "aantal_objecten",
    "aantal_betrokkenen",
    "vernietigingsstatus",
    "foutcode",
    "foutmelding",
    "bronstatus",
    "log_reference",
    "correlatie_id",
  ];
  const data = rows.map((row) => [
    row.kandidaatId,
    row.bronId,
    row.bronIdNaam,
    row.omschrijving,
    row.stekker.naam,
    row.classificatiesleutel,
    row.selectielijst,
    row.grondslag,
    row.bewaartermijn,
    row.begindatum,
    row.einddatum,
    row.vernietigingsdatum,
    row.aantalObjecten,
    row.aantalBetrokkenen,
    row.vernietigingsstatus,
    row.foutcode,
    row.foutmelding,
    row.bronstatus,
    row.logReference,
    row.correlatieId,
  ]);

  return [
    headers.map(escapeCsvValue).join(","),
    ...data.map((row) => row.map(escapeCsvValue).join(",")),
  ].join("\r\n");
}

function getResultaatTellingen(rows: VerklaringResultaatRij[]) {
  return rows.reduce(
    (totalen, row) => {
      switch (normalizeVernietigingsresultaat(row.vernietigingsstatus)) {
        case "SUCCESS":
          totalen.success += 1;
          break;
        case "FAILED":
          totalen.failed += 1;
          break;
        case "NOT_FOUND":
          totalen.notFound += 1;
          break;
        case "CHANGED":
          totalen.changed += 1;
          break;
        case "SKIPPED":
          totalen.skipped += 1;
          break;
      }

      totalen.aantalObjecten += row.aantalObjecten;
      totalen.aantalBetrokkenen += row.aantalBetrokkenen;

      return totalen;
    },
    {
      success: 0,
      failed: 0,
      notFound: 0,
      skipped: 0,
      changed: 0,
      aantalObjecten: 0,
      aantalBetrokkenen: 0,
    }
  );
}

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getGotenbergAuthHeaders(
  username: string | undefined,
  password: string | undefined
) {
  if (!username || !password) {
    return undefined;
  }

  return {
    Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString(
      "base64"
    )}`,
  };
}

function getGotenbergChromiumHtmlUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/$/, "");

  if (normalized.includes("/forms/")) {
    return normalized;
  }

  return `${normalized}/forms/chromium/convert/html`;
}

function getResultaatByKandidaatId(value: Prisma.JsonValue | null) {
  const byId = new Map<string, StoredVernietigingResultaat>();

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return byId;
  }

  const resultaten = value["resultaten"];

  if (!Array.isArray(resultaten)) {
    return byId;
  }

  for (const item of resultaten) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const resultaat = item as StoredVernietigingResultaat;
    const kandidaatId = asString(resultaat.vernietigingskandidaatId);

    if (kandidaatId) {
      byId.set(kandidaatId, resultaat);
    }
  }

  return byId;
}

function getVernietigingResultaatTellingen(value: Prisma.JsonValue | null) {
  const tellingen = {
    success: 0,
    failed: 0,
    notFound: 0,
    skipped: 0,
    changed: 0,
  };

  for (const resultaat of getResultaatByKandidaatId(value).values()) {
    switch (normalizeVernietigingsresultaat(resultaat.resultaat)) {
      case "SUCCESS":
        tellingen.success += 1;
        break;
      case "FAILED":
        tellingen.failed += 1;
        break;
      case "NOT_FOUND":
        tellingen.notFound += 1;
        break;
      case "CHANGED":
        tellingen.changed += 1;
        break;
      case "SKIPPED":
        tellingen.skipped += 1;
        break;
    }
  }

  return tellingen;
}

function normalizeVernietigingsresultaat(value: unknown) {
  const normalized = asString(value);

  if (
    normalized === "SUCCESS" ||
    normalized === "FAILED" ||
    normalized === "NOT_FOUND" ||
    normalized === "SKIPPED" ||
    normalized === "CHANGED"
  ) {
    return normalized;
  }

  return "SKIPPED";
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
