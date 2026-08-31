// FactuurVrij — localStorage persistence (language, design, optional invoice data)

const KEYS = {
  lang: 'fv_lang',
  design: 'fv_design',
  data: 'fv_data',
};

export function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(KEYS[key]);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

export function saveJson(key, value) {
  try {
    localStorage.setItem(KEYS[key], JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

export function removeKey(key) {
  try {
    localStorage.removeItem(KEYS[key]);
  } catch (e) {}
}

export function getLang() {
  return localStorage.getItem(KEYS.lang) || 'nl';
}

export function setLang(lang) {
  localStorage.setItem(KEYS.lang, lang);
}

export function getDesign() {
  return loadJson('design', null);
}

export function saveDesign(design) {
  if (design) saveJson('design', design);
}

export function getSavedData() {
  return loadJson('data', null);
}

export function saveData(data) {
  saveJson('data', data);
}

export function clearSavedData() {
  removeKey('data');
}

export function clearDesign() {
  removeKey('design');
}