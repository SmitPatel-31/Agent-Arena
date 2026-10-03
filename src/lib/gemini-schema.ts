import type { FunctionDeclaration, Schema } from '@google/genai';

/**
 * Keywords Gemini's `Schema` accepts. Composio tool schemas are full JSON Schema
 * (e.g. `examples`), and the API rejects the whole request on any unknown field,
 * so we keep an allow-list rather than chasing a deny-list.
 */
const ALLOWED = new Set<keyof Schema>([
  'type',
  'format',
  'title',
  'description',
  'nullable',
  'enum',
  'default',
  'example',
  'items',
  'minItems',
  'maxItems',
  'properties',
  'required',
  'minProperties',
  'maxProperties',
  'minLength',
  'maxLength',
  'pattern',
  'minimum',
  'maximum',
  'anyOf',
  'propertyOrdering',
]);

type Json = Record<string, unknown>;

export function sanitizeSchema(schema: unknown): Schema {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) return {};
  const out: Json = {};
  for (const [key, value] of Object.entries(schema as Json)) {
    if (!ALLOWED.has(key as keyof Schema)) continue;
    if (key === 'properties' && typeof value === 'object' && value !== null) {
      // Keys here are parameter names, not keywords: keep them all, sanitize each value.
      out.properties = Object.fromEntries(Object.entries(value as Json).map(([name, sub]) => [name, sanitizeSchema(sub)]));
    } else if (key === 'items') {
      out.items = sanitizeSchema(value);
    } else if (key === 'anyOf' && Array.isArray(value)) {
      out.anyOf = value.map(sanitizeSchema);
    } else {
      out[key] = value;
    }
  }
  return out as Schema;
}

export function sanitizeDeclarations(declarations: FunctionDeclaration[]): FunctionDeclaration[] {
  return declarations.map((d) => (d.parameters ? { ...d, parameters: sanitizeSchema(d.parameters) } : d));
}
