// Export-Sheet: Layout und Stil wählen, Vorschau, dann PDF / PNG / Druck / Text / CSV / Teilen.
import * as store from '../core/store.js';
import { currentPlan } from '../core/planning.js';
import { esc, slug, fileDate } from '../core/util.js';
import { icon, on, $ } from '../ui/dom.js';
import { openSheet } from '../ui/sheet.js';
import { toast } from '../ui/feedback.js';
import { buildDoc, layoutPages, LAYOUTS, STYLES, planText, planCsv, blocksData, headerData } from './doc.js';
import { pdfBytes, renderCanvases } from './pdf.js';
import { downloadBlob, shareFiles, sharePlanFile } from './share.js';
import { drillPitch } from '../scene/pitch.js';

export function exportPdf(s, p, layout, style) { return pdfBytes(layoutPages(buildDoc(s, p, layout), style), { title: `TRAINR · ${p.name}` }); }

export function openExport() {
  const s0 = store.get(), p0 = currentPlan(s0);
  if (!p0?.blocks.length) { toast('Erst Übungen zur Einheit hinzufügen.'); return; }
  let layout = s0.settings.exportLayout, style = s0.settings.exportStyle;
  const base = () => `${slug(currentPlan(store.get()).name)}-${fileDate()}`;
  const preview = sh => {
    const s = store.get(), p = currentPlan(s);
    const pages = layoutPages(buildDoc(s, p, layout), style);
    const cv = renderCanvases(pages.slice(0, 2), 380 / 595.28 * 1.5);
    const box = $('#ex-prev', sh.body);
    box.replaceChildren(...cv);
    cv.forEach((c, i) => { c.setAttribute('role', 'img'); c.setAttribute('aria-label', `Vorschau Seite ${i + 1}`); });
    $('#ex-pages', sh.body).textContent = `${pages.length} ${pages.length === 1 ? 'Seite' : 'Seiten'} A4${pages.length > 2 ? ' · Vorschau zeigt Seite 1–2' : ''}`;
  };
  const seg = (key, opts, cur) => `<div class="seg" role="radiogroup">${Object.entries(opts).map(([k, v]) => `<button type="button" role="radio" data-${key}="${k}" aria-checked="${cur === k}">${Array.isArray(v) ? v[0] : v}</button>`).join('')}</div>`;
  openSheet({
    title: 'Export & Teilen', wide: true,
    body: `<p class="small muted">„${esc(p0.name)}“ · alles wird lokal auf diesem Gerät erstellt.</p>
      <div class="field"><span>Layout</span>${seg('layout', LAYOUTS, layout)}<small class="tiny" id="ex-ldesc">${esc(LAYOUTS[layout][1])}</small></div>
      <div class="field"><span>Stil</span>${seg('style', STYLES, style)}</div>
      <div class="export-preview" id="ex-prev" aria-live="polite"></div><p class="tiny" id="ex-pages"></p>
      <div class="grid-2" style="margin-top:8px">
        <button class="btn primary" type="button" data-do="pdf">${icon('download')} PDF</button>
        <button class="btn" type="button" data-do="share">${icon('share')} PDF teilen</button>
        <button class="btn" type="button" data-do="png">${icon('download')} Bild (PNG)</button>
        <button class="btn" type="button" data-do="print">${icon('print')} Drucken</button>
        <button class="btn" type="button" data-do="txt">${icon('download')} Text</button>
        <button class="btn" type="button" data-do="csv">${icon('download')} CSV (Tabelle)</button>
        <button class="btn" type="button" data-do="file">${icon('share')} Als TRAINR-Datei teilen</button>
      </div>
      <p class="tiny" style="margin-top:8px">PDF mit echtem, durchsuchbarem Text. „Übungskarten“ zeigt beim Drucken zusätzlich die Platzskizzen. TRAINR-Dateien können andere Trainer in ihre App importieren.</p>`,
    onMount: sh => {
      preview(sh);
      on(sh.body, 'click', '[data-layout]', (_, b) => { layout = b.dataset.layout; sh.body.querySelectorAll('[data-layout]').forEach(x => x.setAttribute('aria-checked', String(x === b))); $('#ex-ldesc', sh.body).textContent = LAYOUTS[layout][1]; store.setting('exportLayout', layout); preview(sh); });
      on(sh.body, 'click', '[data-style]', (_, b) => { style = b.dataset.style; sh.body.querySelectorAll('[data-style]').forEach(x => x.setAttribute('aria-checked', String(x === b))); store.setting('exportStyle', style); preview(sh); });
      on(sh.body, 'click', '[data-do]', async (_, b) => {
        const s = store.get(), p = currentPlan(s), what = b.dataset.do;
        try {
          if (what === 'pdf') { downloadBlob(`${base()}.pdf`, exportPdf(s, p, layout, style), 'application/pdf'); toast('PDF erstellt.'); }
          if (what === 'share') await shareFiles([new File([exportPdf(s, p, layout, style)], `${base()}.pdf`, { type: 'application/pdf' })], { title: `TRAINR · ${p.name}` });
          if (what === 'png') {
            const cv = renderCanvases(layoutPages(buildDoc(s, p, layout), style));
            for (let i = 0; i < cv.length; i++) { const blob = await new Promise(r => cv[i].toBlob(r, 'image/png')); downloadBlob(`${base()}${cv.length > 1 ? `-${i + 1}` : ''}.png`, blob, 'image/png'); }
            toast(cv.length > 1 ? `${cv.length} PNG-Seiten erstellt. Der Browser fragt evtl. nach.` : 'PNG erstellt.');
          }
          if (what === 'print') printPlan(s, p, layout, style);
          if (what === 'txt') { downloadBlob(`${base()}.txt`, planText(s, p), 'text/plain;charset=utf-8'); toast('Text erstellt.'); }
          if (what === 'csv') { downloadBlob(`${base()}.csv`, planCsv(s, p), 'text/csv;charset=utf-8'); toast('CSV erstellt.'); }
          if (what === 'file') await sharePlanFile(p.id);
        } catch (err) { toast(`Export nicht möglich: ${err.message}`); }
      });
    },
  });
}

/** Druckansicht als HTML (mit Platzskizzen bei Übungskarten). */
export function printHtml(s, p, layout = 'detailed', style = 'brand') {
  const h = headerData(s, p), B = blocksData(s, p);
  const pause = d => (!d.pause ? '' : layout === 'compact' ? `<tr class="pause"><td>${esc(d.pause.label || '')}</td><td><em>Trinkpause</em></td><td>${d.pause.minutes} Min</td></tr>` : `<p class="ppause">— ${esc(d.pause.text)} —</p>`);
  const block = d => one(d) + pause(d);
  const one = d => {
    if (layout === 'compact') return `<tr class="${d.keeper ? 'keeper' : ''}"><td>${esc(d.label || d.num)}</td><td><strong>${esc(d.e.name)}</strong><br><small>${esc(d.kind)} · ${esc(d.groups)} · ${esc(d.material)}${d.b.note ? ` · ${esc(d.b.note)}` : ''}</small></td><td>${d.b.minutes} Min</td></tr>`;
    if (layout === 'coach') return `<article class="coach ${d.keeper ? 'keeper' : ''}"><h2>${d.num} ${esc(d.e.name)} <span>${d.b.minutes} Min</span></h2><p>${esc(d.groups)}</p><ul>${d.points.slice(0, 3).map(t => `<li>${esc(t)}</li>`).join('')}</ul></article>`;
    return `<article class="pblock ${layout === 'cards' ? 'card' : ''} ${d.keeper ? 'keeper' : ''}">
      <h2>${d.num} · ${esc(d.e.name)} <span>${d.label ? esc(d.label) + ' · ' : ''}${d.b.minutes} Min</span></h2>
      <p class="sub">${esc(d.kind)} · ${esc(d.groups)}</p>
      ${layout === 'cards' ? `<div class="psketch">${drillPitch(d.e)}</div>` : ''}
      ${d.e.goal ? `<p><strong>Ziel:</strong> ${esc(d.e.goal)}</p>` : ''}
      <ol>${d.steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol>
      <p><strong>Coaching:</strong></p><ul>${d.points.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      <p><strong>${esc(d.matLabel)}:</strong> ${esc(d.material)}</p>
      ${d.b.note ? `<p><strong>Notiz:</strong> ${esc(d.b.note)}</p>` : ''}${d.ageWarn ? `<p class="warn">${esc(d.ageWarn)}</p>` : ''}
      <p class="src">Quelle: ${esc(d.source)}</p></article>`;
  };
  return `<div class="print-doc style-${style} layout-${layout}">
    <header><div class="bar">TRAINR / TRAININGSPLAN</div><h1>${esc(h.title)}</h1><p>${esc([h.team, h.age, h.type].filter(Boolean).join(' · '))}</p><p>${esc([h.slot, h.squad, `${h.total} Min`, h.pauses].filter(Boolean).join(' · '))}</p>${h.goal ? `<p><strong>Ziel:</strong> ${esc(h.goal)}</p>` : ''}${h.foci ? `<p><strong>Schwerpunkte:</strong> ${esc(h.focus ? `${h.focus} · ` : '')}${esc(h.foci)}</p>` : ''}</header>
    ${layout === 'compact' ? `<table>${B.map(block).join('')}</table>` : B.map(block).join('')}
    <section><h3>Materialübersicht</h3><p>${esc(h.material.join(' · '))}</p>${h.checks.length ? `<h3>Hinweise</h3><ul>${h.checks.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}${h.notes ? `<h3>Coaching-Notizen</h3><p>${esc(h.notes)}</p>` : ''}</section>
    <p class="foot">Lokal erstellt mit TRAINR. Altersgrenzen, Maße und Mengen sind Vorschläge, keine Normen. Spieler, Torwart und Trainer sind getrennt gezählt.</p></div>`;
}

export function printPlan(s, p, layout, style) {
  const root = document.getElementById('print-root');
  root.innerHTML = printHtml(s, p, layout, style);
  const done = () => { root.innerHTML = ''; removeEventListener('afterprint', done); };
  addEventListener('afterprint', done);
  setTimeout(() => window.print(), 50);
}
