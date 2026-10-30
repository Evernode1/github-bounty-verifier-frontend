export const STAGES = ["OPEN", "PAYOUT_READY", "PAID"];
export const LABEL = { OPEN: "Open", PAYOUT_READY: "Payout ready", PAID: "Paid", CANCELLED: "Cancelled" };
export const when = (s) => (Number(s) ? new Date(Number(s) * 1000).toLocaleString() : "-");
export const same = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
export const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || "");
