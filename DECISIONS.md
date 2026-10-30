# Design Decisions

Each entry: the problem, the decision, the trade-off.

## 1. Native GEN escrow via msg.value
**Decision:** Rewards and deposits are real GEN sent with the transaction and held by the contract.  
**Why:** No wrapped tokens or off-chain promises; funds are provably locked.  
**Trade-off:** Fixed to the native token. Accounting is tracked separately (`total_escrowed`, `total_deposits`, `treasury`) so each pool can be reasoned about on its own.

## 2. Wallet binding through the PR description
**Problem:** Claiming a username does not prove you wrote the PR. Anyone could submit someone else's merged PR and take the payout.  
**Decision:** The PR description must contain the submitter's wallet address. The verifier checks it in code.  
**Why:** Only the PR author or a maintainer can edit that text.  
**Trade-off:** Contributors must add one line to their PR. A maintainer could, in theory, edit it; that is accepted since maintainers already control merging.

## 3. Global one-time PR lock, applied on approval
**Decision:** An approved PR is stored in `used_prs` and can never be used again, by anyone, for any bounty.  
**Why not lock at submit time:** A squatter could submit a victim's PR first and block them. Locking only after a successful wallet-bound verification makes squatting impossible: a squatter's submission can never pass.  
**Trade-off:** Several people may submit the same PR URL before approval, but only the real author can win.

## 4. PR must be merged after the bounty was created
**Why:** Prevents claiming old, already-merged work.  
**Trade-off:** Work that was started before the bounty but merged after is allowed; work merged before is not.

## 5. Deterministic checks in code, LLM only for requirements
**Decision:** Merged, repo, timing, wallet, and self-merge are parsed from the GitHub JSON in code. The LLM only answers `requirements_met: true/false`.  
**Why:** Fewer non-deterministic steps means validators agree more often. The LLM prompt treats PR text as untrusted to reduce prompt injection.  
**Trade-off:** Consensus uses `strict_eq` on a tiny verdict; borderline PRs may cause validator disagreement and need a retry.

## 6. Submission deposit
**Problem:** Free submissions invite spam and wasted LLM/validator work.  
**Decision:** Deposit in GEN. Refunded to the winner with the payout, or via `withdraw_deposit` if the submission is untouched, expired, or the bounty closed. After 3 failed verifications it is forfeited to the treasury.  
**Why the treasury, not the creator:** Sending forfeits to the creator would reward creators for writing impossible requirements.  
**Trade-off:** An untouched submission can be withdrawn for free, so there is a small cost-free lock-extension vector. It is bounded by the submission cap.

## 7. Anti-rug rules for creators
**Decision:** Creator cannot cancel before the deadline, nor before the review window (7 days) after the last submission. Creator cannot submit to their own bounty.  
**Why:** Stops a creator from cancelling the moment a contributor starts working.  
**Trade-off:** Creators wait for the deadline to get an unclaimed reward back.  
**Known gap:** A creator who owns the repo can still refuse to merge a good PR, then cancel after the deadline. Contributors should check the repo owner's reputation. A future version could add a repo-ownership proof or a dispute path.

## 8. Self-merge protection (`allow_self_merge`, default false)
**Why:** Stops a collaborator from merging their own trivial PR to farm a bounty.  
**Trade-off:** Solo-maintainer repos must set it to true.

## 9. Limits
- One submission per wallet per bounty, 20 submissions per bounty, 3 verify attempts, 7-day submission life.  
- **Why:** Bound the cost of spam and the lock-extension attack.  
- **Trade-off:** A contributor who fails three times is out for that bounty.

## 10. Transient errors do not burn attempts
**Decision:** If GitHub cannot be read (`FETCH_ERROR`), the attempt is not counted.  
**Why:** A GitHub outage should not cost contributors their deposit.

## 11. `claim_payout` is permissionless but pays only the winner
**Why:** Anyone (a bot, the creator) can trigger it; the destination is fixed, so it is safe. State changes happen before the transfer.

## 12. Owner powers are minimal
**Decision:** Owner can pause, tune min reward/deposit, and take the treasury. Owner cannot touch escrow or deposits.  
**Pause behaviour:** Creating, submitting, and verifying stop. Claiming and withdrawing still work so users can always exit.

## 13. Pagination in views
`get_bounties` takes `offset` and `limit` (max 50) so reads stay bounded as the contract grows.

## Not included (deliberately)
- Private repos (needs a token that validators cannot safely hold).
- Multiple winners or partial payouts.
- Platform fee. Easy to add by routing a share to the treasury in `claim_payout`.
- On-chain disputes or appeals.
- Third-party audit. Needed before real funds.
