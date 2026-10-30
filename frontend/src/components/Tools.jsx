import { useState } from "react";
import { PR_RE, read } from "../genlayer.js";
import { isAddr } from "../format.js";

export default function Tools() {
  const [w, setW] = useState("");
  const [u, setU] = useState("");
  const [res, setRes] = useState(null);
  const m = PR_RE.exec(u.trim());
  return (
    <section>
      <h2>PR tools</h2>
      <label>Your wallet<input value={w} onChange={(e) => setW(e.target.value)} placeholder="0x..." /></label>
      <p className={isAddr(w) ? "ok" : "hint"}>{isAddr(w) ? `Paste into your PR description: Wallet: ${w}` : "Enter a 0x address to get the line."}</p>
      {isAddr(w) && <button className="ghost" onClick={() => navigator.clipboard?.writeText(`Wallet: ${w}`)}>Copy line</button>}
      <label>PR URL<input value={u} onChange={(e) => { setU(e.target.value); setRes(null); }} /></label>
      <button disabled={!m} onClick={async () => setRes(await read("get_pr_status", [u.trim()]).catch((e) => ({ error: e.message })))}>Check if PR is already used</button>
      {u && !m && <p className="err">Not a valid PR URL.</p>}
      {res && <p className={res.used ? "err" : "ok"}>{res.error || (res.used ? `Already used by bounty #${res.bounty_id}. It cannot be used again.` : "Not used yet.")}</p>}
    </section>
  );
}
