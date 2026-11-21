import { uid } from './format.js';

export const STORAGE_KEY = 'billcheck:v1';

export const emptyLine = () => ({ id: uid(), date: '', code: '', description: '', qty: '1', charge: '' });
export const emptyEobLine = () => ({ id: uid(), code: '', billed: '' });

export function emptyState() {
  return {
    patient: { name: '', address: '', contact: '' },
    bill: {
      provider: '',
      accountNumber: '',
      statementDate: '',
      serviceStart: '',
      serviceEnd: '',
      statedTotalCharges: '',
      amountDue: '',
      paymentsMade: '',
      isSummaryOnly: false,
      // Fixed id so hydrating an empty state twice never changes the first row's React key.
      lines: [{ id: 'first-line', date: '', code: '', description: '', qty: '1', charge: '' }],
    },
    eob: {
      insurer: '',
      claimNumber: '',
      networkStatus: 'unknown',
      amountBilled: '',
      allowedAmount: '',
      planPaid: '',
      youOwe: '',
      lines: [],
    },
    included: {}, // finding id -> true/false (unset = default: include high and medium)
    calls: [],
  };
}

// Merges whatever is in storage with the current shape, so older saved data never crashes the app.
export function hydrate(stored) {
  const base = emptyState();
  if (!stored || typeof stored !== 'object') return base;
  return {
    patient: { ...base.patient, ...(stored.patient || {}) },
    bill: {
      ...base.bill,
      ...(stored.bill || {}),
      lines: Array.isArray(stored.bill && stored.bill.lines) ? stored.bill.lines : base.bill.lines,
    },
    eob: {
      ...base.eob,
      ...(stored.eob || {}),
      lines: Array.isArray(stored.eob && stored.eob.lines) ? stored.eob.lines : [],
    },
    included: stored.included && typeof stored.included === 'object' ? stored.included : {},
    calls: Array.isArray(stored.calls) ? stored.calls : [],
  };
}

// A made-up ER bill with several realistic problems, so the app can be tried in ten seconds.
export function sampleState() {
  const base = emptyState();
  const line = (id, date, code, description, charge) => ({ id, date, code, description, qty: '1', charge });
  return {
    ...base,
    bill: {
      ...base.bill,
      provider: 'Riverside Community Hospital',
      accountNumber: 'RC-2209981',
      statementDate: '2026-10-02',
      serviceStart: '2026-09-12',
      serviceEnd: '2026-09-12',
      statedTotalCharges: '2907.00',
      amountDue: '640.00',
      paymentsMade: '0',
      lines: [
        line('s1', '2026-09-12', '99284', 'Emergency department visit, level 4', '1850.00'),
        line('s2', '2026-09-12', '85025', 'CBC with automated differential', '142.00'),
        line('s3', '2026-09-12', '85025', 'CBC with automated differential', '142.00'),
        line('s4', '2026-09-12', '80053', 'Comprehensive metabolic panel', '210.00'),
        line('s5', '2026-09-12', '82947', 'Glucose, blood', '48.00'),
        line('s6', '2026-09-12', '71046', 'Chest X-ray, 2 views', '395.00'),
        line('s7', '2026-09-13', '96372', 'Injection, therapeutic', '120.00'),
      ],
    },
    eob: {
      ...base.eob,
      insurer: 'Northwind Health',
      claimNumber: 'NW-77120044',
      networkStatus: 'in',
      amountBilled: '2597.00',
      allowedAmount: '1180.00',
      planPaid: '980.00',
      youOwe: '200.00',
      lines: [
        { id: 'e1', code: '99284', billed: '1850.00' },
        { id: 'e2', code: '85025', billed: '142.00' },
        { id: 'e3', code: '80053', billed: '210.00' },
        { id: 'e4', code: '71046', billed: '395.00' },
      ],
    },
  };
}
