// FactuurVrij — EPC/SEPA QR payment code. Loads qrcode lazily from the CDN.

let QRModule = null;

async function qrLib() {
  if (!QRModule) QRModule = await import('qrcode');
  return QRModule;
}

// Renders the QR into the given element (an <img> or container).
export async function renderQr(el, payload, sidePx) {
  if (!el || !payload) return;
  try {
    const QR = await qrLib();
    const url = await QR.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: sidePx,
      color: { dark: '#111827', light: '#ffffff' },
    });
    el.innerHTML = '';
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.width = sidePx;
    img.height = sidePx;
    el.appendChild(img);
  } catch (e) {
    /* QR unavailable — ignore, invoice still works */
  }
}
