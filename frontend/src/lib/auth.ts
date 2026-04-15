
import type { AuthTokens } from './types';

const KEY = 'paperwork_auth';

export function loadTokens(): AuthTokens | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthTokens; } catch { return null; }
}

export function saveTokens(tokens: AuthTokens | null) {
  if (!tokens) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, JSON.stringify(tokens));
}
