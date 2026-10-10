import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentMedewerkerService } from "../auth/current-medewerker.service.js";
import { PrismaService } from "../../shared/db/prisma.service.js";
import { schrijfAuditEvent } from "../audit/audit-keten.js";
import { VerklaringMaker } from "../verklaring/verklaring-maker.js";
import { TaakToegangService } from "./taak-toegang.service.js";
import { mapArchivering, mapStoredVerklaring } from "./taken-hulp.js";
import type { ApiArchivering, ApiArchiveringStand, ApiVerklaring } from "@vernietigingscockpit/api-contract";

// Vernietigingsverklaring (CC-17) en archivering (CC-18).
@Injectable()
export class DossierService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CurrentMedewerkerService) private readonly currentMedewerker: CurrentMedewerkerService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(TaakToegangService) private readonly toegang: TaakToegangService
  ) {
    this.verklaringMaker = new VerklaringMaker(this.prisma, this.config);
  }

  private readonly verklaringMaker: VerklaringMaker;

  async getVerklaring(user: AuthUser, taakinstantieId: string): Promise<ApiVerklaring> {
    const latest = await this.getLatestVerklaring(user, taakinstantieId);

    if (latest) {
      return mapStoredVerklaring(latest);
    }

    // Nog geen verklaring: de worker maakt hem bij de overgang naar resultaat (CC-17).
    // Tot dan een voorbeeld van de inhoud, of niets als de uitvoering nog loopt.
    await this.toegang.taakVoorLijst(user, taakinstantieId);

    try {
      return { ...(await this.verklaringMaker.voorbeeld(taakinstantieId)), beschikbaar: false };
    } catch (error) {
      if (error instanceof ConflictException) {
        return { beschikbaar: false, status: "uitvoering-loopt" };
      }
      throw error;
    }
  }

  // Beheeractie: een nieuwe versie van de verklaring laten maken (bijv. na een fout).
  async verklaringOpnieuw(taakinstantieId: string) {
    const taak = await this.prisma.client.taakinstantie.findUnique({
      where: { id: taakinstantieId },
      select: { id: true, status: true },
    });

    if (!taak) {
      throw new NotFoundException("Taak niet gevonden.");
    }

    if (taak.status !== "resultaat" && taak.status !== "archief") {
      throw new ConflictException("Een verklaring kan pas worden gemaakt als de uitvoering is afgerond.");
    }

    const job = await this.prisma.client.outbox.create({
      data: {
        taakinstantieId,
        queue: "verklaring",
        jobNaam: "verklaring:genereer",
        payload: { taakinstantieId },
      },
      select: { id: true },
    });

    return { taakinstantieId, jobId: job.id };
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

  private async getLatestVerklaring(user: AuthUser, taakinstantieId: string) {
    return this.prisma.client.verklaring.findFirst({
      where: {
        taakinstantieId,
        taakinstantie: await this.toegang.toegangWhere(user),
      },
      orderBy: {
        versie: "desc",
      },
    });
  }

  // Archiveren aanvragen (CC-18): de recordmanager, vanuit resultaat, met If-Match. De
  // worker zet het pakket weg; pas als dat lukt, gaat de taak naar archief. Na een
  // mislukte poging kan de recordmanager opnieuw archiveren.
  async archiveren(user: AuthUser, taakinstantieId: string, verwachteVersie: number): Promise<ApiArchivering> {
    const taak = await this.toegang.taakVoorBesluit(user, taakinstantieId, "recordmanager", "archiveren", verwachteVersie);

    const archivering = await this.prisma.client.$transaction(async (tx) => {
      if ((await tx.verklaring.count({ where: { taakinstantieId: taak.id } })) === 0) {
        throw new ConflictException("Er is nog geen vernietigingsverklaring; archiveren kan zodra die er is.");
      }

      if ((await tx.archivering.count({ where: { taakinstantieId: taak.id, status: "PENDING" } })) > 0) {
        throw new ConflictException("Het archiveren van deze taak loopt al.");
      }

      const nieuw = await tx.archivering.create({
        data: { taakinstantieId: taak.id, adapter: "bestand", aangevraagdDoor: user.sub },
      });
      await tx.outbox.create({
        data: {
          taakinstantieId: taak.id,
          queue: "archief",
          jobNaam: "archief:archiveer",
          payload: { archiveringId: nieuw.id },
        },
      });
      await schrijfAuditEvent(tx, { type: "user", user, rol: "recordmanager" }, {
        taakinstantieId: taak.id,
        eventType: "Archivering aangevraagd",
        entiteitType: "taakinstantie",
        entiteitId: taak.id,
        details: { archiveringId: nieuw.id },
      });

      return nieuw;
    });

    return mapArchivering(archivering);
  }

  async getArchivering(user: AuthUser, taakinstantieId: string): Promise<ApiArchiveringStand> {
    const taak = await this.toegang.taakVoorLijst(user, taakinstantieId);
    const laatste = await this.prisma.client.archivering.findFirst({
      where: { taakinstantieId: taak.id },
      orderBy: { aangevraagdOp: "desc" },
    });

    return { taakStatus: taak.status, archivering: laatste ? mapArchivering(laatste) : null };
  }

  async archiefStand(user: AuthUser, taak: { id: string; status: string; recordmanagerId: string }) {
    const [laatste, verklaringen, medewerkerId] = await Promise.all([
      this.prisma.client.archivering.findFirst({ where: { taakinstantieId: taak.id }, orderBy: { aangevraagdOp: "desc" } }),
      this.prisma.client.verklaring.count({ where: { taakinstantieId: taak.id } }),
      this.currentMedewerker.findForUser(user),
    ]);
    const kan =
      user.roles.includes("recordmanager") &&
      medewerkerId === taak.recordmanagerId &&
      taak.status === "resultaat" &&
      verklaringen > 0 &&
      laatste?.status !== "PENDING";

    return {
      archivering: laatste ? mapArchivering(laatste) : null,
      toegestaneActies: kan ? ["archiveren"] : [],
    };
  }
}
