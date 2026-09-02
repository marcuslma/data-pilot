import { BadRequestException } from '@nestjs/common';
import { hasMultipleSqlStatements } from './sql-statement.js';

describe('hasMultipleSqlStatements', () => {
  it.each([
    "SELECT ';'",
    'SELECT 1; -- trailing ;',
    'SELECT 1 /* ; */',
  ])('accepts one statement when punctuation is inside SQL syntax: %s', (text) => {
    expect(hasMultipleSqlStatements(text)).toBe(false);
  });

  it('detects a second SQL statement', () => {
    expect(hasMultipleSqlStatements('SELECT 1; SELECT 2')).toBe(true);
  });

  it.each(['-- inspection notes only', '/* inspection notes only */'])(
    'rejects comment-only text: %s',
    (text) => {
      expect(() => hasMultipleSqlStatements(text)).toThrow(
        new BadRequestException('Invalid SQL statement.'),
      );
    },
  );

  it('keeps semicolons inside a PostgreSQL escape string literal', () => {
    expect(hasMultipleSqlStatements("SELECT E'escaped\\'; semicolon'"))
      .toBe(false);
  });

  it.each(["SELECT 'unfinished", 'SELECT 1 /* unfinished'])(
    'rejects an unterminated quote or comment: %s',
    (text) => {
      expect(() => hasMultipleSqlStatements(text)).toThrow(
        new BadRequestException('Invalid SQL statement.'),
      );
    },
  );
});
