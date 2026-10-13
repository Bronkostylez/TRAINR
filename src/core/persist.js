// Dauerhafter Browser-Speicher: bittet den Browser, die lokalen Daten nicht von selbst zu löschen.
let state = null; // true | false | null (unbekannt/nicht unterstützt)

export async function ensurePersist() {
  try {
    if (!navigator.storage?.persist) return (state = null);
    if (await navigator.storage.persisted()) return (state = true);
    return (state = !!(await navigator.storage.persist()));
  } catch { return (state = null); }
}
export const persistState = () => state;
