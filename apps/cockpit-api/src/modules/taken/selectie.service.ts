import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentMedewerkerService } from "../auth/current-medewerker.service.js";
import { PrismaService } from "../../shared/db/prisma.service.js";
import { schrijfAuditEvent } from "../audit/audit-keten.js";
import { mapTaakSelectie, taakSelectieSelect } from "./selectie.dto.js";
import { ACTIEVE_SELECTIE } from "./actieve-selectie.js";
import { datumTekst, nogGepland } from "../taakdefinities/planning.js";
import { TaakToegangService } from "./taak-toegang.service.js";
import { StartSelectieInput, parseOptionalDate, formatDateOnly } from "./taken-hulp.js";
import type { ApiSelectieGestart, ApiTaakSelectie } from "@vernietigingscockpit/api-contract";

// Selectie (F4/CC-16): selectie aanvragen en de stand per stekker tonen.
@Injectable()
export class SelectieService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CurrentMedewerkerService) private readonly currentMedewerker: CurrentMedewerkerService,
    @Inject(TaakToegangService) private readonly toegang: TaakToegangService
  ) {}

  async getSelectie(user: AuthUser, taakinstantieId: string): Promise<ApiTaakSelectie> {
    const taak = await this.prisma.client.taakinstantie.findFirstOrThrow({
      where: {
        id: taakinstantieId,
        ...(await this.toegang.toegangWhere(user)),
      },
      select: taakSelectieSelect,
    });

    return mapTaakSelectie(taak);
  }

  async startSelectie(
    user: AuthUser,
    taakinstantieId: string,
    input: StartSelectieInput
  ): Promise<ApiSelectieGestart> {
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
        verwijderdOp: null,
      },
      select: {
        id: true,
        naam: true,
        status: true,
        peildatum: true,
        geplandOp: true,
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
          where: ACTIEVE_SELECTIE,
          select: {
            id: true,
            status: true,
            stekkerId: true,
          },
        },
      },
    });

    if (taak.status !== "init") {
      throw new BadRequestException("Selectie kan alleen starten vanuit status init.");
    }

    // Geplande uitvoering van een terugkerende taak: pas vanaf de startdatum.
    if (taak.geplandOp && nogGepland(taak.geplandOp, new Date())) {
      throw new ConflictException(
        `Deze taakuitvoering is gepland vanaf ${datumTekst(taak.geplandOp)}; de selectie kan vanaf die datum starten.`
      );
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

    if (taak.selecties.length > 0) {
      const retryStekkerId = input.stekkerId?.trim();

      if (!retryStekkerId) {
        throw new BadRequestException(
          "Voor deze taak is de selectie al gestart. Kies een gefaalde stekker om te herkansen."
        );
      }

      const bestaandeSelectie = taak.selecties.find(
        (selectie) => selectie.stekkerId === retryStekkerId
      );

      if (!bestaandeSelectie) {
        throw new BadRequestException(
          "Voor deze stekker is geen selectie gevonden om te herkansen."
        );
      }

      if (bestaandeSelectie.status !== "FAILED") {
        throw new BadRequestException(
          "Alleen een gefaalde selectie kan opnieuw worden geprobeerd."
        );
      }

      const taakStekker = stekkers.find(
        ({ stekkerId }) => stekkerId === retryStekkerId
      );

      if (!taakStekker) {
        throw new BadRequestException(
          "Deze stekker is niet actief voor deze taakdefinitie."
        );
      }

      const configuratie = taakStekker.stekker.configuraties[0];

      // Herkansen maakt een nieuw selectierecord (CC-16). De mislukte selectie blijft met
      // haar kandidaten en foutmelding bewaard voor het dossier, met status VERVANGEN.
      const nieuweSelectieId = await this.prisma.client.$transaction(async (tx) => {
        const nieuwe = { id: randomUUID() };

        // Eerst de oude vervangen (per taak en stekker is er maar één actieve selectie), en
        // alleen als die nog FAILED is: twee gelijktijdige herkansingen geven één nieuwe.
        const { count } = await tx.selectie.updateMany({
          where: { id: bestaandeSelectie.id, status: "FAILED" },
          data: { status: "VERVANGEN", vervangenDoorId: nieuwe.id },
        });

        if (count === 0) {
          throw new ConflictException("Deze selectie is intussen al opnieuw gestart.");
        }

        await tx.selectie.create({
          data: {
            id: nieuwe.id,
            taakinstantieId: taak.id,
            stekkerId: taakStekker.stekkerId,
            stekkerConfiguratieId: configuratie.id,
            status: "AANGEVRAAGD",
            peildatum: effectievePeildatum,
            selectietijdstip: new Date(),
            configuratieversie: String(configuratie.versie),
          },
        });

        await tx.outbox.create({
          data: {
            taakinstantieId: taak.id,
            queue: "selectie",
            jobNaam: "selectie:start",
            payload: {
              taakinstantieId: taak.id,
              selectieId: nieuwe.id,
              stekkerId: taakStekker.stekkerId,
              stekkerConfiguratieId: configuratie.id,
              peildatum: formatDateOnly(effectievePeildatum),
              selectieparameters: taakStekker.selectieparameters,
            },
          },
        });

        await schrijfAuditEvent(tx, { type: "user", user, rol: "recordmanager" }, {
          taakinstantieId: taak.id,
          eventType: "Selectie opnieuw aangevraagd",
          entiteitType: "selectie",
          entiteitId: nieuwe.id,
          details: {
            vorigeSelectieId: bestaandeSelectie.id,
            selectieId: nieuwe.id,
            stekkerId: taakStekker.stekkerId,
            peildatum: formatDateOnly(effectievePeildatum),
          },
        });

        return nieuwe.id;
      });

      const refreshed = await this.prisma.client.taakinstantie.findUniqueOrThrow({
        where: {
          id: taakinstantieId,
        },
        select: taakSelectieSelect,
      });

      return {
        ...mapTaakSelectie(refreshed),
        aangemaakteSelecties: [nieuweSelectieId],
      };
    }

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

      await schrijfAuditEvent(tx, { type: "user", user, rol: "recordmanager" }, {
        taakinstantieId: taak.id,
        eventType: "Selectie aangevraagd",
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
}
