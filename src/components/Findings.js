import { SEVERITY_LABEL } from '../lib/audit';
import { money } from '../lib/format';

export default function Findings({ audit, isIncluded, onToggle, onGoto, onSample }) {
  const { findings, passed, summary } = audit;

  if (!summary.hasData) {
    return (
      <div>
        <h2>Findings</h2>
        <p className="notice">
          Nothing to check yet. Enter the bill and the insurance statement, or load a sample bill to see how the checks
          work.
        </p>
        <div className="actions">
          <button type="button" className="btn" onClick={() => onGoto('bill')}>
            Enter the bill
          </button>
          <button type="button" className="btn btn-quiet" onClick={onSample}>
            Try a sample bill
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>Findings</h2>
      <p className="panel-intro">
        {findings.length > 0
          ? `${findings.length} ${findings.length === 1 ? 'thing' : 'things'} worth raising with the billing office. Tick the ones to include in the dispute letter.`
          : 'No mismatches found in the numbers you entered.'}
      </p>

      {findings.length === 0 ? (
        <p className="notice">
          That does not prove the bill is right. If you have not seen an itemized statement with billing codes, ask for one,
          and add the insurance statement so the two can be compared.
        </p>
      ) : null}

      {findings.map((f) => (
        <article key={f.id} className={`finding finding-${f.severity}`}>
          <header>
            <span className={`tag tag-${f.severity}`}>{SEVERITY_LABEL[f.severity]}</span>
            {f.impact ? <span className="impact">Up to {money(f.impact)}</span> : null}
          </header>
          <h3>{f.title}</h3>
          <p>{f.detail}</p>
          {f.tip ? <p className="tip">{f.tip}</p> : null}
          <p className="ask">
            <strong>What to ask:</strong> {f.ask}
          </p>
          <label className="check">
            <input type="checkbox" checked={isIncluded(f)} onChange={() => onToggle(f)} />
            Include in the dispute letter
          </label>
        </article>
      ))}

      {passed.length > 0 ? (
        <details className="passed">
          <summary>What checked out ({passed.length})</summary>
          <ul>
            {passed.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="fineprint">
        BillCheck compares the numbers you type in. It cannot judge whether care was medically necessary or whether a
        billing code is correct, and it is not legal or financial advice. A flag is a reason to ask, not proof of an error.
        Pay any part of the bill you are not disputing, and keep records of every conversation.
      </p>
    </div>
  );
}
