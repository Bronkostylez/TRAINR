// Explicit editorial role audit. Never infer a coach role from a tag or group size.
// A coach replaces only a cooperative feeder/partner, never an opponent or competing player.
const partner = 'gk-gateroll gk-rectangle gk-gatepass warm roll feet v5-kball v5-kdistance gatepass left-right threepasses v5-widegate'.split(' ');
const feed = 'gk-strike ready catch chest high angle react v5-kready v5-kroll v5-ksoft v5-kfollow v22-kwinkel v22-kwechsel v22-kherauslaufen v22-kaufsetzer v22-kkreuz pass v5-kopen v22-kabwurf v5-receive v5-kcolor'.split(' ');
export const COACH_ROLES = Object.fromEntries([
  ...partner.map(id => [id, { role: 'Partner-Zuspiel', slots: 1 }]),
  ...feed.map(id => [id, { role: 'Zuspiel / Zuwurf', slots: 1 }]),
  ['v5-scan', { role: 'Richtung zeigen', slots: 1 }],
  ['gk-steps', { role: 'Kontrollierter Zuwurf', external: true }],
]);
export const coachRole = e => e && !e.custom ? COACH_ROLES[e.id] || null : null;
