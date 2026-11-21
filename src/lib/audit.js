// Deterministic checks for a medical bill against the insurer's Explanation of Benefits (EOB).
// Pure functions, no React and no network, so every rule is easy to test and explain.
//
// Important limits: this compares numbers the user typed in. It cannot judge medical
// necessity or whether a billing code is correct. Rules that depend on code relationships
// (panels, visit levels) are small hand-picked lists and only ever say "ask", never "wrong".

import { toNum, round2, money, fmtDate } from './format.js';

export const SEVERITY_LABEL = {
  high: 'Likely error',
  medium: 'Worth questioning',
  low: 'Double-check',
};

const EPS = 0.009;

// Lab panels and the individual tests they already include.
const PANELS = {
  '80048': { name: 'basic metabolic panel', parts: ['82310', '82374', '82435', '82565', '82947', '84132', '84295', '84520'] },
  '80051': { name: 'electrolyte panel', parts: ['82374', '82435', '84132', '84295'] },
  '80053': {
    name: 'comprehensive metabolic panel',
    parts: ['82040', '82247', '82310', '82374', '82435', '82565', '82947', '84075', '84132', '84155', '84295', '84450', '84460', '84520'],
  },
  '80061': { name: 'lipid panel', parts: ['82465', '83718', '84478'] },
};

// Only one code from each group is normally billed per provider per day.
const VISIT_LEVEL_GROUPS = [
  { name: 'established-patient office visit levels', codes: ['99212', '99213', '99214', '99215'] },
  { name: 'new-patient office visit levels', codes: ['99202', '99203', '99204', '99205'] },
];

// Pairs that describe the same test done two ways.
const EXCLUSIVE_PAIRS = [['85025', '85027', 'a blood count with and without a differential']];

function norm(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function joinList(items) {
  const a = items.map(String);
  if (a.length <= 1) return a.join('');
  return `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
}

function lineRefs(lines) {
  return `${lines.length > 1 ? 'Lines' : 'Line'} ${joinList(lines.map((l) => l.no))}`;
}

function labelOf(line) {
  if (line.code && line.description) return `${line.code} (${line.description})`;
  return line.code || line.description || `Line ${line.no}`;
}

function dateOn(date) {
  return date && date !== 'undated' ? ` on ${fmtDate(date)}` : '';
}

function sumCharges(lines) {
  return round2(lines.reduce((s, l) => s + (l.charge ?? 0), 0));
}

export function runAudit(bill = {}, eob = {}) {
  const findings = [];
  const passed = [];
  // `ask` is advice for the person; `request` is the same point worded for the letter to the billing office.
  const add = (f) => findings.push({ impact: null, lineIds: [], tip: '', request: '', ...f });

  // `no` is the row's position in the editor, so findings can point at "Line 3".
  const lines = (bill.lines || [])
    .map((l, i) => ({
      id: l.id,
      no: i + 1,
      date: l.date || '',
      code: norm(l.code),
      description: String(l.description || '').trim(),
      qty: toNum(l.qty) ?? 1,
      charge: toNum(l.charge),
    }))
    .filter((l) => l.code || l.description || l.charge !== null);
  const priced = bill.isSummaryOnly ? [] : lines.filter((l) => l.charge !== null);
  const hasLines = priced.length > 0;

  const lineSum = hasLines ? sumCharges(priced) : null;
  const statedTotal = toNum(bill.statedTotalCharges);
  const amountDue = toNum(bill.amountDue);
  const paymentsMade = toNum(bill.paymentsMade) ?? 0;
  const eobOwe = toNum(eob.youOwe);
  const eobBilled = toNum(eob.amountBilled);

  // 1. Is there anything line-by-line to check?
  if (!hasLines && (bill.isSummaryOnly || statedTotal !== null || amountDue !== null)) {
    add({
      id: 'no-itemization',
      severity: 'medium',
      title: 'No itemized charges to check',
      detail: 'Without a line-by-line list, duplicate charges, wrong codes and services that never happened cannot be spotted.',
      ask: 'Request an itemized statement showing the date, billing code and charge for every service.',
      request: 'Please send an itemized statement showing the date, billing code and charge for every service.',
    });
  }

  if (hasLines) {
    // 2. Do the lines add up to the stated total?
    if (statedTotal !== null) {
      const diff = round2(statedTotal - lineSum);
      if (diff > EPS) {
        add({
          id: 'total-mismatch',
          severity: 'high',
          title: 'Stated total is higher than the line items add up to',
          detail: `The line items add up to ${money(lineSum)}, but the bill states ${money(statedTotal)}. That is ${money(diff)} that no listed service accounts for.`,
          ask: 'Ask which charges make up the difference, or request a corrected statement.',
          request: 'Please identify the charges that make up the difference, or send a corrected statement.',
          impact: diff,
        });
      } else if (diff < -EPS) {
        add({
          id: 'total-below-lines',
          severity: 'medium',
          title: 'Line items add up to more than the stated total',
          detail: `The line items add up to ${money(lineSum)}, but the bill states ${money(statedTotal)}. Discounts or adjustments listed elsewhere can explain this.`,
          ask: 'Ask where the adjustments are shown and confirm the total.',
          request: 'Please show where adjustments are applied and confirm the correct total.',
        });
      } else {
        passed.push('Line items add up to the stated total charges');
      }
    }

    // 3. Identical charges repeated on the same date.
    const dupGroups = [
      ...groupBy(
        priced.filter((l) => l.code || l.description),
        (l) => [l.code || l.description.toLowerCase(), l.date, l.charge].join('|')
      ).values(),
    ].filter((g) => g.length > 1);
    for (const g of dupGroups) {
      const first = g[0];
      const n = g.length;
      add({
        id: `dup:${first.code || first.description}|${first.date}|${first.charge}`,
        severity: 'high',
        title: `${labelOf(first)} is listed ${n} times`,
        detail: `${lineRefs(g)} show the same service${dateOn(first.date)} at ${money(first.charge)} each, ${money(first.charge * n)} in total.`,
        ask: `Confirm the service was performed ${n} times and send the records, or remove the extra ${n - 1 === 1 ? 'charge' : 'charges'}.`,
        request: `Please confirm the service was performed ${n} times and send the supporting records, or remove the extra ${n - 1 === 1 ? 'charge' : 'charges'}.`,
        impact: round2(first.charge * (n - 1)),
        lineIds: g.map((l) => l.id),
      });
    }
    if (dupGroups.length === 0) passed.push('No identical charges repeated on the same date');

    // 4. Same code, same day, different amounts.
    for (const g of groupBy(priced.filter((l) => l.code && l.date), (l) => `${l.code}|${l.date}`).values()) {
      if (g.length > 1 && new Set(g.map((l) => l.charge)).size > 1) {
        add({
          id: `sameday:${g[0].code}|${g[0].date}`,
          severity: 'medium',
          title: `${g[0].code} is billed ${g.length} times${dateOn(g[0].date)}`,
          detail: `${lineRefs(g)} use the same code with different amounts (${joinList(g.map((l) => money(l.charge)))}).`,
          ask: 'Ask what each line covers and why the amounts differ.',
          request: 'Please explain what each line covers and why the amounts differ.',
          lineIds: g.map((l) => l.id),
        });
      }
    }

    // 5. Code relationships on the same date: visit levels, exclusive pairs, panels billed with their parts.
    for (const [date, g] of groupBy(priced.filter((l) => l.code), (l) => l.date || 'undated')) {
      const codes = new Set(g.map((l) => l.code));

      for (const group of VISIT_LEVEL_GROUPS) {
        const hit = group.codes.filter((c) => codes.has(c));
        if (hit.length > 1) {
          const rows = g.filter((l) => hit.includes(l.code));
          add({
            id: `visit-levels:${hit.join('+')}|${date}`,
            severity: 'medium',
            title: `Two ${group.name} billed${dateOn(date)}`,
            detail: `${lineRefs(rows)} bill ${joinList(hit)}. A single visit normally has one level.`,
            ask: 'Ask which level applies and for the other to be removed.',
            request: 'Please confirm which level applies and remove the other.',
            lineIds: rows.map((l) => l.id),
          });
        }
      }

      for (const [a, b, what] of EXCLUSIVE_PAIRS) {
        if (codes.has(a) && codes.has(b)) {
          const rows = g.filter((l) => l.code === a || l.code === b);
          add({
            id: `exclusive:${a}+${b}|${date}`,
            severity: 'medium',
            title: `${a} and ${b} both billed${dateOn(date)}`,
            detail: `${lineRefs(rows)} describe ${what}, which is normally billed one way or the other.`,
            ask: 'Ask whether both tests were actually run.',
            request: 'Please confirm whether both tests were performed.',
            lineIds: rows.map((l) => l.id),
          });
        }
      }

      for (const [panel, info] of Object.entries(PANELS)) {
        if (!codes.has(panel)) continue;
        const parts = g.filter((l) => info.parts.includes(l.code));
        if (parts.length === 0) continue;
        const panelRows = g.filter((l) => l.code === panel);
        add({
          id: `unbundled:${panel}|${date}`,
          severity: 'medium',
          title: `${panel} already includes tests billed separately`,
          detail: `${panel} (${info.name}) covers tests such as ${joinList(parts.map((l) => l.code))}. ${lineRefs(parts)} bill${parts.length > 1 ? '' : 's'} ${parts.length > 1 ? 'them' : 'it'} again${dateOn(date)}.`,
          ask: 'Ask whether these were extra tests ordered separately from the panel. If not, they should not be charged twice.',
          request: 'Please confirm whether these were separate tests ordered in addition to the panel. If they were not, please remove them.',
          impact: sumCharges(parts),
          lineIds: [...panelRows, ...parts].map((l) => l.id),
        });
      }
    }

    // 6. Very large quantities (a stray zero is a classic typo).
    const bigQty = priced.filter((l) => l.qty >= 20);
    if (bigQty.length > 0) {
      add({
        id: 'large-quantity',
        severity: 'low',
        title: 'Unusually large quantities',
        detail: `${lineRefs(bigQty)} list quantities of ${joinList(bigQty.map((l) => l.qty))}.`,
        ask: 'Verify the quantities. A typo can turn 10 units into 100.',
        request: 'Please verify these quantities.',
        lineIds: bigQty.map((l) => l.id),
      });
    }

    // 7. Charges dated outside the service period.
    const start = bill.serviceStart || bill.serviceEnd || '';
    const end = bill.serviceEnd || bill.serviceStart || '';
    if (start || end) {
      const dated = priced.filter((l) => l.date);
      const outside = dated.filter((l) => (start && l.date < start) || (end && l.date > end));
      if (outside.length > 0) {
        const period = start === end ? fmtDate(start) : `${fmtDate(start)} to ${fmtDate(end)}`;
        add({
          id: 'outside-service-dates',
          severity: 'medium',
          title: 'Charges dated outside the service period',
          detail: `${lineRefs(outside)} ${outside.length > 1 ? 'are' : 'is'} dated ${joinList(outside.map((l) => fmtDate(l.date)))}, but the service period is ${period}.`,
          ask: 'Ask what these charges are for and why they fall outside the visit dates.',
          request: 'Please explain what these charges are for and why they fall outside the dates of service.',
          impact: sumCharges(outside),
          lineIds: outside.map((l) => l.id),
        });
      } else if (dated.length > 0) {
        passed.push('Every charge date falls inside the service period');
      }
    }
  }

  // 8. What the bill asks for vs what the insurer says the patient owes.
  const expected = eobOwe === null ? null : Math.max(0, round2(eobOwe - paymentsMade));
  let gap = null;
  if (amountDue !== null && expected !== null) {
    gap = round2(amountDue - expected);
    if (gap > EPS) {
      let tip = '';
      if (eob.networkStatus === 'in') {
        tip = 'This provider is in your network. The gap between billed and allowed amounts is normally written off under the provider’s contract, not passed on to you.';
      } else if (eob.networkStatus === 'out') {
        tip = 'If this was emergency care, or care at an in-network facility, the federal No Surprises Act may limit what you can be charged. The No Surprises Help Desk or your state insurance department can help.';
      }
      add({
        id: 'balance-vs-eob',
        severity: 'high',
        title: 'Amount due is higher than the insurance statement supports',
        detail: `The bill asks for ${money(amountDue)}. The EOB lists ${money(eobOwe)} as the patient’s responsibility${
          paymentsMade > EPS ? `, and ${money(paymentsMade)} has already been paid, which leaves ${money(expected)}` : ''
        }. That is ${money(gap)} more than the EOB supports.`,
        ask: 'Ask the billing office to reconcile the balance against the EOB and send a corrected statement, or explain what the extra amount is for.',
        request: 'Please reconcile the balance against the EOB and send a corrected statement, or explain what the additional amount is for.',
        tip,
        impact: gap,
      });
    } else if (gap < -EPS) {
      add({
        id: 'balance-below-eob',
        severity: 'low',
        title: 'Amount due is lower than the insurance statement',
        detail: `The bill asks for ${money(amountDue)}, while the EOB points to ${money(expected)} after payments.`,
        ask: 'Confirm no payment or adjustment is still pending, so a larger bill does not arrive later.',
        request: 'Please confirm that no payment or adjustment is still pending on this account.',
      });
    } else {
      passed.push('Amount due matches what the insurance statement says is owed');
    }
  }

  // 9. Does the bill's total match what the provider billed the insurer?
  const billTotal = statedTotal ?? lineSum;
  if (billTotal !== null && eobBilled !== null) {
    const diff = round2(billTotal - eobBilled);
    if (Math.abs(diff) > EPS) {
      add({
        id: 'billed-vs-eob',
        severity: 'medium',
        title: 'Bill total does not match the amount billed on the EOB',
        detail: `The bill totals ${money(billTotal)}; the EOB shows ${money(eobBilled)} billed to the insurer, a ${money(Math.abs(diff))} difference. ${
          diff > 0
            ? 'Some charges may never have reached the insurer.'
            : 'The insurer may have been billed for more than this statement shows.'
        }`,
        ask: 'Ask the billing office which charges were sent to the insurer and which were not.',
        request: 'Please confirm which charges were submitted to my insurer and which were not.',
        tip: 'More than one EOB can apply to a single bill. If you have others, add their amounts together before comparing.',
      });
    } else {
      passed.push('Bill total matches the amount billed on the EOB');
    }
  }

  // 10. Charges whose codes the EOB never mentions.
  const eobCodes = new Set((eob.lines || []).map((l) => norm(l.code)).filter(Boolean));
  if (hasLines && eobCodes.size > 0) {
    const missing = priced.filter((l) => l.code && !eobCodes.has(l.code));
    if (missing.length > 0) {
      add({
        id: 'not-on-eob',
        severity: 'medium',
        title: 'Charges that do not appear on the EOB',
        detail: `${lineRefs(missing)} (${joinList(missing.map((l) => l.code))}, ${money(sumCharges(missing))} in total) ${missing.length > 1 ? 'are' : 'is'} not among the codes listed on the EOB.`,
        ask: 'Ask whether these were submitted to the insurer. Charges the insurer never saw may not be yours to pay yet.',
        request: 'Please confirm whether these charges were submitted to my insurer.',
        impact: sumCharges(missing),
        lineIds: missing.map((l) => l.id),
      });
    } else {
      passed.push('Every coded charge on the bill appears on the EOB');
    }
  }

  const rank = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity] || (b.impact || 0) - (a.impact || 0));

  const flagged = {};
  for (const f of findings) {
    for (const id of f.lineIds) {
      if (!flagged[id] || rank[f.severity] < rank[flagged[id]]) flagged[id] = f.severity;
    }
  }

  const counts = { high: 0, medium: 0, low: 0 };
  for (const f of findings) counts[f.severity] += 1;

  const hasData = hasLines || [statedTotal, amountDue, eobOwe, eobBilled].some((v) => v !== null);

  return {
    findings,
    passed,
    flagged,
    summary: { lineSum, statedTotal, amountDue, eobOwe, paymentsMade, expected, gap, counts, hasData },
  };
}
