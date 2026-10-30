import { LABEL, STAGES } from "../format.js";

export default function Rail({ status }) {
  if (status === "CANCELLED") return <div className="rail cancelled">Cancelled, reward refunded</div>;
  const at = STAGES.indexOf(status);
  return (
    <ol className="rail" aria-label="Bounty progress">
      {STAGES.map((s, i) => <li key={s} className={i < at ? "done" : i === at ? "now" : ""}>{LABEL[s]}</li>)}
    </ol>
  );
}
