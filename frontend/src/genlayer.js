import { createClient } from "genlayer-js";
import { studionet, localnet, testnetAsimov } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export const ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";
const NET = import.meta.env.VITE_GENLAYER_NETWORK || "studionet";
export const NETWORK = NET;
const chain = { studionet, localnet, testnetAsimov }[NET] || studionet;
const GEN = 10n ** 18n;

// Money is always BigInt wei, never floats.
export function toWei(text) {
  const t = String(text).trim();
  if (!/^\d+(\.\d{1,18})?$/.test(t)) throw new Error("Enter a GEN amount with up to 18 decimals");
  const [a, b = ""] = t.split(".");
  return BigInt(a) * GEN + BigInt(b.padEnd(18, "0"));
}
export function fromWei(w) {
  const v = BigInt(w || 0);
  const f = (v % GEN).toString().padStart(18, "0").replace(/0+$/, "").slice(0, 6);
  return (v / GEN).toString() + (f ? "." + f : "");
}
// genlayer-js decodes dicts as Map and ints as bigint; normalise for React.
export const plain = (x) =>
  x instanceof Map ? Object.fromEntries([...x].map(([k, v]) => [k, plain(v)]))
  : Array.isArray(x) ? x.map(plain)
  : typeof x === "bigint" ? x.toString() : x;

const reader = createClient({ chain });
export const read = async (functionName, args = []) =>
  plain(await reader.readContract({ address: ADDRESS, functionName, args }));

export async function connectWallet() {
  if (!window.ethereum) throw new Error("No wallet found. Install MetaMask and reload.");
  const [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
  const client = createClient({ chain, account });
  try { await client.connect(NET); } catch { /* network may already be added */ }
  return { account, client };
}

export async function write(client, functionName, args = [], value = 0n) {
  const hash = await client.writeContract({ address: ADDRESS, functionName, args, value });
  await client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, retries: 80, interval: 3000 });
  return hash;
}

export const PR_RE = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)$/;
export const short = (a) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "");
export const ZERO = "0x" + "0".repeat(40);

export const errText = (e) => String(e?.shortMessage || e?.message || e).slice(0, 240);
