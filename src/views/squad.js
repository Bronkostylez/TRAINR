// „Wer ist da?“: Spieler, Torwart und Trainer – mit Vorschau, was das für jeden Block der Einheit bedeutet.
import * as store from '../core/store.js';
import { currentPlan, planType, exercise, blockLayout, layoutText, layoutAdvice, flowOf, FLOW_LABEL } from '../core/planning.js';
import { esc, integer } from '../core/util.js';
import { openSheet } from '../ui/sheet.js';
import { on } from '../ui/dom.js';
import { updatePlan, undoToast } from '../ui/actions.js';

export const ROLE_MAX = { people: 100, keepers: 20, coaches: 10 };

const row = (key, title, hint, min) => `<div class="field"><span>${title}</span><div class="stepper"><button type="button" data-sq="${key}" data-d="-1" aria-label="${title}: einer weniger">−</button><input id="sq-${key}" type="number" inputmode="numeric" min="${min}" max="${ROLE_MAX[key]}" aria-label="${title}"><button type="button" data-sq="${key}" data-d="1" aria-label="${title}: einer mehr">+</button></div><small class="tiny">${hint}</small></div>`;

/** Sheet zum Eintragen der Besetzung der aktuellen Einheit. */
export function openSquadSheet() {
  const s0 = store.get(), p0 = currentPlan(s0); if (!p0) return;
  const keeperTeam = planType(s0, p0) === 'keeper';
  const f = { people: p0.people, keepers: p0.keepers || 0, coaches: p0.coaches ?? 1 };
  const draft = () => ({ ...p0, ...f, keepers: keeperTeam ? 0 : f.keepers });
  const paint = sh => {
    const st = store.get(), plan = draft();
    for (const k of Object.keys(f)) sh.body.querySelector(`#sq-${k}`).value = f[k];
    sh.body.querySelector('#sq-total').innerHTML = keeperTeam ? `<span>${f.people} Torwart</span> · <span>${f.coaches} Trainer</span>` : `<span>${f.people + f.keepers} auf dem Platz (${f.people} Feld, ${f.keepers} Tor)</span> · <span>${f.coaches} Trainer</span>`;
    sh.body.querySelector('#sq-blocks').innerHTML = plan.blocks.length ? `<ul class="check-list">${plan.blocks.map(b => {
      const e = exercise(st, b.exerciseId), L = blockLayout(st, plan, b); if (!e || !L) return '';
      const adv = layoutAdvice(L);
      return `<li class="${L.level === 'ok' ? 'ok' : L.level === 'no' ? 'warn' : 'info'}"><div><strong>${esc(e.name)}</strong> · <span class="small">${esc(FLOW_LABEL[flowOf(e)])}</span><br><small>${esc(layoutText(L))}</small>${adv && L.level !== 'ok' ? `<br><small>${esc(adv)}</small>` : ''}</div></li>`;
    }).join('')}</ul>` : '<p class="small muted">Sobald Übungen im Plan stehen, siehst du hier, wie sich die Besetzung auf jede einzelne auswirkt.</p>';
  };
  openSheet({
    title: 'Wer ist da?',
    body: `<p class="small muted">Spieler und Torwart üben, Trainer betreuen. Gruppen bildet TRAINR nur dort, wo eine Übung sie braucht. Bei Schlangen-Übungen reihen sich alle weiteren ein, bei Übungen für alle wächst das Feld.</p>
      <div class="grid-2">
        ${row('people', keeperTeam ? 'Torwarte' : 'Spieler', keeperTeam ? 'Alle Anwesenden trainieren als Torwart.' : 'Feldspieler, ohne Torwart.', 1)}
        ${keeperTeam ? '' : row('keepers', 'Torwart', 'Spielen bei Feldübungen mit, im Tor nur, wo es nötig ist.', 0)}
        ${row('coaches', 'Trainer', 'Übernehmen geprüfte Helferrollen, keine Spieler- oder Gegnerrolle.', 0)}
      </div>
      <p class="small" id="sq-total" aria-live="polite"></p>
      <h3 style="margin:14px 0 6px">So läuft jeder Block</h3>
      <div id="sq-blocks" aria-live="polite"></div>
      <p class="error" id="sq-err" role="alert"></p>`,
    foot: '<button class="btn" type="button" data-close>Abbrechen</button><button class="btn primary" type="button" id="sq-ok">Übernehmen</button>',
    onMount(sh) {
      const set = (k, v) => { f[k] = Math.min(ROLE_MAX[k], Math.max(k === 'people' ? 1 : 0, Math.round(Number(v)) || (k === 'people' ? 1 : 0))); paint(sh); };
      on(sh.body, 'click', '[data-sq]', (_, b) => set(b.dataset.sq, f[b.dataset.sq] + Number(b.dataset.d)));
      for (const k of Object.keys(f)) sh.body.querySelector(`#sq-${k}`)?.addEventListener('change', ev => set(k, ev.target.value));
      sh.foot.querySelector('#sq-ok').onclick = () => {
        if (!integer(f.people, 1, ROLE_MAX.people)) { sh.body.querySelector('#sq-err').textContent = 'Spieler: 1–100.'; return; }
        updatePlan('Besetzung geändert', x => {
          x.people = f.people;
          if (keeperTeam || !f.keepers) delete x.keepers; else x.keepers = f.keepers;
          if (f.coaches === 1) delete x.coaches; else x.coaches = f.coaches;
          for (const b of x.blocks) if (b.people === f.people) delete b.people;
        }, { reason: 'minutes' });
        sh.close();
        undoToast('Besetzung gespeichert.');
      };
      paint(sh);
    },
  });
}
