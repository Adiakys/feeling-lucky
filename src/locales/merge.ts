import type { Messages } from '../config/types';

export function merge(...parts: Messages[]): Messages {
  const result: Messages = {};
  for (const part of parts)
    for (const [key, value] of Object.entries(part)) {
      const current = result[key];
      result[key] = typeof value === 'object' && typeof current === 'object' ? merge(current, value) : value;
    }
  return result;
}
