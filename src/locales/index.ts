import type { Messages } from '../config/types';
import de from './de';
import en from './en';
import es from './es';
import fr from './fr';
import it from './it';

export const BUILT_IN: Record<string, Messages> = { en, it, es, fr, de };
export { en, it, es, fr, de };
