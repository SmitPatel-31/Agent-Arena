/**
 * Racers. All are Gemini models that were on the free tier when this was written.
 * Free-tier availability changes; run `npm run check:models` to ping each one.
 */
export interface ModelOption {
  id: string;
  label: string;
  blurb: string;
}

export const MODELS: readonly ModelOption[] = [
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', blurb: 'Smallest and fastest' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', blurb: 'Newest, but only 20 free requests/day' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', blurb: 'Full Flash model, thinks before acting' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', blurb: 'Older lightweight model' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (preview)', blurb: 'Preview release' },
];

// Checked 2026-10-03: gemini-2.5-* returns 404 for new API keys, gemini-3.1-pro-preview has no
// free-tier quota, and gemini-3.8-flash allows only 20 requests/day (about 3 races), so it is not a default.
export const DEFAULT_MODELS = { A: 'gemini-3.5-flash-lite', B: 'gemini-3.6-flash' } as const;

export function isKnownModel(id: string): boolean {
  return MODELS.some((m) => m.id === id);
}

export function modelLabel(id: string): string {
  return MODELS.find((m) => m.id === id)?.label ?? id;
}
