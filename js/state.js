// FactuurVrij — invoice state model + defaults

export function makeLine(over = {}) {
  return {
    desc: '',
    qty: '',
    unit: 'hour',
    price: '',
    vat: '21',
    ...over,
  };
}

export function emptyState(lang) {
  const today = new Date();
  const iso = toISODate(today);
  return {
    lang,
    company: {
      name: '', personName: '', street: '', postal: '', city: '', country: '',
      kvk: '', vat: '', iban: '', email: '', phone: '', website: '',
    },
    logo: { dataUrl: null, size: 80 },
    customer: { name: '', contact: '', email: '', street: '', postal: '', city: '', country: '', kvk: '', vat: '' },
    invoice: {
      number: new Date().getFullYear() + '-001',
      date: iso,
      payTerm: '30',
      customDue: '',
      deliveryDate: '', period: '', reference: '', project: '', customerNo: '',
    },
    lines: [makeLine()],
    discount: { enabled: false, type: 'pct', value: '' },
    kor: false,
    reverseCharge: false,
    paymentText: '',
    qrEnabled: true,
    design: {
      template: 'business',
      color: '#1f2a3a',
      font: 'sans',
    },
    remember: false,
  };
}

export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Fill the form with realistic example data (marked as example).
export function exampleState(lang) {
  const s = emptyState(lang);
  s.company = {
    name: 'Studio Noord',
    personName: 'Naam van de eigenaar',
    street: 'Keizersgracht 100',
    postal: '1015 AA',
    city: 'Amsterdam',
    country: 'Nederland',
    kvk: '12345678',
    vat: 'NL123456789B01',
    iban: 'NL91 ABNA 0417 1643 00',
    email: 'info@studionoord.nl',
    phone: '+31 20 123 4567',
    website: 'www.studionoord.nl',
  };
  s.customer = {
    name: 'Voorbeeld Bedrijf B.V.',
    contact: 'J. Jansen',
    street: 'Industrieweg 12',
    postal: '2712 PC',
    city: 'Zoetermeer',
    country: 'Nederland',
    email: 'info@voorbeeld.nl',
  };
  const today = new Date();
  s.invoice = {
    number: today.getFullYear() + '-001',
    date: toISODate(today),
    payTerm: '30',
    customDue: '',
    deliveryDate: '',
    period: today.getFullYear() + '-Q3',
    reference: 'REF-100',
    project: '',
    customerNo: '',
  };
  s.lines = [
    makeLine({ desc: 'Webdesign', qty: '10', unit: 'hour', price: '75', vat: '21' }),
    makeLine({ desc: 'Hosting (per jaar)', qty: '1', unit: 'project', price: '120', vat: '21' }),
  ];
  s.remember = true;
  return s;
}

export function cloneState(s) {
  return JSON.parse(JSON.stringify(s));
}
