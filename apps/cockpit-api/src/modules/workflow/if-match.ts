import { BadRequestException, HttpException, HttpStatus } from "@nestjs/common";

// Statuswijzigingen vereisen de taakversie die de client kent (optimistic locking).
// Geaccepteerd: `3`, `"3"` en `W/"3"`. Zonder header 428, bij onzin 400.
export function leesIfMatch(header: string | undefined): number {
  if (header === undefined || header.trim() === "") {
    throw new HttpException(
      {
        statusCode: HttpStatus.PRECONDITION_REQUIRED,
        message: "If-Match met de taakversie is verplicht bij deze actie.",
        error: "Precondition Required",
      },
      HttpStatus.PRECONDITION_REQUIRED
    );
  }

  const match = /^(?:W\/)?"?(\d{1,9})"?$/.exec(header.trim());

  if (!match) {
    throw new BadRequestException("If-Match bevat geen geldige taakversie.");
  }

  return Number(match[1]);
}

export function etagVoorVersie(versie: number) {
  return `"${versie}"`;
}
