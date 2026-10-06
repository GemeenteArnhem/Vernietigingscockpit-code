import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { AppRole } from "./app-role.js";
import type { AuthUser } from "./auth-user.js";
import { IS_PUBLIC_KEY } from "./public.decorator.js";
import { ANY_AUTHENTICATED_KEY, ROLES_KEY } from "./roles.decorator.js";

type AuthenticatedRequest = Request & {
  user?: AuthUser;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const anyAuthenticated = this.reflector.getAllAndOverride<boolean>(ANY_AUTHENTICATED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (anyAuthenticated) {
      return Boolean(request.user);
    }

    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    // Default-deny (CC-11): zonder expliciete rollen is een endpoint niet bereikbaar.
    if (!requiredRoles || requiredRoles.length === 0) {
      return false;
    }

    const userRoles = request.user?.roles ?? [];

    return requiredRoles.some((role) => userRoles.includes(role));
  }
}
