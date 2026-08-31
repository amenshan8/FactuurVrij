// FactuurVrij — three invoice templates. A shared style spec drives BOTH the
// live preview (CSS) and the PDF renderer, so they always match.
//
// style flags:
//  headerBand   solid brand-colour header band across the top (logo + company + title + meta)
//  tableSolid   brand-coloured table header row
//  side         brand-coloured vertical sidebar (logo + company + contact)
//  minimal      super clean, typography-first with plenty of whitespace & thin lines
//  titleColor   invoice title rendered in the brand colour
//
// Every template shows the exact same invoice information — only the visual
// presentation changes. The logo position is defined by the template, never by
// the user.

export const TEMPLATES = [
  { id: 'business', style: { headerBand: true, tableSolid: true } },
  { id: 'studio', style: { side: true } },
  { id: 'clean', style: { minimal: true, titleColor: true } },
];

export function templateById(id) {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
}

export const PRESETS = {
  navy: '#1f2a3a',
  blue: '#2563eb',
  black: '#111827',
  green: '#15803d',
  purple: '#7c3aed',
  orange: '#ea580c',
  red: '#dc2626',
  teal: '#0d9488',
  gray: '#4b5563',
};

// The selectable UI fonts. Arabic is mapped automatically by fontFor().
export const SELECT_FONTS = ['sans', 'arial', 'helvetica', 'georgia', 'times'];

export const FONTS = {
  sans: { family: 'Inter, "Open Sans", Arial, sans-serif', label: 'Inter' },
  arial: { family: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  helvetica: { family: 'Helvetica, Arial, sans-serif', label: 'Helvetica' },
  georgia: { family: 'Georgia, "Times New Roman", serif', label: 'Georgia' },
  times: { family: '"Times New Roman", Times, serif', label: 'Times New Roman' },
  // Arabic faces (hidden from the picker; chosen automatically for ar)
  noto: { family: '"Noto Sans Arabic", "Segoe UI", Tahoma, Arial, sans-serif', label: 'Noto Sans Arabic' },
  cairo: { family: 'Cairo, "Noto Sans Arabic", Arial, sans-serif', label: 'Cairo' },
  tajawal: { family: 'Tajawal, "Noto Sans Arabic", Arial, sans-serif', label: 'Tajawal' },
};

export function fontFor(lang, fontId) {
  if (lang === 'ar') {
    if (fontId === 'cairo') return FONTS.cairo;
    if (fontId === 'tajawal') return FONTS.tajawal;
    if (fontId === 'noto') return FONTS.noto;
    return FONTS.noto;
  }
  return FONTS[fontId] || FONTS.sans;
}
