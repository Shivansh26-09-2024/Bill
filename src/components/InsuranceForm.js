import Field from './Field';
import { emptyEobLine } from '../lib/state';

const NETWORK = [
  { value: 'in', label: 'In network' },
  { value: 'out', label: 'Out of network' },
  { value: 'unknown', label: 'Not sure' },
];

export default function InsuranceForm({ eob, onChange }) {
  const set = (key) => (e) => {
    const value = e.target.value;
    onChange({ ...eob, [key]: value });
  };
  const setLine = (id, key) => (e) => {
    const value = e.target.value;
    onChange({ ...eob, lines: eob.lines.map((l) => (l.id === id ? { ...l, [key]: value } : l)) });
  };
  const addLine = () => onChange({ ...eob, lines: [...eob.lines, emptyEobLine()] });
  const removeLine = (id) => onChange({ ...eob, lines: eob.lines.filter((l) => l.id !== id) });

  return (
    <div>
      <h2>Insurance statement</h2>
      <p className="panel-intro">
        This is the Explanation of Benefits (EOB) your insurer sent. It is not a bill, and it shows what they say you owe.
      </p>
      <details className="help">
        <summary>Which number is which?</summary>
        <p>
          Labels vary by insurer. <strong>Amount billed</strong> is what the provider charged the insurer, often shown as
          “Billed” or “Charges”. <strong>You owe</strong> may be called “Patient responsibility”, “Your share” or “You may
          owe”. The EOB is usually marked “This is not a bill”.
        </p>
      </details>

      <div className="grid">
        <Field label="Insurance company">
          <input value={eob.insurer} onChange={set('insurer')} autoComplete="off" />
        </Field>
        <Field label="Claim number">
          <input value={eob.claimNumber} onChange={set('claimNumber')} autoComplete="off" />
        </Field>
        <Field label="Amount billed" hint="What the provider charged the insurer.">
          <input inputMode="decimal" placeholder="0.00" value={eob.amountBilled} onChange={set('amountBilled')} />
        </Field>
        <Field label="Allowed amount" hint="Optional.">
          <input inputMode="decimal" placeholder="0.00" value={eob.allowedAmount} onChange={set('allowedAmount')} />
        </Field>
        <Field label="Plan paid" hint="Optional.">
          <input inputMode="decimal" placeholder="0.00" value={eob.planPaid} onChange={set('planPaid')} />
        </Field>
        <Field label="You owe" hint="Often called patient responsibility.">
          <input inputMode="decimal" placeholder="0.00" value={eob.youOwe} onChange={set('youOwe')} />
        </Field>
      </div>

      <fieldset className="choice">
        <legend>Network status of the provider</legend>
        <div className="choice-row">
          {NETWORK.map((n) => (
            <label key={n.value} className="choice-item">
              <input
                type="radio"
                name="network"
                value={n.value}
                checked={eob.networkStatus === n.value}
                onChange={set('networkStatus')}
              />
              {n.label}
            </label>
          ))}
        </div>
      </fieldset>

      <section aria-labelledby="eob-lines-heading">
        <h3 id="eob-lines-heading" className="subhead">Services on the EOB (optional)</h3>
        <p className="panel-intro">
          List the billing codes the EOB shows. BillCheck uses them to spot charges your insurer never saw.
        </p>

        {eob.lines.length > 0 ? (
          <ul className="lines">
            {eob.lines.map((l, i) => (
              <li key={l.id} className="line">
                <div className="line-head">
                  <span className="line-no">EOB line {i + 1}</span>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => removeLine(l.id)}
                    aria-label={`Remove EOB line ${i + 1}`}
                  >
                    Remove
                  </button>
                </div>
                <div className="grid">
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
                  <Field label="Amount billed">
                    <input inputMode="decimal" placeholder="0.00" value={l.billed} onChange={setLine(l.id, 'billed')} />
                  </Field>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="line-actions">
          <button type="button" className="btn btn-quiet" onClick={addLine}>
            Add an EOB line
          </button>
        </div>
      </section>
    </div>
  );
}
