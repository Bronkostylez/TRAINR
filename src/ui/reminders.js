// Erinnerungen an Termine – ohne Server. Geprüft wird, solange TRAINR geöffnet ist (auch im Hintergrund-Tab)
// und beim nächsten Öffnen. Verlässlich bei geschlossener App: Termine als .ics in den Handy-Kalender übernehmen.
import * as store from '../core/store.js';
import { dueReminders, reminderKey, title, fmtDate } from '../core/calendar.js';
import { toast, beep, haptic } from './feedback.js';

const KEY = 'trainr-reminded';
let seen = new Set(), timer = null, onOpen = () => {};
try { seen = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { /* egal */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...seen].slice(-300))); } catch { /* egal */ } };

export const supported = () => typeof Notification !== 'undefined';
/** 'granted' | 'denied' | 'default' | 'unsupported' */
export const permission = () => (supported() ? Notification.permission : 'unsupported');
export async function requestPermission() {
  if (!supported()) return 'unsupported';
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

function text(ev) {
  const team = store.get().teams.find(t => t.id === ev.teamId), plan = store.get().plans.find(p => p.id === ev.planId);
  return { head: `${title(ev)} · ${fmtDate(ev.date, { relative: true })}, ${ev.start} Uhr`, body: [team?.name, plan ? `Einheit: ${plan.name}` : 'Noch keine Einheit geplant', ev.place].filter(Boolean).join(' · ') };
}

async function notify(ev) {
  const { head, body } = text(ev);
  if (permission() !== 'granted' || !document.hidden) return false;
  const opts = { body, tag: `trainr-${ev.id}`, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: `./#kalender/termin/${ev.id}` } };
  try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) { await reg.showNotification(`TRAINR · ${head}`, opts); return true; } } catch { /* Fallback unten */ }
  try { const n = new Notification(`TRAINR · ${head}`, opts); n.onclick = () => { focus(); onOpen(ev.id); }; return true; } catch { return false; }
}

/** Prüft fällige Erinnerungen und meldet jede genau einmal. */
export function check(now = new Date()) {
  const due = dueReminders(store.get(), now, seen);
  for (const ev of due) {
    seen.add(reminderKey(ev));
    notify(ev);
    const { head, body } = text(ev);
    if (navigator.userActivation?.hasBeenActive) beep('warn'); // Ton erst nach einer Nutzeraktion möglich
    haptic('warn');
    toast(`⏰ ${head}. ${body}`, { ms: 9000, action: 'Öffnen', onAction: () => onOpen(ev.id) });
  }
  if (due.length) save();
  return due;
}

export function initReminders(open) {
  onOpen = open;
  clearInterval(timer);
  timer = setInterval(check, 30_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  navigator.serviceWorker?.addEventListener?.('message', ev => { if (ev.data?.type === 'open-event') onOpen(ev.data.id); });
  setTimeout(check, 1500);
}
