// Kleine, reine Hilfsfunktionen ohne DOM-Abhängigkeit.
export const APP_VERSION = '21.36.0';
export const BRAND = 'TRAINR';
export const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const DAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const LABELS = { field: 'Nur Feldspieler', keeper: 'Nur Torwart', both: 'Feldspieler & Torwart' };
export const TYPE_SHORT = { field: 'Feld', keeper: 'Torwart', both: 'Gemischt' };

export const uid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const integer = (x, a, b) => Number.isInteger(x) && x >= a && x <= b;
export const text = (x, n) => typeof x === 'string' && x.trim().length > 0 && x.length <= n;
export const optText = (x, n) => x === undefined || (typeof x === 'string' && x.length <= n);

export function safeURL(x) {
  if (!x) return true;
  try { return new URL(x).protocol === 'https:'; } catch { return false; }
}

/** "HH:MM" → Minuten seit Mitternacht, -1 bei ungültiger Eingabe. */
export function time(s) {
  if (typeof s !== 'string' || !/^\d\d:\d\d$/.test(s)) return -1;
  const [h, m] = s.split(':').map(Number);
  return integer(h, 0, 23) && integer(m, 0, 59) ? h * 60 + m : -1;
}
export const fmtTime = x => String(Math.floor(x / 60) % 24).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0');
export const fmtClock = sec => {
  const s = Math.max(0, Math.round(sec));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const sum = (arr, fn) => arr.reduce((a, x) => a + fn(x), 0);

/** Deterministischer Zufall (mulberry32) – für reproduzierbare Vorschläge und Tests. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const deepClone = x => (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)));
export const fileDate = (d = new Date()) => d.toISOString().slice(0, 10);
export const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'plan';
