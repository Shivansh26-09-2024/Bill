// Builds the dispute letter and the phone script from the findings the user chose to include.

import { money, fmtDate, toNum } from './format.js';

function servicePeriod(bill) {
  const start = bill.serviceStart || bill.serviceEnd;
  const end = bill.serviceEnd || bill.serviceStart;
  if (!start) return '[date of service]';
  return start === end ? fmtDate(start) : `${fmtDate(start)} to ${fmtDate(end)}`;
}

export function buildLetter({ patient = {}, bill = {}, eob = {}, findings = [], today = '' }) {
  const name = (patient.name || '').trim() || '[Your name]';
  const out = [];

  out.push(fmtDate(today) || '[Date]', '');
  out.push(name);
  if ((patient.address || '').trim()) out.push(patient.address.trim());
  if ((patient.contact || '').trim()) out.push(patient.contact.trim());
  out.push('');
  out.push(bill.provider || '[Provider name]');
  out.push('Attn: Billing Department', '');
  out.push('Re: Request for review of statement');
  out.push(`Account number: ${bill.accountNumber || '[account number]'}`);
  out.push(`Date(s) of service: ${servicePeriod(bill)}`);
  if (bill.statementDate) out.push(`Statement date: ${fmtDate(bill.statementDate)}`);
  if (bill.amountDue) out.push(`Amount currently billed to me: ${money(toNum(bill.amountDue))}`);
  if (eob.claimNumber) out.push(`Insurance claim number: ${eob.claimNumber}`);
  out.push('', 'To the Billing Department:', '');

  const insurer = eob.insurer || 'my insurer';
  if (findings.length > 0) {
    out.push(
      `I am writing to ask you to review the statement above. I compared it with the Explanation of Benefits from ${insurer} and found the following items I would like checked:`,
      ''
    );
    findings.forEach((f, i) => {
      out.push(`${i + 1}. ${f.title}. ${f.detail}`);
      out.push(`   ${f.request || f.ask}`, '');
    });
  } else {
    out.push(
      `I am writing to ask you to review the statement above and confirm that the charges are accurate and match what ${insurer} processed.`,
      ''
    );
  }

  out.push('Please also:');
  out.push('- Send a fully itemized statement showing the date, billing code (CPT/HCPCS) and charge for each service.');
  out.push('- Confirm in writing the amount I owe after insurance, with all contractual adjustments applied.');
  out.push('- Note on the account that it is under review, and do not send it to collections or report it to credit bureaus while the review is open.');
  out.push('');
  out.push('I am glad to pay any amount that is confirmed as correct. I would appreciate a written response within 30 days. A copy of my Explanation of Benefits is enclosed.');
  out.push('', 'Sincerely,', name);

  return out.join('\n');
}

export function buildCallScript({ bill = {}, eob = {}, findings = [] }) {
  const acct = bill.accountNumber ? `account ${bill.accountNumber}` : 'my account';
  const when = bill.serviceStart ? `, date of service ${fmtDate(bill.serviceStart)}` : '';
  const steps = [];

  steps.push(
    `Have the bill and the EOB${eob.claimNumber ? ` (claim ${eob.claimNumber})` : ''} in front of you, plus something to write with. Ask for the billing department.`
  );
  steps.push(
    `Say: “I’m calling about ${acct}${when}. I compared my bill with my insurer’s statement and have a few questions.”`
  );
  findings.slice(0, 3).forEach((f) => steps.push(`Bring up: ${f.title}. ${f.ask}`));
  steps.push(
    'Say: “Please send me an itemized bill with billing codes, and note on the account that it is under review so it isn’t sent to collections.”'
  );
  steps.push(
    'Before you hang up, write down the representative’s name, a reference number, and what happens next and by when. Add it to the Calls tab.'
  );
  return steps;
}
