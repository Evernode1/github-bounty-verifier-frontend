# GitHub Bounty Verifier (GenLayer Intelligent Contract)

Trustless GitHub bounties paid in native **GEN**. A creator escrows a reward, a contributor submits a merged PR, and GenLayer validators read the PR from GitHub and use an LLM to decide whether the requirements were met. If yes, the bounty is flagged `PAYOUT_READY` and the winner claims the reward.

Contract: `github_bounty_verifier_strict.py`  
Tests: `tests/test_github_bounty_verifier.py`  
Design reasoning: `DECISIONS.md`

## Frontend

A React + Vite app lives in `frontend/` (see `frontend/README.md`).

## Flow

1. **Creator** calls `create_bounty(repo, title, requirements, deadline_days, allow_self_merge)` with GEN attached. The reward is escrowed.
2. **Contributor** opens a PR to that repo and puts their wallet in the PR description:
   `Wallet: 0xYourAddress`
3. After the PR is merged, the contributor calls `submit_pr(bounty_id, pr_url)` with a GEN deposit (>= `min_deposit`).
4. Anyone calls `verify_submission(bounty_id, contributor_address)`.
   - Code checks: repo, merged, merged after bounty creation, wallet in description, merger differs from author (unless allowed).
   - LLM check: requirements satisfied.
   - Approved: PR is locked forever, bounty becomes `PAYOUT_READY`.
5. Anyone calls `claim_payout(bounty_id)`. Reward plus the winner's deposit go to the verified winner.

## Functions

| Function | Who | Notes |
|---|---|---|
| `create_bounty` (payable) | anyone | min reward 0.1 GEN, deadline 1-90 days |
| `submit_pr` (payable) | contributor | one per wallet per bounty, max 20 per bounty |
| `verify_submission` | anyone | max 3 attempts, expires 7 days after submit |
| `claim_payout` | anyone | funds always go to the winner |
| `withdraw_deposit` | contributor | if unverified, expired, or bounty closed |
| `cancel_bounty` | creator | only after deadline + review window |
| `set_params`, `set_paused`, `transfer_ownership`, `withdraw_treasury` | owner | treasury = forfeited deposits only |
| `get_bounty`, `get_submission`, `get_bounties`, `get_pr_status`, `get_config`, `get_accounting` | view | |

## Statuses

- Bounty: `OPEN` -> `PAYOUT_READY` -> `PAID`, or `OPEN` -> `CANCELLED`
- Submission: `PENDING`, `REJECTED` (can retry), `APPROVED`, `FORFEITED`, `WITHDRAWN`

## Deploy and test

1. Open GenLayer Studio, paste `github_bounty_verifier_strict.py`, deploy with no constructor args.
2. Run the tests: `pip install genlayer-test pytest` then `gltest tests/ -v`.
3. For the live test, set `BOUNTY_TEST_REPO`, `BOUNTY_TEST_PR_URL`, `BOUNTY_TEST_REQUIREMENTS`.

## Lint and deploy

```
pip install genvm-linter
genvm-lint check github_bounty_verifier_strict.py     # lint + SDK validation
genvm-lint schema github_bounty_verifier_strict.py    # ABI schema
```

Lint-related fixes in this version (from the GenVM linter docs and working GenLayer escrow contracts):
- Helpers are normal instance methods (no `@staticmethod` without `self`).
- Header is the official pinned runner: `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`.
- Every public method has parameter and return annotations (`-> None` where nothing is returned); no default argument values.
- No `datetime` import; time comes from `gl.message.datetime` through a small integer-only parser.
- Non-deterministic calls (`web.render`, `exec_prompt`) are only inside the `strict_eq` block, which returns a processed canonical verdict (GL-S03 safe).
- GEN is sent with `emit_transfer` through an `@gl.evm.contract_interface` proxy (works for wallets), after state is updated.

Still verify on your network:
- If the SDK validation step reports `E101 ... 404`, that is a linter download issue (genvm-linter issue #27), not a contract error; static lint still runs.
- `gl.message.datetime` and `emit_transfer` behaviour on your Studio/testnet (some networks have had issues executing emitted messages).
- Units: 18 decimals assumed (1 GEN = 10^18).

## Limitations

- Public repos only. Unauthenticated GitHub API calls can hit rate limits.
- LLM judgement is not perfect; the creator's requirements text should be specific and testable.
- A malicious repo owner can refuse to merge a good PR (see `DECISIONS.md`).
- Not audited. Do not put significant funds in it before a security review.
