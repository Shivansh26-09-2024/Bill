import { useCallback, useMemo, useState } from 'react';
import useLocalStorage from './lib/useLocalStorage';
import { STORAGE_KEY, hydrate, sampleState } from './lib/state';
import { runAudit } from './lib/audit';
import { money } from './lib/format';
import BillForm from './components/BillForm';
import InsuranceForm from './components/InsuranceForm';
import Findings from './components/Findings';
import LetterPanel from './components/LetterPanel';
import CallLog from './components/CallLog';
import "./App.css";

const TABS = [
  { id: 'bill', label: 'Bill' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'findings', label: 'Findings' },
  { id: 'letter', label: 'Letter' },
  { id: 'calls', label: 'Calls' },
];

function gapNote(summary) {
  if (summary.gap === null) return 'Enter the amount due and the “You owe” figure from your insurer to compare them.';
  if (summary.gap > 0.009) return 'The bill asks for more than your insurance statement supports.';
  if (summary.gap < -0.009) return 'The bill asks for less than your insurance statement shows.';
  return 'The bill and your insurance statement agree.';
}

function SummaryBar({ summary }) {
  const over = summary.gap !== null && summary.gap > 0.009;
  return (
    <section aria-label="Bill summary">
      <div className="summary">
        <div>
          <span className="summary-label">Bill asks for</span>
          <strong>{money(summary.amountDue)}</strong>
        </div>
        <div>
          <span className="summary-label">Insurer says you owe{summary.paymentsMade > 0 ? ' (after your payments)' : ''}</span>
          <strong>{money(summary.expected)}</strong>
        </div>
        <div className={over ? 'gap-over' : ''}>
          <span className="summary-label">Difference</span>
          <strong>{money(summary.gap)}</strong>
        </div>
      </div>
      <p className="summary-note">{gapNote(summary)}</p>
    </section>
  );
}

export default function App() {
  const [stored, setStored] = useLocalStorage(STORAGE_KEY, null);
  const [tab, setTab] = useState('bill');
  const [letterOverride, setLetterOverride] = useState(null);

  const state = useMemo(() => hydrate(stored), [stored]);
  const patch = useCallback((changes) => setStored((prev) => ({ ...hydrate(prev), ...changes })), [setStored]);

  const audit = useMemo(() => runAudit(state.bill, state.eob), [state.bill, state.eob]);

  const isIncluded = useCallback(
    (f) => (state.included[f.id] !== undefined ? state.included[f.id] : f.severity !== 'low'),
    [state.included]
  );
  const selected = useMemo(() => audit.findings.filter(isIncluded), [audit.findings, isIncluded]);

  const toggleFinding = (f) => patch({ included: { ...state.included, [f.id]: !isIncluded(f) } });

  const loadSample = () => {
    const hasEntries =
      state.bill.provider || state.eob.insurer || state.bill.lines.some((l) => l.charge || l.code || l.description);
    if (hasEntries && !window.confirm('Replace what you have entered with a made-up sample bill?')) return;
    setStored(sampleState());
    setLetterOverride(null);
    setTab('findings');
  };

  const clearAll = () => {
    if (!window.confirm('Delete everything BillCheck has stored in this browser? This cannot be undone.')) return;
    setStored(null);
    setLetterOverride(null);
    setTab('bill');
  };

  return (
    <div className="app">
      <header className="masthead">
        <h1>BillCheck</h1>
        <p>
          Compare a medical bill with your insurance statement, see what does not add up, and send the billing office a
          clear, polite dispute.
        </p>
        <div className="masthead-actions">
          <button type="button" className="btn btn-quiet" onClick={loadSample}>
            Try a sample bill
          </button>
        </div>
      </header>

      <SummaryBar summary={audit.summary} />

      <div className="tabs" role="tablist" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls="panel"
            className="tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'findings' && audit.findings.length > 0 ? (
              <span className="tab-count">{audit.findings.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      <main id="panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="panel">
        {tab === 'bill' && (
          <BillForm bill={state.bill} flagged={audit.flagged} onChange={(bill) => patch({ bill })} />
        )}
        {tab === 'insurance' && <InsuranceForm eob={state.eob} onChange={(eob) => patch({ eob })} />}
        {tab === 'findings' && (
          <Findings
            audit={audit}
            isIncluded={isIncluded}
            onToggle={toggleFinding}
            onGoto={setTab}
            onSample={loadSample}
          />
        )}
        {tab === 'letter' && (
          <LetterPanel
            patient={state.patient}
            onPatient={(patient) => patch({ patient })}
            bill={state.bill}
            eob={state.eob}
            selected={selected}
            override={letterOverride}
            onOverride={setLetterOverride}
          />
        )}
        {tab === 'calls' && <CallLog calls={state.calls} onChange={(calls) => patch({ calls })} />}
      </main>

      <footer className="footer">
        <p>
          Everything you enter stays in this browser. BillCheck has no server and never uploads what you type. On a shared
          computer, delete your data when you are done.
        </p>
        <button type="button" className="btn btn-quiet" onClick={clearAll}>
          Delete my data
        </button>
      </footer>
    </div>
  );
}
