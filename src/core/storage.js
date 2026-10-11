// Aktuelle TRAINR-Daten laden und Backups prüfen. Andere Speicherschlüssel bleiben unberührt.
import { validateV3, emptyV3 } from './schema.js';
import { deepClone } from './util.js';

export const KEY_V3 = 'trainr-v21';

export function load(storage) {
  let raw3 = null;
  try { raw3 = storage.getItem(KEY_V3); } catch { return { state: emptyV3(), source: 'new', problem: 'storage' }; }
  if (raw3) {
    try { return { state: validateV3(JSON.parse(raw3)), source: 'v3' }; }
    catch (err) { return { state: emptyV3(), source: 'new', problem: 'invalid-v3', raw: raw3, error: err.message }; }
  }
  return { state: emptyV3(), source: 'new' };
}

/** Backup-Datei im aktuellen Format prüfen. Wirft mit verständlicher Meldung. */
export function importBackup(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Keine gültige TRAINR-Datei.');
  if (obj.version === 3) {
    const s = validateV3(deepClone(obj));
    for (const k of ['exportedAt', 'app', 'appVersion']) delete s[k];
    return s;
  }
  throw new Error('Unbekanntes Backup-Format.');
}
