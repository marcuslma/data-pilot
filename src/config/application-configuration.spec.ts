import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

describe('application configuration', () => {
  const originalPort = process.env.PORT;

  afterEach(() => {
    if (originalPort === undefined) {
      delete process.env.PORT;
      return;
    }

    process.env.PORT = originalPort;
  });

  it('exposes schema-coerced values through ConfigService', async () => {
    process.env.PORT = '4321';

    const { applicationConfigurationModule } = await import(
      './application-configuration.js'
    );
    const module = await Test.createTestingModule({
      imports: [applicationConfigurationModule],
    }).compile();

    expect(module.get(ConfigService).get('PORT')).toBe(4321);

    await module.close();
  });
});
