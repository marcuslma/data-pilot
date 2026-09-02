import { createAskConfiguration } from './ask-configuration.js';

describe('createAskConfiguration', () => {
  it('uses bounded defaults', () => {
    expect(createAskConfiguration({})).toEqual({
      maxSources: 10,
      maxSummaryRowsPerExecution: 100,
      maxSummaryContentChars: 50_000,
      openAi: undefined,
    });
  });

  it('uses configured positive limits', () => {
    expect(
      createAskConfiguration({
        MAX_ASK_SOURCES: '4',
        MAX_ASK_SUMMARY_ROWS_PER_EXECUTION: '25',
        MAX_ASK_SUMMARY_CONTENT_CHARS: '1200',
      }),
    ).toEqual({
      maxSources: 4,
      maxSummaryRowsPerExecution: 25,
      maxSummaryContentChars: 1200,
      openAi: undefined,
    });
  });

  it('rejects a non-positive configured limit', () => {
    expect(() =>
      createAskConfiguration({ MAX_ASK_SOURCES: '0' }),
    ).toThrow('MAX_ASK_SOURCES must be a positive integer.');
  });
});
