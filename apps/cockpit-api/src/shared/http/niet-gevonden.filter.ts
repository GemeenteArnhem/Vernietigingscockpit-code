import { ArgumentsHost, Catch, HttpStatus } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";

// Prisma-fouten voor "bestaat niet" (findFirstOrThrow, update op onbekend id) en voor een
// id dat geen geldige UUID is, worden een 404 zonder interne details. Een taak waar je
// geen toegang toe hebt is voor de API hetzelfde als een taak die niet bestaat.
// Alle andere fouten gaan naar de standaardafhandeling van Nest (500 zonder details).
@Catch()
export class NietGevondenFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() === "http" && isNietGevonden(exception)) {
      const response = host.switchToHttp().getResponse<{
        status(code: number): { json(body: unknown): void };
      }>();

      response.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        message: "Niet gevonden.",
        error: "Not Found",
      });
      return;
    }

    super.catch(exception, host);
  }
}

export function isNietGevonden(exception: unknown) {
  if (!(exception instanceof Error)) {
    return false;
  }

  const code = (exception as { code?: unknown }).code;

  return (
    (exception.name === "PrismaClientKnownRequestError" && (code === "P2025" || code === "P2023")) ||
    // Postgres 22P02 via de driver-adapter: ongeldige UUID in een filter.
    /invalid input syntax for type uuid/i.test(exception.message)
  );
}
