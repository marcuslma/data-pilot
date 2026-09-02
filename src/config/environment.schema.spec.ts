import { environmentSchema } from './environment.schema.js';

describe('environmentSchema', () => {
  const validEnvironment = {
    NODE_ENV: 'test',
    OPENAI_API_KEY: 'test-key',
  };

  it('rejects startup configuration without an OpenAI API key', () => {
    expect(
      environmentSchema.safeParse({ NODE_ENV: 'test' }).success,
    ).toBe(false);
  });

  it('rejects a blank OpenAI API key', () => {
    expect(
      environmentSchema.safeParse({
        NODE_ENV: 'test',
        OPENAI_API_KEY: '   ',
      }).success,
    ).toBe(false);
  });

  it('rejects startup configuration without NODE_ENV', () => {
    expect(
      environmentSchema.safeParse({ OPENAI_API_KEY: 'test-key' }).success,
    ).toBe(false);
  });

  it('supplies typed defaults for optional application settings', () => {
    expect(environmentSchema.parse(validEnvironment)).toMatchObject({
      PORT: 3000,
      OPENAI_MODEL: 'gpt-5-nano',
      OPENAI_REASONING_EFFORT: 'medium',
      MAX_ASK_SOURCES: 10,
      MAX_ASK_SUMMARY_ROWS_PER_EXECUTION: 100,
      MAX_ASK_SUMMARY_CONTENT_CHARS: 50_000,
      OBSERVE_SERVICE_ID: 'data-pilot',
    });
  });

  it('normalizes supplied application settings', () => {
    expect(
      environmentSchema.parse({
        ...validEnvironment,
        OPENAI_API_KEY: ' test-key ',
        PORT: '4321',
        OPENAI_MODEL: ' gpt-5.6-luna ',
        OPENAI_REASONING_EFFORT: ' high ',
        MAX_ASK_SOURCES: '4',
        MAX_ASK_SUMMARY_ROWS_PER_EXECUTION: '25',
        MAX_ASK_SUMMARY_CONTENT_CHARS: '1200',
        OBSERVE_APP_KEY: ' app-key ',
        OBSERVE_APP_SECRET: ' app-secret ',
        OBSERVE_SERVICE_ID: ' custom-service ',
      }),
    ).toMatchObject({
      OPENAI_API_KEY: 'test-key',
      PORT: 4321,
      OPENAI_MODEL: 'gpt-5.6-luna',
      OPENAI_REASONING_EFFORT: 'high',
      MAX_ASK_SOURCES: 4,
      MAX_ASK_SUMMARY_ROWS_PER_EXECUTION: 25,
      MAX_ASK_SUMMARY_CONTENT_CHARS: 1200,
      OBSERVE_APP_KEY: 'app-key',
      OBSERVE_APP_SECRET: 'app-secret',
      OBSERVE_SERVICE_ID: 'custom-service',
    });
  });

  it.each([
    ['NODE_ENV', 'staging'],
    ['PORT', '0'],
    ['PORT', '1.5'],
    ['PORT', '65536'],
    ['OPENAI_MODEL', 'gpt-4.1'],
    ['OPENAI_REASONING_EFFORT', 'ultra'],
    ['MAX_ASK_SOURCES', '0'],
    ['MAX_ASK_SUMMARY_ROWS_PER_EXECUTION', '1.5'],
    ['MAX_ASK_SUMMARY_CONTENT_CHARS', '9007199254740992'],
  ])('rejects invalid %s values', (name, value) => {
    expect(
      environmentSchema.safeParse({ ...validEnvironment, [name]: value })
        .success,
    ).toBe(false);
  });

  it('rejects a partial Observe configuration', () => {
    expect(
      environmentSchema.safeParse({
        ...validEnvironment,
        OBSERVE_APP_KEY: 'app-key',
      }).success,
    ).toBe(false);
  });

  it('treats blank optional values as absent', () => {
    expect(
      environmentSchema.parse({
        ...validEnvironment,
        OPENAI_MODEL: '   ',
        OPENAI_REASONING_EFFORT: '   ',
        OBSERVE_APP_KEY: '   ',
        OBSERVE_APP_SECRET: '   ',
        OBSERVE_SERVICE_ID: '   ',
      }),
    ).toMatchObject({
      OPENAI_MODEL: 'gpt-5-nano',
      OPENAI_REASONING_EFFORT: 'medium',
      OBSERVE_SERVICE_ID: 'data-pilot',
    });
  });
});
