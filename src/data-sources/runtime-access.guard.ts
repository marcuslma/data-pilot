import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class RuntimeAccessGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    const nodeEnv = process.env.NODE_ENV;

    if (nodeEnv === 'development' || nodeEnv === 'test') {
      return true;
    }

    throw new ForbiddenException(
      'Database endpoints are available only in development or test.',
    );
  }
}
