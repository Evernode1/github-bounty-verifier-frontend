import { useCallback, useEffect, useState } from "react";
import { ADDRESS, NETWORK, connectWallet, errText, fromWei, read, short } from "./genlayer.js";
import { LABEL, isAddr, same } from "./format.js";
import Rail from "./components/Rail.jsx";
import Detail from "./components/Detail.jsx";
import Create from "./components/Create.jsx";
import Tools from "./components/Tools.jsx";
import Admin from "./components/Admin.jsx";

const parseHash = () => (/^#bounty-(\d+)$/.exec(window.location.hash) || [])[1] || null;

export default function App() {
  const [wallet, setWallet] = useState(null);       // { account, client }
  const [cfg, setCfg] = useState(null);
  const [acct, setAcct] = useState(null);
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState("board");
  const [selId, setSelId] = useState(parseHash());
  const [one, setOne] = useState(null);
  const [loading, setLoading] = useState(true);
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);             // { ok, text }

  const refresh = useCallback(async () => {
    if (!ADDRESS) return;
    try {
      const [c, a, l] = await Promise.all([read("get_config"), read("get_accounting"), read("get_bounties", [filter, 0, 50])]);
      setCfg(c); setAcct(a); setList(l);
    } catch (e) { setMsg({ ok: false, text: "Could not read the contract: " + errText(e) }); }
    finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const f = () => setSelId(parseHash());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  const sel = list.find((b) => b.id === selId) || (one && one.id === selId ? one : null);
  useEffect(() => {
    if (selId && !list.find((b) => b.id === selId)) read("get_bounty", [Number(selId)]).then(setOne).catch(() => setOne(null));
  }, [selId, list]);

  const me = wallet?.account;
  const isOwner = same(me, cfg?.owner);

  async function run(label, fn) {
    if (!wallet) return setMsg({ ok: false, text: "Connect your wallet first." });
    setBusy(label); setMsg(null);
    const note = (ok, hash) => setLog((l) => [{ label, ok, hash, at: Date.now() }, ...l].slice(0, 8));
    try { const hash = await fn(wallet.client); note(true, hash); setMsg({ ok: true, text: `${label} confirmed.` }); await refresh(); }
    catch (e) { note(false); setMsg({ ok: false, text: `${label} failed: ${errText(e)}` }); }
    finally { setBusy(""); }
  }
  const connect = async () => { try { setWallet(await connectWallet()); } catch (e) { setMsg({ ok: false, text: e.message }); } };

  if (!ADDRESS) return <main className="wrap"><h1>Bounty Board</h1><p className="err">Set VITE_CONTRACT_ADDRESS in frontend/.env and restart.</p></main>;

  return (
    <main className="wrap">
      <header className="top">
        <div><h1>Bounty Board</h1><p className="sub">GitHub bounties paid in GEN, checked by validators.</p></div>
        {wallet ? <span className="pill">{short(me)}{isOwner && " (owner)"}</span> : <button onClick={connect}>Connect wallet</button>}
      </header>

      {cfg?.paused && <p className="banner">The contract is paused. You can still claim payouts and withdraw deposits.</p>}
      {acct && (
        <dl className="stats">
          <div><dt>In bounties</dt><dd>{fromWei(acct.total_escrowed)} GEN</dd></div>
          <div><dt>Held deposits</dt><dd>{fromWei(acct.total_deposits)} GEN</dd></div>
          <div><dt>Treasury</dt><dd>{fromWei(acct.treasury)} GEN</dd></div>
          <div><dt>Contract balance</dt><dd>{fromWei(acct.contract_balance)} GEN</dd></div>
        </dl>
      )}

      <nav className="tabs" role="tablist">
        {["board", "create", "tools", ...(isOwner ? ["admin"] : [])].map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{{ board: "Bounties", create: "Create", tools: "PR tools", admin: "Admin" }[t]}</button>
        ))}
      </nav>
      {msg && <p className={msg.ok ? "ok" : "err"} role="status">{msg.text}</p>}

      {tab === "board" && (
        <section>
          <div className="chips">
            {["", "OPEN", "PAYOUT_READY", "PAID", "CANCELLED"].map((f) => (
              <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{f ? LABEL[f] : "All"}</button>
            ))}
          </div>
          {loading && <p className="empty" aria-busy="true">Loading bounties…</p>}
          {!loading && list.length === 0 && <p className="empty">No bounties here yet. Create the first one from the Create tab.</p>}
          <div className="grid">
            {list.map((b) => (
              <article key={b.id} className={"card" + (sel?.id === b.id ? " sel" : "")}>
                <button className="cardbtn" onClick={() => { window.location.hash = "bounty-" + b.id; }}>
                  <strong>{b.title}</strong>
                  <span className="repo">{b.repo}</span>
                  <span className="reward">{fromWei(b.reward)} GEN</span>
                  <Rail status={b.status} />
                </button>
              </article>
            ))}
          </div>
          {sel && <Detail key={sel.id} b={sel} me={me} cfg={cfg} run={run} busy={busy} />}
        </section>
      )}
      {tab === "create" && <Create cfg={cfg} run={run} busy={busy} />}
      {tab === "tools" && <Tools />}
      {tab === "admin" && isOwner && <Admin cfg={cfg} acct={acct} run={run} busy={busy} />}
      {log.length > 0 && (
        <aside className="log" aria-label="Recent activity">
          <h3>Recent activity</h3>
          <ul>{log.map((x) => <li key={x.at} className={x.ok ? "ok" : "err"}>{x.label}: {x.ok ? "confirmed" : "failed"}{x.hash ? ` · tx ${short(x.hash)}` : ""} · {new Date(x.at).toLocaleTimeString()}</li>)}</ul>
        </aside>
      )}
      <footer className="foot">Contract {short(ADDRESS)} on {NETWORK}. Amounts are in GEN. This software is unaudited: use small amounts.</footer>
    </main>
  );
}
