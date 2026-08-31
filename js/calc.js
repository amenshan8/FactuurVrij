// FactuurVrij — money math. All amounts are integer cents to avoid float errors.

// Normalize Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) digits to Latin.
export function normalizeDigits(str) {
  return String(str).replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function parseAmount(input, lang) {
  if (input === null || input === undefined) return 0;
  let s = normalizeDigits(input).trim();
  if (s === '') return 0;
  // Normalize: strip spaces, group separators and currency symbols
  s = s.replace(/[€\s\u00a0\u066c\u060c]/g, '');
  // Detect decimal separator: comma is the decimal separator if it is the last separator
  let decimalSep = '.';
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && !hasDot) decimalSep = ',';
  else if (hasComma && hasDot) {
    // whichever appears last is the decimal separator
    decimalSep = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    if (decimalSep === ',') s = s.replace(/\./g, '');
    else s = s.replace(/,/g, '');
  } else {
    // only dots; could be thousand groups or decimals — treat last dot as decimal if only one
    decimalSep = '.';
  }
  if (decimalSep === ',') {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const num = Number(s);
  if (!isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function formatCurrency(cents, lang) {
  const value = (cents || 0) / 100;
  const locale = localeFor(lang);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  } catch (e) {
    return '€' + value.toFixed(2);
  }
}

export function localeFor(lang) {
  switch (lang) {
    case 'nl': return 'nl-NL';
    case 'ar': return 'ar-EG';
    default: return 'en-US';
  }
}

export function formatDate(date, lang) {
  if (!date) return '';
  let d;
  if (date instanceof Date) d = date;
  else {
    d = new Date(date + (date.length === 10 ? 'T00:00:00' : ''));
  }
  if (isNaN(d.getTime())) return '';
  const locale = localeFor(lang);
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'numeric', year: 'numeric' }).format(d);
  } catch (e) {
    return d.toLocaleDateString();
  }
}

export function formatQty(value) {
  // Quantity: keep up to 2 decimals, no trailing zeros
  if (value === '' || value === null || value === undefined) return '';
  const num = Number(normalizeDigits(value).replace(',', '.'));
  if (!isFinite(num)) return '';
  return formatDisplayNumber(num);
}

export function formatDisplayNumber(num) {
  const fixed = Math.round(num * 100) / 100;
  return String(fixed).replace('.', ',');
}

// Display great unit amount without forced decimals (but 2 in table for consistency is fine)

export function lineBase(qtyInput, priceInput, lang) {
  const qty = Number(normalizeDigits(qtyInput || 0).replace(',', '.'));
  const q = isFinite(qty) ? qty : 0;
  const price = parseAmount(priceInput, lang);
  return Math.round(q * price);
}

export function round(v) {
  return Math.round(v);
}

export function calculateDueDate(dateStr, term, customDate) {
  const base = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  if (isNaN(base.getTime())) return new Date();
  if (term === 'custom' && customDate) {
    const c = new Date(customDate + 'T00:00:00');
    if (!isNaN(c.getTime())) return c;
  }
  const days = { direct: 0, 7: 7, 14: 14, 30: 30, 60: 60 };
  const d = term in days ? days[term] : 30;
  const out = new Date(base);
  out.setDate(out.getDate() + d);
  return out;
}

export function nextNumber(current) {
  const m = String(current || '').trim().match(/-(\d+)$/);
  if (!m) {
    // fall back to default pattern
    const year = new Date().getFullYear();
    return year + '-001';
  }
  const prefix = String(current).trim().slice(0, String(current).trim().lastIndexOf('-'));
  const num = parseInt(m[1], 10) + 1;
  return prefix + '-' + String(num).padStart(3, '0');
}

// --- EPC / SEPA QR payment code -------------------------------------------
// Standard used by the Dutch "QR-betaalcode" (and the pan-European quick response
// code). Encodes the creditor name, IBAN, amount and the invoice-number reference
// so a client can scan it with their banking app and pay with everything pre-filled.
//
// Returns an array of one string per line (data source), which the caller joins
// with "\n" (EPC 008 / EU QR spec). Amount is optional; here we always include it.
export function makeEpcPayload({ name, iban, amountCents, reference }) {
  const cleanName = String(name || '').trim().substring(0, 70);
  const cleanIban = String(iban || '').replace(/\s+/g, '').toUpperCase().substring(0, 34);
  // structured reference (RF18) is ideal, but invoice numbers aren't RF. Use the
  // unstructured "reference" slot so any invoice number (e.g. 2026-001) works as-is.
  const cleanedRef = String(reference || '').trim().substring(0, 140);
  if (!cleanIban || !cleanName) return null;

  const eur = (amountCents / 100).toFixed(2);

  const lines = [
    'BCD',       // service tag
    '002',       // version
    '1',         // character set: UTF-8
    'SCT',       // SEPA Credit Transfer
    '',          // BIC (omit -> derived from IBAN)
    cleanName,
    cleanIban,
    'EUR' + eur,
    '',          // purpose code
    cleanedRef,  // remittance information / reference
  ];
  return lines;
}

export function epcPayloadString(name, iban, amountCents, reference) {
  const lines = makeEpcPayload({ name, iban, amountCents, reference });
  return lines ? lines.join('\n') : null;
}

// Rate defs
export const VAT_DEFS = [
  { id: '21', rate: 0.21 },
  { id: '9', rate: 0.09 },
  { id: '0', rate: 0 },
  { id: 'exempt', rate: 0, exempt: true },
  { id: 'reverse', rate: 0, reverse: true },
];

export function vatDef(id) {
  if (id === '21') return VAT_DEFS[0];
  if (id === '9') return VAT_DEFS[1];
  if (id === '0') return VAT_DEFS[2];
  if (id === 'exempt') return VAT_DEFS[3];
  return VAT_DEFS[4];
}

// Compute full invoice breakdown.
// state: { lines:[{qty,price,vat}], discount:{enabled,type,value}, kor, reverseCharge }
export function compute(state) {
  const kor = !!state.kor;
  const globalReverse = !!state.reverseCharge;

  const lines = [];
  let subtotal = 0;
  for (const ln of state.lines) {
    const base = lineBase(ln.qty, ln.price, state.lang);
    let vatId = ln.vat || '21';
    let effective = vatDef(vatId);
    let finalVat = vatId;
    if (kor) {
      finalVat = '0';
      effective = VAT_DEFS[2];
    } else if (globalReverse) {
      finalVat = 'reverse';
      effective = VAT_DEFS[4];
    }
    lines.push({
      desc: ln.desc,
      qty: ln.qty,
      unit: ln.unit,
      price: ln.price,
      baseCents: base,
      vat: finalVat,
      rate: effective.rate,
      exempt: effective.exempt,
      reverse: effective.reverse,
    });
    subtotal += base;
  }

  // discount
  let discountCents = 0;
  if (state.discount && state.discount.enabled) {
    const dv = parseAmount(state.discount.value, state.lang);
    if (state.discount.type === 'pct') {
      const pct = dv / 10000; // dv is cents of percent(?), we store percent as decimal string
      if (isFinite(pct)) discountCents = Math.round(subtotal * pct);
    } else {
      discountCents = dv;
    }
    if (discountCents > subtotal) discountCents = subtotal;
  }

  const netBase = subtotal - discountCents;

  // VAT per rate group, proportional after discount
  const totals = {};
  for (const ln of lines) {
    const key = ln.vat;
    if (!totals[key]) totals[key] = { base: 0, count: 0 };
    totals[key].base += ln.baseCents;
    totals[key].count++;
  }
  const ratio = subtotal > 0 ? netBase / subtotal : 1;
  const vatGroups = [];
  let vatTotal = 0;
  for (const key of Object.keys(totals)) {
    const def = vatDef(key);
    const taxedBase = Math.round(totals[key].base * ratio);
    const vatCents = def.exempt || def.reverse ? 0 : round(taxedBase * def.rate);
    vatTotal += vatCents;
    vatGroups.push({
      vat: key,
      rate: def.rate,
      exempt: def.exempt,
      reverse: def.reverse,
      baseCents: taxedBase,
      vatCents,
    });
  }

  const grandTotal = netBase + vatTotal;

  return {
    lines,
    subtotalCents: subtotal,
    discountCents,
    netBaseCents: netBase,
    vatGroups,
    vatTotalCents: vatTotal,
    grandTotalCents: grandTotal,
    kor,
    globalReverse,
  };
}