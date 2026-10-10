// Übungskatalog in anderen Sprachen. Deutsch ist die Quelle (data/drills.js + drill-meta.js); hier stehen nur Übersetzungen.
// Wörterbuch je Sprache: deutscher Satz (oder ganzer Text) → Übersetzung. Mehrsätzige Texte werden Satz für Satz übersetzt,
// damit wiederkehrende Sätze (Sicherheitshinweise, Standard-Coaching) nur einmal vorkommen. Unbekanntes bleibt deutsch.
import { getLang } from './index.js';
import { CATALOG_EN } from './catalog-en.js';
import { TAG_VARIANTS_EN } from './catalog-en-tags.js';

const CATALOGS = { en: CATALOG_EN };
const TAG_VARIANTS_BY = { en: TAG_VARIANTS_EN };
const cache = new Map();

const SENTENCE = /(?<=[.!?]) +/;
function tr(dict, s) {
  if (typeof s !== 'string') return s;
  const hit = dict[s];
  if (hit !== undefined) return hit;
  const parts = s.split(SENTENCE);
  return parts.length > 1 ? parts.map(p => dict[p] ?? p).join(' ') : s;
}

/** Übung in der aktuellen Sprache (Kopie mit übersetzten Texten) oder unverändert (Deutsch, eigene Übungen). */
export function localizeExercise(e) {
  const dict = CATALOGS[getLang()];
  if (!dict || e.custom) return e;
  let hit = cache.get(e.id);
  if (!hit) {
    hit = { ...e };
    for (const k of ['name', 'description', 'coaching', 'goal', 'safety']) if (e[k]) hit[k] = tr(dict, e[k]);
    for (const k of ['points', 'variants']) if (Array.isArray(e[k])) hit[k] = e[k].map(x => tr(dict, x));
    cache.set(e.id, hit);
  }
  return hit;
}

/** Leichter/schwerer-Hinweise je Kategorie in der aktuellen Sprache. */
export const localizeVariants = (tag, fallback) => TAG_VARIANTS_BY[getLang()]?.[tag] || fallback;
