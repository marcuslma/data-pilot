import { BadRequestException } from '@nestjs/common';

const INVALID_SQL_STATEMENT = 'Invalid SQL statement.';

export function hasMultipleSqlStatements(text: string): boolean {
  if (text.trim().length === 0) {
    throw new BadRequestException(INVALID_SQL_STATEMENT);
  }

  let singleQuoted = false;
  let escapeString = false;
  let doubleQuoted = false;
  let dollarQuoteDelimiter: string | undefined;
  let lineComment = false;
  let blockCommentDepth = 0;
  let terminated = false;
  let contentAfterTerminator = false;
  let hasExecutableContent = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (lineComment) {
      if (character === '\n' || character === '\r') {
        lineComment = false;
      }
      continue;
    }

    if (blockCommentDepth > 0) {
      if (character === '/' && nextCharacter === '*') {
        blockCommentDepth += 1;
        index += 1;
      } else if (character === '*' && nextCharacter === '/') {
        blockCommentDepth -= 1;
        index += 1;
      }
      continue;
    }

    if (dollarQuoteDelimiter) {
      if (text.startsWith(dollarQuoteDelimiter, index)) {
        index += dollarQuoteDelimiter.length - 1;
        dollarQuoteDelimiter = undefined;
      }
      continue;
    }

    if (singleQuoted) {
      if (escapeString && character === '\\' && nextCharacter !== undefined) {
        index += 1;
      } else if (character === "'" && nextCharacter === "'") {
        index += 1;
      } else if (character === "'") {
        singleQuoted = false;
        escapeString = false;
      }
      continue;
    }

    if (doubleQuoted) {
      if (character === '"' && nextCharacter === '"') {
        index += 1;
      } else if (character === '"') {
        doubleQuoted = false;
      }
      continue;
    }

    if (character === '-' && nextCharacter === '-') {
      lineComment = true;
      index += 1;
      continue;
    }

    if (character === '/' && nextCharacter === '*') {
      blockCommentDepth = 1;
      index += 1;
      continue;
    }

    if (character === "'") {
      singleQuoted = true;
      escapeString = isPostgresEscapeString(text, index);
      hasExecutableContent = true;
      continue;
    }

    if (character === '"') {
      doubleQuoted = true;
      hasExecutableContent = true;
      continue;
    }

    if (character === '$') {
      const delimiter = readDollarQuoteDelimiter(text, index);

      if (delimiter) {
        dollarQuoteDelimiter = delimiter;
        index += delimiter.length - 1;
        hasExecutableContent = true;
        continue;
      }
    }

    if (character === ';') {
      terminated = true;
      continue;
    }

    if (!/\s/.test(character)) {
      hasExecutableContent = true;
    }

    if (terminated && !/\s/.test(character)) {
      contentAfterTerminator = true;
    }
  }

  if (
    !hasExecutableContent ||
    singleQuoted ||
    doubleQuoted ||
    dollarQuoteDelimiter ||
    blockCommentDepth > 0
  ) {
    throw new BadRequestException(INVALID_SQL_STATEMENT);
  }

  return contentAfterTerminator;
}

function readDollarQuoteDelimiter(text: string, start: number): string | undefined {
  const remainder = text.slice(start);
  const match = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(remainder);

  return match?.[0];
}

function isPostgresEscapeString(text: string, quoteIndex: number): boolean {
  const prefix = text[quoteIndex - 1];
  const precedingCharacter = text[quoteIndex - 2];

  return (
    (prefix === 'E' || prefix === 'e') &&
    (precedingCharacter === undefined || !/[A-Za-z0-9_$]/.test(precedingCharacter))
  );
}
