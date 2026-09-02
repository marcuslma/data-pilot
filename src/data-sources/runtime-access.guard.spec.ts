import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { ApplicationConfigService } from '../config/application-configuration.js';
import { RuntimeAccessGuard } from './runtime-access.guard.js';

describe('RuntimeAccessGuard', () => {
  const context = {} as ExecutionContext;

  it.each(['development', 'test'])('allows database endpoints in %s', (nodeEnv) => {
    expect(
      new RuntimeAccessGuard(configurationFor(nodeEnv)).canActivate(context),
    ).toBe(true);
  });

  it('rejects database endpoints in production', () => {
    expect(() =>
      new RuntimeAccessGuard(configurationFor('production')).canActivate(context),
    ).toThrow(
      new ForbiddenException(
        'Database endpoints are available only in development or test.',
      ),
    );
  });
});

function configurationFor(nodeEnv: string): ApplicationConfigService {
  return {
    getOrThrow: () => nodeEnv,
  } as unknown as ApplicationConfigService;
}
