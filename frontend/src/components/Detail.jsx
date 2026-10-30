import { useEffect, useState } from "react";
import { PR_RE, ZERO, fromWei, read, short, toWei, write } from "../genlayer.js";
import { same, when } from "../format.js";

export default function Detail({ b, me, cfg, run, busy }) {
  const [sub, setSub] = useState(null);
  const [pr, setPr] = useState("");
  const [dep, setDep] = useState("");
  const [who, setWho] = useState("");
  const [lock, setLock] = useState(null);
  const open = b.status === "OPEN";
  const mine = same(me, b.creator);
  const deadlinePassed = Date.now() / 1000 > Number(b.deadline);
  const unlock = Math.max(Number(b.deadline), Number(b.last_submit_at) ? Number(b.last_submit_at) + (cfg?.review_ttl_seconds || 0) : 0);

  useEffect(() => {
    setSub(null); setLock(null);
    if (me) read("get_submission", [Number(b.id), me]).then(setSub).catch(() => setSub(null));
  }, [b.id, b.status, me]);
  useEffect(() => { setDep(cfg ? fromWei(cfg.min_deposit) : ""); }, [cfg]);

  const id = Number(b.id);
  const prOk = PR_RE.test(pr.trim());

  return (
    <section className="detail">
      <button className="ghost close" onClick={() => { window.location.hash = ""; }}>Close</button>
      <h2>{b.title}</h2>
      <p className="meta">{b.repo} · created by {short(b.creator)} · deadline {when(b.deadline)} · {b.submissions_count} submissions</p>
      <p className="req">{b.requirements}</p>
      {b.winner !== ZERO && <p className="ok">Winner {short(b.winner)} with <a href={b.winning_pr} target="_blank" rel="noreferrer">{b.winning_pr}</a></p>}

      {b.status === "PAYOUT_READY" && (
        <button disabled={!!busy} onClick={() => run("Claim payout", (c) => write(c, "claim_payout", [id]))}>Send reward to winner</button>
      )}

      {open && !mine && (
        <form onSubmit={(e) => { e.preventDefault(); run("Submit PR", (c) => write(c, "submit_pr", [id, pr.trim()], toWei(dep))); }}>
          <h3>Submit your merged PR</h3>
          <p className="hint">Your PR description must contain <code>Wallet: {me || "0xYourAddress"}</code>. Without it verification fails.</p>
          <label>Pull request URL<input value={pr} onChange={(e) => setPr(e.target.value)} placeholder="https://github.com/owner/repo/pull/12" /></label>
          {pr && !prOk && <p className="err">Use https://github.com/owner/repo/pull/number with nothing after the number.</p>}
          <label>Deposit in GEN (minimum {cfg ? fromWei(cfg.min_deposit) : "..."})<input value={dep} onChange={(e) => setDep(e.target.value)} inputMode="decimal" /></label>
          <button disabled={!prOk || !!busy || !!sub}>Submit with deposit</button>
          {sub && <p className="hint">You already submitted to this bounty.</p>}
        </form>
      )}

      {sub && (
        <div className="subbox">
          <h3>Your submission</h3>
          <p><span className={"tag " + sub.status}>{sub.status}</span> {sub.reason}</p>
          <p className="meta">{sub.pr_url} · attempts {sub.attempts}/{cfg?.max_attempts} · deposit {fromWei(sub.deposit)} GEN</p>
          {["PENDING", "REJECTED"].includes(sub.status) && Number(sub.deposit) > 0 && (
            <button className="ghost" disabled={!!busy} onClick={() => run("Withdraw deposit", (c) => write(c, "withdraw_deposit", [id]))}>Withdraw deposit</button>
          )}
        </div>
      )}

      {open && (
        <div className="subbox">
          <h3>Verify a submission</h3>
          <p className="hint">Anyone can run this. Validators read the PR on GitHub and check it against the requirements.</p>
          <label>Contributor wallet<input value={who} onChange={(e) => setWho(e.target.value)} placeholder={me || "0x..."} /></label>
          <div className="row">
            <button disabled={!!busy || !(who || me)} onClick={() => run("Verify", (c) => write(c, "verify_submission", [id, (who || me).trim()]))}>Verify now</button>
            <button className="ghost" onClick={async () => { try { setLock(await read("get_submission", [id, (who || me).trim()])); } catch (e) { setLock({ reason: e.message }); } }}>Look up status</button>
          </div>
          {lock && <p className="hint">{lock.status ? `${lock.status}: ${lock.reason}` : lock.reason}</p>}
        </div>
      )}

      {open && mine && (
        <div className="subbox">
          <h3>Cancel bounty</h3>
          <p className="hint">{deadlinePassed && Date.now() / 1000 >= unlock ? "The lock has ended. You can take your reward back." : `Locked until ${when(unlock)} so contributors are protected.`}</p>
          <button className="danger" disabled={!!busy || Date.now() / 1000 < unlock} onClick={() => run("Cancel bounty", (c) => write(c, "cancel_bounty", [id]))}>Cancel and refund</button>
        </div>
      )}
    </section>
  );
}
