import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentMedewerkerService } from "../auth/current-medewerker.service.js";
import { PrismaService } from "../../shared/db/prisma.service.js";
import { schrijfAuditEvent } from "../audit/audit-keten.js";
import { WorkflowService } from "../workflow/workflow.service.js";
import { ACTIEVE_SELECTIE } from "./actieve-selectie.js";
import { taakinstantieActies } from "../workflow/toegestane-acties.js";
import { TaakToegangService } from "./taak-toegang.service.js";
import { DossierService } from "./dossier.service.js";
import { weergaveStatus, telResultaten, leesBatchGrootte, verdeelInBatches, berekenLijstHash, LijstGewijzigdFout, taakStatusAntwoord } from "./taken-hulp.js";
import type { ApiUitvoering, ApiVernietigingsopdracht, ApiVernietigingsresultaten } from "@vernietigingscockpit/api-contract";

// Vernietigingsopdracht en uitvoering (CC-8), en de resultaten.
@Injectable()
export class UitvoeringService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CurrentMedewerkerService) private readonly currentMedewerker: CurrentMedewerkerService,
    @Inject(WorkflowService) private readonly workflow: WorkflowService,
    @Inject(TaakToegangService) private readonly toegang: TaakToegangService,
    @Inject(DossierService) private readonly dossier: DossierService
  ) {}

  async getVernietigingsresultaten(user: AuthUser, taakinstantieId: string): Promise<ApiVernietigingsresultaten> {
    const where = await this.toegang.toegangWhere(user);
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
        versie: true,
        recordmanagerId: true,
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
          where: ACTIEVE_SELECTIE,
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
              include: {
                // Eén regel per vernietiging; per selectie is er één vernietiging.
                uitvoeringsresultaten: true,
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

    const archief = await this.dossier.archiefStand(user, taak);

    return {
      taak: {
        id: taak.id,
        naam: taak.naam,
        status: taak.status,
        stapSinds: taak.stapSinds.toISOString(),
        versie: taak.versie,
        verantwoordelijken: {
          recordmanager: taak.recordmanager,
          proceseigenaar: taak.proceseigenaar,
          archivaris: taak.archivaris,
        },
        // Archivering (CC-18): laatste poging en of de recordmanager nu kan archiveren.
        archivering: archief.archivering,
        toegestaneActies: archief.toegestaneActies,
      },
      resultaten: taak.selecties.flatMap((selectie) => {
        return selectie.kandidaten.map((kandidaat) => {
          const resultaat = kandidaat.uitvoeringsresultaten[0];

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
            // Leeg zolang de stekker nog geen resultaat heeft gemeld; geen standaardwaarde.
            vernietigingsstatus: resultaat?.resultaat ?? null,
            foutcode: resultaat?.foutcode ?? null,
            foutmelding: resultaat?.foutmelding ?? null,
            bronstatus: resultaat?.bronstatus ?? null,
            logReference: resultaat?.logReference ?? null,
            correlatieId: resultaat?.correlatieId ?? null,
            stekker: {
              id: selectie.stekkerConfiguratie.stekker.id,
              naam: selectie.stekkerConfiguratie.stekker.naam,
            },
          };
        });
      }),
    };
  }

  async getUitvoering(user: AuthUser, taakinstantieId: string): Promise<ApiUitvoering> {
    const where = await this.toegang.toegangWhere(user);
    const medewerkerId = await this.currentMedewerker.findForUser(user);
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
        versie: true,
        recordmanagerId: true,
        proceseigenaarId: true,
        archivarisId: true,
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
          where: ACTIEVE_SELECTIE,
          include: {
            stekkerConfiguratie: {
              include: {
                stekker: true,
              },
            },
            vernietiging: {
              include: { resultaten: { select: { resultaat: true } } },
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
        versie: taak.versie,
        verantwoordelijken: {
          recordmanager: taak.recordmanager,
          proceseigenaar: taak.proceseigenaar,
          archivaris: taak.archivaris,
        },
        // De UI leidt geen rechten af (CC-13): welke taakacties kunnen, bepaalt de API.
        toegestaneActies: taakinstantieActies(
          {
            status: taak.status,
            selecties: taak.selecties,
            recordmanager: { id: taak.recordmanagerId },
            proceseigenaar: { id: taak.proceseigenaarId },
            archivaris: { id: taak.archivarisId },
          },
          { roles: user.roles, medewerkerId }
        ),
      },
      stekkers: taak.selecties.map((selectie) => {
        const vernietiging = selectie.vernietiging;
        const fout = vernietiging?.fout ?? selectie.fout;

        return {
          id: selectie.stekkerConfiguratie.stekker.id,
          naam: selectie.stekkerConfiguratie.stekker.naam,
          versie: selectie.configuratieversie,
          stekkerStatus: fout ? "FOUT" : "SUCCES",
          selectieId: selectie.id,
          externSelectieId: selectie.externSelectieId,
          externVernietigingId: vernietiging?.externVernietigingId ?? null,
          vernietigingStatus: weergaveStatus(vernietiging),
          vernietigingGestartOp:
            (vernietiging?.stekkerStarttijd ?? vernietiging?.vrijgegevenOp)?.toISOString() ?? null,
          vernietigingAfgerondOp:
            (vernietiging?.stekkerEindtijd ?? vernietiging?.afgerondOp)?.toISOString() ?? null,
          aantalKandidaten: selectie._count.kandidaten,
          // Voor de bevestiging vóór de vernietigingsopdracht (aantal batches).
          batchGrootte: vernietiging?.batchGrootte ?? leesBatchGrootte(selectie.stekkerConfiguratie.parameters),
          aantalObjecten: selectie.totaalObjecten,
          fout,
          resultaatTellingen: telResultaten(vernietiging?.resultaten ?? []),
          // De UI leidt geen rechten af; welke acties per stekker kunnen, bepaalt de API.
          toegestaneActies:
            user.roles.includes("recordmanager") &&
            medewerkerId === taak.recordmanagerId &&
            taak.status === "uitvoering" &&
            (vernietiging?.status === "MISLUKT" || vernietiging?.status === "INTEGRITEIT_MISLUKT")
              ? ["vernietiging.opnieuw"]
              : [],
        };
      }),
    };
  }

  async vernietigingsopdracht(user: AuthUser, taakinstantieId: string, verwachteVersie: number): Promise<ApiVernietigingsopdracht> {
    const taak = await this.toegang.taakVoorBesluit(user, taakinstantieId, "recordmanager", "vernietiging.opdracht_geven", verwachteVersie);

    const resultaat = await this.prisma.client
      .$transaction(async (tx) => {
        // De lijst moet nog precies zijn wat de archivaris heeft vrijgegeven (CC-9).
        const vrijgegeven = await tx.taakinstantie.findUniqueOrThrow({ where: { id: taak.id }, select: { lijstHash: true } });
        const huidig = await berekenLijstHash(tx, taak.id);

        if (vrijgegeven.lijstHash !== huidig) {
          throw new LijstGewijzigdFout(vrijgegeven.lijstHash, huidig);
        }

        // TODO(CC-9): het id van het archivarisbesluit zodra dat een eigen record heeft.
        const vrijgave = await tx.auditEvent.findFirst({
          where: { taakinstantieId: taak.id, actie: "DESTRUCTION_APPROVED_BY_ARCHIVIST" },
          orderBy: { id: "desc" },
          select: { id: true },
        });

        if (!vrijgave) {
          throw new BadRequestException("Er is geen vrijgave door de archivaris vastgelegd voor deze taak.");
        }

        const selecties = await tx.selectie.findMany({
          where: { taakinstantieId: taak.id, ...ACTIEVE_SELECTIE },
          select: {
            id: true,
            stekkerId: true,
            stekkerConfiguratie: { select: { parameters: true } },
            kandidaten: {
              where: { beoordeling: "AKKOORD" },
              select: { id: true },
              // Vaste volgorde, zodat de batchindeling reproduceerbaar is.
              orderBy: { kandidaatId: "asc" },
            },
          },
        });
        const opdrachtSelecties = selecties.filter((selectie) => selectie.kandidaten.length > 0);
        const totaalKandidaten = opdrachtSelecties.reduce((totaal, selectie) => totaal + selectie.kandidaten.length, 0);

        if (totaalKandidaten === 0) {
          throw new BadRequestException(
            "Er zijn geen akkoord bevonden kandidaten om te vernietigen."
          );
        }

        // Per selectie een eigen vernietigingsrecord met vaste batches en een (lege)
        // resultaatregel per kandidaat; de worker voert de stappen uit (CC-8).
        const vernietigingen: Array<{ vernietigingId: string; selectieId: string; stekkerId: string; aantalKandidaten: number; aantalBatches: number }> = [];

        for (const selectie of opdrachtSelecties) {
          const batchGrootte = leesBatchGrootte(selectie.stekkerConfiguratie.parameters);
          const vernietiging = await tx.vernietiging.create({
            data: {
              taakinstantieId: taak.id,
              selectieId: selectie.id,
              besluitReferentie: `audit-event:${vrijgave.id}`,
              batchGrootte,
              aantalKandidaten: selectie.kandidaten.length,
            },
            select: { id: true },
          });
          const batches = verdeelInBatches(selectie.kandidaten, batchGrootte);

          for (const [index, kandidaten] of batches.entries()) {
            const batch = await tx.vernietigingBatch.create({
              data: { vernietigingId: vernietiging.id, batchNummer: index + 1, aantal: kandidaten.length },
              select: { id: true },
            });
            await tx.uitvoeringsresultaat.createMany({
              data: kandidaten.map((kandidaat) => ({
                vernietigingId: vernietiging.id,
                batchId: batch.id,
                kandidaatId: kandidaat.id,
              })),
            });
          }

          await tx.outbox.create({
            data: {
              taakinstantieId: taak.id,
              queue: "vernietiging",
              jobNaam: "vernietiging:start",
              payload: { vernietigingId: vernietiging.id },
            },
          });
          vernietigingen.push({
            vernietigingId: vernietiging.id,
            selectieId: selectie.id,
            stekkerId: selectie.stekkerId,
            aantalKandidaten: selectie.kandidaten.length,
            aantalBatches: batches.length,
          });
        }

        const taakNa = await this.workflow.transition(tx, {
          taakinstantieId: taak.id,
          actie: "vernietiging.opdracht_geven",
          verwachteVersie,
          actor: { type: "user", user, rol: "recordmanager" },
          details: { totaalKandidaten, besluitReferentie: `audit-event:${vrijgave.id}`, vernietigingen },
        });

        return { taakNa, totaalKandidaten, aantalOpdrachten: vernietigingen.length };
      })
      .catch(async (error: unknown) => {
        if (!(error instanceof LijstGewijzigdFout)) {
          throw error;
        }

        // Eigen transactie: de opdracht zelf is teruggedraaid, de weigering blijft vastgelegd.
        await this.prisma.client.$transaction((tx) =>
          schrijfAuditEvent(tx, { type: "user", user, rol: "recordmanager" }, {
            taakinstantieId: taak.id,
            actie: "EXECUTION_FAILED",
            entiteitType: "taakinstantie",
            entiteitId: taak.id,
            details: { reden: "LIST_CHANGED", vrijgegevenHash: error.vrijgegevenHash, huidigeHash: error.huidigeHash },
          })
        );
        throw new ConflictException(
          error.vrijgegevenHash
            ? "De lijst is na de vrijgave door de archivaris gewijzigd. De vernietigingsopdracht is geweigerd."
            : "Er is geen vastgelegde vrijgave van de lijst door de archivaris. De vernietigingsopdracht is geweigerd."
        );
      });

    return {
      ...taakStatusAntwoord(resultaat.taakNa),
      totaalKandidaten: resultaat.totaalKandidaten,
      aantalOpdrachten: resultaat.aantalOpdrachten,
    };
  }

  // Een mislukte uitvoering voor één stekker opnieuw starten. De uitvoering gaat verder bij
  // de stap die nog openstaat; de Idempotency-Keys blijven gelijk, dus wat de stekker al
  // heeft verwerkt, gebeurt niet nog eens.
  async vernietigingOpnieuw(user: AuthUser, taakinstantieId: string, stekkerId: string) {
    const currentMedewerkerId = await this.currentMedewerker.findForUser(user);

    if (!currentMedewerkerId) {
      throw new ForbiddenException(
        "De ingelogde gebruiker is niet gekoppeld aan een medewerker."
      );
    }

    const vernietiging = await this.prisma.client.vernietiging.findFirst({
      where: {
        taakinstantieId,
        selectie: { stekkerId },
        taakinstantie: {
          recordmanagerId: currentMedewerkerId,
          status: "uitvoering",
        },
      },
      include: { batches: { select: { geaccepteerdOp: true } } },
    });

    if (!vernietiging || (vernietiging.status !== "MISLUKT" && vernietiging.status !== "INTEGRITEIT_MISLUKT")) {
      throw new BadRequestException(
        "Opnieuw proberen kan alleen door de gekoppelde recordmanager, voor een stekker waarvan de vernietigingsopdracht is mislukt."
      );
    }

    const vervolgstap = !vernietiging.externVernietigingId
      ? "vernietiging:start"
      : vernietiging.batches.some((batch) => !batch.geaccepteerdOp)
        ? "vernietiging:batches"
        : !vernietiging.vrijgegevenOp
          ? "vernietiging:vrijgeven"
          : null;

    await this.prisma.client.$transaction(async (tx) => {
      const { count } = await tx.vernietiging.updateMany({
        where: { id: vernietiging.id, status: vernietiging.status },
        data: {
          status: "LOPEND",
          fout: null,
          // Zonder openstaande stap: de stand en resultaten opnieuw opvragen.
          ...(vervolgstap ? {} : { volgendePollOp: new Date(), pollPogingen: 0 }),
        },
      });

      if (count === 0) {
        throw new ConflictException("De uitvoering is intussen al opnieuw gestart.");
      }

      const job = vervolgstap
        ? await tx.outbox.create({
            data: {
              taakinstantieId,
              queue: "vernietiging",
              jobNaam: vervolgstap,
              payload: { vernietigingId: vernietiging.id },
            },
            select: { id: true },
          })
        : null;

      await schrijfAuditEvent(tx, { type: "user", user, rol: "recordmanager" }, {
        taakinstantieId,
        actie: "EXECUTION_RETRY_REQUESTED",
        entiteitType: "taakinstantie",
        entiteitId: taakinstantieId,
        details: {
          stekkerId,
          vernietigingId: vernietiging.id,
          vorigeStatus: vernietiging.status,
          vorigeFout: vernietiging.fout,
          vervolgstap: vervolgstap ?? "status-opvragen",
          nieuweJobId: job?.id ?? null,
        },
      });
    });

    return this.getUitvoering(user, taakinstantieId);
  }
}
