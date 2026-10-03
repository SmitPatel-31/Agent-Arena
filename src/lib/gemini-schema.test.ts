import { describe, expect, it } from 'vitest';
import { sanitizeSchema } from './gemini-schema';

describe('sanitizeSchema', () => {
  it('drops unsupported keywords at every depth but keeps parameter names', () => {
    const input = {
      type: 'object',
      $schema: 'http://json-schema.org/draft-07/schema#',
      properties: {
        // A parameter literally named "examples" must survive; only the keyword is dropped.
        examples: { type: 'string', examples: ['a'] },
        labels: { type: 'array', items: { type: 'string', examples: ['bug'], additionalProperties: false } },
        filter: { anyOf: [{ type: 'string', examples: ['x'] }, { type: 'integer' }] },
      },
      required: ['labels'],
      additionalProperties: false,
    };

    expect(sanitizeSchema(input)).toEqual({
      type: 'object',
      properties: {
        examples: { type: 'string' },
        labels: { type: 'array', items: { type: 'string' } },
        filter: { anyOf: [{ type: 'string' }, { type: 'integer' }] },
      },
      required: ['labels'],
    });
  });

  it('returns an empty schema for non-objects', () => {
    expect(sanitizeSchema(null)).toEqual({});
    expect(sanitizeSchema(['x'])).toEqual({});
  });
});
