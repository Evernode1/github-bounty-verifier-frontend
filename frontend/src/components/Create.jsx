import { useState } from "react";
import { fromWei, toWei, write } from "../genlayer.js";

export default function Create({ cfg, run, busy }) {
  const [f, setF] = useState({ repo: "", title: "", req: "", days: "14", self: false, reward: "1" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const bad = !/^[\w.-]+\/[\w.-]+$/.test(f.repo) || !f.title.trim() || f.req.trim().length < 20 || !(+f.days >= 1 && +f.days <= 90);
  return (
    <form onSubmit={(e) => { e.preventDefault(); run("Create bounty", (c) => write(c, "create_bounty", [f.repo.trim(), f.title.trim(), f.req.trim(), Number(f.days), f.self], toWei(f.reward))); }}>
      <h2>Create a bounty</h2>
      <label>Repository<input value={f.repo} onChange={set("repo")} placeholder="owner/repo" /></label>
      <label>Title<input value={f.title} onChange={set("title")} maxLength={200} /></label>
      <label>Requirements (20+ characters, be specific and testable)<textarea rows={5} value={f.req} onChange={set("req")} maxLength={3000} /></label>
      <label>Days until deadline (1 to 90)<input value={f.days} onChange={set("days")} inputMode="numeric" /></label>
      <label>Reward in GEN (minimum {cfg ? fromWei(cfg.min_reward) : "..."})<input value={f.reward} onChange={set("reward")} inputMode="decimal" /></label>
      <label className="check"><input type="checkbox" checked={f.self} onChange={set("self")} /> Allow the PR author to merge their own PR</label>
      <p className="hint">The reward is locked in the contract until a PR wins or the deadline and review window pass.</p>
      <button disabled={bad || !!busy}>Lock reward and create</button>
    </form>
  );
}
