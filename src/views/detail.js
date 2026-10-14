// Detail-Sheet einer Übung: Animation, Ziel, Ablauf, Coaching, Material, Varianten, Bewertung, Notiz, Quellen.
import * as store from '../core/store.js';
import { exercise, effective, coachRole, layout, layoutText, squadOf, flowOf, FLOW_LABEL, currentPlan, similar, progression, meta, level, LEVEL_LABEL, planAge, foci, FOCUS, AREAS, MAX_FOCI } from '../core/planning.js';
import { focusChips } from '../ui/focus.js';
import { TAG_VARIANTS } from '../data/drill-meta.js';
import { localizeVariants } from '../i18n/catalog.js';
import { esc, integer, uid, TYPE_SHORT, deepClone } from '../core/util.js';
import { openSheet, confirmSheet } from '../ui/sheet.js';
import { icon, on, $ } from '../ui/dom.js';
import { mountPlayer } from '../scene/player.js';
import { drillPitch } from '../scene/pitch.js';
import { addExercise, undoToast } from '../ui/actions.js';
import { toast, haptic } from '../ui/feedback.js';
import { pulse } from '../ui/motion.js';
import { materialChips } from '../ui/material.js';
import { validAnimation } from '../core/schema.js';
import { familyOf, variantParams, variantId, defaults, scriptToAnimation } from '../data/variants.js';
import { getLang } from '../i18n/index.js';

const fmt = ms => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** Öffnet die Detailansicht. `order` = Liste von IDs zum Blättern. */
export function openDetail(id, order = null) {
  let idx = order ? Math.max(0, order.indexOf(id)) : 0, ids = order || [id], player = null;
  let paintId = 0;
  const sheet = openSheet({ title: '', wide: true, label: 'Übungsdetails', onClose: () => player?.destroy() });
  sheet.dialog.classList.add('detail-sheet');

  function paint() {
    const renderId = ++paintId;
    player?.destroy();
    const s = store.get(), e = exercise(s, ids[idx]);
    if (!e) { sheet.close(); return; }
    const p = currentPlan(s), x = effective(s, e), m = meta(s, e.variantOf || e.id), L = layout(s, e, squadOf(s, p)), g = L.level !== 'no', flow = flowOf(e);
    const variants = e.variants || localizeVariants(e.tag, TAG_VARIANTS[e.tag]);
    const age = planAge(s, p);
    sheet.setTitle(e.name);
    sheet.setBody(`
      <div class="row detail-tags">
        <span class="tag">${esc(e.tag)}</span>
        <span class="tag ${e.type === 'keeper' ? 'keeper' : e.type === 'both' ? 'both' : ''}">${esc(TYPE_SHORT[e.type])}</span>
        <span class="tag">${esc(LEVEL_LABEL[level(e)])}</span>
        ${e.custom ? '<span class="tag custom">Eigene Übung</span>' : ''}
        ${!e.custom && e.id.startsWith('v22-') ? '<span class="tag new">Neu</span>' : ''}
        ${e.archived ? '<span class="tag warn">Archiviert</span>' : ''}
        ${age && !e.ages.includes(age) ? `<span class="tag warn">Nicht für ${esc(age)} vorgesehen</span>` : ''}
        ${ids.length > 1 ? `<span class="tiny" style="margin-left:auto">${idx + 1} / ${ids.length}</span>` : ''}
      </div>
      <div class="detail-grid">
        <div class="detail-visual">
          <div id="d-scene"></div>
          <div class="player-bar" id="d-bar">
            <button class="btn sm" type="button" id="d-play" aria-pressed="false">${icon('start')} Abspielen</button>
            <span class="seg" role="group" id="d-rates" aria-label="Tempo">${[[.5, '½×'], [1, '1×'], [2, '2×']].map(([v, t]) => `<button type="button" data-rate="${v}" aria-pressed="${v === 1}" aria-label="Tempo ${t}">${t}</button>`).join('')}</span>
            <input type="range" id="d-scrub" min="0" max="1000" value="0" step="10" aria-label="Zeitleiste der Animation">
            <span class="tiny" id="d-time"></span>
          </div>
          <p class="tiny" id="d-disclaimer" style="margin-top:6px">Schematische Darstellung: keine maßstabsgetreuen Positionen oder exakten Laufwege${e.type !== 'field' ? ', keine Fang- oder Falltechnik-Demonstration' : ''}.</p>
        </div>
        <div class="stack detail-content">
          <div class="facts"><span>${icon('clock')} ${x.minutes} Min${m.variant ? ' · deine Variante' : ''}</span><span>${flow === 'open' ? `ab ${x.min} Spieler` : flow === 'queue' ? `Je Station ${x.min === x.max ? x.min : `${x.min}–${x.max}`} Spieler aktiv` : `${x.min === x.max ? x.min : `${x.min}–${x.max}`} ${coachRole(e)?.slots ? 'Rollen (Kinder + Helfer)' : 'Spieler'} / Gruppe`}</span><span>${esc(FLOW_LABEL[flow])}</span><span>ab ${esc(e.ages[0])}</span><span class="${g ? '' : 'warn'}">${esc(layoutText(L))}</span></div>
          ${superSection(e)}
          ${e.goal ? `<section><h3>Ziel</h3><p>${esc(e.goal)}</p></section>` : ''}
          <section class="detail-section"><h3>Aufbau & Material <small class="tiny">je Gruppe</small></h3><div>${materialChips(e.equipment)}</div>${e.type === 'keeper' && e.min <= 2 ? '<p class="tiny">Kinder und Trainer werden getrennt gezählt. Eine belegte Helferrolle ersetzt einen Partnerplatz, nicht die Übungsrolle.</p>' : ''}</section>
          <section class="detail-section detail-steps"><h3>Ablauf</h3><ol class="steps" id="d-steps"></ol></section>
          ${coachRole(e) ? `<section class="coach-role detail-section"><h3>Trainerrolle</h3><p>${esc(coachRole(e).role)}</p><details class="detail-context"><summary>Hinweise zur Trainerrolle</summary><p class="small muted">TRAINR-Anpassung: Trainer übernimmt nur die Helferrolle, nicht Torwart, Gegner oder Spieler im Wettkampf. Kinder wechseln die Übungsrolle; Trainer bleibt Helfer. Im Block abschaltbar, Pflicht-Zuwurf bleibt nötig.</p></details><p class="tiny">Animation zeigt den Originalablauf, nicht die Trainerbesetzung.</p></section>` : ''}
          <section class="detail-section"><h3>Coaching</h3>${Array.isArray(e.points) && e.points.length ? `<ul class="points">${e.points.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : `<p>${esc(e.coaching)}</p>`}
            ${Array.isArray(e.points) && e.points.length && e.safety ? `<p class="small muted">${esc(e.safety)}</p>` : ''}</section>

          ${foci(e).length ? `<details class="disclosure detail-foci"><summary>Schwerpunkte</summary><div class="body">${focusChips(foci(e), { link: true, mark: p?.focus })}
            <ul class="foci-explain">${foci(e).map((k, i) => `<li><strong>${esc(k)}</strong>${i ? '' : ' <span class="tiny">Hauptschwerpunkt</span>'} – ${esc(FOCUS[k]?.hint || '')} <span class="tiny">· ${esc(AREAS[FOCUS[k]?.area]?.label || '')}</span></li>`).join('')}</ul></div></details>` : ''}
          ${variants ? `<details class="disclosure"><summary>Leichter / schwerer</summary><div class="body"><p class="small"><strong>Leichter:</strong> ${esc(variants[0])}</p><p class="small"><strong>Schwerer:</strong> ${esc(variants[1])}</p></div></details>` : ''}
          ${lernweg(s, e)}
          ${e.variantOf ? '' : `<details class="disclosure"><summary>Deine Variante <span class="tiny">${m.variant ? 'aktiv' : 'Spieler & Minuten anpassen'}</span></summary><div class="body">
            <p class="tiny">Nur auf diesem Gerät. Gilt für neue Blöcke, Gruppenberechnung und Vorschläge. Material bleibt beim Original.</p>
            <div class="row"><label class="field grow"><span>Von Spielern</span><input class="input" id="v-min" type="number" min="1" max="100" value="${x.min}"></label><label class="field grow"><span>Bis Spielern</span><input class="input" id="v-max" type="number" min="1" max="100" value="${x.max}"></label><label class="field grow"><span>Minuten</span><input class="input" id="v-min2" type="number" min="1" max="120" value="${x.minutes}"></label></div>
            <div class="row"><button class="btn sm" type="button" id="v-save">Variante merken</button>${m.variant ? '<button class="btn sm ghost" type="button" id="v-reset">Original</button>' : ''}</div>
          </div></details>`}
          <details class="disclosure" id="d-feedback"><summary>Deine Bewertung & Notiz${m.rating || m.note ? ' <span class="tiny">gespeichert</span>' : ''}</summary><div class="body"><div class="stars" role="group" aria-label="Bewertung">${[1, 2, 3, 4, 5].map(k => `<button type="button" data-rate-star="${k}" aria-pressed="${(m.rating || 0) >= k}" aria-label="${k} von 5 Sternen">★</button>`).join('')}</div>
            <label class="field"><span>Deine Notiz (keine Spielernamen)</span><textarea class="input" id="d-note" maxlength="1000" rows="3" placeholder="Was hat funktioniert? Was ändern?">${esc(m.note || '')}</textarea></label></div></details>
          <details class="disclosure"><summary>Quellen & Hinweise</summary><div class="body">${sourcesHtml(e)}
            <p class="tiny">Eigene Kurzfassung bzw. Variante, keine offizielle Übung des Verbands. Maße, Minuten, Altersgrenzen und Mengen sind redaktionelle Vorschläge, keine Normen. Belastung an Können, Platz und Gruppe anpassen.</p></div></details>
          <details class="disclosure"><summary>Ähnliche Übungen</summary><div class="body"><div class="stack">${similar(s, e, 3).map(o => `<button class="mini-drill" type="button" data-open="${esc(o.id)}">${drillPitch(o)}<span><strong>${esc(o.name)}</strong><br><small>${esc(foci(o).slice(0, 2).join(' · ') || o.tag)} · ${effective(s, o).minutes} Min</small></span></button>`).join('')}</div></div></details>
          <div class="row">
            ${e.custom ? `<button class="btn sm" type="button" id="d-edit">${icon('edit')} Bearbeiten</button><button class="btn sm danger" type="button" id="d-del">${icon('trash')} Löschen</button>` : `<button class="btn sm" type="button" id="d-copy">${icon('copy')} Als eigene Übung anpassen</button>`}
          </div>
        </div>
      </div>`);
    sheet.setFoot(`
      ${ids.length > 1 ? `<button class="btn" type="button" id="d-prev" aria-label="Vorherige Übung" ${idx <= 0 ? 'disabled' : ''} style="flex:0 0 auto;min-width:56px">${icon('back')}</button>` : ''}
      <button class="btn primary" type="button" id="d-add">${icon('plus')} In den Plan</button>
      ${ids.length > 1 ? `<button class="btn" type="button" id="d-next" aria-label="Nächste Übung" ${idx >= ids.length - 1 ? 'disabled' : ''} style="flex:0 0 auto;min-width:56px">${icon('chevron')}</button>` : ''}`);
    bind(e, renderId);
  }

  function sourcesHtml(e) {
    const list = Array.isArray(e.sources) && e.sources.length ? e.sources : e.url ? [{ title: 'Fachliche Quelle', url: e.url }] : [];
    if (!list.length) return '<p class="small muted">Keine externe Quelle hinterlegt.</p>';
    return `<div class="stack">${list.map(src => `<a class="source" href="${esc(src.url)}" target="_blank" rel="noopener noreferrer"><strong>${esc(src.title)} ↗</strong>${src.supports ? `<small>Belegt: ${esc(src.supports)}</small>` : ''}<small>${esc(src.url.replace(/^https:\/\//, ''))}</small></a>`).join('')}</div>`;
  }

  function bind(e, renderId) {
    const b = sheet.body, f = sheet.foot;
    const stepsEl = $('#d-steps', b);
    const stepsHtml = () => player.steps.map((t, i) => `<li data-step="${i}" class="${i === player.step ? 'current' : ''}" tabindex="0">${esc(t)}</li>`).join('');
    const playBtn = $('#d-play', b), scrub = $('#d-scrub', b), timeEl = $('#d-time', b);
    player = mountPlayer($('#d-scene', b), e, {
      camera: true,
      onStep: i => stepsEl.querySelectorAll('li').forEach((li, k) => li.classList.toggle('current', k === i)),
      onTime: (t, total) => { if (document.activeElement !== scrub) { scrub.max = total; scrub.value = t; } timeEl.textContent = `${fmt(t)} / ${fmt(total)}`; },
      onState: st => {
        playBtn.innerHTML = st === 'run' ? `${icon('pause')} Pause` : st === 'done' ? `${icon('reset')} Nochmal` : st === 'static' ? `${icon('next')} Nächster Schritt` : `${icon('start')} Abspielen`;
        playBtn.setAttribute('aria-pressed', String(st === 'run'));
        b.querySelector('#d-rates').hidden = scrub.hidden = st === 'static';
      },
    });
    stepsEl.innerHTML = stepsHtml();
    if (player.animated) { timeEl.textContent = `0:00 / ${fmt(player.total)}`; scrub.max = player.total; setTimeout(() => { if (renderId === paintId && sheet.dialog.isConnected && player.state === 'pause' && player.animated) player.play(); }, 650); }
    else $('#d-disclaimer', b).textContent += ' Animation aus – Schritte einzeln ansehen.';
    playBtn.onclick = () => { if (player.animated) player.toggle(); else player.goStep((player.step + 1) % player.steps.length); };
    on(b, 'click', '[data-rate]', (_, btn) => { player.rate(Number(btn.dataset.rate)); b.querySelectorAll('[data-rate]').forEach(x => x.setAttribute('aria-pressed', String(x === btn))); });
    scrub.oninput = () => { player.pause(); player.seek(Number(scrub.value)); };
    on(stepsEl, 'click', '[data-step]', (_, li) => { player.goStep(Number(li.dataset.step)); if (player.animated) player.play(); });
    on(stepsEl, 'keydown', '[data-step]', (ev, li) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); li.click(); } });

    on(b, 'click', '[data-rate-star]', (_, btn) => {
      const mid = e.variantOf || e.id, k = Number(btn.dataset.rateStar), cur = meta(store.get(), mid).rating;
      store.update('Bewertung', d => { const mm = (d.exerciseMeta[mid] ||= {}); if (cur === k) delete mm.rating; else mm.rating = k; }, { reason: 'meta' });
      b.querySelectorAll('[data-rate-star]').forEach(x => x.setAttribute('aria-pressed', String((cur === k ? 0 : k) >= Number(x.dataset.rateStar))));
      haptic('tap'); pulse(btn);
    });
    $('#d-note', b).onchange = ev => { const v = ev.target.value.trim().slice(0, 1000); store.update('Notiz', d => { const mm = (d.exerciseMeta[e.variantOf || e.id] ||= {}); if (v) mm.note = v; else delete mm.note; }, { reason: 'meta' }); toast('Notiz gespeichert.'); };
    on(b, 'click', '[data-vid]', (_, btn) => { const keep = sheet.body.scrollTop, wasOpen = !!btn.closest('.seg') || !!b.querySelector('#d-super details[open]'); ids[idx] = btn.dataset.vid; haptic('tap'); paint(); const dd = sheet.body.querySelector('#d-super details'); if (dd && wasOpen) dd.open = true; sheet.body.scrollTop = keep; });
    const vSave = $('#v-save', b);
    if (vSave) vSave.onclick = () => {
      const v = { min: Number($('#v-min', b).value), max: Number($('#v-max', b).value), minutes: Number($('#v-min2', b).value) };
      if (!integer(v.min, 1, 100) || !integer(v.max, v.min, 100) || !integer(v.minutes, 1, 120)) { toast('Gültigen Bereich (Von ≤ Bis) und 1–120 Minuten wählen.'); return; }
      store.update('Variante gespeichert', d => { (d.exerciseMeta[e.id] ||= {}).variant = v; }, { reason: 'meta' });
      undoToast('Deine Variante gespeichert.'); paint();
    };
    $('#v-reset', b)?.addEventListener('click', () => { store.update('Variante entfernt', d => { delete d.exerciseMeta[e.id]?.variant; }, { reason: 'meta' }); undoToast('Original wiederhergestellt.'); paint(); });
    on(b, 'click', '[data-open]', (_, btn) => { ids = [btn.dataset.open]; idx = 0; paint(); sheet.body.scrollTop = 0; });
    $('#d-edit', b)?.addEventListener('click', () => { sheet.close(); import('./editor.js').then(mm => mm.openEditor(e.id)); });
    $('#d-copy', b)?.addEventListener('click', () => { sheet.close(); import('./editor.js').then(mm => mm.openEditor(null, copyAsCustom(e))); });
    $('#d-del', b)?.addEventListener('click', async () => {
      const s = store.get(), uses = s.plans.filter(p => p.blocks.some(x => x.exerciseId === e.id)).length;
      if (!(await confirmSheet({ title: 'Eigene Übung löschen?', text: uses ? `„${e.name}“ wird aus ${uses} ${uses === 1 ? 'Einheit' : 'Einheiten'} entfernt.` : `„${e.name}“ wird gelöscht.`, ok: 'Löschen', danger: true }))) return;
      store.update('Eigene Übung gelöscht', d => { d.custom = d.custom.filter(c => c.id !== e.id); for (const p of d.plans) p.blocks = p.blocks.filter(x => x.exerciseId !== e.id); delete d.exerciseMeta[e.id]; });
      sheet.close(); undoToast(`„${e.name}“ gelöscht.`);
    });
    $('#d-add', f).onclick = ev => { if (addExercise(e.id)) { ev.currentTarget.innerHTML = `${icon('check')} Hinzugefügt`; pulse(ev.currentTarget); } };
    $('#d-prev', f)?.addEventListener('click', () => nav(-1));
    $('#d-next', f)?.addEventListener('click', () => nav(1));
  }

  function nav(d) { const n = idx + d; if (n < 0 || n >= ids.length) return; idx = n; paint(); sheet.body.scrollTop = 0; haptic('tap'); }
  sheet.dialog.addEventListener('keydown', ev => { if (ev.target.closest('input,textarea,select')) return; if (ev.key === 'ArrowRight') { ev.preventDefault(); nav(1); } if (ev.key === 'ArrowLeft') { ev.preventDefault(); nav(-1); } });
  let sw = null;
  sheet.body.addEventListener('touchstart', ev => { if (ev.target.closest('input,button,a,summary,.pitch-scene,textarea')) return; sw = { x: ev.touches[0].clientX, y: ev.touches[0].clientY }; }, { passive: true });
  sheet.body.addEventListener('touchend', ev => { if (!sw) return; const dx = ev.changedTouches[0].clientX - sw.x, dy = ev.changedTouches[0].clientY - sw.y; sw = null; if (Math.abs(dx) > 80 && Math.abs(dy) < 50) nav(dx < 0 ? 1 : -1); }, { passive: true });
  paint();
  return sheet;
}

/** Super-Übung: fertige Varianten zum Antippen und einzelne Stellschrauben. Nur für Grundübungen mit Variantenfamilie. */
function superSection(e) {
  const fam = familyOf(e.variantOf || e.id);
  if (!fam) return '';
  const en = getLang() === 'en', cur = variantParams(e.id), base = defaults(fam), active = e.id;
  const presets = [{ de: 'Original', en: 'Original', p: {} }, ...fam.presets];
  const chip = pr => { const id = variantId(fam, { ...base, ...pr.p }); return `<button type="button" class="chip" data-vid="${esc(id)}" aria-pressed="${id === active}">${esc(en ? pr.en : pr.de)}</button>`; };
  const rows = fam.params.map(q => `<div class="field"><span>${esc(en ? q.label[1] : q.label[0])}</span><div class="seg" role="group" aria-label="${esc(en ? q.label[1] : q.label[0])}">${q.opts.map(o => `<button type="button" data-vid="${esc(variantId(fam, { ...cur, [q.k]: o[0] }))}" aria-pressed="${cur[q.k] === o[0]}">${esc(en ? o[2] : o[1])}</button>`).join('')}</div></div>`).join('');
  const custom = active !== fam.base && !fam.presets.some(pr => variantId(fam, { ...base, ...pr.p }) === active);
  return `<section class="detail-section super-section" id="d-super"><h3>Super-Übung <small class="tiny">Aufbau, Animation und Material passen sich an</small></h3>
    <div class="chips" role="group" aria-label="Fertige Varianten">${presets.map(chip).join('')}</div>
    <details class="disclosure"${custom ? ' open' : ''}><summary>Selbst einstellen</summary><div class="body">${rows}</div></details></section>`;
}

/** Vorstufe und Weiterführung als Sprungziele im Detail. */
function lernweg(s, e) {
  const { easier, harder } = progression(s, e);
  if (!easier && !harder) return '';
  const link = (o, t) => o ? `<button class="mini-drill" type="button" data-open="${esc(o.id)}">${drillPitch(o)}<span><small>${t} · ${esc(LEVEL_LABEL[level(o)])}</small><br><strong>${esc(o.name)}</strong></span></button>` : '';
  return `<details class="disclosure"><summary>Lernweg</summary><div class="body stack">${link(easier, 'Vorstufe')}${link(harder, 'Weiterführung')}</div></details>`;
}

function copyAsCustom(e) {
  const c = deepClone({ id: 'custom-' + uid(), name: `${e.name} (eigene)`.slice(0, 80), type: e.type, tag: e.tag, ages: e.ages, min: e.min, max: e.max, minutes: e.minutes, description: e.description, coaching: e.coaching, equipment: e.equipment, url: e.url || '', custom: true });
  if (e.goal) c.goal = e.goal;
  if (e.script) { const an = scriptToAnimation(e.script, e.steps); if (an && validAnimation(an)) c.animation = an; }
  if (foci(e).length) c.focus = foci(e).slice(0, MAX_FOCI);
  return c;
}
