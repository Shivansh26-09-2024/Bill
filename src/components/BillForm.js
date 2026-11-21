import Field from './Field';
import { emptyLine } from '../lib/state';
import { SEVERITY_LABEL } from '../lib/audit';
import { money, round2, toNum } from '../lib/format';

export default function BillForm({ bill, flagged, onChange }) {
  const set = (key) => (e) => {
    const value = e.target.value;
    onChange({ ...bill, [key]: value });
  };
  const setLine = (id, key) => (e) => {
    const value = e.target.value;
    onChange({ ...bill, lines: bill.lines.map((l) => (l.id === id ? { ...l, [key]: value } : l)) });
  };
  const addLine = () => onChange({ ...bill, lines: [...bill.lines, emptyLine()] });
  const removeLine = (id) => onChange({ ...bill, lines: bill.lines.filter((l) => l.id !== id) });

  const lineTotal = round2(bill.lines.reduce((sum, l) => sum + (toNum(l.charge) ?? 0), 0));

  return (
    <div>
      <h2>The bill</h2>
      <p className="panel-intro">Copy the numbers from the statement you received from the provider.</p>

      <div className="grid">
        <Field label="Provider or hospital">
          <input value={bill.provider} onChange={set('provider')} autoComplete="off" />
        </Field>
        <Field label="Account number">
          <input value={bill.accountNumber} onChange={set('accountNumber')} autoComplete="off" />
        </Field>
        <Field label="Service start date">
          <input type="date" value={bill.serviceStart} onChange={set('serviceStart')} />
        </Field>
        <Field label="Service end date" hint="Leave blank for a single-day visit.">
          <input type="date" value={bill.serviceEnd} onChange={set('serviceEnd')} />
        </Field>
        <Field label="Statement date">
          <input type="date" value={bill.statementDate} onChange={set('statementDate')} />
        </Field>
        <Field label="Total charges" hint="All charges, before insurance.">
          <input inputMode="decimal" placeholder="0.00" value={bill.statedTotalCharges} onChange={set('statedTotalCharges')} />
        </Field>
        <Field label="Amount due from you" hint="The balance the bill asks you to pay.">
          <input inputMode="decimal" placeholder="0.00" value={bill.amountDue} onChange={set('amountDue')} />
        </Field>
        <Field label="Payments you already made" hint="Copays or payments toward this bill.">
          <input inputMode="decimal" placeholder="0.00" value={bill.paymentsMade} onChange={set('paymentsMade')} />
        </Field>
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={bill.isSummaryOnly}
          onChange={(e) => onChange({ ...bill, isSummaryOnly: e.target.checked })}
        />
        This bill only shows a total, with no list of services
      </label>

      {bill.isSummaryOnly ? (
        <p className="notice">
          Without a line-by-line list there is little to check. The Findings tab will suggest requesting an itemized statement.
        </p>
      ) : (
        <section aria-labelledby="lines-heading">
          <h3 id="lines-heading" className="subhead">Line items</h3>
          <p className="panel-intro">
            Enter each charge as printed (the line total, not the price per unit). A flagged line is marked in colour and
            explained on the Findings tab.
          </p>

          {bill.lines.length === 0 ? <p className="notice">No lines yet. Add the first one below.</p> : null}

          <ol className="lines">
            {bill.lines.map((l, i) => {
              const sev = flagged[l.id];
              return (
                <li key={l.id} className={`line${sev ? ` line-${sev}` : ''}`}>
                  <div className="line-head">
                    <span className="line-no">Line {i + 1}</span>
                    {sev ? <span className={`tag tag-${sev}`}>{SEVERITY_LABEL[sev]}</span> : null}
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => removeLine(l.id)}
                      aria-label={`Remove line ${i + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="line-grid">
                    <Field label="Date">
                      <input type="date" value={l.date} onChange={setLine(l.id, 'date')} />
                    </Field>
                    <Field label="Code">
                      <input
                        value={l.code}
                        onChange={setLine(l.id, 'code')}
                        placeholder="e.g. 85025"
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck="false"
                      />
                    </Field>
                    <Field label="Description" className="span-2">
                      <input value={l.description} onChange={setLine(l.id, 'description')} autoComplete="off" />
                    </Field>
                    <Field label="Qty">
                      <input inputMode="numeric" value={l.qty} onChange={setLine(l.id, 'qty')} />
                    </Field>
                    <Field label="Charge">
                      <input inputMode="decimal" placeholder="0.00" value={l.charge} onChange={setLine(l.id, 'charge')} />
                    </Field>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="line-actions">
            <button type="button" className="btn btn-quiet" onClick={addLine}>
              Add a line
            </button>
            <span className="line-total">Lines add up to {money(lineTotal)}</span>
          </div>
        </section>
      )}
    </div>
  );
}
