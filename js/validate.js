// FactuurVrij — validation checklist. Never blocks PDF creation.

export function validate(state) {
  const items = [];
  const c = state.company;
  const hasCompany =
    c.name.trim() !== '' ||
    c.personName.trim() !== '' ||
    c.street.trim() !== '' ||
    c.city.trim() !== '' ||
    c.iban.trim() !== '' ||
    c.email.trim() !== '' ||
    c.phone.trim() !== '';

  items.push({
    key: 'checkCompany',
    ok: hasCompany,
    warn: 'warnCompany',
  });

  const hasCustomer = state.customer.name.trim() !== '';
  items.push({ key: 'checkCustomer', ok: hasCustomer, warn: 'warnCustomer' });

  const hasNumber = state.invoice.number.trim() !== '';
  items.push({ key: 'checkNumber', ok: hasNumber, warn: 'warnNumber' });

  const hasDate = state.invoice.date.trim() !== '';
  items.push({ key: 'checkDate', ok: hasDate, warn: 'warnDate' });

  const hasLines = state.lines.some((l) => String(l.desc || '').trim() !== '');
  items.push({ key: 'checkLines', ok: hasLines, warn: 'warnLines' });

  const hasVat = state.lines.some((l) => (l.vat || '21') !== '');
  items.push({ key: 'checkVat', ok: hasVat, warn: 'warnVat' });

  const hasIban = c.iban.trim() !== '';
  items.push({ key: 'checkIban', ok: hasIban, warn: 'warnIban' });

  const okCount = items.filter((i) => i.ok).length;
  return { items, okCount, total: items.length, complete: okCount === items.length };
}