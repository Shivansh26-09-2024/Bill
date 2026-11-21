import { runAudit } from './audit.js';
import { sampleState, emptyState } from './state.js';
import { toNum } from './format.js';

const line = (id, code, charge, date = '2026-01-05', qty = '1') => ({ id, code, charge, date, qty, description: '' });

test('toNum parses typed money and rejects junk', () => {
  expect(toNum('$1,234.50')).toBe(1234.5);
  expect(toNum('(50.00)')).toBe(-50);
  expect(toNum('')).toBe(null);
  expect(toNum('abc')).toBe(null);
  expect(toNum('12-34')).toBe(null);
});

test('an empty form produces no findings and no data flag', () => {
  const s = emptyState();
  const r = runAudit(s.bill, s.eob);
  expect(r.findings.length).toBe(0);
  expect(r.summary.hasData).toBe(false);
});

test('sample bill surfaces the seeded problems in priority order', () => {
  const s = sampleState();
  const r = runAudit(s.bill, s.eob);
  const ids = r.findings.map((f) => f.id);
  expect(ids[0]).toBe('balance-vs-eob');
  expect(ids).toContain('dup:85025|2026-09-12|142');
  expect(ids).toContain('unbundled:80053|2026-09-12');
  expect(ids).toContain('outside-service-dates');
  expect(ids).toContain('not-on-eob');
  expect(ids).toContain('billed-vs-eob');
  expect(r.summary.counts.high).toBe(2);
  expect(r.summary.counts.medium).toBe(4);
  expect(r.summary.gap).toBe(440);
  expect(r.passed).toContain('Line items add up to the stated total charges');
});

test('a clean bill that matches the EOB has no findings', () => {
  const bill = {
    ...emptyState().bill,
    statedTotalCharges: '300',
    amountDue: '50',
    serviceStart: '2026-01-05',
    serviceEnd: '2026-01-05',
    lines: [line('a', '99213', '200'), line('b', '36415', '100')],
  };
  const eob = { ...emptyState().eob, amountBilled: '300', youOwe: '50', lines: [{ id: 'x', code: '99213' }, { id: 'y', code: '36415' }] };
  const r = runAudit(bill, eob);
  expect(r.findings.length).toBe(0);
  expect(r.passed.length).toBeGreaterThan(2);
});

test('payments already made reduce what is expected', () => {
  const bill = { ...emptyState().bill, amountDue: '100', paymentsMade: '150', lines: [] };
  const eob = { ...emptyState().eob, youOwe: '200' };
  const r = runAudit(bill, eob);
  const f = r.findings.find((x) => x.id === 'balance-vs-eob');
  expect(f.impact).toBe(50);
});

test('stated total above the line sum is a likely error', () => {
  const bill = { ...emptyState().bill, statedTotalCharges: '130', lines: [line('a', '99213', '100')] };
  const f = runAudit(bill, emptyState().eob).findings.find((x) => x.id === 'total-mismatch');
  expect(f.severity).toBe('high');
  expect(f.impact).toBe(30);
});

test('summary-only bills ask for itemization', () => {
  const bill = { ...emptyState().bill, isSummaryOnly: true, amountDue: '400' };
  const r = runAudit(bill, emptyState().eob);
  expect(r.findings.map((f) => f.id)).toContain('no-itemization');
});

test('two visit levels on one day are flagged', () => {
  const bill = { ...emptyState().bill, lines: [line('a', '99213', '120'), line('b', '99214', '180')] };
  const ids = runAudit(bill, emptyState().eob).findings.map((f) => f.id);
  expect(ids.some((id) => id.startsWith('visit-levels:'))).toBe(true);
});
