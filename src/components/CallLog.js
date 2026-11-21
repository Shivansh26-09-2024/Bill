import { useState } from 'react';
import Field from './Field';
import { fmtDate, todayISO, uid } from '../lib/format';

const blank = () => ({ date: todayISO(), who: '', ref: '', notes: '' });

export default function CallLog({ calls, onChange }) {
  const [draft, setDraft] = useState(blank);

  const set = (key) => (e) => {
    const value = e.target.value;
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const add = (e) => {
    e.preventDefault();
    if (!draft.who.trim() && !draft.ref.trim() && !draft.notes.trim()) return;
    onChange([{ id: uid(), ...draft }, ...calls]);
    setDraft(blank());
  };

  const remove = (id) => onChange(calls.filter((c) => c.id !== id));

  return (
    <div>
      <h2>Call log</h2>
      <p className="panel-intro">
        Note who you spoke to, the reference number and what was promised. If a dispute drags on, this record is what
        you will lean on.
      </p>

      <form onSubmit={add} className="grid">
        <Field label="Date">
          <input type="date" value={draft.date} onChange={set('date')} />
        </Field>
        <Field label="Who you spoke to">
          <input value={draft.who} onChange={set('who')} autoComplete="off" />
        </Field>
        <Field label="Reference number">
          <input value={draft.ref} onChange={set('ref')} autoComplete="off" />
        </Field>
        <Field label="What was said or promised" className="span-2">
          <textarea value={draft.notes} onChange={set('notes')} rows={3} />
        </Field>
        <div className="span-2">
          <button type="submit" className="btn">
            Save this call
          </button>
        </div>
      </form>

      {calls.length === 0 ? (
        <p className="notice">No calls logged yet.</p>
      ) : (
        <ul className="calls">
          {calls.map((c) => (
            <li key={c.id} className="call">
              <div className="call-head">
                <strong>{fmtDate(c.date) || 'No date'}</strong>
                <button type="button" className="link-btn" onClick={() => remove(c.id)} aria-label="Delete this call entry">
                  Delete
                </button>
              </div>
              {c.who ? <p>Spoke to: {c.who}</p> : null}
              {c.ref ? <p>Reference: {c.ref}</p> : null}
              {c.notes ? <p className="call-notes">{c.notes}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
