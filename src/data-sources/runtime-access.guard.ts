import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApplicationConfigService } from '../config/application-configuration.js';

@Injectable()
export class RuntimeAccessGuard implements CanActivate {
  constructor(
    @Inject(ConfigService)
    private readonly configuration: ApplicationConfigService,
  ) {}

  canActivate(_context: ExecutionContext): boolean {
    const nodeEnv = this.configuration.getOrThrow('NODE_ENV', { infer: true });

    if (nodeEnv === 'development' || nodeEnv === 'test') {
      return true;
    }

    throw new ForbiddenException(
      'Database endpoints are available only in development or test.',
    );
  }
}
