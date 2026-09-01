// FactuurVrij — builds the editor and live preview DOM.

export function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setByPath(obj, path, value) {
  const parts = path.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    o = o[parts[i]];
  }
  o[parts[parts.length - 1]] = value;
}

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const ICON = {
  up: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>`,
  down: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`,
  copy: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  trash: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
};

const isMobile = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width:760px)').matches;
const openFor = (name) => (isMobile() ? name === 'company' : true);

function input(label, path, value, placeholder, type = 'text') {
  return `
    <label class="field ${type === 'date' ? 'has-date' : ''}">
      <span class="field-label">${esc(label)}</span>
      <input type="${type}" data-field="${path}" value="${esc(value)}" placeholder="${esc(placeholder || '')}" />
    </label>`;
}

function section(id, title, content, open = true) {
  return `
    <section class="card section ${open ? 'open' : ''}" id="sec-${id}">
      <button type="button" class="section-head" data-section-toggle="${id}" aria-expanded="${open}">
        <span class="section-title">${esc(title)}</span>
        <span class="section-chev" aria-hidden="true"></span>
      </button>
      <div class="section-body">${content}</div>
    </section>`;
}

// --- Units -----------------------------------------------------------------
const UNIT_KEYS = ['unitPiece', 'unitHour', 'unitDay', 'unitMonth', 'unitKm', 'unitProject', 'unitService', 'unitOther'];
const UNIT_VALS = ['piece', 'hour', 'day', 'month', 'km', 'project', 'service', 'other'];
const VAT_VALS = ['21', '9', '0', 'exempt', 'reverse'];

function unitOptions(t, current) {
  return UNIT_KEYS.map((k, i) => `<option value="${UNIT_VALS[i]}" ${UNIT_VALS[i] === current ? 'selected' : ''}>${esc(t(k))}</option>`).join('');
}

function vatOptions(t, current) {
  return VAT_VALS.map((v) => {
    const key = v === '21' ? 'vat21' : v === '9' ? 'vat9' : v === '0' ? 'vat0' : v === 'exempt' ? 'vatExempt' : 'vatReverse';
    return `<option value="${v}" ${v === current ? 'selected' : ''}>${esc(t(key))}</option>`;
  }).join('');
}

function paymentOptions(t) {
  return [
    ['direct', 'payDirect'],
    ['7', 'pay7'],
    ['14', 'pay14'],
    ['30', 'pay30'],
    ['60', 'pay60'],
    ['custom', 'payCustom'],
  ]
    .map(([v, k]) => `<option value="${v}">${esc(t(k))}</option>`)
    .join('');
}

function shortDate(iso, t, key) {
  return `
    <label class="field">
      <span class="field-label">${esc(t(key))}</span>
      <input type="date" data-field="${iso}" />
    </label>`;
}

// --- Editor ----------------------------------------------------------------
export function buildEditor(scope) {
  const { state, t, lang } = scope;
  const s = state;

  const topbar = `
    <div class="editor-toolbar">
      <button type="button" class="btn" data-action="undo" ${scope.canUndo ? '' : 'disabled'}>${esc(t('undo'))}</button>
      <button type="button" class="btn" data-action="newInvoice">${esc(t('newInvoice'))}</button>
      <button type="button" class="btn" data-action="fillExample">${esc(t('fillExample'))}</button>
      <button type="button" class="btn" data-action="rememberNow">${esc(t('rememberData'))}</button>
      <button type="button" class="btn btn-ghost" data-action="clearAll">${esc(t('clearAll'))}</button>
    </div>
    <div class="remember-row">
      <label class="check">
        <input type="checkbox" data-field="remember" ${s.remember ? 'checked' : ''} />
        <span>${esc(t('remember'))}</span>
      </label>
    </div>
    <p class="privacy-inline" data-i18np="privacy">${esc(t('privacy'))}</p>
  `;

  const company = section('company', t('sCompany'), `
      <div class="grid grid-2">
        ${input(t('fCompanyName'), 'company.name', s.company.name)}
        ${input(t('fPersonName'), 'company.personName', s.company.personName)}
        ${input(t('fStreet'), 'company.street', s.company.street)}
        ${input(t('fPostal'), 'company.postal', s.company.postal)}
        ${input(t('fCity'), 'company.city', s.company.city)}
        ${input(t('fCountry'), 'company.country', s.company.country)}
        ${input(t('fKvk'), 'company.kvk', s.company.kvk)}
        ${input(t('fVat'), 'company.vat', s.company.vat)}
        ${input(t('fIban'), 'company.iban', s.company.iban)}
        ${input(t('fEmail'), 'company.email', s.company.email, '', 'email')}
        ${input(t('fPhone'), 'company.phone', s.company.phone)}
        ${input(t('fWebsite'), 'company.website', s.company.website)}
      </div>
    `
  );

  const customer = section(
    'customer',
    t('sCustomer'),
    `
      <div class="grid grid-2">
        ${input(t('fCustomerName'), 'customer.name', s.customer.name)}
        ${input(t('fContact'), 'customer.contact', s.customer.contact)}
        ${input(t('fEmail'), 'customer.email', s.customer.email, '', 'email')}
        ${input(t('fStreet'), 'customer.street', s.customer.street)}
        ${input(t('fPostal'), 'customer.postal', s.customer.postal)}
        ${input(t('fCity'), 'customer.city', s.customer.city)}
        ${input(t('fCountry'), 'customer.country', s.customer.country)}
        ${input(t('fKvk'), 'customer.kvk', s.customer.kvk)}
        ${input(t('fVat'), 'customer.vat', s.customer.vat)}
        ${input(t('fCustomerNo'), 'customer.customerNo', s.customer.customerNo)}
      </div>
    `,
    openFor('customer')
  );

  const invoiceFields = `
    <div class="grid grid-3">
      <label class="field">
        <span class="field-label">${esc(t('fInvoiceNumber'))}</span>
        <div class="input-btn">
          <input type="text" data-field="invoice.number" value="${esc(s.invoice.number)}" placeholder="2026-001" />
          <button type="button" class="btn btn-small" data-action="nextNumber">${esc(t('fNextNumber'))}</button>
        </div>
      </label>
      ${shortDate('invoice.date', t, 'fInvoiceDate')}
      <label class="field">
        <span class="field-label">${esc(t('fPaymentTerm'))}</span>
        <select data-field="invoice.payTerm" data-rel="due">${paymentOptions(t)}</select>
      </label>
      <div id="due-field" class="field-wrap">
        ${shortDate('invoice.due', t, 'fDueDate')}
      </div>
      ${input(t('fDeliveryDate'), 'invoice.deliveryDate', s.invoice.deliveryDate, '', 'date')}
    </div>
    <div class="grid grid-3">
      ${input(t('fPeriod'), 'invoice.period', s.invoice.period)}
      ${input(t('fReference'), 'invoice.reference', s.invoice.reference)}
      ${input(t('fProject'), 'invoice.project', s.invoice.project)}
    </div>
  `;
  const invoice = section('invoice', t('sInvoice'), invoiceFields, openFor('invoice'));

  const linesRows = s.lines
    .map((l, i) => {
      const field = (f) => `lines.${i}.${f}`;
      const upD = i === 0;
      const downD = i === s.lines.length - 1;
      return `
      <div class="line-row" data-line="${i}">
        <div class="line-cell line-desc">
          <span class="mob-label">${esc(t('colDesc'))}</span>
          <input type="text" data-field="${field('desc')}" value="${esc(l.desc)}" placeholder="${esc(t('colDesc'))}" />
        </div>
        <div class="line-cell line-qty">
          <span class="mob-label">${esc(t('colQty'))}</span>
          <input type="text" inputmode="decimal" data-field="${field('qty')}" value="${esc(l.qty)}" placeholder="0" />
        </div>
        <div class="line-cell line-unit">
          <span class="mob-label">${esc(t('colUnit'))}</span>
          <select data-field="${field('unit')}">
            ${unitOptions(t, l.unit)}
          </select>
        </div>
        <div class="line-cell line-price">
          <span class="mob-label">${esc(t('colPrice'))}</span>
          <input type="text" inputmode="decimal" data-field="${field('price')}" value="${esc(l.price)}" placeholder="0,00" />
        </div>
        <div class="line-cell line-vat">
          <span class="mob-label">${esc(t('colVat'))}</span>
          <select data-field="${field('vat')}">${vatOptions(t, l.vat)}</select>
        </div>
        <div class="line-cell line-amount">
          <span class="mob-label">${esc(t('colAmount'))}</span>
          <span class="amount-val" data-line-amount="${i}"></span>
        </div>
        <div class="line-actions" role="group" aria-label="${esc(t('colActions'))}">
          <button type="button" class="icon-btn" title="${esc(t('moveUp'))}" aria-label="${esc(t('moveUp'))}" data-action="moveUp" data-i="${i}" ${upD ? 'disabled' : ''}>${ICON.up}</button>
          <button type="button" class="icon-btn" title="${esc(t('moveDown'))}" aria-label="${esc(t('moveDown'))}" data-action="moveDown" data-i="${i}" ${downD ? 'disabled' : ''}>${ICON.down}</button>
          <button type="button" class="icon-btn" title="${esc(t('duplicateItem'))}" aria-label="${esc(t('duplicateItem'))}" data-action="duplicate" data-i="${i}">${ICON.copy}</button>
          <button type="button" class="icon-btn icon-danger" title="${esc(t('deleteItem'))}" aria-label="${esc(t('deleteItem'))}" data-action="deleteLine" data-i="${i}">${ICON.trash}</button>
        </div>
      </div>`;
    })
    .join('');

  const lines = section(
    'lines',
    t('sLines'),
    `
      <div class="lines-table">
        <div class="lines-head">
          <span class="h-desc">${esc(t('colDesc'))}</span><span class="h-qty">${esc(t('colQty'))}</span><span class="h-unit">${esc(t('colUnit'))}</span>
          <span class="h-price">${esc(t('colPrice'))}</span><span class="h-vat">${esc(t('colVat'))}</span><span class="h-amount">${esc(t('colAmount'))}</span><span class="h-actions">${esc(t('colActions'))}</span>
        </div>
        <div id="lines-container">${linesRows}</div>
        <button type="button" class="btn add-line" data-action="addLine">${esc(t('addItem'))}</button>
      </div>
    `,
    openFor('lines')
  );

  const summary = buildSummary(scope);
  const design = buildDesign(scope);

  return topbar + company + customer + invoice + lines + summary + design;
}

function buildSummary(scope) {
  const { state, t, calc } = scope;
  const s = state;
  const disc = s.discount;

  const discountHtml = `
    <button type="button" class="btn btn-small" data-action="toggleDiscount">${esc(t('discountBtn'))}</button>
    <div id="discount-panel" ${disc.enabled ? '' : 'hidden'}>
      <label class="field">
        <span class="field-label">${esc(t('discount'))}</span>
        <input type="text" inputmode="decimal" data-field="discount.value" value="${esc(disc.value)}" placeholder="10" />
      </label>
      <label class="field">
        <span class="field-label">${esc(t('discount'))}</span>
        <select data-field="discount.type">
          <option value="pct" ${disc.type === 'pct' ? 'selected' : ''}>${esc(t('discPct'))}</option>
          <option value="fixed" ${disc.type === 'fixed' ? 'selected' : ''}>${esc(t('discFixed'))}</option>
        </select>
      </label>
    </div>
  `;

  const toggles = `
    <div class="toggle-row">
      <label class="check">
        <input type="checkbox" data-field="kor" ${s.kor ? 'checked' : ''} />
        <span>${esc(t('kor'))}</span>
      </label>
      <span class="tooltip" tabindex="0" aria-label="${esc(t('korTooltip'))}">?</span>
    </div>
    <div class="toggle-row">
      <label class="check">
        <input type="checkbox" data-field="reverseCharge" ${s.reverseCharge ? 'checked' : ''} />
        <span>${esc(t('reverseCharge'))}</span>
      </label>
      <span class="tooltip" tabindex="0" aria-label="${esc(t('reverseTooltip'))}">?</span>
    </div>
  `;

  const payment = `
    <label class="check qr-check">
      <input type="checkbox" data-field="qrEnabled" ${s.qrEnabled ? 'checked' : ''} />
      <span>${esc(t('qrShow'))}</span>
    </label>
    <span class="tooltip" tabindex="0" aria-label="${esc(t('qrHint'))}">?</span>
    <div class="grid grid-2">
      <label class="field">
        <span class="field-label">${esc(t('fIban'))}</span>
        <input type="text" data-field="company.iban" value="${esc(s.company.iban)}" />
      </label>
      ${input(t('accountHolder'), 'company.personName', s.company.personName)}
    </div>
    <label class="field">
      <span class="field-label">${esc(t('payCustomLabel'))}</span>
      <textarea data-field="paymentText" rows="3">${esc(s.paymentText)}</textarea>
    </label>
  `;

  const totals = `
    <div class="totals" data-totals></div>
  `;
  const checklist = `<div class="checklist" data-checklist></div>`;

  return section(
    'summary',
    t('sSummary'),
    `
      <div class="subblock">${toggles}</div>
      <div class="subblock">${discountHtml}</div>
      <div class="subblock">${payment}</div>
      ${totals}
      ${checklist}
    `,
    openFor('summary')
  );
}

// --- Design section ---------------------------------------------------------
function buildDesign(scope) {
  const { state, t, templates, presets, SELECT_FONTS, fonts } = scope;
  const s = state;
  const d = s.design;

  const templateCards = templates
    .map((tp) => {
      const nameKey = 'template' + tp.id.charAt(0).toUpperCase() + tp.id.slice(1);
      const descKey = nameKey + 'Desc';
      const selected = d.template === tp.id;
      return `
        <button type="button" class="tmpl-card ${selected ? 'selected' : ''}" data-action="setTemplate" data-template="${tp.id}" aria-pressed="${selected}">
          <span class="tmpl-thumb">${thumbSvg(tp.id)}</span>
          <span class="tmpl-meta">
            <span class="tmpl-name">${esc(t(nameKey))}</span>
            <span class="tmpl-desc">${esc(t(descKey))}</span>
          </span>
          <span class="tmpl-check" aria-hidden="true"></span>
        </button>`;
    })
    .join('');

  const colorSwatches = Object.keys(presets)
    .map((name) => {
      const colorKey = 'color' + name.charAt(0).toUpperCase() + name.slice(1);
      const color = presets[name];
      const active = String(d.color || '').toLowerCase() === color;
      return `<button type="button" class="swatch ${active ? 'active' : ''}" data-action="setColor" data-color="${color}" style="--sw:${color}" title="${esc(t(colorKey))}" aria-label="${esc(t(colorKey))}" aria-pressed="${active}"></button>`;
    })
    .join('');

  const fontOptions = SELECT_FONTS
    .map((id) => `<option value="${id}" ${d.font === id ? 'selected' : ''}>${esc(fonts[id].label)}</option>`)
    .join('');

  const hasLogo = !!s.logo.dataUrl;
  const logoControls = `
    <div class="logo-stack">
      <div class="logo-row">
        ${hasLogo
          ? `<div class="logo-preview" aria-hidden="true"><img src="${s.logo.dataUrl}" alt="" /></div>
            <button type="button" class="btn btn-ghost" data-action="changeLogo">${esc(t('changeLogo'))}</button>
            <button type="button" class="btn btn-ghost btn-danger" data-action="removeLogo">${esc(t('removeLogo'))}</button>`
          : `<button type="button" class="btn" data-action="changeLogo">${esc(t('addLogo'))}</button>`}
      </div>
      <input type="file" id="logo-input" accept="image/png,image/jpeg,image/svg+xml,.svg,.png,.jpg,.jpeg" hidden />
      <div class="range-row">
        <span class="field-label">${esc(t('logoSize'))}</span>
        <output class="range-val" for="logo-size">${s.logo.size}px</output>
        <input type="range" id="logo-size" class="range" data-field="logo.size" min="30" max="180" value="${s.logo.size}" />
      </div>
      <span class="hint">${esc(t('logoHint'))}</span>
    </div>
  `;

  return section(
    'design',
    t('sDesign'),
    `
      <p class="hint design-intro">${esc(t('designHint'))}</p>
      <div class="design-block">
        <span class="field-label">${esc(t('templateLabel'))}</span>
        <div class="tmpl-grid" style="--tt:${esc(d.color)}">${templateCards}</div>
      </div>
      <div class="design-block">
        <span class="field-label">${esc(t('colorLabel'))}</span>
        <div class="swatch-row">${colorSwatches}</div>
        <div class="color-custom">
          <input type="color" data-field="design.color" value="${esc(d.color)}" aria-label="${esc(t('colorCustom'))}" class="color-picker" />
          <input type="text" data-field="design.color" value="${esc(d.color)}" aria-label="${esc(t('colorCustom'))}" class="color-hex" spellcheck="false" />
        </div>
      </div>
      <div class="design-block">
        <label class="field">
          <span class="field-label">${esc(t('fontLabel'))}</span>
          <select data-field="design.font">${fontOptions}</select>
        </label>
      </div>
      <div class="design-block">
        <span class="field-label">${esc(t('logoLabel'))}</span>
        ${logoControls}
      </div>
    `,
    openFor('design')
  );
}

// --- Miniature invoice thumbnails (real visual previews, brand-coloured) ----
function thumbSvg(id) {
  const t = 'var(--tt)';
  const line = '#e2e8f0';
  const line2 = '#cbd5e1';
  const dark = '#64748b';
  const white = '#ffffff';
  const fade = 'rgba(255,255,255,0.72)';
  const r2 = 'rx="2"';
  const rect = (x, y, w, h, fill, rx) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${rx ? 'rx="2"' : ''}/>`;

  if (id === 'business') {
    return `<svg class="thumb" viewBox="0 0 210 150" preserveAspectRatio="xMidYMin meet" aria-hidden="true">
      ${rect(0, 0, 210, 42, t)}
      ${rect(14, 13, 20, 16, white, true)}
      ${rect(40, 13, 54, 5, white, true)}
      ${rect(40, 21, 44, 3, fade, true)}
      ${rect(40, 27, 48, 3, fade, true)}
      <text x="196" y="26" text-anchor="end" font-family="Inter,sans-serif" font-size="12" font-weight="800" fill="${white}">FACTUUR</text>
      ${rect(14, 54, 46, 4, dark)}
      ${rect(14, 61, 66, 3, line)}
      ${rect(14, 67, 60, 3, line)}
      ${rect(14, 78, 182, 1, line2)}
      ${rect(14, 83, 182, 9, '#f1f5f9')}
      ${rect(14, 95, 182, 3, line)}
      ${rect(14, 101, 182, 3, line)}
      ${rect(14, 110, 182, 1, line2)}
      ${rect(116, 116, 80, 3, line)}
      ${rect(148, 123, 48, 3, line)}
      ${rect(124, 130, 72, 6, t)}
    </svg>`;
  }
  if (id === 'studio') {
    return `<svg class="thumb" viewBox="0 0 210 150" preserveAspectRatio="xMidYMin meet" aria-hidden="true">
      ${rect(0, 0, 48, 150, t)}
      ${rect(8, 12, 32, 16, white, true)}
      ${rect(8, 33, 30, 4, fade, true)}
      ${rect(8, 40, 26, 3, fade, true)}
      ${rect(8, 47, 30, 3, fade, true)}
      ${rect(8, 54, 24, 3, fade, true)}
      <text x="128" y="24" text-anchor="middle" font-family="Inter,sans-serif" font-size="12" font-weight="800" fill="${dark}">FACTUUR</text>
      ${rect(78, 30, 100, 3, line)}
      ${rect(92, 37, 72, 3, line)}
      ${rect(58, 52, 60, 3, dark)}
      ${rect(58, 59, 76, 3, line)}
      ${rect(58, 65, 68, 3, line)}
      ${rect(58, 76, 144, 1, line2)}
      ${rect(58, 81, 144, 9, '#f1f5f9')}
      ${rect(58, 93, 144, 3, line)}
      ${rect(58, 99, 144, 3, line)}
      ${rect(58, 108, 144, 1, line2)}
      ${rect(118, 114, 84, 3, line)}
      ${rect(148, 121, 54, 3, line)}
      ${rect(126, 128, 76, 6, t)}
    </svg>`;
  }
  // clean
  return `<svg class="thumb" viewBox="0 0 210 150" preserveAspectRatio="xMidYMin meet" aria-hidden="true">
      ${rect(16, 14, 40, 14, dark, true)}
      <text x="194" y="24" text-anchor="end" font-family="Inter,sans-serif" font-size="11" font-weight="700" fill="${dark}">FACTUUR</text>
      ${rect(16, 38, 178, 1, line2)}
      ${rect(16, 52, 46, 4, dark)}
      ${rect(16, 59, 66, 3, line)}
      ${rect(16, 65, 60, 3, line)}
      ${rect(16, 76, 178, 1, line)}
      ${rect(16, 80, 178, 12, '#fafbfc')}
      ${rect(16, 95, 178, 1, line)}
      ${rect(16, 99, 178, 1, line)}
      ${rect(16, 108, 178, 1, line)}
      ${rect(120, 118, 74, 3, line)}
      ${rect(150, 125, 44, 3, line)}
      ${rect(130, 132, 64, 6, t)}
    </svg>`;
}

// --- Preview ---------------------------------------------------------------
const BRAND_FALLBACK = '#1f2a3a';
export const sanitizeColor = (c) => (/^#[0-9a-fA-F]{6}$/.test(String(c || '')) ? String(c) : BRAND_FALLBACK);

// Normalize user-entered hex to #RRGGBB, or null if not a valid #RGB / #RRGGBB color.
export function normalizeHex(input) {
  const s = String(input || '').trim();
  let hex = s.charAt(0) === '#' ? s.slice(1) : s;
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) return null;
  let full = hex;
  if (hex.length === 3) full = hex.split('').map((c) => c + c).join('');
  return '#' + full.toLowerCase();
}

export function renderPreview(el, scope) {
  const { state, t, calc, fontFor, templateById } = scope;
  const s = state;
  const rtl = s.lang === 'ar';
  const d = s.design;
  const tmpl = templateById(d.template);
  const font = fontFor(s.lang, d.font);
  const brand = sanitizeColor(d.color);

  const computed = calc.compute({
    lang: s.lang,
    lines: s.lines,
    discount: s.discount,
    kor: s.kor,
    reverseCharge: s.reverseCharge,
  });

  el.setAttribute('dir', 'ltr');
  el.dataset.dir = 'ltr';
  el.style.fontFamily = font.family;
  el.style.setProperty('--brand', brand);
  el.className = ['invoice-page', 'tmpl-' + tmpl.id].join(' ');

  const logo = s.logo.dataUrl
    ? `<img class="inv-logo" src="${s.logo.dataUrl}" alt="" style="max-height:${s.logo.size}px;max-width:100%;width:auto;height:auto;object-fit:contain;" />`
    : '';

  const companyLines = [
    s.company.name,
    s.company.name && s.company.personName ? s.company.personName : '',
    s.company.street,
    [s.company.postal, s.company.city].filter(Boolean).join(' '),
    s.company.country,
  ].filter(Boolean);

  const companyMeta = [
    s.company.kvk ? `${t('fKvk')}: ${s.company.kvk}` : '',
    s.company.vat ? `${t('fVat')}: ${s.company.vat}` : '',
    s.company.email,
    s.company.phone,
    s.company.website,
  ].filter(Boolean);

  const customerLines = [
    s.customer.name,
    s.customer.contact,
    s.customer.email,
    s.customer.street,
    [s.customer.postal, s.customer.city].filter(Boolean).join(' '),
    s.customer.country,
    s.customer.kvk ? `${t('fKvk')}: ${s.customer.kvk}` : '',
    s.customer.vat ? `${t('fVat')}: ${s.customer.vat}` : '',
  ].filter(Boolean);

  const metaRows = [
    [t('invoiceNumberShort'), s.invoice.number],
    [t('invoiceDateShort'), fmtDate(s.invoice.date, s.lang)],
    [t('dueDateShort'), fmtDate(dueOf(s, calc), s.lang)],
    s.invoice.deliveryDate ? [t('deliveryDateShort'), fmtDate(s.invoice.deliveryDate, s.lang)] : null,
    s.invoice.period ? [t('periodShort'), s.invoice.period] : null,
    s.invoice.reference ? [t('referenceShort'), s.invoice.reference] : null,
    s.invoice.project ? [t('fProject'), s.invoice.project] : null,
  ].filter(Boolean);

  const metaHtml = `<div class="inv-meta">${metaRows.map(([k, v]) => `<div class="meta-row"><span class="meta-k">${esc(k)}</span><span class="meta-v">${esc(v)}</span></div>`).join('')}</div>`;

  const body = { s, t, calc, rtl, computed };

  const tableRows = computed.lines
    .map((l) => {
      const unitTxt = esc(unitLabel(l.unit, t));
      const vatTxt = vatLabel(l.vat, t);
      const unitPriceTxt = esc(calc.formatCurrency(unitPrice(l), s.lang));
      const qtyTxt = esc(l.qty || '0');
      const amountTxt = esc(calc.formatCurrency(l.baseCents, s.lang));
      return `
      <tr>
        <td class="c-desc"><span>${esc(l.desc || '')}</span></td>
        <td class="c-qty">${qtyTxt}</td>
        <td class="c-unit">${unitTxt}</td>
        <td class="c-price">${unitPriceTxt}</td>
        <td class="c-vat">${vatTxt}</td>
        <td class="c-amount">${amountTxt}</td>
      </tr>`;
    })
    .join('');

  const notice = s.kor
    ? `<div class="inv-notice">${esc(t('korNotice'))}</div>`
    : s.reverseCharge
    ? `<div class="inv-notice">${esc(t('reverseNotice'))}</div>`
    : computed.lines.some((l) => l.vat === 'exempt')
    ? `<div class="inv-notice">${esc(t('vatExemptNotice'))}</div>`
    : '';

  const table = `
    <div class="inv-table-wrap">
      <table class="inv-table">
        <thead>
          <tr>
            <th class="c-desc">${esc(t('colDesc'))}</th>
            <th class="c-qty">${esc(t('colQty'))}</th>
            <th class="c-unit">${esc(t('colUnit'))}</th>
            <th class="c-price">${esc(t('colPrice'))}</th>
            <th class="c-vat">${esc(t('colVat'))}</th>
            <th class="c-amount">${esc(t('colAmount'))}</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
      ${notice}
    </div>
  `;

  const vatSummary =
    computed.vatGroups.length === 0
      ? ''
      : computed.vatGroups
          .map((g) => {
            const label = g.reverse ? t('reverseCharge') : g.exempt ? t('vatExempt') : `${t('vatRate')} ${Math.round(g.rate * 100)}%`;
            return `<div class="tot-row vat-row"><span>${esc(label)}</span><span>${esc(calc.formatCurrency(g.vatCents, s.lang))}</span></div>`;
          })
          .join('');

  const totals = `
    <div class="inv-totals">
      <div class="tot-row"><span>${esc(t('subSubtotal'))}</span><span>${esc(calc.formatCurrency(computed.subtotalCents, s.lang))}</span></div>
      ${computed.discountCents > 0 ? `<div class="tot-row"><span>${esc(t('subDiscount'))}</span><span>-${esc(calc.formatCurrency(computed.discountCents, s.lang))}</span></div>` : ''}
      ${vatSummary}
      <div class="tot-row tot-grand"><span>${esc(t('subTotal'))}</span><span>${esc(calc.formatCurrency(computed.grandTotalCents, s.lang))}</span></div>
    </div>
  `;

  const paymentText = s.paymentText || t('payDefault');
  const payment = `
    <div class="inv-payment">
      <div class="inv-pay-head">
        <div>
          <div class="inv-pay-title">${esc(t('paymentInfo'))}</div>
          <p class="inv-pay-text">${esc(paymentText)}</p>
          <div class="inv-pay-bank">
            ${s.company.iban ? `<div><span class="meta-k">${esc(t('iban'))}</span><span class="meta-v">${esc(s.company.iban)}</span></div>` : ''}
            ${s.company.personName ? `<div><span class="meta-k">${esc(t('accountHolder'))}</span><span class="meta-v">${esc(s.company.personName)}</span></div>` : ''}
            <div><span class="meta-k">${esc(t('invoiceNumberShort'))}</span><span class="meta-v">${esc(s.invoice.number)}</span></div>
          </div>
        </div>
        ${s.qrEnabled ? `<div class="inv-pay-qr" data-qr></div>` : ''}
      </div>
    </div>
  `;

  const customer = `
    <div class="inv-to">
      <div class="inv-to-title">${esc(t('invoiceTo'))}</div>
      ${customerLines.length ? customerLines.map((l) => `<div class="inv-line">${esc(l)}</div>`).join('') : '<div class="muted">—</div>'}
    </div>
  `;

  let inner;
  if (tmpl.id === 'business') {
    inner = `
      <div class="doc-pad biz-band">
        <div class="biz-cols">
          <div class="biz-brand">
            ${logo}
            <div class="biz-company">${companyLines.map((l) => `<div class="inv-line">${esc(l)}</div>`).join('')}</div>
            ${companyMeta.length ? `<div class="biz-company-meta">${companyMeta.map((l) => `<div class="inv-line">${esc(l)}</div>`).join('')}</div>` : ''}
          </div>
          <div class="biz-meta">
            <div class="inv-title">${esc(t('invoiceTitle'))}</div>
            ${metaHtml}
            ${s.customer.name ? `<div class="biz-to">${customer}</div>` : ''}
          </div>
        </div>
      </div>
      <div class="doc-pad biz-body">
        ${table}
        ${totals}
        ${payment}
      </div>`;
  } else if (tmpl.id === 'studio') {
    inner = `
      <div class="studio-grid">
        <aside class="studio-side">
          <div class="studio-brand">
            ${logo}
            ${s.company.name ? `<div class="studio-name">${esc(s.company.name)}</div>` : ''}
          </div>
          <div class="studio-contact">
            ${companyLines.slice(1).map((l) => `<div class="inv-line">${esc(l)}</div>`).join('')}
            ${companyMeta.map((l) => `<div class="inv-line">${esc(l)}</div>`).join('')}
          </div>
        </aside>
        <div class="studio-main">
          <div class="studio-head">
            <div class="inv-title">${esc(t('invoiceTitle'))}</div>
            ${metaHtml}
          </div>
          ${customer}
          ${table}
          ${totals}
          ${payment}
        </div>
      </div>`;
  } else {
    inner = `
      <div class="doc-pad clean-body">
        <div class="clean-head">
          <div class="clean-brand">
            ${logo}
            <div class="clean-company">
              ${companyLines.map((l) => `<div class="inv-line">${esc(l)}</div>`).join('')}
              ${companyMeta.length ? `<div class="clean-company-meta">${companyMeta.map((l) => `<div class="inv-line">${esc(l)}</div>`).join('')}</div>` : ''}
            </div>
          </div>
          <div class="clean-meta">
            <div class="inv-title">${esc(t('invoiceTitle'))}</div>
            ${metaHtml}
          </div>
        </div>
        <div class="clean-rule" aria-hidden="true"></div>
        ${customer}
        ${table}
        ${totals}
        ${payment}
      </div>`;
  }

  el.innerHTML = `<div class="doc ${tmpl.id}">${inner}</div>`;
}

function dueOf(s, calc) {
  return s.invoice.due || isoOf(calc.calculateDueDate(s.invoice.date, s.invoice.payTerm, s.invoice.customDue));
}

function unitLabel(unit, t) {
  const key = 'unit' + unit.charAt(0).toUpperCase() + unit.slice(1);
  return t(key);
}

function vatLabel(vat, t) {
  if (vat === 'exempt') return t('vatExempt');
  if (vat === 'reverse') return t('vatReverse');
  return vat + '%';
}

function unitPrice(l) {
  const q = Number(String(l.qty || '').replace(',', '.'));
  if (!isFinite(q) || q === 0) return l.baseCents;
  return Math.round(l.baseCents / q);
}

export function fmtDate(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso + (String(iso).length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(lang === 'nl' ? 'nl-NL' : lang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(d);
}

function isoOf(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export { esc };
