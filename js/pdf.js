// FactuurVrij — PDF export. Captures the LIVE preview element (the exact DOM
// the user sees in the preview box) with html2canvas, so the downloaded PDF is
// pixel-for-pixel WYSIWYG: every detail, style, font, logo and change shows up
// exactly as in the preview. Long invoices are sliced across multiple A4 pages.

import { jsPDF } from 'jspdf';

const MM_W = 210;
const MM_H = 297;
const BASE_W = 794; // CSS px width of the preview page (~210mm at 96dpi)
const PAGE_CSS_H = Math.round((BASE_W * MM_H) / MM_W); // ~1123px, A4 ratio
const TARGET_SCALE = 3; // raster resolution multiplier (~267 dpi) — crisp print

function clampScale(contentCssH) {
  // Keep the rasterized strip at a manageable pixel budget for very long invoices.
  const MAX_H = 16000;
  let scale = TARGET_SCALE;
  if (contentCssH * scale > MAX_H) {
    scale = Math.max(1.5, Math.floor((MAX_H / contentCssH) * 10) / 10);
  }
  return scale;
}

function fileName(s) {
  const num = String(s.invoice.number || '').replace(/[^\w\-]+/g, '_') || 'factuur';
  if (s.lang === 'ar') {
    return 'invoice-' + (num.replace(/[^\x00-\x7F]/g, '') || 'factuur') + '.pdf';
  }
  const prefix = s.lang === 'nl' ? 'factuur' : 'invoice';
  return `${prefix}-${num}.pdf`;
}

export async function exportPdf(scope) {
  const { state } = scope;
  const s = state;

  const src = document.getElementById('preview');
  if (!src) return;

  await document.fonts.ready;

  // Clone the preview off-screen at its natural (non-zoomed) size so capture is
  // unaffected by the preview's fit/zoom transform.
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;width:' + BASE_W + 'px;z-index:-1;pointer-events:none;';
  host.appendChild(src.cloneNode(true));
  document.body.appendChild(host);

  const clone = host.firstElementChild;
  clone.style.cssText = (clone.getAttribute('style') || '') +
    ';width:' + BASE_W + 'px;max-width:none;height:auto;aspect-ratio:auto;zoom:1;' +
    'overflow:visible;box-shadow:none;border-radius:0;margin:0;';
  const docEl = clone.querySelector('.doc');
  if (docEl) docEl.style.overflow = 'visible';

  try {
    const html2canvas = (await import('html2canvas')).default;
    const contentCssH = clone.scrollHeight || PAGE_CSS_H;
    const scale = clampScale(contentCssH);

    const canvas = await html2canvas(clone, {
      scale,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: BASE_W,
    });

    const W = canvas.width;
    const H = canvas.height;
    const pageW = BASE_W * scale;
    const pageH = PAGE_CSS_H * scale;
    const totalH = Math.max(H, pageH); // pad short invoices to a full A4 page
    const pageCount = Math.max(1, Math.ceil(totalH / pageH));

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    doc.setProperties({ title: 'Invoice ' + s.invoice.number, creator: 'FactuurVrij' });

    for (let i = 0; i < pageCount; i++) {
      const page = document.createElement('canvas');
      page.width = pageW;
      page.height = pageH;
      const pctx = page.getContext('2d');
      pctx.fillStyle = '#ffffff';
      pctx.fillRect(0, 0, pageW, pageH);
      const sy = i * pageH;
      const sh = Math.min(pageH, totalH - sy);
      // source width == pageW, so draw 1:1 with no horizontal scaling
      pctx.drawImage(canvas, 0, sy, W, sh, 0, 0, pageW, sh);
      if (i > 0) doc.addPage();
      doc.addImage(page.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, MM_W, MM_H);
    }

    doc.save(fileName(s));
  } finally {
    host.remove();
  }
}