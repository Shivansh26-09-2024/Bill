import { useCallback, useMemo, useRef, useState } from 'react';
import useLocalStorage from './lib/useLocalStorage';
import { STORAGE_KEY, hydrate, sampleState } from './lib/state';
import { runAudit } from './lib/audit';
import { money } from './lib/format';
import BillForm from './components/BillForm';
import InsuranceForm from './components/InsuranceForm';
import Findings from './components/Findings';
import LetterPanel from './components/LetterPanel';
import CallLog from './components/CallLog';
import "./App.css"

const TABS = [
  { id: 'bill', step: '1', label: 'Bill' },
  { id: 'insurance', step: '2', label: 'Insurance' },
  { id: 'findings', step: '3', label: 'Findings' },
  { id: 'letter', step: '4', label: 'Letter' },
  { id: 'calls', step: '', label: 'Calls' },
];

const NEXT = {
  bill: { to: 'insurance', label: 'Next: add the insurance statement' },
  insurance: { to: 'findings', label: 'Next: see what does not match' },
  findings: { to: 'letter', label: 'Next: write the letter' },
};

function gapNote(summary) {
  if (summary.gap === null) return 'Enter both papers to see whether the bill matches what your insurer says you owe.';
  if (summary.gap > 0.009) return 'The bill asks for more than your insurance statement supports.';
  if (summary.gap < -0.009) return 'The bill asks for less than your insurance statement shows.';
  return 'The bill and your insurance statement agree.';
}

function SummaryBar({ summary, onGoto }) {
  const over = summary.gap !== null && summary.gap > 0.009;
  return (
    <section aria-label="Bill summary">
      <div className="summary">
        <div>
          <span className="summary-label">Bill asks for</span>
          {summary.amountDue === null ? (
            <button type="button" className="fill-btn" onClick={() => onGoto('bill')}>
              Enter from your bill
            </button>
          ) : (
            <strong>{money(summary.amountDue)}</strong>
          )}
        </div>
        <div>
          <span className="summary-label">
            Insurer says you owe{summary.paymentsMade > 0 ? ' (after your payments)' : ''}
          </span>
          {summary.expected === null ? (
            <button type="button" className="fill-btn" onClick={() => onGoto('insurance')}>
              Enter from your insurance statement
            </button>
          ) : (
            <strong>{money(summary.expected)}</strong>
          )}
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
  const panelRef = useRef(null);

  // Switch tab and bring the panel into view, so "Next" never leaves you staring at the page header.
  const go = useCallback((id) => {
    setTab(id);
    if (panelRef.current) panelRef.current.scrollIntoView();
  }, []);

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
    go('findings');
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
        <p className="tagline">
          Compare a medical bill with your insurance statement, see what does not add up, and send the billing office a
          clear, polite dispute.
        </p>
        <p className="needs">
          <strong>You need two papers:</strong> the bill from your provider and the Explanation of Benefits (EOB) from
          your insurer. You do not need to understand the billing codes.
        </p>
        <div className="masthead-actions">
          <button type="button" className="btn" onClick={loadSample}>
            Try a sample bill
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => go('bill')}>
            Enter my own bill
          </button>
        </div>
        <p className="trust">Private: everything stays in this browser and nothing is uploaded.</p>
        <details className="how">
          <summary>What does BillCheck check?</summary>
          <ul>
            <li>Does the amount due match what your insurer says you owe?</li>
            <li>Is any charge listed twice, or do the lines fail to add up to the total?</li>
            <li>Are any charges missing from your insurance statement?</li>
            <li>Are any charges dated outside the visit?</li>
            <li>Are lab tests billed on top of a panel that already includes them?</li>
          </ul>
          <p>A flag is a question to ask the billing office, not proof of an error. This is not legal advice.</p>
        </details>
      </header>

      <SummaryBar summary={audit.summary} onGoto={go} />

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
            {t.step ? (
              <span className="tab-step" aria-hidden="true">
                {t.step}
              </span>
            ) : null}
            {t.label}
            {t.id === 'findings' && audit.findings.length > 0 ? (
              <span className="tab-count">{audit.findings.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      <main id="panel" ref={panelRef} role="tabpanel" aria-labelledby={`tab-${tab}`} className="panel">
        {tab === 'bill' && (
          <BillForm bill={state.bill} flagged={audit.flagged} onChange={(bill) => patch({ bill })} />
        )}
        {tab === 'insurance' && <InsuranceForm eob={state.eob} onChange={(eob) => patch({ eob })} />}
        {tab === 'findings' && (
          <Findings
            audit={audit}
            isIncluded={isIncluded}
            onToggle={toggleFinding}
            onGoto={go}
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
        {NEXT[tab] ? (
          <div className="next">
            <button type="button" className="btn" onClick={() => go(NEXT[tab].to)}>
              {NEXT[tab].label}
            </button>
          </div>
        ) : null}
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
