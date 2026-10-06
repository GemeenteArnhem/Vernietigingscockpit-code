import { BadRequestException, type PipeTransform } from "@nestjs/common";
import { ID_PATROON } from "@vernietigingscockpit/api-contract";
import type { z } from "zod";

// Invoervalidatie aan de rand van de API (CC-11): een ongeldige body, query of id geeft
// altijd 400 met een korte uitleg, nooit een 500. De services houden hun domeinregels.

export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(waarde: unknown): z.output<T> {
    const uitkomst = this.schema.safeParse(waarde);

    if (!uitkomst.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: "Bad Request",
        message: "Ongeldige invoer.",
        fouten: uitkomst.error.issues.slice(0, 20).map((issue) => ({
          veld: issue.path.join(".") || "(body)",
          melding: issue.message,
        })),
      });
    }

    return uitkomst.data;
  }
}

// Voor id-parameters (alle id's in de API zijn UUID's, in de vorm 8-4-4-4-12; zie ID_PATROON).
class IdPipe implements PipeTransform<unknown, string> {
  transform(waarde: unknown): string {
    if (typeof waarde !== "string" || !ID_PATROON.test(waarde)) {
      throw new BadRequestException("Ongeldig id: verwacht een UUID.");
    }

    return waarde;
  }
}

export const UUID = new IdPipe();
