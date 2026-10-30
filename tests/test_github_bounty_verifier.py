"""
Integration tests for github_bounty_verifier_strict.py (GenLayer Studio / gltest).

Setup:
    pip install genlayer-test pytest
    # start GenLayer Studio / localnet, then:
    gltest tests/ -v          (or: pytest tests/ -v)

Covers deterministic paths (validation, escrow, locks, admin).
The live verification test (real GitHub PR + LLM) is skipped unless you set:
    BOUNTY_TEST_REPO, BOUNTY_TEST_PR_URL, BOUNTY_TEST_REQUIREMENTS

NOTE: gltest's API differs slightly between versions (transact kwargs, account
helpers). If a call fails to import or run, check the current genlayer-test docs.
"""
import os

import pytest
from gltest import get_contract_factory, create_account, default_account
from gltest.assertions import tx_execution_failed, tx_execution_succeeded

GEN = 10 ** 18
REPO = "octocat/Hello-World"
REQS = "Add a CONTRIBUTING.md file that explains how to open a pull request."
PR = f"https://github.com/{REPO}/pull/1"


@pytest.fixture()
def contract():
    factory = get_contract_factory("GitHubBountyVerifierStrict")
    return factory.deploy(args=[])


def make_bounty(contract, value=GEN, days=7, account=None):
    kw = {"value": value}
    if account is not None:
        kw["account"] = account
    return contract.create_bounty(args=[REPO, "Add contributing guide", REQS, days, False]).transact(**kw)


# ----------------------------------------------------------------- create

def test_create_bounty_escrows_reward(contract):
    assert tx_execution_succeeded(make_bounty(contract))
    b = contract.get_bounty(args=[1]).call()
    assert b["status"] == "OPEN" and b["reward"] == GEN
    assert contract.get_accounting(args=[]).call()["total_escrowed"] == GEN


def test_create_rejects_low_reward(contract):
    assert tx_execution_failed(make_bounty(contract, value=1))


@pytest.mark.parametrize("repo", ["bad", "a/b/c", "", "owner/"])
def test_create_rejects_bad_repo(contract, repo):
    tx = contract.create_bounty(args=[repo, "t", REQS, 7, False]).transact(value=GEN)
    assert tx_execution_failed(tx)


@pytest.mark.parametrize("days", [0, 91])
def test_create_rejects_bad_deadline(contract, days):
    assert tx_execution_failed(make_bounty(contract, days=days))


# ----------------------------------------------------------------- submit

def test_submit_requires_deposit(contract):
    make_bounty(contract)
    alice = create_account()
    tx = contract.submit_pr(args=[1, PR]).transact(value=0, account=alice)
    assert tx_execution_failed(tx)


def test_creator_cannot_submit_to_own_bounty(contract):
    make_bounty(contract)
    tx = contract.submit_pr(args=[1, PR]).transact(value=GEN // 100)
    assert tx_execution_failed(tx)


@pytest.mark.parametrize("url", [
    "http://github.com/octocat/Hello-World/pull/1",
    f"{PR}/files",
    f"{PR}?x=1",
    "https://github.com/octocat/Hello-World/issues/1",
    "https://evil.com/octocat/Hello-World/pull/1",
])
def test_submit_rejects_bad_urls(contract, url):
    make_bounty(contract)
    alice = create_account()
    tx = contract.submit_pr(args=[1, url]).transact(value=GEN // 100, account=alice)
    assert tx_execution_failed(tx)


def test_submit_rejects_other_repo(contract):
    make_bounty(contract)
    alice = create_account()
    tx = contract.submit_pr(args=[1, "https://github.com/other/repo/pull/1"]).transact(
        value=GEN // 100, account=alice
    )
    assert tx_execution_failed(tx)


def test_one_submission_per_wallet(contract):
    make_bounty(contract)
    alice = create_account()
    assert tx_execution_succeeded(contract.submit_pr(args=[1, PR]).transact(value=GEN // 100, account=alice))
    again = contract.submit_pr(args=[1, f"https://github.com/{REPO}/pull/2"]).transact(
        value=GEN // 100, account=alice
    )
    assert tx_execution_failed(again)


# --------------------------------------------------------------- withdraw

def test_untouched_submission_can_withdraw_deposit(contract):
    make_bounty(contract)
    alice = create_account()
    contract.submit_pr(args=[1, PR]).transact(value=GEN // 100, account=alice)
    assert contract.get_accounting(args=[]).call()["total_deposits"] == GEN // 100
    assert tx_execution_succeeded(contract.withdraw_deposit(args=[1]).transact(account=alice))
    assert contract.get_accounting(args=[]).call()["total_deposits"] == 0
    # cannot withdraw twice
    assert tx_execution_failed(contract.withdraw_deposit(args=[1]).transact(account=alice))


# ----------------------------------------------------------------- cancel

def test_only_creator_can_cancel(contract):
    make_bounty(contract)
    mallory = create_account()
    assert tx_execution_failed(contract.cancel_bounty(args=[1]).transact(account=mallory))


def test_creator_cannot_cancel_before_deadline(contract):
    make_bounty(contract, days=7)
    assert tx_execution_failed(contract.cancel_bounty(args=[1]).transact())


# ------------------------------------------------------------------ admin

def test_admin_functions_owner_only(contract):
    mallory = create_account()
    assert tx_execution_failed(contract.set_paused(args=[True]).transact(account=mallory))
    assert tx_execution_failed(contract.set_params(args=[1, 1]).transact(account=mallory))
    assert tx_execution_failed(contract.withdraw_treasury(args=[1]).transact(account=mallory))


def test_pause_blocks_create_but_not_withdraw(contract):
    make_bounty(contract)
    alice = create_account()
    contract.submit_pr(args=[1, PR]).transact(value=GEN // 100, account=alice)
    assert tx_execution_succeeded(contract.set_paused(args=[True]).transact())
    assert tx_execution_failed(make_bounty(contract))
    assert tx_execution_succeeded(contract.withdraw_deposit(args=[1]).transact(account=alice))


def test_treasury_cannot_exceed_balance(contract):
    assert tx_execution_failed(contract.withdraw_treasury(args=[1]).transact())


def test_pr_status_unused(contract):
    assert contract.get_pr_status(args=[PR]).call() == {"used": False, "bounty_id": 0}


# ------------------------------------------------- live (real GitHub + LLM)

LIVE = all(os.getenv(k) for k in ("BOUNTY_TEST_REPO", "BOUNTY_TEST_PR_URL", "BOUNTY_TEST_REQUIREMENTS"))


@pytest.mark.skipif(not LIVE, reason="set BOUNTY_TEST_* env vars to run the live test")
def test_live_verify_and_payout(contract):
    """
    Needs a PR merged AFTER the bounty is created, authored by the account used
    here, with that account's wallet address in the PR description.
    """
    repo = os.environ["BOUNTY_TEST_REPO"]
    pr = os.environ["BOUNTY_TEST_PR_URL"]
    reqs = os.environ["BOUNTY_TEST_REQUIREMENTS"]
    creator, contributor = create_account(), default_account
    contract.create_bounty(args=[repo, "Live test", reqs, 7, True]).transact(value=GEN, account=creator)
    contract.submit_pr(args=[1, pr]).transact(value=GEN // 100, account=contributor)
    contract.verify_submission(args=[1, contributor.address]).transact()
    sub = contract.get_submission(args=[1, contributor.address]).call()
    assert sub["status"] in ("APPROVED", "REJECTED"), sub
    if sub["status"] == "APPROVED":
        assert contract.get_bounty(args=[1]).call()["status"] == "PAYOUT_READY"
        assert contract.get_pr_status(args=[pr]).call()["used"] is True
        assert tx_execution_succeeded(contract.claim_payout(args=[1]).transact())
        assert contract.get_bounty(args=[1]).call()["status"] == "PAID"
