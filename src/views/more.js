// Mehr: Mannschaften, Darstellung & Bedienung, Training, Daten (Backup/Import), Hilfe, Info & Updates.
import * as store from '../core/store.js';
import { importBackup } from '../core/storage.js';
import { LIMITS, DEFAULT_SETTINGS } from '../core/schema.js';
import { esc, LABELS, DAYS_SHORT, APP_VERSION, fileDate, uid, TYPE_SHORT, plural } from '../core/util.js';
import { activeTeam, plansOfTeam } from '../core/planning.js';
import { icon, on, $ } from '../ui/dom.js';
import { openSheet, confirmSheet } from '../ui/sheet.js';
import { toast, haptic } from '../ui/feedback.js';
import { undoToast } from '../ui/actions.js';
import { teamWizard, TEAM_COLORS } from './onboarding.js';
import { showHelp, tour } from '../ui/help.js';
import { go } from '../ui/router.js';
import { downloadBlob } from '../exports/share.js';
import { autoFill, resyncAuto } from '../core/calendar.js';
import { LANGS, locale } from '../i18n/index.js';

const CLUB = [null, '#d4f26b', '#ffd23f', '#ff8a3d', '#ef4444', '#3b82f6', '#22c55e', '#e5e7eb'];

export function downloadBackup() {
  const s = store.get();
  const data = { ...s, exportedAt: new Date().toISOString(), app: 'TRAINR', appVersion: APP_VERSION };
  downloadBlob(`trainr-backup-${fileDate()}.json`, JSON.stringify(data, null, 2), 'application/json');
  store.update('Backup', d => { d.help.lastBackup = Date.now(); }, { undo: false, reason: 'meta' });
  toast('Backup heruntergeladen. Datei sicher aufbewahren.');
}

/** Datei wählen und als Backup oder geteilte Einheit importieren. */
export function pickBackup() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'application/json,.json,.trainr';
  input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    try {
      if (file.size > LIMITS.backupBytes) throw new Error('Datei zu groß (max. 5 MB).');
      const obj = JSON.parse(await file.text());
      if (obj?.kind === 'trainr-plan') { const m = await import('../exports/share.js'); m.importSharedPlan(obj); return; }
      const next = importBackup(obj);
      const teams = next.teams.length, plans = next.plans.filter(p => !p.template).length;
      const ok = await confirmSheet({ title: 'Backup wiederherstellen?', text: `${plural(teams, 'Mannschaft', 'Mannschaften')}, ${plural(plans, 'Einheit', 'Einheiten')} und ${plural(next.custom.length, 'eigene Übung', 'eigene Übungen')}. Deine aktuellen Daten werden ersetzt – direkt danach ist Rückgängig möglich.`, ok: 'Wiederherstellen', danger: true });
      if (!ok) return;
      if (!next.settings) next.settings = { ...DEFAULT_SETTINGS };
      store.replace(next, 'Backup wiederhergestellt');
      undoToast('Backup wiederhergestellt.');
      go(next.teams.length ? 'heute' : 'onboarding');
    } catch (err) {
      haptic('warn');
      toast(`Import abgelehnt: ${err.message}`);
    }
  };
  input.click();
}

export function teamSwitcher() {
  const s = store.get();
  openSheet({
    title: 'Mannschaft wechseln',
    body: `<div class="list">${s.teams.map(t => `<button class="list-item" type="button" data-team="${t.id}" aria-current="${t.id === s.activeTeamId}"><span class="team-card" style="padding:0;border:0;display:contents"><span class="dot" style="--team-color:${t.color || '#133e33'};width:36px;height:36px;border-radius:11px;background:${t.color || '#133e33'};color:#fff;display:grid;place-items:center;font-weight:900">${esc(t.name.slice(0, 2).toUpperCase())}</span></span><span class="grow"><strong translate="no">${esc(t.name)}</strong><small>${esc(t.age)} · ${esc(TYPE_SHORT[t.type])} · ${plural(plansOfTeam(s, t.id).length, 'Einheit', 'Einheiten')}</small></span>${t.id === s.activeTeamId ? icon('check') : ''}</button>`).join('')}</div>`,
    foot: `<button class="btn" type="button" data-manage>${icon('settings')} Verwalten</button><button class="btn primary" type="button" data-newteam>${icon('plus')} Neue Mannschaft</button>`,
    onMount: sh => {
      on(sh.body, 'click', '[data-team]', (_, b) => { switchTeam(b.dataset.team); sh.close(); });
      sh.foot.querySelector('[data-newteam]').onclick = () => { sh.close(); setTimeout(() => editTeam(null), 220); };
      sh.foot.querySelector('[data-manage]').onclick = () => go('mehr');
    },
  });
}

export function switchTeam(id) {
  const s = store.get(); if (id === s.activeTeamId) return;
  store.update('Mannschaft gewechselt', d => {
    d.activeTeamId = id;
    const p = d.plans.find(x => !x.template && x.teamId === id);
    if (p) d.selectedPlanId = p.id;
    else { const t = d.teams.find(x => x.id === id), n = { id: uid(), teamId: id, name: 'Meine Einheit', people: 12, slot: t.slots[0].day, focus: 'Alle', notes: '', goal: '', blocks: [], date: null }; d.plans.push(n); d.selectedPlanId = n.id; }
  });
  haptic('ok');
  toast(`Mannschaft: ${activeTeam(store.get()).name}`);
}

export function editTeam(id) {
  const s = store.get(), team = s.teams.find(t => t.id === id);
  if (!team && s.teams.length >= LIMITS.teams) { toast(`Maximal ${LIMITS.teams} Mannschaften.`); return; }
  const sh = openSheet({ title: team ? 'Mannschaft bearbeiten' : 'Neue Mannschaft' });
  teamWizard(sh.body, {
    initial: team, title: team ? team.name : 'Neue Mannschaft', submitLabel: 'Speichern', onCancel: () => sh.close(),
    onDone: t => {
      store.update(team ? 'Mannschaft geändert' : 'Mannschaft angelegt', d => {
        const i = d.teams.findIndex(x => x.id === t.id);
        if (i >= 0) { d.teams[i] = t; resyncAuto(d, team, t); } else { d.teams.push(t); d.activeTeamId = t.id; autoFill(d); const n = { id: uid(), teamId: t.id, name: 'Meine erste Einheit', people: 12, slot: t.slots[0].day, focus: 'Alle', notes: '', goal: '', blocks: [], date: null }; d.plans.push(n); d.selectedPlanId = n.id; }
        for (const p of d.plans) if (p.teamId === t.id && !t.slots.some(x => x.day === p.slot)) p.slot = t.slots[0].day;
      });
      sh.close();
      undoToast(team ? 'Mannschaft gespeichert.' : `„${t.name}“ angelegt und ausgewählt.`);
    },
  });
}

async function deleteTeam(id) {
  const s = store.get(), t = s.teams.find(x => x.id === id), n = s.plans.filter(p => p.teamId === id && !p.template).length;
  if (s.teams.length <= 1) { toast('Die letzte Mannschaft kann nicht gelöscht werden.'); return; }
  if (!(await confirmSheet({ title: `„${t.name}“ löschen?`, text: `Die Mannschaft, ${plural(n, 'ihre Einheit', 'ihre Einheiten')} und ihre Kalendertermine werden gelöscht. Vorlagen und eigene Übungen bleiben. Rückgängig ist direkt danach möglich.`, ok: 'Löschen', danger: true }))) return;
  store.update('Mannschaft gelöscht', d => {
    d.teams = d.teams.filter(x => x.id !== id);
    d.plans = d.plans.filter(p => p.teamId !== id || p.template);
    d.events = d.events.filter(ev => ev.teamId !== id);
    if (d.activeTeamId === id) d.activeTeamId = d.teams[0].id;
    if (!d.plans.some(p => p.id === d.selectedPlanId)) d.selectedPlanId = d.plans.find(p => !p.template && p.teamId === d.activeTeamId)?.id ?? null;
  });
  undoToast(`„${t.name}“ gelöscht.`);
}

export const moreView = {
  id: 'mehr', title: 'Mehr', tab: 'mehr',
  render(root) { this.root = root; this.paint(); },
  refresh() { this.paint(); },
  paint() {
    const s = store.get(), st = s.settings, info = store.info();
    const expanded = new Set([...this.root.querySelectorAll('details[data-more-group][open]')].map(e => e.dataset.moreGroup));
    const seg = (key, opts) => `<div class="seg" role="radiogroup" aria-label="${key}">${opts.map(([v, t]) => `<button type="button" role="radio" data-set="${key}" data-v="${v}" aria-checked="${String(st[key]) === String(v)}">${t}</button>`).join('')}</div>`;
    const sw = (key, title, sub) => `<label class="switch-row"><span>${title}<small>${sub}</small></span><input class="switch" type="checkbox" data-toggle="${key}" ${st[key] ? 'checked' : ''}></label>`;
    this.root.innerHTML = `
      <div class="page-head"><div><p class="eyebrow">Lokal · ohne Konto</p><h1 id="h-mehr">Mehr</h1></div></div>
      ${!info.storageOK ? `<div class="notice danger">${icon('warn')}<span>Lokaler Speicher nicht verfügbar oder gespeicherte Daten ungültig. Vorhandene Browserdaten wurden nicht überschrieben${info.raw ? ' und zusätzlich gesichert' : ''}. Bitte ein Backup herunterladen.</span></div>` : ''}

      <section class="settings-group"><h2>Mannschaften</h2><div class="settings-card" style="padding:0">
        ${s.teams.map(t => `<div class="team-card"><span class="dot" style="--team-color:${t.color || '#133e33'}">${esc(t.name.slice(0, 2).toUpperCase())}</span><span><strong translate="no">${esc(t.name)}</strong>${t.id === s.activeTeamId ? ' <span class="tag ok">aktiv</span>' : ''}<br><small class="tiny">${esc(t.age)} · ${esc(LABELS[t.type])} · ${t.slots.map(x => `${DAYS_SHORT[x.day]} ${x.start}–${x.end}`).join(', ')}</small></span>
          <span class="row" style="gap:0">${t.id !== s.activeTeamId ? `<button class="btn sm" type="button" data-use-team="${t.id}">Wählen</button>` : ''}<button class="icon-btn" type="button" data-edit-team="${t.id}" aria-label="${esc(t.name)} bearbeiten">${icon('edit')}</button>${s.teams.length > 1 ? `<button class="icon-btn" type="button" data-del-team="${t.id}" aria-label="${esc(t.name)} löschen">${icon('trash')}</button>` : ''}</span></div>`).join('')}
        <div style="padding:12px 16px"><button class="btn block" type="button" id="m-newteam">${icon('plus')} Mannschaft hinzufügen</button></div></div></section>

      <section class="settings-group"><h2>Werkzeuge</h2><div class="list">
        <button class="list-item" type="button" data-go="kalender">${icon('calendar')}<span class="grow"><strong>Kalender</strong><small>Termine, Serien, Erinnerungen und Rückblick</small></span>${icon('chevron')}</button>
        <button class="list-item" type="button" data-go="taktik">${icon('board')}<span class="grow"><strong>Taktikboard</strong><small>Spieler, Keeper (lila), Ball und Laufwege frei bewegen</small></span>${icon('chevron')}</button>
        <button class="list-item" type="button" data-go-plan="packliste">${icon('cone')}<span class="grow"><strong>Packliste</strong><small>Material der aktuellen Einheit abhaken</small></span>${icon('chevron')}</button>
        <button class="list-item" type="button" id="m-export">${icon('print')}<span class="grow"><strong>Export & Druck</strong><small>PDF, Bild, Text, CSV, Teilen</small></span>${icon('chevron')}</button></div></section>

      <details class="disclosure settings-group more-disclosure" data-more-group="appearance" ${expanded.has('appearance') ? 'open' : ''}><summary>Darstellung</summary><div class="body"><div class="settings-card">
        <div class="field"><span>Sprache</span><div class="seg" role="radiogroup" aria-label="Sprache">${[['auto', 'Auto'], ...LANGS.map(l => [l[0], l[1]])].map(([v, t]) => `<button type="button" role="radio" data-lang="${v}"${v === 'auto' ? '' : ' translate="no" lang="' + v + '"'} aria-checked="${(st.lang || 'auto') === v}">${t}</button>`).join('')}</div><small class="tiny">Auto folgt der Gerätesprache. Deine Daten und Übungen bleiben unverändert.</small></div>
        <div class="field"><span>Erscheinungsbild</span>${seg('theme', [['system', 'System'], ['light', 'Hell'], ['dark', 'Dunkel']])}</div>
        <div class="field"><span>Animationen</span>${seg('motion', [['full', 'Voll'], ['reduced', 'Reduziert'], ['off', 'Aus']])}<small class="tiny">„Weniger Bewegung“ im System hat immer Vorrang und begrenzt auf „Reduziert“.</small></div>
        <div class="field"><span>Schriftgröße</span>${seg('fontScale', [[90, 'Klein'], [100, 'Normal'], [115, 'Groß'], [130, 'Sehr groß']])}</div>
        <div class="field"><span>Vereinsfarbe (Akzent)</span><div class="color-row">${CLUB.map(c => `<button type="button" class="swatch" data-club="${c || ''}" aria-pressed="${st.clubColor === c}" aria-label="${c ? `Akzentfarbe ${c}` : 'Standard (Schiri-Gelb)'}" style="background:${c || 'linear-gradient(135deg,#ffd400 50%,#14130e 50%)'}"></button>`).join('')}</div><small class="tiny">Torwart-Elemente bleiben immer lila.</small></div>
      </div></div></details>

      <details class="disclosure settings-group more-disclosure" data-more-group="controls" ${expanded.has('controls') ? 'open' : ''}><summary>Bedienung & Training</summary><div class="body"><div class="settings-card">
        ${sw('haptics', 'Vibration bei Aktionen', 'Nur auf unterstützten Geräten')}
        ${sw('sound', 'Signaltöne', 'Vorwarnung und Blockende')}
        ${sw('autoAdvance', 'Automatisch zum nächsten Block', 'Startet 2,5 s nach Blockende den nächsten Block')}
        ${sw('wakeLock', 'Bildschirm anlassen', 'Während der Timer läuft, falls der Browser es erlaubt')}
        <div class="field"><span>Vorwarnung vor Blockende</span>${seg('warnSeconds', [[0, 'Aus'], [10, '10 s'], [30, '30 s'], [60, '60 s']])}</div>
      </div></div></details>

      <section class="settings-group"><h2>Daten</h2><div class="settings-card">

        <div class="grid-2" style="margin-bottom:12px"><button class="btn primary" type="button" id="m-backup">${icon('download')} Backup herunterladen</button><button class="btn" type="button" id="m-restore">${icon('upload')} Backup / Datei importieren</button></div>
        <details class="disclosure" style="margin-bottom:12px"><summary>Wo liegen meine Daten?</summary><div class="body">        <p class="small muted" style="margin:12px 0">Einheiten, Kalendertermine, Mannschaften, eigene Übungen, Merkliste, Bewertungen, Notizen, Taktikboards und Einstellungen liegen nur im Speicher dieses Browsers. Kein Tracking, kein Server, keine Spielerdaten. Browserdaten löschen oder privater Modus kann alles entfernen.</p></div></details>
        <details class="disclosure" style="margin-bottom:12px"><summary>Weitere Optionen</summary><div class="body">
          <button class="btn sm danger" type="button" id="m-reset" style="margin-top:8px">${icon('trash')} Alle V21-Daten zurücksetzen</button>
          <p class="tiny">Lade vorher ein Backup herunter.</p></div></details>
        <p class="tiny">${s.help.lastBackup ? `Letztes Backup: ${new Date(s.help.lastBackup).toLocaleDateString(locale())}` : 'Noch kein Backup erstellt.'}</p>
      </div></section>

      <details class="disclosure settings-group more-disclosure" data-more-group="help" ${expanded.has('help') ? 'open' : ''}><summary>Hilfe & Info</summary><div class="body"><div class="list">
        <button class="list-item" type="button" id="m-tour">${icon('sparkles')}<span class="grow"><strong>Kurze Einführung</strong></span>${icon('chevron')}</button>
        <button class="list-item" type="button" id="m-help">${icon('help')}<span class="grow"><strong>Hilfe</strong><small>Erklärungen zu jeder Ansicht über ? oben rechts</small></span>${icon('chevron')}</button>
        <button class="list-item" type="button" id="m-update">${icon('reset')}<span class="grow"><strong>Nach Updates suchen</strong><small>Version ${APP_VERSION}</small></span>${icon('chevron')}</button>
        <button class="list-item" type="button" id="m-install" hidden>${icon('download')}<span class="grow"><strong>App installieren</strong><small>Startbildschirm, offline nutzbar</small></span>${icon('chevron')}</button>
      </div>
      <details class="disclosure" style="margin-top:12px"><summary>Übungen & Sicherheit</summary><div class="body small">
        <p>Die Übungen sind eigene Kurzfassungen und Varianten auf Grundlage öffentlicher Trainerquellen des DFB. Jede Übung nennt ihre Quelle. Altersgrenzen, Minuten, Feldgrößen und Materialmengen sind redaktionelle Vorschläge, keine offiziellen Normen.</p>
        <p>Spielerzahlen zählen immer ohne Trainer. Keine Kopfballübungen. Falltechnik erst ab D-Jugend, nur auf weichem, ebenem Boden und mit geschulter Anleitung; bei Angst, Schmerz oder unsicherem Fallen nicht steigern. Bambini trainieren spielerisch und werden nicht früh auf die Torwartposition festgelegt.</p>
        <p>Die Platzskizzen sind schematisch: keine maßstabsgetreuen Positionen, keine Technik-Demonstration.</p></div></details>
      <details class="disclosure" style="margin-top:12px"><summary>Aufs Handy</summary><div class="body small">
        <p>Öffentliche TRAINR-App: <a href="https://bronkostylez.github.io/TRAINR/" target="_blank" rel="noopener noreferrer">bronkostylez.github.io/TRAINR</a>. Android/Chrome: Menü → „App installieren“. iPhone/Safari: Teilen → „Zum Home-Bildschirm“. Einmal online laden, danach offline nutzen.</p>
        <p>Die App ruft keine externen Inhalte ab; nur bewusst geöffnete Quellenlinks führen nach außen. Lokal: <code>node serve.cjs</code> und <code>http://localhost:8765</code>.</p></div></details>
      <p class="tiny" style="text-align:center;margin-top:24px">TRAINR ${APP_VERSION} · Fußballtraining lokal geplant</p></div></details>`;
    this.bind();
  },
  bind() {
    const r = this.root;
    on(r, 'click', '[data-set]', (_, b) => {
      const k = b.dataset.set, raw = b.dataset.v, v = ['fontScale', 'warnSeconds'].includes(k) ? Number(raw) : raw;
      store.setting(k, v); haptic('tap');
      if (k === 'motion') toast(v === 'off' ? 'Animationen aus.' : v === 'reduced' ? 'Reduzierte Animationen.' : 'Animationen an.');
    });
    on(r, 'click', '[data-lang]', (_, b) => {
      if (b.dataset.lang === (store.get().settings.lang || 'auto')) return;
      store.setting('lang', b.dataset.lang); store.flush(); haptic('tap');
      location.reload(); // Die Anzeige wird einmal beim Start übersetzt; ein Neustart der Ansicht ist der sauberste Wechsel.
    });
    on(r, 'change', '[data-toggle]', (_, c) => { store.setting(c.dataset.toggle, c.checked); haptic('tap'); });
    on(r, 'click', '[data-club]', (_, b) => { store.setting('clubColor', b.dataset.club || null); haptic('tap'); });
    on(r, 'click', '[data-use-team]', (_, b) => switchTeam(b.dataset.useTeam));
    on(r, 'click', '[data-edit-team]', (_, b) => editTeam(b.dataset.editTeam));
    on(r, 'click', '[data-del-team]', (_, b) => deleteTeam(b.dataset.delTeam));
    on(r, 'click', '[data-go]', (_, b) => go(b.dataset.go));
    on(r, 'click', '[data-go-plan]', (_, b) => go('planen', b.dataset.goPlan));
    $('#m-newteam', r).onclick = () => editTeam(null);
    $('#m-export', r).onclick = () => import('../exports/sheet.js').then(m => m.openExport());
    $('#m-backup', r).onclick = () => downloadBackup();
    $('#m-restore', r).onclick = pickBackup;
    $('#m-tour', r).onclick = tour;
    $('#m-help', r).onclick = () => showHelp('mehr');
    $('#m-update', r).onclick = () => import('../ui/update.js').then(m => m.checkNow(true));
    $('#m-reset', r).onclick = async () => {
      if (!(await confirmSheet({ title: 'Alle V21-Daten zurücksetzen?', text: 'Mannschaften, Einheiten, eigene Übungen und Einstellungen in V21 werden gelöscht. Rückgängig ist direkt danach möglich.', ok: 'Zurücksetzen', danger: true }))) return;
      const { emptyV3 } = await import('../core/schema.js');
      store.replace(emptyV3(), 'Daten zurückgesetzt');
      undoToast('Alle V21-Daten zurückgesetzt.');
      go('onboarding');
    };
    const inst = $('#m-install', r);
    if (window.__installPrompt) { inst.hidden = false; inst.onclick = async () => { await window.__installPrompt.prompt(); window.__installPrompt = null; inst.hidden = true; }; }
  },
};
export { TEAM_COLORS };
