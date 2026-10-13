// Sprachansagen im Training (optional, Web Speech API). Ohne Unterstützung passiert nichts.
import { locale } from '../i18n/index.js';

export const supported = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';

export function speak(text) {
  if (!supported() || !text) return false;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = locale(); u.rate = 0.95;
    speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}
export function silence() { try { if (supported()) speechSynthesis.cancel(); } catch { /* egal */ } }
