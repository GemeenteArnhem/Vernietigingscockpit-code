import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { DossierGrafsteen } from "@prisma/client";
import type { ApiDossier, ApiGrafsteen, ApiVerwijzing, ApiWerkkopieBewaartermijn } from "@vernietigingscockpit/api-contract";
import { PrismaService } from "../../shared/db/prisma.service.js";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentMedewerkerService } from "../auth/current-medewerker.service.js";
import { beginwaarde, leesBewaartermijn, SLEUTEL_BEWAARTERMIJN, zetBewaartermijn } from "./bewaartermijn.js";
import { verifieerGrafstenen } from "./grafsteen.js";

// Beheer van de bewaartermijn van de werkkopie en controle na verwijderen (ADR-0006 §6).
@Injectable()
export class WerkkopieService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(CurrentMedewerkerService) private readonly currentMedewerker: CurrentMedewerkerService
  ) {}

  async getBewaartermijn(): Promise<ApiWerkkopieBewaartermijn> {
    const termijn = await leesBewaartermijn(this.prisma.client, this.beginwaarde());
    return { sleutel: SLEUTEL_BEWAARTERMIJN, ...termijn };
  }

  async zetBewaartermijn(user: AuthUser, waarde: string): Promise<ApiWerkkopieBewaartermijn> {
    await this.prisma.client.$transaction((tx) => zetBewaartermijn(tx, { type: "user", user, rol: "functioneel_beheerder" }, waarde));
    return this.getBewaartermijn();
  }

  verifieerGrafstenen() {
    return verifieerGrafstenen(this.prisma);
  }

  // Een dossier: met werkkopie (verwijzing naar de taak) of na verwijderen de grafsteen.
  // Zichtbaar voor de auditor en de betrokkenen; anderen krijgen 404. Na verwijderen staan
  // er geen namen meer in de grafsteen: betrokken zijn dan de recordmanager, proceseigenaar
  // en archivaris van de taakdefinitie.
  async getDossier(user: AuthUser, taakinstantieId: string): Promise<ApiDossier> {
    const auditor = user.roles.includes("auditor");
    const medewerkerId = auditor ? null : await this.currentMedewerker.findForUser(user);
    const betrokken = (ids: string[]) => auditor || (medewerkerId !== null && ids.includes(medewerkerId));

    const taak = await this.prisma.client.taakinstantie.findUnique({
      where: { id: taakinstantieId },
      select: { id: true, status: true, recordmanagerId: true, proceseigenaarId: true, archivarisId: true },
    });

    if (taak) {
      if (!betrokken([taak.recordmanagerId, taak.proceseigenaarId, taak.archivarisId])) {
        throw new NotFoundException("Dossier niet gevonden.");
      }
      return { status: "werkkopie_aanwezig", taakinstantieId, taakStatus: taak.status };
    }

    const grafsteen = await this.prisma.client.dossierGrafsteen.findUnique({ where: { taakinstantieId } });
    const definitie = grafsteen
      ? await this.prisma.client.taakdefinitie.findUnique({
          where: { id: grafsteen.taakdefinitieId },
          select: { recordmanagerId: true, proceseigenaarId: true, archivarisId: true },
        })
      : null;

    if (!grafsteen || !betrokken(definitie ? [definitie.recordmanagerId, definitie.proceseigenaarId, definitie.archivarisId] : [])) {
      throw new NotFoundException("Dossier niet gevonden.");
    }

    return { status: "werkkopie_verwijderd", taakinstantieId, grafsteen: mapGrafsteen(grafsteen) };
  }

  private beginwaarde() {
    return beginwaarde(this.config.get<string>("WERKKOPIE_BEWAARTERMIJN"));
  }
}

function mapGrafsteen(g: DossierGrafsteen): ApiGrafsteen {
  const verificatie = g.verificatie as { tijdstip: string; uitkomst: string; aantalBestanden: number };

  return {
    id: g.id.toString(),
    taakinstantieId: g.taakinstantieId,
    taakdefinitieId: g.taakdefinitieId,
    archiefvormer: g.archiefvormer as ApiVerwijzing,
    archivering: {
      id: g.archiveringId,
      adapter: g.archiefAdapter,
      locatie: g.archiefLocatie,
      openzaakZaakId: g.openzaakZaakId,
      dossierSha256: g.dossierSha256,
    },
    verificatie: { tijdstip: verificatie.tijdstip, uitkomst: verificatie.uitkomst, aantalBestanden: verificatie.aantalBestanden },
    auditlog: { aantalEvents: g.auditAantalEvents, laatsteHash: g.auditLaatsteHash },
    lijstHash: g.lijstHash,
    verklaring: { versie: g.verklaringVersie, pdfSha256: g.verklaringPdfSha256 },
    afgerondOp: g.afgerondOp?.toISOString() ?? null,
    gearchiveerdOp: g.gearchiveerdOp.toISOString(),
    verwijderdOp: g.verwijderdOp.toISOString(),
    bewaartermijnWerkkopie: g.bewaartermijnWerkkopie,
    hash: g.hash,
  };
}
