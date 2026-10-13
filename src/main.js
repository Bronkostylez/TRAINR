// TRAINR V21 – Start: Daten laden/migrieren, Darstellung anwenden, Ansichten registrieren, Router starten.
import * as store from './core/store.js';
import * as timer from './core/timer.js';
import * as i18n from './i18n/index.js';
import { exercise, activeTeam, currentPlan, blockLayout } from './core/planning.js';
import { setResolver } from './scene/motion.js';
import { $, $$, icon } from './ui/dom.js';
import { setLevel, onChange as onMotion } from './ui/motion.js';
import { register, start, setGuard, refresh, currentView, go, TAB_ORDER } from './ui/router.js';
import { toast, beep, haptic } from './ui/feedback.js';
import { speak, silence } from './ui/speech.js';
import { ensurePersist } from './core/persist.js';
import { showHelp } from './ui/help.js';
import { initUpdates } from './ui/update.js';
import { anyOpen } from './ui/sheet.js';
import { esc } from './core/util.js';
import { onboardingView } from './views/onboarding.js';
import { todayView } from './views/today.js';
import { libraryView } from './views/library.js';
import { planView } from './views/plan.js';
import { trainingView } from './views/training.js';
import { moreView, teamSwitcher } from './views/more.js';
import { tacticsView } from './views/tactics.js';
import { calendarView, todaysTraining, reviewEvent } from './views/calendar.js';
import { initReminders } from './ui/reminders.js';
import { initFocusLinks } from './ui/focus.js';
import { autoFill } from './core/calendar.js';

const info = store.init();
i18n.init(store.get().settings.lang); // vor dem ersten Rendern: Sprache festlegen und Übersetzung starten
setResolver(id => exercise(store.get(), id));
initFocusLinks();

// ---------- Darstellung ----------
const darkMq = matchMedia('(prefers-color-scheme: dark)');
function luminance(hex) { const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
function applySettings() {
  const s = store.get().settings, root = document.documentElement;
  root.dataset.theme = s.theme === 'system' ? (darkMq.matches ? 'dark' : 'light') : s.theme;
  root.style.setProperty('--font-scale', s.fontScale / 100);
  if (s.clubColor) { root.style.setProperty('--accent', s.clubColor); root.style.setProperty('--on-accent', luminance(s.clubColor) > .4 ? '#14130e' : '#ffffff'); }
  else { root.style.removeProperty('--accent'); root.style.removeProperty('--on-accent'); }
  setLevel(s.motion);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', root.dataset.theme === 'dark' ? '#0e0e0b' : '#efebe0');
}
darkMq.addEventListener('change', applySettings);
applySettings();

// ---------- Shell ----------
const TAB_INFO = { heute: ['home', 'Heute'], uebungen: ['grid', 'Übungen'], planen: ['plan', 'Planen'], training: ['play', 'Training'], mehr: ['more', 'Mehr'] };
for (const t of $$('.tab')) { const [ic, label] = TAB_INFO[t.dataset.tab]; t.innerHTML = `${icon(ic)}<span>${label}</span>`; t.onclick = () => { haptic('tap'); go(t.dataset.tab); }; }
$('#btn-undo').innerHTML = icon('undo');
$('#btn-help').innerHTML = icon('help');
$('#btn-undo').onclick = () => { const l = store.undo(); if (l) toast(`„${l}“ rückgängig gemacht.`, { action: 'Wiederholen', onAction: () => store.redo() }); };
$('#btn-help').onclick = () => showHelp(currentView()?.id === 'onboarding' ? 'heute' : currentView()?.id);
$('#team-chip').onclick = teamSwitcher;

function syncChrome() {
  const s = store.get(), team = activeTeam(s), chip = $('#team-chip');
  chip.hidden = !team;
  if (team) chip.innerHTML = `<span class="dot" style="--team-color:${team.color || '#133e33'}" aria-hidden="true"></span><span translate="no">${esc(team.name)}</span>`;
  const u = $('#btn-undo'); u.disabled = !store.canUndo(); u.title = store.canUndo() ? `Rückgängig: ${store.undoLabel()}` : 'Nichts rückgängig zu machen';
  const live = $('.tab[data-tab="training"]');
  live.querySelector('.tab-live-dot')?.remove();
  if (timer.running()) live.insertAdjacentHTML('beforeend', '<span class="tab-live-dot" aria-hidden="true"></span>');
  live.setAttribute('aria-label', timer.running() ? 'Training (Timer läuft)' : 'Training');
}

let scrollFrame = 0;
addEventListener('scroll', () => { if (scrollFrame) return; scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; $('#appbar').classList.toggle('scrolled', scrollY > 24); }); }, { passive: true });

// ---------- Ansichten ----------
[onboardingView, todayView, libraryView, planView, trainingView, moreView, tacticsView, calendarView].forEach(register);
setGuard(id => (!store.get().teams.length && id !== 'mehr' ? 'onboarding' : store.get().teams.length && id === 'onboarding' ? 'heute' : id));

store.subscribe((s, reason) => {
  if (reason === 'settings') { applySettings(); syncChrome(); if (currentView()?.id === 'mehr') refresh(reason); return; }
  if (reason === 'storage-error') { toast('Speichern nicht möglich. Jetzt ein Backup herunterladen.'); return; }
  timer.sync();
  syncChrome();
  if (!s.teams.length && currentView()?.id !== 'onboarding' && currentView()?.id !== 'mehr') { go('onboarding'); return; }
  refresh(reason);
});

// ---------- Timer-Rückmeldungen (global, auch außerhalb der Trainingsansicht) ----------
/** Konkrete Trainerrolle des Blocks als Ansage (nur bei geprüften Helferrollen). */
function coachCue(b) {
  try { const s = store.get(), L = blockLayout(s, currentPlan(s), b); return L && L.level !== 'no' && L.coachesUsed && L.coachRole ? ' ' + i18n.t('Trainer: {}.', i18n.t(L.coachRole)) : ''; } catch { return ''; }
}
timer.setHooks({
  onStart: snap => { if (!store.get().settings.speech || !snap.block) return; speak(snap.block.pause ? i18n.t('Pause. {} Minuten.', snap.block.minutes) : i18n.t('Los: {}. {} Minuten.', i18n.t(exercise(store.get(), snap.block.exerciseId)?.name || ''), snap.block.minutes) + coachCue(snap.block)); },
  onWarn: snap => { if (store.get().settings.speech) speak(i18n.t('Noch {} Sekunden.', store.get().settings.warnSeconds)); beep('warn'); haptic('warn'); toast(`Noch ${store.get().settings.warnSeconds} Sekunden: ${snap.block.pause ? 'Pause' : exercise(store.get(), snap.block.exerciseId)?.name || ''}`, { ms: 3000 }); },
  onEnd: snap => {
    beep('end'); haptic('end');
    if (store.get().settings.speech) speak(snap.hasNext ? i18n.t('Block fertig.') : i18n.t('Training geschafft.'));
    const ev = !snap.hasNext && todaysTraining(store.get()); // letzter Block: heutigen Kalendertermin direkt nachbereiten
    toast(snap.hasNext ? (snap.block.pause ? (store.get().settings.autoAdvance ? 'Pause vorbei. Weiter geht’s gleich.' : 'Pause vorbei. Alle zusammenholen.') : store.get().settings.autoAdvance ? 'Block fertig. Nächster Schritt startet gleich.' : 'Block fertig. Kurz sammeln, dann weiter.') : 'Training geschafft! Auslaufen und kurz besprechen.',
      snap.hasNext && !store.get().settings.autoAdvance ? { action: 'Weiter', onAction: () => timer.next({ autostart: true }) } : ev ? { action: 'Nachbereiten', onAction: () => reviewEvent(ev.id), ms: 10000 } : {});
    syncChrome();
  },
  onAuto: () => { beep('start'); },
});
timer.subscribe(() => { const was = $('.tab-live-dot'); if (!!was !== timer.running()) syncChrome(); });
timer.restore();

// ---------- Sicherheitsnetz ----------
let lastCrash = 0;
function crashNotice(msg) {
  if (/ResizeObserver/.test(String(msg)) || Date.now() - lastCrash < 30000) return;
  lastCrash = Date.now();
  toast('Etwas ist schiefgelaufen. Neu laden hilft meistens; gespeicherte Daten bleiben unverändert.', { action: 'Neu laden', onAction: () => location.reload(), ms: 12000 });
}
addEventListener('error', ev => crashNotice(ev.message));
addEventListener('unhandledrejection', ev => crashNotice(ev.reason?.message || ev.reason));
ensurePersist();

// ---------- Tastatur ----------
addEventListener('keydown', ev => {
  if (ev.target.closest?.('input, textarea, select, [contenteditable]')) return;
  const mod = ev.ctrlKey || ev.metaKey;
  if (mod && ev.key.toLowerCase() === 'z' && !ev.shiftKey) { ev.preventDefault(); $('#btn-undo').click(); }
  else if (mod && (ev.key.toLowerCase() === 'y' || (ev.key.toLowerCase() === 'z' && ev.shiftKey))) { ev.preventDefault(); const l = store.redo(); if (l) toast(`„${l}“ wiederhergestellt.`); }
  else if (currentView()?.id === 'training' && ev.key === ' ' && !anyOpen()) { ev.preventDefault(); timer.toggle(); }
  else if (!mod && !ev.altKey && /^[1-5]$/.test(ev.key) && !anyOpen() && store.get().teams.length) go(TAB_ORDER[Number(ev.key) - 1]);
});

// Strg+P ohne Export-Sheet: aktuelle Einheit ausführlich drucken.
addEventListener('beforeprint', () => {
  const root = $('#print-root'); if (root.innerHTML.trim()) return;
  const s = store.get(), p = currentPlan(s); if (!p) return;
  import('./exports/sheet.js').then(m => { root.innerHTML = m.printHtml(s, p, s.settings.exportLayout, s.settings.exportStyle); });
});
addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); window.__installPrompt = ev; if (currentView()?.id === 'mehr') refresh(); });
addEventListener('online', () => toast('Wieder online. Deine Daten bleiben lokal.', { ms: 2500 }));
addEventListener('offline', () => toast('Offline. TRAINR funktioniert weiter.', { ms: 2500 }));
onMotion(() => syncChrome());

syncChrome();
start();
initUpdates();
// Automatische Trainingsserien: beim Start und bei Rückkehr in die App 8 Wochen voraus auffüllen.
const fillSeries = () => { if (store.get().teams.length) store.update('Trainingsserie', d => { autoFill(d); }, { undo: false }); };
fillSeries();
document.addEventListener('visibilitychange', () => { if (!document.hidden) fillSeries(); });
initReminders(id => (id ? go('kalender', 'termin', id) : go('kalender')));
if (info.problem === 'invalid-v3') toast('Gespeicherte Daten waren ungültig und wurden gesichert, nicht überschrieben. Details unter „Mehr“.', { ms: 8000 });
window.__trainr = { store, timer, version: '21.24.0' }; // für Tests und Fehlersuche

// ---------- Wischen zwischen den Haupt-Tabs (nur Touch, nur schmale Bildschirme) ----------
{
  let sw = null;
  const blocked = t => !t.closest || t.closest('input, textarea, select, .chips, .seg, .cal-grid, .board-wrap, .editor-pitch, .blocks, .pitch-scene, input[type=range], dialog, .seg-progress');
  addEventListener('touchstart', ev => {
    if (innerWidth >= 1024 || ev.touches.length !== 1 || anyOpen() || !store.get().teams.length || blocked(ev.target)) { sw = null; return; }
    sw = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, t: performance.now() };
  }, { passive: true });
  addEventListener('touchend', ev => {
    if (!sw) return;
    const dx = ev.changedTouches[0].clientX - sw.x, dy = ev.changedTouches[0].clientY - sw.y, dt = performance.now() - sw.t; sw = null;
    if (Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx) * .6 || dt > 700) return;
    const i = TAB_ORDER.indexOf(currentView()?.tab), next = TAB_ORDER[i + (dx < 0 ? 1 : -1)];
    if (i >= 0 && next) { haptic('tap'); go(next); }
  }, { passive: true });
}
