// Einziger Zustand der App. Alle Änderungen laufen über `update()`:
// Undo-Schnappschuss → Änderung → Validierung → Speichern → Benachrichtigung.
import { load, KEY_V3 } from './migrate.js';
import { validateV3 } from './schema.js';
import { deepClone } from './util.js';

const UNDO_LIMIT = 40;
const listeners = new Set();
let state, undoStack = [], redoStack = [], storageOK = true, loadInfo, saveTimer = null;

export function init(storage = globalThis.localStorage) {
  loadInfo = load(storage);
  state = loadInfo.state;
  if (loadInfo.raw) {
    // Ungültige Daten niemals überschreiben: Kopie unter Recovery-Schlüssel ablegen.
    try {
      storage.setItem(`${KEY_V3}-recovery-${Date.now()}`, loadInfo.raw);
      loadInfo.resolved = true; // Kopie liegt sicher – ab jetzt darf trainr-v21 neu geschrieben werden
    } catch {
      // Speicher voll: Rohdaten bleiben am Originalschlüssel, bis der Nutzer ein Backup gezogen hat.
      if (loadInfo.problem === 'invalid-v3') storageOK = false;
    }
  }
  if (loadInfo.problem === 'storage') storageOK = false;
  if (loadInfo.source === 'v2') persist(); // erste V21-Kopie anlegen; trainr-v2 bleibt unverändert
  return loadInfo;
}

export const get = () => state;
export const info = () => ({ ...loadInfo, storageOK });
export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;
export const undoLabel = () => undoStack.at(-1)?.label || '';
export const redoLabel = () => redoStack.at(-1)?.label || '';

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(reason) { for (const fn of listeners) { try { fn(state, reason); } catch (err) { console.error(err); } } }

function persist() {
  if (loadInfo?.problem === 'invalid-v3' && !loadInfo.resolved) return; // Nutzer muss zuerst entscheiden
  try { localStorage.setItem(KEY_V3, JSON.stringify(state)); storageOK = true; }
  catch { storageOK = false; emit('storage-error'); }
}
function schedule() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 120); }
export function flush() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; persist(); } }
if (typeof window !== 'undefined') { addEventListener('pagehide', flush); document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); }); }

/**
 * Ändert den Zustand. `fn` bekommt einen Entwurf (tiefe Kopie) und verändert ihn direkt.
 * Optionen: undo (Standard true) – Schnappschuss für Rückgängig; reason – für Abonnenten.
 * Wirft, wenn das Ergebnis ungültig wäre; der alte Zustand bleibt dann bestehen.
 */
export function update(label, fn, { undo = true, reason = 'data' } = {}) {
  const before = JSON.stringify(state);
  const draft = deepClone(state);
  const result = fn(draft);
  validateV3(draft);
  if (JSON.stringify(draft) === before) return result;
  if (undo) {
    undoStack.push({ label, snap: before });
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    redoStack = [];
  }
  state = draft;
  schedule();
  emit(reason);
  return result;
}

/** Einstellungen ohne Undo-Eintrag ändern (Darstellung soll nicht im Rückgängig-Verlauf landen). */
export function setting(key, value) { return update('Einstellung', s => { s.settings[key] = value; }, { undo: false, reason: 'settings' }); }

export function undo() {
  const entry = undoStack.pop(); if (!entry) return null;
  redoStack.push({ label: entry.label, snap: JSON.stringify(state) });
  state = keepSettings(JSON.parse(entry.snap)); schedule(); emit('undo'); return entry.label;
}
export function redo() {
  const entry = redoStack.pop(); if (!entry) return null;
  undoStack.push({ label: entry.label, snap: JSON.stringify(state) });
  state = keepSettings(JSON.parse(entry.snap)); schedule(); emit('redo'); return entry.label;
}
// Rückgängig betrifft Inhalte, nie die aktuelle Darstellung.
function keepSettings(next) { next.settings = deepClone(state.settings); return next; }

/** Kompletten Zustand ersetzen (Import, Wiederherstellung). Mit Undo-Eintrag. */
export function replace(next, label = 'Daten ersetzt') {
  validateV3(next);
  undoStack.push({ label, snap: JSON.stringify(state) }); redoStack = [];
  state = next;
  if (loadInfo) loadInfo.resolved = true;
  persist(); emit('replace');
}

/** Nach einem Ladeproblem bewusst neu beginnen (Rohdaten liegen gesichert unter dem Recovery-Schlüssel). */
export function resolveProblem() { if (loadInfo) loadInfo.resolved = true; storageOK = true; persist(); emit('data'); }
