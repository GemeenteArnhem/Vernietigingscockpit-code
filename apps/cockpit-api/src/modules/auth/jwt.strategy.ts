import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import jwksRsa from "jwks-rsa";
import { isAppRole } from "./app-role.js";
import type { AuthUser } from "./auth-user.js";

type RealmAccess = {
  roles?: string[];
};

type JwtPayload = {
  sub: string;
  iss: string;
  aud: string | string[];
  preferred_username?: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
  realm_access?: RealmAccess;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(@Inject(ConfigService) config: ConfigService) {
    const issuer = requiredConfig(config, "OIDC_ISSUER");
    const audience = requiredConfig(config, "OIDC_AUDIENCE");

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience,
      issuer,
      algorithms: ["RS256"],
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `${issuer}/protocol/openid-connect/certs`,
      }),
    });
  }

  validate(payload: JwtPayload): AuthUser {
    const roles = (payload.realm_access?.roles ?? []).filter(isAppRole);

    return {
      sub: payload.sub,
      username: payload.preferred_username,
      name: payload.name,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      roles,
      issuer: payload.iss,
      audience: payload.aud,
    };
  }
}

function requiredConfig(config: ConfigService, key: string) {
  const value = config.get<string>(key);

  if (!value) {
    throw new Error(`Configuratie ${key} ontbreekt.`);
  }

  return value;
}
