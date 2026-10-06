import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { LoggerModule } from "nestjs-pino";

// Logging (CC-15): JSON via pino, met een correlatie_id per request (uit X-Correlation-ID
// van de aanroeper, anders nieuw) die ook in de response terugkomt. Geen headers met
// tokens, geen bodies: alleen methode, pad en status.

const GELDIGE_CORRELATIE = /^[\w.:-]{1,100}$/;

export function correlatieVoorRequest(request: IncomingMessage, response: ServerResponse) {
  const aangeleverd = request.headers["x-correlation-id"];
  const id = typeof aangeleverd === "string" && GELDIGE_CORRELATIE.test(aangeleverd) ? aangeleverd : randomUUID();
  response.setHeader("X-Correlation-ID", id);
  return id;
}

export function loggingModule() {
  return LoggerModule.forRoot({
    pinoHttp: {
      level: process.env.LOG_LEVEL ?? "info",
      genReqId: correlatieVoorRequest,
      customAttributeKeys: { reqId: "correlatie_id" },
      // Health-checks niet loggen: die komen elke paar seconden langs.
      autoLogging: { ignore: (request) => request.url?.startsWith("/api/v1/health") ?? false },
      serializers: {
        req: (request: { method?: string; url?: string }) => ({ method: request.method, url: request.url }),
        res: (response: { statusCode?: number }) => ({ statusCode: response.statusCode }),
      },
      // Vangnet als ergens toch een header of body in een logregel belandt.
      redact: {
        paths: ["req.headers", "res.headers", "headers.authorization", "body", "*.body", "*.password", "*.secret"],
        remove: true,
      },
    },
  });
}
