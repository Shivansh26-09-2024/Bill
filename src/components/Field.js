// A label wrapped around its input, so tapping the label focuses the field.
export default function Field({ label, hint, className = '', children }) {
  return (
    <label className={`field ${className}`.trim()}>
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}
