import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserContext } from './user-context';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserContext => {
    const request = ctx.switchToHttp().getRequest<{ user: UserContext }>();
    return request.user;
  },
);
