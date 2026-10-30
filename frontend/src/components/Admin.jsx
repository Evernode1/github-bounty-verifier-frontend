import { useState } from "react";
import { fromWei, toWei, write } from "../genlayer.js";
import { isAddr } from "../format.js";

export default function Admin({ cfg, acct, run, busy }) {
  const [p, setP] = useState({ r: fromWei(cfg.min_reward), d: fromWei(cfg.min_deposit), o: "", t: "" });
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });
  return (
    <section>
      <h2>Admin</h2>
      <p className="hint">You can pause the contract and tune minimums. You can only withdraw the treasury ({fromWei(acct.treasury)} GEN), never bounty rewards or deposits.</p>
      <div className="row">
        <label>Min reward (GEN)<input value={p.r} onChange={set("r")} /></label>
        <label>Min deposit (GEN)<input value={p.d} onChange={set("d")} /></label>
      </div>
      <button disabled={!!busy} onClick={() => run("Update limits", (c) => write(c, "set_params", [toWei(p.r), toWei(p.d)]))}>Save limits</button>
      <button className="ghost" disabled={!!busy} onClick={() => run(cfg.paused ? "Unpause" : "Pause", (c) => write(c, "set_paused", [!cfg.paused]))}>{cfg.paused ? "Unpause contract" : "Pause contract"}</button>
      <label>Withdraw treasury (GEN)<input value={p.t} onChange={set("t")} /></label>
      <button disabled={!!busy || !p.t} onClick={() => run("Withdraw treasury", (c) => write(c, "withdraw_treasury", [toWei(p.t)]))}>Withdraw to owner</button>
      <label>Transfer ownership to<input value={p.o} onChange={set("o")} placeholder="0x..." /></label>
      <button className="danger" disabled={!!busy || !isAddr(p.o)} onClick={() => window.confirm("Transfer ownership? This cannot be undone.") && run("Transfer ownership", (c) => write(c, "transfer_ownership", [p.o]))}>Transfer ownership</button>
    </section>
  );
}
