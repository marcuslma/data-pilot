import { createOpenAiConfiguration } from './openai-configuration.js';

describe('createOpenAiConfiguration', () => {
  it('leaves OpenAI unconfigured without an API key', () => {
    expect(createOpenAiConfiguration({})).toBeUndefined();
  });

  it.each([undefined, '   '])(
    'defaults the OpenAI model to gpt-5-nano when it is %p',
    (model) => {
      expect(
        createOpenAiConfiguration({
          OPENAI_API_KEY: 'key-only',
          ...(model === undefined ? {} : { OPENAI_MODEL: model }),
        }),
      ).toMatchObject({
        model: 'gpt-5-nano',
      });
    },
  );

  it('uses normalized OpenAI credentials and configuration', () => {
    expect(
      createOpenAiConfiguration({
        OPENAI_API_KEY: ' test-key ',
        OPENAI_MODEL: ' gpt-5.6-luna ',
        OPENAI_REASONING_EFFORT: ' high ',
      }),
    ).toEqual({
      apiKey: 'test-key',
      model: 'gpt-5.6-luna',
      reasoningEffort: 'high',
    });
  });

  it.each([undefined, '   '])(
    'defaults the OpenAI reasoning effort to medium when it is %p',
    (reasoningEffort) => {
      expect(
        createOpenAiConfiguration({
          OPENAI_API_KEY: 'test-key',
          OPENAI_MODEL: 'gpt-5-nano',
          ...(reasoningEffort === undefined
            ? {}
            : { OPENAI_REASONING_EFFORT: reasoningEffort }),
        }),
      ).toMatchObject({
        reasoningEffort: 'medium',
      });
    },
  );

  it('rejects an unsupported OpenAI model', () => {
    expect(() =>
      createOpenAiConfiguration({
        OPENAI_API_KEY: 'test-key',
        OPENAI_MODEL: 'gpt-4.1',
      }),
    ).toThrow(
      'OPENAI_MODEL must be one of: gpt-5-nano, gpt-5.6-luna, gpt-5.6-terra, gpt-5.6-sol.',
    );
  });

  it('rejects an unsupported OpenAI reasoning effort', () => {
    expect(() =>
      createOpenAiConfiguration({ OPENAI_REASONING_EFFORT: 'ultra' }),
    ).toThrow(
      'OPENAI_REASONING_EFFORT must be one of: none, low, medium, high, xhigh, max.',
    );
  });
});
