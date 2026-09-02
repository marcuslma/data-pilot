import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RuntimeAccessGuard } from './runtime-access.guard.js';

describe('RuntimeAccessGuard', () => {
  const context = {} as ExecutionContext;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
      return;
    }

    process.env.NODE_ENV = originalNodeEnv;
  });

  it.each(['development', 'test'])('allows database endpoints in %s', (nodeEnv) => {
    process.env.NODE_ENV = nodeEnv;

    expect(new RuntimeAccessGuard().canActivate(context)).toBe(true);
  });

  it('rejects database endpoints in production', () => {
    process.env.NODE_ENV = 'production';

    expect(() => new RuntimeAccessGuard().canActivate(context)).toThrow(
      new ForbiddenException(
        'Database endpoints are available only in development or test.',
      ),
    );
  });
});
