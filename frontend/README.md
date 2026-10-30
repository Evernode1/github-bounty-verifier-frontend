# Bounty Board (frontend)

React + Vite + `genlayer-js`. Covers every function of `contract/github_bounty_verifier_strict.py`.

## Run

```
cd frontend
cp .env.example .env      # set VITE_CONTRACT_ADDRESS to your deployed contract
npm install
npm run dev
```

Open the printed URL, connect MetaMask (the app adds/switches to the GenLayer network), and fund the account with GEN from the Studio faucet/accounts page.

## What each screen does

| Screen | Contract calls |
|---|---|
| Header stats | `get_accounting`, `get_config` (paused banner, owner detection) |
| Bounties (filter chips, cards, progress rail) | `get_bounties`, `get_bounty` data |
| Bounty detail: submit | `submit_pr` (payable deposit), shows the required `Wallet: 0x...` line |
| Bounty detail: your submission | `get_submission`, `withdraw_deposit` |
| Bounty detail: verify | `verify_submission`, status lookup via `get_submission` |
| Bounty detail: payout | `claim_payout` (button appears at PAYOUT_READY) |
| Bounty detail: cancel | `cancel_bounty` (disabled until the deadline and review window pass) |
| Create | `create_bounty` (payable reward, deadline days, self-merge toggle) |
| PR tools | wallet line generator, `get_pr_status` (is the PR already used) |
| Admin (owner only) | `set_params`, `set_paused`, `withdraw_treasury`, `transfer_ownership` |

## Structure

```
frontend/src/
  App.jsx              shell: wallet, data loading, tabs, hash routing, transaction runner, activity log
  genlayer.js          client, wei helpers, read/write wrappers, error text
  format.js            labels, date and address helpers
  main.jsx             entry point with an error boundary
  components/          Rail, Detail, Create, Tools, Admin
```

## Features beyond the basics

- Shareable links: opening a bounty sets `#bounty-<id>`, and the page restores it on load (also for bounties outside the current filter).
- Loading, empty and error states, and a recent-activity list with transaction hashes.
- A copy button for the wallet line contributors must put in their PR description.
- Error boundary so a rendering problem shows a reload screen instead of a blank page.
- English-only interface, keyboard focus styles, light and dark themes, reduced-motion friendly.

## Safety in the UI

- Money is `BigInt` wei only. GEN text is parsed with a strict regex, never floats.
- PR URLs are validated with the same regex as the contract before any transaction.
- Buttons are disabled while a transaction is pending, and every action shows a plain success or error message.
- Contract-side rules (locks, attempts, deposits) are enforced on-chain; the UI only mirrors them.

## Notes

- The code was written against the `genlayer-js` API (`createClient`, `readContract`, `writeContract`, `waitForTransactionReceipt`, `client.connect`). It was not built or run in this environment, so run `npm install && npm run build` first. If a call name differs in your installed version, `src/genlayer.js` is the only file to change.
- Read results can come back as `Map`/`bigint`; `plain()` in `src/genlayer.js` normalises them.
