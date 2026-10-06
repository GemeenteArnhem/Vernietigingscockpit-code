import { Injectable, type ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ThrottlerGuard, type ThrottlerModuleOptions } from "@nestjs/throttler";

// Rate limit (CC-11): per ingelogde gebruiker (OIDC sub), en per IP voor verzoeken zonder
// login (alleen de health-endpoints). De guard draait na de JwtAuthGuard, zodat de
// gebruiker bekend is. Ongeldige tokens worden eerder al met 401 geweigerd.

type Verzoek = { user?: { sub?: string }; ip?: string };

export function rateLimitSleutel(verzoek: Verzoek) {
  return verzoek.user?.sub ? `gebruiker:${verzoek.user.sub}` : `ip:${verzoek.ip ?? "onbekend"}`;
}

function getal(waarde: string | undefined, standaard: number) {
  const n = Number(waarde);
  return Number.isInteger(n) && n > 0 ? n : standaard;
}

export function rateLimitOpties(config: ConfigService): ThrottlerModuleOptions {
  const gebruiker = getal(config.get<string>("RATE_LIMIT_GEBRUIKER_PER_MINUUT"), 300);
  const anoniem = getal(config.get<string>("RATE_LIMIT_ANONIEM_PER_MINUUT"), 60);

  return {
    errorMessage: "Te veel verzoeken. Probeer het over een minuut opnieuw.",
    throttlers: [
      {
        name: "per-minuut",
        ttl: 60_000,
        limit: (context: ExecutionContext) =>
          context.switchToHttp().getRequest<Verzoek>().user?.sub ? gebruiker : anoniem,
      },
    ],
  };
}

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected override async getTracker(verzoek: Record<string, unknown>) {
    return rateLimitSleutel(verzoek as Verzoek);
  }
}
