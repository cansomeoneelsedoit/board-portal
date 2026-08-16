/** Three orange dots pulsing in turn — the AI is running. */
export default function WorkingDots({ label = null }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="bp-dots" aria-hidden="true"><i /><i /><i /></span>
      {label && <span>{label}</span>}
    </span>
  )
}
