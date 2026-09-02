import { vi } from 'vitest';

describe('AppModule configuration', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalOpenAiApiKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    restoreEnvironment('NODE_ENV', originalNodeEnv);
    restoreEnvironment('OPENAI_API_KEY', originalOpenAiApiKey);
    vi.resetModules();
  });

  it('fails module initialization when OPENAI_API_KEY is absent', async () => {
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = '';
    vi.resetModules();

    await expect(import('./app.module.js')).rejects.toThrow('OPENAI_API_KEY');
  });
});

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
