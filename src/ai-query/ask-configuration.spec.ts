import { createAskConfiguration } from './ask-configuration.js';

describe('createAskConfiguration', () => {
  it('uses bounded defaults and leaves OpenAI unconfigured without both credentials', () => {
    expect(createAskConfiguration({})).toEqual({
      maxSources: 10,
      maxSummaryRowsPerExecution: 100,
      maxSummaryContentChars: 50_000,
      openAi: undefined,
    });

    expect(
      createAskConfiguration({
        OPENAI_API_KEY: 'key-only',
        OPENAI_MODEL: '   ',
      }),
    ).toMatchObject({ openAi: undefined });
  });

  it('uses configured positive limits and OpenAI credentials', () => {
    expect(
      createAskConfiguration({
        OPENAI_API_KEY: 'test-key',
        OPENAI_MODEL: 'test-model',
        MAX_ASK_SOURCES: '4',
        MAX_ASK_SUMMARY_ROWS_PER_EXECUTION: '25',
        MAX_ASK_SUMMARY_CONTENT_CHARS: '1200',
      }),
    ).toEqual({
      maxSources: 4,
      maxSummaryRowsPerExecution: 25,
      maxSummaryContentChars: 1200,
      openAi: { apiKey: 'test-key', model: 'test-model' },
    });
  });

  it('rejects a non-positive configured limit', () => {
    expect(() =>
      createAskConfiguration({ MAX_ASK_SOURCES: '0' }),
    ).toThrow('MAX_ASK_SOURCES must be a positive integer.');
  });
});
