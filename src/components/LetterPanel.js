import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Field from './Field';
import { buildCallScript, buildLetter } from '../lib/letter';
import { todayISO } from '../lib/format';

export default function LetterPanel({ patient, onPatient, bill, eob, selected, override, onOverride }) {
  const [status, setStatus] = useState('');
  const today = useMemo(() => todayISO(), []);

  const generated = useMemo(
    () => buildLetter({ patient, bill, eob, findings: selected, today }),
    [patient, bill, eob, selected, today]
  );
  const text = override === null ? generated : override;
  const steps = useMemo(() => buildCallScript({ bill, eob, findings: selected }), [bill, eob, selected]);
  const hasPlaceholders = /\[[^\]]+\]/.test(text);

  const setPatient = (key) => (e) => {
    const value = e.target.value;
    onPatient({ ...patient, [key]: value });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Letter copied.');
    } catch (err) {
      setStatus('Copying was blocked. Select the text and copy it by hand.');
    }
  };

  const download = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'billcheck-dispute-letter.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus('Letter downloaded.');
  };

  return (
    <div>
      <h2>Dispute letter</h2>
      <p className="panel-intro">
        Built from the findings you ticked. It is worded as questions and requests, not accusations, and it asks for a
        hold on collections while the bill is reviewed.
      </p>

      <div className="grid">
        <Field label="Your name">
          <input value={patient.name} onChange={setPatient('name')} autoComplete="name" />
        </Field>
        <Field label="Phone or email" hint="Where the billing office can reach you.">
          <input value={patient.contact} onChange={setPatient('contact')} autoComplete="off" />
        </Field>
        <Field label="Mailing address" className="span-2">
          <textarea value={patient.address} onChange={setPatient('address')} rows={2} autoComplete="street-address" />
        </Field>
      </div>

      {selected.length === 0 ? (
        <p className="notice">
          No findings are ticked, so the letter is a general request to review the bill. Tick findings on the Findings tab
          to add specifics.
        </p>
      ) : null}
      {hasPlaceholders ? (
        <p className="notice">Text in [square brackets] still needs your details before you send the letter.</p>
      ) : null}
      {override !== null ? (
        <p className="notice">
          You edited this letter, so it will not follow later changes.{' '}
          <button type="button" className="link-btn" onClick={() => onOverride(null)}>
            Regenerate from the findings
          </button>
        </p>
      ) : null}

      <label className="field letter-field">
        <span className="field-label">Letter text (you can edit it)</span>
        <textarea className="letter-box" value={text} onChange={(e) => onOverride(e.target.value)} />
      </label>

      <div className="actions">
        <button type="button" className="btn" onClick={copy}>
          Copy letter
        </button>
        <button type="button" className="btn btn-quiet" onClick={download}>
          Download .txt
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => window.print()}>
          Print
        </button>
      </div>
      <p className="status" role="status" aria-live="polite">
        {status}
      </p>

      <section aria-labelledby="script-heading">
        <h3 id="script-heading" className="subhead">If you would rather call first</h3>
        <ol className="script">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      {createPortal(
        <div className="letter-print" aria-hidden="true">
          {text}
        </div>,
        document.body
      )}
    </div>
  );
}
