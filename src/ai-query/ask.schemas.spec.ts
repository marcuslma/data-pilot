import { askRequestSchema } from './ask.schemas.js';

describe('askRequestSchema', () => {
  it.each([
    {
      question: '',
      sources: [
        {
          kind: 'postgres',
          connectionUrl: 'postgresql://localhost/test',
        },
      ],
    },
    {
      question: 'x'.repeat(2001),
      sources: [
        {
          kind: 'postgres',
          connectionUrl: 'postgresql://localhost/test',
        },
      ],
    },
    { question: 'teste', sources: [] },
  ])('rejects an invalid request body', (body) => {
    expect(askRequestSchema.safeParse(body).success).toBe(false);
  });

  it('rejects unknown request fields', () => {
    expect(
      askRequestSchema.safeParse({
        question: 'teste',
        sources: [
          {
            kind: 'postgres',
            connectionUrl: 'postgresql://localhost/test',
          },
        ],
        extra: true,
      }).success,
    ).toBe(false);
  });
});
