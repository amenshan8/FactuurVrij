// FactuurVrij — application controller

import * as TRANSL from './translations.js';
import * as CALC from './calc.js';
import * as STORE from './storage.js';
import { TEMPLATES, PRESETS, FONTS, SELECT_FONTS, templateById, fontFor } from './templates.js';
import * as STATE from './state.js';
import { buildEditor, renderPreview, getByPath, setByPath, esc, fmtDate, normalizeHex, sanitizeColor } from './render.js';
import { validate } from './validate.js';
import { exportPdf } from './pdf.js';
import { renderQr } from './qr.js';

let qrAnim = 0;

const MAX_UNDO = 60;
let undoStack = [];

function pushHistory() {
  if (undoStack.length >= MAX_UNDO) undoStack.shift();
  undoStack.push(JSON.parse(JSON.stringify(state)));
  setUndoDisabled(undoStack.length === 0);
}

function undo() {
  if (!undoStack.length) return;
  const prev = undoStack.pop();
  Object.assign(state, prev);
  state.lang = lang;
  if (undoStack.length === 0) setUndoDisabled(true);
  renderEditor();
  if (state.remember) persist(true);
}

function setUndoDisabled(disabled) {
  const btn = typeof editorEl !== 'undefined' && editorEl ? editorEl.querySelector('[data-action="undo"]') : null;
  if (btn) btn.disabled = disabled;
}

const state = createInitialState();
let lang = STORE.getLang();
if (!['nl', 'en', 'ar'].includes(lang)) lang = 'nl';
state.lang = lang;

let lastValidColor = normalizeHex(state.design.color) || sanitizeColor(state.design.color);

const t = (key) => TRANSL.translate(key, lang);
const rtl = () => lang === 'ar';

const scope = {
  get state() {
    return state;
  },
  get lang() {
    return lang;
  },
  t,
  calc: CALC,
  templates: TEMPLATES,
  presets: PRESETS,
  fonts: FONTS,
  SELECT_FONTS,
  fontFor,
  templateById,
  get canUndo() {
    return undoStack.length > 0;
  },
};

function createInitialState() {
  const s = STATE.emptyState(STORE.getLang());
  const saved = STORE.getSavedData();
  if (saved) {
    try {
      Object.assign(s, JSON.parse(JSON.stringify(saved)));
    } catch (e) {}
  }
  const design = STORE.getDesign();
  if (design) s.design = Object.assign(s.design, design);
  return s;
}

function persist(silent) {
  if (state.remember) {
    const copy = JSON.parse(JSON.stringify(state));
    if (copy.logo && copy.logo.dataUrl && copy.logo.dataUrl.length > 900000) copy.logo.dataUrl = null;
    const ok = STORE.saveData(copy);
    STORE.saveDesign(state.design);
    if (ok && !silent) toast(t('successSaved'));
  } else {
    STORE.clearSavedData();
    STORE.saveDesign(state.design);
  }
}

function updateDynamic() {
  updateLineAmounts();
  updateTotals();
  updateChecklist();
  renderPreview(previewEl, scope);
  updateQr();
  syncTmplAccent();
}

function syncTmplAccent() {
  const grid = editorEl.querySelector('.tmpl-grid');
  if (grid) grid.style.setProperty('--tt', sanitizeColor(state.design.color));
}

function updateQr() {
  const holder = previewEl.querySelector('[data-qr]');
  const myAnim = ++qrAnim;
  if (!holder || !state.qrEnabled) {
    if (holder) holder.innerHTML = '';
    return;
  }
  const computed = CALC.compute(computeInput());
  const payload = CALC.epcPayloadString(
    state.company.personName || state.company.name,
    state.company.iban,
    computed.grandTotalCents,
    state.invoice.number
  );
  if (!payload) {
    holder.innerHTML = '';
    return;
  }
  const side = Math.round(Math.min(holder.clientWidth || 88, 88));
  renderQr(holder, payload, side).then(() => {
    if (myAnim !== qrAnim) return; // stale update
  });
}

function updateLineAmounts() {
  const computed = CALC.compute(computeInput());
  document.querySelectorAll('[data-line-amount]').forEach((el) => {
    const i = Number(el.dataset.lineAmount);
    const l = computed.lines[i];
    el.textContent = l ? CALC.formatCurrency(l.baseCents, lang) : '—';
  });
}

function computeInput() {
  return {
    lang,
    lines: state.lines,
    discount: state.discount,
    kor: state.kor,
    reverseCharge: state.reverseCharge,
  };
}

function updateTotals() {
  const computed = CALC.compute(computeInput());
  const box = document.querySelector('[data-totals]');
  if (!box) return;
  const rows = [];
  rows.push([t('subSubtotal'), computed.subtotalCents]);
  if (computed.discountCents > 0) rows.push([t('subDiscount'), -computed.discountCents]);
  computed.vatGroups.forEach((g) => {
    const label = g.reverse ? t('reverseCharge') : g.exempt ? t('vatExempt') : `${t('vatRate')} ${Math.round(g.rate * 100)}%`;
    rows.push([label, g.vatCents]);
  });
  const html =
    rows
      .map(([k, c]) => `<div class="tot-row"><span>${esc(k)}</span><span>${esc(CALC.formatCurrency(c, lang))}</span></div>`)
      .join('') +
    `<div class="tot-row tot-grand"><span>${esc(t('subTotal'))}</span><span>${esc(CALC.formatCurrency(computed.grandTotalCents, lang))}</span></div>`;
  box.innerHTML = html;
}

function updateChecklist() {
  const box = document.querySelector('[data-checklist]');
  if (!box) return;
  const { items, complete, okCount, total } = validate(state);
  const list = items
    .map((it) => {
      const cls = it.ok ? 'check-ok' : 'check-warn';
      const mark = it.ok ? '✓' : '•';
      const note = it.ok ? '' : `<span class="warn-text">${esc(t(it.warn))}</span>`;
      return `<div class="check-item ${cls}"><span class="check-mark">${mark}</span><span class="check-name">${esc(t(it.key))}</span>${note}</div>`;
    })
    .join('');
  const status = complete
    ? `<div class="check-status ok">${esc(t('okComplete'))}</div>`
    : `<div class="check-status">${okCount}/${total}</div>`;
  box.innerHTML = `<div class="check-header">${esc(t('checkTitle'))}</div>${status}${list}`;
}

// ---------------------------------------------------------------------------

const editorEl = document.getElementById('editor');
const previewEl = document.getElementById('preview');

function renderEditor() {
  editorEl.innerHTML = buildEditor(scope);
  updateDynamic();
}

// --- editor event delegation (bound once) ---
function applyEditorBindings() {
  editorEl.addEventListener('input', onEditorInput);
  editorEl.addEventListener('change', onEditorChange);
  editorEl.addEventListener('focusin', onEditorFocus);
  editorEl.addEventListener('click', onEditorClick);
}

function onEditorFocus(e) {
  const el = e.target.closest('[data-field]');
  if (!el || el.dataset.focusCaptured) return;
  pushHistory();
  el.dataset.focusCaptured = '1';
}

function onEditorInput(e) {
  const el = e.target;
  if (el.matches('[data-field]')) {
    const path = el.dataset.field;
    let value;
    if (el.type === 'checkbox') value = el.checked;
    else if (el.type === 'range') value = Number(el.value);
    else value = el.value;
    setByPath(state, path, value);
    if (path === 'design.color') syncColorInputs(value);
    if (path === 'logo.size') {
      const range = editorEl.querySelector('#logo-size');
      const out = range && range.closest('.range-row') ? range.closest('.range-row').querySelector('.range-val') : null;
      if (out) out.textContent = value + 'px';
    }
    if (path === 'lines' || /^lines\.\d+\./.test(path)) {
      // update just the line amounts + totals + preview
      updateDynamic();
    } else {
      updateDynamic();
    }
    maybeAutoDue(path);
  }
}

function syncColorInputs(value) {
  const norm = normalizeHex(value);
  editorEl.querySelectorAll('[data-field="design.color"]').forEach((el) => {
    if (el.classList.contains('color-picker')) {
      if (norm) el.value = norm;
    } else if (el.value !== value) {
      el.value = value;
    }
  });
}

function onEditorChange(e) {
  const el = e.target;
  if (el.matches('[data-field]')) {
    let value;
    if (el.type === 'checkbox') value = el.checked;
    else value = el.value;
    const path = el.dataset.field;
    if (path === 'design.color') {
      const norm = normalizeHex(value);
      if (!norm && value.trim() !== '') {
        // Reject malformed hex on blur: restore the last valid color.
        state.design.color = lastValidColor;
        syncColorInputs(lastValidColor);
        updateDynamic();
        return;
      }
    }
    setByPath(state, path, value);
    if (path === 'design.color') {
      const norm = normalizeHex(value);
      if (norm) lastValidColor = norm;
      syncColorInputs(value);
    }
    if (path === 'remember') {
      if (value) persist(false);
      else STORE.clearSavedData();
    } else if (state.remember) {
      persist(true);
    }
    maybeAutoDue(path);
    updateDynamic();
  }
}

function maybeAutoDue(path) {
  if (path === 'invoice.date' || path === 'invoice.payTerm' || path === 'invoice.customDue') {
    const due = autoDue();
    state.invoice.due = due;
    const dueIn = editorEl.querySelector('[data-field="invoice.due"]');
    if (dueIn) dueIn.value = due;
  }
}

function autoDue() {
  if (state.invoice.payTerm === 'custom') {
    return state.invoice.customDue || state.invoice.date;
  }
  return isoOf(CALC.calculateDueDate(state.invoice.date, state.invoice.payTerm, state.invoice.customDue));
}

function isoOf(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  return STATE.toISODate(d);
}

function onEditorClick(e) {
  const target = e.target;
  const toggle = target.closest('[data-section-toggle]');
  if (toggle) {
    const sec = toggle.closest('.section');
    sec.classList.toggle('open');
    const open = sec.classList.contains('open');
    toggle.setAttribute('aria-expanded', String(open));
    return;
  }
  const actionEl = target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  handleAction(action, actionEl, e);
}

function handleAction(action, el, e) {
  switch (action) {
    case 'undo':
      undo();
      break;
    case 'nextNumber':
      pushHistory();
      state.invoice.number = CALC.nextNumber(state.invoice.number);
      setFieldValue('invoice.number', state.invoice.number);
      updateDynamic();
      break;
    case 'addLine':
      pushHistory();
      const lastLine = state.lines[state.lines.length - 1];
      state.lines.push(STATE.makeLine({ vat: lastLine ? lastLine.vat : '21' }));
      renderEditor();
      break;
    case 'deleteLine':
      pushHistory();
      state.lines.splice(Number(el.dataset.i), 1);
      if (state.lines.length === 0) state.lines.push(STATE.makeLine());
      renderEditor();
      break;
    case 'duplicate':
      pushHistory();
      state.lines.splice(Number(el.dataset.i) + 1, 0, JSON.parse(JSON.stringify(state.lines[Number(el.dataset.i)])));
      renderEditor();
      break;
    case 'moveUp': {
      const i = Number(el.dataset.i);
      if (i > 0) {
        pushHistory();
        const tmp = state.lines[i - 1];
        state.lines[i - 1] = state.lines[i];
        state.lines[i] = tmp;
        renderEditor();
      }
      break;
    }
    case 'moveDown': {
      const i = Number(el.dataset.i);
      if (i < state.lines.length - 1) {
        pushHistory();
        const tmp = state.lines[i + 1];
        state.lines[i + 1] = state.lines[i];
        state.lines[i] = tmp;
        renderEditor();
      }
      break;
    }
    case 'toggleDiscount':
      pushHistory();
      state.discount.enabled = !state.discount.enabled;
      renderEditor();
      break;
    case 'setTemplate':
      pushHistory();
      state.design.template = el.dataset.template;
      persist();
      renderEditor();
      break;
    case 'setColor':
      pushHistory();
      state.design.color = el.dataset.color;
      setFieldValue('design.color', el.dataset.color);
      lastValidColor = el.dataset.color;
      persist();
      renderEditor();
      break;
    case 'newInvoice':
      pushHistory();
      Object.assign(state, STATE.emptyState(lang));
      state.lang = lang;
      renderEditor();
      break;
    case 'fillExample':
      pushHistory();
      Object.assign(state, STATE.exampleState(lang));
      state.lang = lang;
      state.invoice.due = autoDue();
      renderEditor();
      persist(false);
      toast(t('exampleNotice'));
      break;
    case 'clearAll':
      openConfirmDialog();
      break;
    case 'changeLogo':
      openLogoPicker();
      break;
    case 'removeLogo':
      pushHistory();
      state.logo.dataUrl = null;
      renderEditor();
      break;
    case 'rememberNow':
      pushHistory();
      state.remember = true;
      setFieldValue('remember', true);
      persist();
      break;
  }
}

function setFieldValue(path, value) {
  const els = editorEl.querySelectorAll(`[data-field="${path}"]`);
  if (!els.length) return;
  els.forEach((el) => {
    if (el.type === 'checkbox') el.checked = !!value;
    else el.value = value;
  });
}

// --- logo picker ---
function openLogoPicker() {
  const input = document.getElementById('logo-input');
  input.value = '';
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!/image\/(png|jpeg|jpg|svg\+xml)|\.svg$/i.test(file.type)) {
      toast(t('imageUnsupported'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      pushHistory();
      state.logo.dataUrl = reader.result;
      renderEditor();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// --- dialogs ---
function openConfirmDialog() {
  const root = document.getElementById('dialog-root');
  const html = `
    <div class="dialog-backdrop" role="presentation">
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title">
        <h3 id="dlg-title">${esc(t('confirmClearTitle'))}</h3>
        <p>${esc(t('confirmClear'))}</p>
        <div class="dialog-actions">
          <button type="button" class="btn" data-dlg="cancel">${esc(t('btnCancel'))}</button>
          <button type="button" class="btn btn-danger" data-dlg="confirm">${esc(t('btnConfirm'))}</button>
        </div>
      </div>
    </div>`;
  root.innerHTML = html;
  const backdrop = root.querySelector('.dialog-backdrop');
  const close = () => (root.innerHTML = '');
  backdrop.querySelector('[data-dlg="cancel"]').onclick = close;
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector('[data-dlg="confirm"]').onclick = () => {
    // clear everything including saved data
    pushHistory();
    Object.assign(state, STATE.emptyState(lang));
    state.lang = lang;
    state.remember = false;
    STORE.clearSavedData();
    STORE.clearDesign();
    root.innerHTML = '';
    renderEditor();
    toast(t('dataCleared'));
  };
  const btn = backdrop.querySelector('[data-dlg="confirm"]');
  btn.focus();
}

// --- toast ---
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// --- preview zoom ---
const ZOOM_BASE = 794; // CSS width returned at 100% (210mm @ ~96dpi), true A4 proportions
let previewZoom = 1;
let previewZoomFit = true;

function setupZoom() {
  const frame = document.querySelector('.preview-frame');
  if (!frame) return;
  const pct = document.getElementById('zoom-pct');
  const out = document.getElementById('zoom-out');
  const inn = document.getElementById('zoom-in');
  const fit = document.getElementById('zoom-fit');

  const apply = () => {
    const cs = getComputedStyle(frame);
    const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const inner = Math.max(frame.clientWidth - pad, 1);
    const zoom = previewZoomFit ? Math.max(inner / ZOOM_BASE, 0.08) : previewZoom;
    frame.style.setProperty('--pz', zoom.toFixed(3));
    if (pct) pct.textContent = Math.round(zoom * 100) + '%';
  };

  out.addEventListener('click', () => {
    previewZoomFit = false;
    previewZoom = Math.max(0.2, (previewZoomFit ? 1 : previewZoom) * 0.9);
    apply();
  });
  inn.addEventListener('click', () => {
    previewZoomFit = false;
    previewZoom = Math.min(3, (previewZoomFit ? 1 : previewZoom) * 1.1);
    apply();
  });
  fit.addEventListener('click', () => {
    previewZoomFit = true;
    apply();
  });

  window.addEventListener('resize', () => {
    if (previewZoomFit) apply();
  });

  apply();
}

// --- theme ---
function applyTheme(orovia) {
  const on = !!orovia;
  document.body.classList.toggle('theme-orovia', on);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.setAttribute('aria-pressed', String(on));
  try {
    localStorage.setItem('fv-theme', on ? 'orovia' : 'classic');
  } catch (e) {}
}

function setTheme(orovia) {
  applyTheme(orovia);
}

// --- language ---
function setLanguage(next) {
  lang = next;
  state.lang = next;
  STORE.setLang(next);
  applyLanguage();
  renderEditor();
}

function applyLanguage() {
  const html = document.documentElement;
  html.lang = lang;
  html.dir = 'ltr';
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.title =
    lang === 'nl' ? 'FactuurVrij — Gratis facturen maken' : lang === 'ar' ? 'FactuurVrij — إنشاء فواتير مجانية' : 'FactuurVrij — Free invoices';
  buildLangSwitcher();
  buildHowList();
  buildWhyList();
  buildFaq();
}

function buildLangSwitcher() {
  const el = document.getElementById('lang-switcher');
  el.innerHTML = TRANSL.LANGUAGES.map((l) => {
    const label = l === 'nl' ? 'Nederlands' : l === 'en' ? 'English' : 'العربية';
    return `<button type="button" class="lang-btn ${l === lang ? 'active' : ''}" data-lang="${l}" aria-pressed="${l === lang}">${label}</button>`;
  }).join('');
}

function buildHowList() {
  const el = document.getElementById('how-list');
  el.innerHTML = ['how1', 'how2', 'how3', 'how4'].map((k) => `<li>${esc(t(k))}</li>`).join('');
}

function buildWhyList() {
  const el = document.getElementById('why-list');
  el.innerHTML = ['why1', 'why2', 'why3', 'why4', 'why5', 'why6', 'why7'].map((k) => `<li>${esc(t(k))}</li>`).join('');
}

function buildFaq() {
  const el = document.getElementById('faq-list');
  const qa = [
    ['q1', 'a1'],
    ['q2', 'a2'],
    ['q3', 'a3'],
    ['q4', 'a4'],
    ['q5', 'a5'],
    ['q6', 'a6'],
  ];
  el.innerHTML = qa
    .map(([q, a]) => {
      return `
      <div class="faq-item">
        <button type="button" class="faq-q" aria-expanded="false">${esc(t(q))}</button>
        <div class="faq-a" hidden>${esc(t(a))}</div>
      </div>`;
    })
    .join('');
}

// ---------------------------------------------------------------------------

function bindActions() {
  document.getElementById('lang-switcher').addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (b) setLanguage(b.dataset.lang);
  });

  document.getElementById('btn-download').addEventListener('click', doDownload);
  document.getElementById('btn-print').addEventListener('click', () => window.print());
  document.getElementById('mob-download').addEventListener('click', doDownload);
  document.getElementById('mob-view').addEventListener('click', () => {
    const frame = document.querySelector('.preview-frame');
    frame.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => setTheme(!document.body.classList.contains('theme-orovia')));
  }

  setupZoom();

  document.querySelector('.main-nav').addEventListener('click', (e) => {
    e.preventDefault();
    const a = e.target.closest('a');
    if (a) document.querySelector(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('faq-list').addEventListener('click', (e) => {
    const q = e.target.closest('.faq-q');
    if (!q) return;
    const a = q.nextElementSibling;
    const open = a.hidden;
    a.hidden = !open ? true : false;
    q.setAttribute('aria-expanded', String(a.hidden ? false : true));
  });
}

async function doDownload() {
  const btn = document.getElementById('btn-download');
  const mob = document.getElementById('mob-download');
  const buttons = [btn, mob].filter(Boolean);
  const originals = buttons.map((b) => b.textContent);
  buttons.forEach((b) => {
    b.disabled = true;
    b.textContent = t('pdfCreating');
  });
  try {
    await exportPdf(scope);
  } catch (err) {
    console.error('[FactuurVrij] PDF creation failed:', err);
    toast(t('pdfError'));
  } finally {
    buttons.forEach((b, i) => {
      b.disabled = false;
      b.textContent = originals[i];
    });
  }
}

// ---------------------------------------------------------------------------

function init() {
  bindActions();
  applyEditorBindings();
  applyLanguage();
  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem('fv-theme');
  } catch (e) {}
  applyTheme(savedTheme === 'orovia');
  state.invoice.due = autoDue();
  window.addEventListener('pagehide', () => { if (state.remember) persist(true); });
  renderEditor();
}

init();
