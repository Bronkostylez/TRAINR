// PDF mit echtem, durchsuchbarem Text (Helvetica, WinAnsi) und PNG-Seiten aus demselben Seitenlayout.
import { PAGE } from './doc.js';

const WIN = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99 };
const FALLBACK = { '◆': '•', '★': '*', '⚠': '!', '′': "'", '″': '"', '↗': '', '→': '->', '←': '<-', '✓': 'v', '≤': '<=', '≥': '>=', '½': '½', '⅓': '1/3', ' ': ' ' };

/** Text → PDF-String-Literal in WinAnsi mit Oktal-Escapes. */
function pdfString(str) {
  let out = '';
  for (const raw of String(str)) {
    const ch = FALLBACK[raw] ?? raw;
    for (const c of ch) {
      const code = WIN[c] ?? c.codePointAt(0);
      if (code === 0x28 || code === 0x29 || code === 0x5c) out += '\\' + c;
      else if (code >= 32 && code < 127) out += c;
      else if ((code >= 0xa0 && code <= 0xff) || (code >= 0x80 && code < 0xa0 && Object.values(WIN).includes(code))) out += '\\' + code.toString(8).padStart(3, '0');
      else out += '?';
    }
  }
  return `(${out})`;
}
const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => (v / 255).toFixed(3)).join(' '); };

/** Seiten (aus layoutPages) → PDF-Bytes. */
export function pdfBytes(pages, { title = 'TRAINR Trainingsplan' } = {}) {
  const enc = new TextEncoder(), chunks = [], offsets = [];
  let pos = 0;
  const push = s => { const a = typeof s === 'string' ? enc.encode(s) : s; chunks.push(a); pos += a.length; };
  const obj = (n, body) => { offsets[n] = pos; push(`${n} 0 obj\n${body}\nendobj\n`); };
  const H = PAGE.h;
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  // 1 Katalog, 2 Seitenbaum, 3 Helvetica, 4 Helvetica-Bold, 5 Info, danach je Seite: Page + Contents
  const first = 6;
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${first + i * 2} 0 R`).join(' ')}] >>`);
  obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  obj(5, `<< /Title ${pdfString(title)} /Producer (TRAINR) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}) >>`);
  let imageNumber = first + pages.length * 2;
  const imageObjects = [];
  pages.forEach((pg, i) => {
    const resources = [];
    const n = first + i * 2;
    let c = '';
    for (const op of pg.ops) {
      if (op.t === 'rect') c += `${rgb(op.fill)} rg ${op.x.toFixed(2)} ${(H - op.y - op.h).toFixed(2)} ${op.w.toFixed(2)} ${op.h.toFixed(2)} re f\n`;
      else if (op.t === 'line') c += `${rgb(op.color)} RG ${op.lw} w ${op.x1.toFixed(2)} ${(H - op.y1).toFixed(2)} m ${op.x2.toFixed(2)} ${(H - op.y2).toFixed(2)} l S\n`;
      else if (op.t === 'image') {
        if (!op.image) throw new Error('Aufbauskizze noch nicht bereit.');
        const id = imageNumber++, name = `Im${resources.length + 1}`; resources.push(`/${name} ${id} 0 R`); imageObjects.push([id, op.image]);
        c += `q ${op.w.toFixed(2)} 0 0 ${op.h.toFixed(2)} ${op.x.toFixed(2)} ${(H - op.y - op.h).toFixed(2)} cm /${name} Do Q\n`;
      }
      else if (op.t === 'text') c += `BT /${op.bold ? 'F2' : 'F1'} ${op.s} Tf ${rgb(op.color)} rg ${op.x.toFixed(2)} ${(H - op.y).toFixed(2)} Td ${pdfString(op.text)} Tj ET\n`;
    }
    const bytes = enc.encode(c);
    obj(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${resources.join(' ')} >> >> /Contents ${n + 1} 0 R >>`);
    offsets[n + 1] = pos; push(`${n + 1} 0 obj\n<< /Length ${bytes.length} >>\nstream\n`); push(bytes); push('\nendstream\nendobj\n');
  });
  for (const [id, image] of imageObjects) {
    offsets[id] = pos; push(`${id} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`);
    push(image.bytes); push('\nendstream\nendobj\n');
  }
  const count = imageNumber;
  const xref = pos;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let i = 1; i < count; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(pos); let k = 0;
  for (const a of chunks) { out.set(a, k); k += a.length; }
  return out;
}

/** Seiten → Canvas-Elemente (für PNG und Vorschau). scale 2.0833 ≈ 1240 px Breite. */
export function renderCanvases(pages, scale = 1240 / PAGE.w) {
  return pages.map(pg => {
    const c = document.createElement('canvas');
    c.width = Math.round(PAGE.w * scale); c.height = Math.round(PAGE.h * scale);
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); x.scale(scale, scale); x.textBaseline = 'alphabetic';
    for (const op of pg.ops) {
      if (op.t === 'rect') { x.fillStyle = op.fill; x.fillRect(op.x, op.y, op.w, op.h); }
      else if (op.t === 'line') { x.strokeStyle = op.color; x.lineWidth = op.lw; x.beginPath(); x.moveTo(op.x1, op.y1); x.lineTo(op.x2, op.y2); x.stroke(); }
      else if (op.t === 'image') { if (!op.image) throw new Error('Aufbauskizze noch nicht bereit.'); x.drawImage(op.image.canvas, op.x, op.y, op.w, op.h); }
      else { x.font = `${op.bold ? 'bold ' : ''}${op.s}px Arial, Helvetica, sans-serif`; x.fillStyle = op.color; x.fillText(op.text, op.x, op.y); }
    }
    return c;
  });
}
