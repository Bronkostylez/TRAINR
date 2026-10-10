// Mehrsprachigkeit. Deutsch ist die Quellsprache: Der Code schreibt deutsche Texte, die Übersetzung ersetzt sie
// beim Anzeigen (Textknoten und Beschriftungs-Attribute). Für Deutsch läuft nichts davon – kein Beobachter, kein Aufwand.
// Wörterbuch: Schlüssel = deutscher Text. Ein `{}` im Schlüssel steht für einen beliebigen Teil (Name, Text, …), `{#}` für eine Zahl;
// im Wert wird er der Reihe nach (`{}`) oder mit Nummer (`{2}`) wieder eingesetzt. Ein Teil wird selbst übersetzt, wenn er bekannt ist.
// Inhalte der Nutzer sind Ausnahmen: Elemente mit `translate="no"` bleiben unverändert.
import { EN } from './en.js';

/** Verfügbare Sprachen: [Code, Eigenname, BCP-47-Gebietsschema für Datum/Zahlen]. Neue Sprache = Eintrag hier + Wörterbuch in DICTS + Katalog. */
export const LANGS = [['de', 'Deutsch', 'de-DE'], ['en', 'English', 'en-GB']];
export const LANG_CODES = LANGS.map(l => l[0]);
const DICTS = { en: EN };

let lang = 'de', exact = new Map(), patterns = [], observer = null;
const written = new WeakMap();

/** Gewählte Sprache bestimmen. `pref` = 'auto' oder ein Sprachcode; bei „auto“ zählt die erste bekannte Gerätesprache, sonst Englisch. */
export function resolve(pref, list) {
  if (LANG_CODES.includes(pref)) return pref;
  const langs = list || (typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : []);
  for (const l of langs) { const c = String(l || '').toLowerCase().split('-')[0]; if (LANG_CODES.includes(c)) return c; }
  return langs.length ? 'en' : 'de';
}

export const getLang = () => lang;
/** Gebietsschema für Datum und Zahlen. Passt die Gerätesprache zur App-Sprache, gilt deren Region (z. B. en-US). */
export function locale() {
  const dev = typeof navigator !== 'undefined' ? navigator.language : '';
  return dev && dev.toLowerCase().startsWith(lang) ? dev : LANGS.find(l => l[0] === lang)[2];
}

const fill = (tpl, args) => { let i = 0; return tpl.replace(/\{(\d*)\}/g, (_, d) => args[d ? d - 1 : i++] ?? ''); };
// Starke Trenner zuerst: „3 Gruppen à 4 · 1 wechselt ein“ beginnt mit einer Zahl, besteht aber aus zwei eigenständigen Teilen.
const STRONG = [' · ', ' – '], SEPS = [': ', '; ', ', '];
const norm = s =>s.replace(/\s+/g, ' ');

function lookup(core, depth = 0) {
  const hit = exact.get(core);
  if (hit !== undefined) return hit;
  if (depth > 3) return core;
  for (const [re, tpl] of patterns) {
    const g = re.exec(core);
    if (g) return fill(tpl, g.slice(1).map(x => lookup(x, depth + 1)));
  }
  const pre = /^([⚠✓✕★♥●▲▣▰▤◇◆⚽🧤→←↗↶↻⏭•+\-–—·]+\s*)(.+)$/u.exec(core); // Symbol-Präfix bleibt, Rest wird übersetzt
  if (pre) { const r = lookup(pre[2], depth + 1); if (r !== pre[2]) return pre[1] + r; }
  const sent = core.split(/(?<=[.!?]) (?=[A-ZÄÖÜ„"(⚠])/); // mehrere Sätze in einem Textknoten: einzeln übersetzen
  if (sent.length > 1) { const out = sent.map(x => lookup(x, depth + 1)); if (out.some((x, i) => x !== sent[i])) return out.join(' '); }
  const parted = seps => { // zusammengesetzte Zeilen („Aufwärmen · 2 Gruppen“): Teile einzeln übersetzen
    for (const sep of seps) {
      if (!core.includes(sep)) continue;
      const parts = core.split(sep), out = parts.map(x => lookup(x, depth + 1));
      if (out.some((x, i) => x !== parts[i])) return out.join(sep);
    }
    return null;
  };
  const strong = parted(STRONG);
  if (strong !== null) return strong;
  const num = /^(\d+(?:[.,]\d+)?) (.+)$/.exec(core); // „5 Einheiten“: Zahl bleibt, Rest wird übersetzt
  if (num) { const r = lookup(num[2], depth + 1); if (r !== num[2]) return `${num[1]} ${/^[A-Z][a-z]/.test(r) ? r[0].toLowerCase() + r.slice(1) : r}`; }
  return parted(SEPS) ?? core;
}

/** Deutschen Text übersetzen. Unbekanntes bleibt unverändert. Führende/abschließende Leerzeichen bleiben erhalten. */
export function t(s, ...args) {
  if (typeof s !== 'string') return s;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), core = m[2];
  if (!core || lang === 'de') return args.length ? fill(s, args) : s;
  const r = lookup(norm(core));
  return m[1] + (args.length ? fill(r, args) : r) + m[3];
}

// ---------- Anzeige übersetzen ----------
const ATTRS = ['aria-label', 'title', 'placeholder', 'alt', 'aria-description'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);

function text(n) {
  const v = n.nodeValue, w = written.get(n);
  if (w === v || !n.parentElement || n.parentElement.translate === false || SKIP.has(n.parentElement.tagName)) return;
  const r = t(v);
  if (r !== v) { n.nodeValue = r; written.set(n, r); }
}
function attrs(el) {
  for (const a of ATTRS) {
    const v = el.getAttribute?.(a);
    if (v) { const r = t(v); if (r !== v) el.setAttribute(a, r); }
  }
}
function walk(n) {
  if (n.nodeType === 3) return text(n);
  if (n.nodeType !== 1 || n.translate === false || n.tagName === 'SCRIPT' || n.tagName === 'STYLE') return;
  attrs(n); // Platzhalter von Textfeldern werden übersetzt, ihr Inhalt (Nutzertext) nie
  if (SKIP.has(n.tagName)) return;
  for (let c = n.firstChild; c; c = c.nextSibling) walk(c);
}

function compile(dict) {
  exact = new Map(); patterns = [];
  for (const [k, v] of Object.entries(dict)) {
    if (!/\{#?\}/.test(k)) { exact.set(norm(k), v); continue; }
    const nk = norm(k), parts = nk.split(/\{#?\}/), kinds = [...nk.matchAll(/\{(#?)\}/g)].map(m => (m[1] ? '(\\d+(?:[.,]\\d+)?)' : '(.+?)'));
    const re = new RegExp('^' + parts.map((x, i) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (kinds[i] || '')).join('') + '$');
    patterns.push([re, v, parts.join('').length]);
  }
  patterns.sort((a, b) => b[2] - a[2]);
  patterns = patterns.map(([re, v]) => [re, v]);
}

/** Sprache festlegen und – außer bei Deutsch – die Anzeige fortlaufend übersetzen. Einmal beim Start aufrufen, vor dem ersten Rendern. */
export function init(pref) {
  lang = resolve(pref);
  document.documentElement.lang = lang;
  observer?.disconnect(); observer = null;
  if (lang === 'de') return lang;
  compile(DICTS[lang]);
  walk(document.documentElement);
  observer = new MutationObserver(recs => {
    for (const r of recs) {
      if (r.type === 'childList') r.addedNodes.forEach(walk);
      else if (r.type === 'characterData') text(r.target);
      else if (r.type === 'attributes') attrs(r.target);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  return lang;
}
