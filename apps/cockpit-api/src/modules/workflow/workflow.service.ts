import {
  ConflictException,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { schrijfAuditEvent, type AuditActor } from "../audit/audit-keten.js";
import { isTerugsturen, TRANSITIES, type Transitie, type TransitieActie } from "./transitions.js";

export type TransitieOpdracht = {
  taakinstantieId: string;
  actie: TransitieActie;
  // Versie die de client kent (If-Match). Bij systeemovergangen leeg.
  verwachteVersie?: number;
  actor: AuditActor;
  details?: Prisma.InputJsonValue;
  // Extra velden bij de overgang, bijv. gestartOp of afgerondOp.
  extraData?: Prisma.TaakinstantieUpdateManyMutationInput;
};

// De enige plek waar de status van een taakinstantie verandert.
//
// In de transactie van de aanroeper:
// 1. conditionele update: alleen als de taak nog in de verwachte status (en versie) staat,
//    zodat gelijktijdige verzoeken (dubbelklik, twee tabbladen) maar één keer slagen;
// 2. versie +1 (optimistic locking), bij terugsturen ook ronde +1;
// 3. audit-event in dezelfde transactie.
//
// Fouten: 404 als de taak niet bestaat, 412 bij een verouderde versie, 409 bij een
// verkeerde status. Rol- en persoonscontroles (403) doen de services vóóraf.
@Injectable()
export class WorkflowService {
  async transition(tx: Prisma.TransactionClient, opdracht: TransitieOpdracht) {
    const transitie: Transitie = TRANSITIES[opdracht.actie];
    const { count } = await tx.taakinstantie.updateMany({
      where: {
        id: opdracht.taakinstantieId,
        status: transitie.van,
        ...(opdracht.verwachteVersie !== undefined ? { versie: opdracht.verwachteVersie } : {}),
      },
      data: {
        status: transitie.naar,
        stapSinds: new Date(),
        versie: { increment: 1 },
        ...(isTerugsturen(opdracht.actie) ? { ronde: { increment: 1 } } : {}),
        ...opdracht.extraData,
      },
    });

    if (count === 0) {
      throw await this.redenGeweigerd(tx, opdracht);
    }

    await schrijfAuditEvent(tx, opdracht.actor, {
      taakinstantieId: opdracht.taakinstantieId,
      eventType: transitie.eventType,
      entiteitType: "taakinstantie",
      entiteitId: opdracht.taakinstantieId,
      details: {
        ...(opdracht.details && typeof opdracht.details === "object" && !Array.isArray(opdracht.details)
          ? opdracht.details
          : {}),
        van: transitie.van,
        naar: transitie.naar,
      },
    });

    // Bijv. bij de vrijgave door de archivaris: de lijst is daarmee bevroren (MDTO Bevriezing),
    // met de vingerafdruk van de lijst in de details.
    if (transitie.vervolgEventType) {
      const extra = (opdracht.extraData ?? {}) as { lijstHash?: unknown };
      await schrijfAuditEvent(tx, { type: "system" }, {
        taakinstantieId: opdracht.taakinstantieId,
        eventType: transitie.vervolgEventType,
        entiteitType: "taakinstantie",
        entiteitId: opdracht.taakinstantieId,
        details: { na: transitie.eventType, ...(typeof extra.lijstHash === "string" ? { lijstHash: extra.lijstHash } : {}) },
      });
    }

    return tx.taakinstantie.findUniqueOrThrow({
      where: { id: opdracht.taakinstantieId },
      select: { id: true, status: true, stapSinds: true, versie: true, ronde: true },
    });
  }

  // Snelle controle vóór validaties, met dezelfde foutcodes als transition(): 412 bij een
  // verouderde versie, 409 bij een verkeerde status. Vervangt de atomaire controle niet.
  controleerVooraf(taak: { status: string; versie: number }, actie: TransitieActie, verwachteVersie?: number) {
    const fout = weigering(taak, actie, verwachteVersie);

    if (fout) {
      throw fout;
    }
  }

  private async redenGeweigerd(tx: Prisma.TransactionClient, opdracht: TransitieOpdracht) {
    const huidig = await tx.taakinstantie.findUnique({
      where: { id: opdracht.taakinstantieId },
      select: { status: true, versie: true },
    });

    if (!huidig) {
      return new NotFoundException("Taak niet gevonden.");
    }

    return (
      weigering(huidig, opdracht.actie, opdracht.verwachteVersie) ??
      new PreconditionFailedException(VERSIE_MELDING)
    );
  }
}

const VERSIE_MELDING = "De taak is intussen gewijzigd door iemand anders. Laad de pagina opnieuw.";

function weigering(taak: { status: string; versie: number }, actie: TransitieActie, verwachteVersie?: number) {
  const { van } = TRANSITIES[actie];

  // De If-Match-voorwaarde gaat vóór: wie een verouderde versie heeft (tweede tabblad,
  // dubbelklik), moet opnieuw laden, ook als de status intussen ook veranderd is.
  if (verwachteVersie !== undefined && taak.versie !== verwachteVersie) {
    return new PreconditionFailedException(VERSIE_MELDING);
  }

  if (taak.status !== van) {
    return new ConflictException(
      `De taak staat op status '${taak.status}'; deze actie kan alleen vanuit '${van}'.`
    );
  }

  return null;
}
