import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { UserContext } from './user-context';

interface RequestWithUser {
  headers: Record<string, string | string[] | undefined>;
  user?: UserContext;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    request.user = {
      id: this.headerValue(request, 'x-user-id') ?? 'system',
      naam: this.headerValue(request, 'x-user-name') ?? 'Systeemgebruiker',
      rollen: (this.headerValue(request, 'x-user-roles') ?? 'beheerder')
        .split(',')
        .map((rol) => rol.trim())
        .filter(Boolean),
    };

    return true;
  }

  private headerValue(request: RequestWithUser, name: string): string | undefined {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }
}
