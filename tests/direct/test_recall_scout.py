import json

import pytest


def warp_to(direct_vm, iso: str) -> None:
    direct_vm.warp(iso)
    import sys

    gl = sys.modules.get("genlayer.gl")
    if gl is None:
        return
    raw = getattr(gl, "message_raw", None)
    if isinstance(raw, dict):
        raw["datetime"] = iso
    nested = getattr(getattr(gl, "message", None), "raw", None)
    if isinstance(nested, dict):
        nested["datetime"] = iso


ONE_GEN = 10**18
BOND = 1
GOOD_HASH = "sha256:" + ("a" * 64)


def create_watch(direct_vm, contract, sponsor, value=ONE_GEN, deadline="2026-08-01T12:00:00Z"):
    direct_vm.sender = sponsor
    direct_vm.value = value
    watch_id = contract.create_watch(
        "Amazon dresser tip-over recall",
        "Furniture / child safety",
        "Pay scouts who show a live listing matching an official recalled dresser by brand, model, or product line.",
        "CPSC recalls",
        deadline,
    )
    direct_vm.value = 0
    return watch_id


def submit_report(direct_vm, contract, scout, watch_id, product="https://shop.example.test/dresser", recall="https://www.cpsc.gov/Recalls/example"):
    direct_vm.sender = scout
    direct_vm.value = BOND
    contract.submit_report(watch_id, product, GOOD_HASH, recall, "CPSC", "")
    direct_vm.value = 0


def mock_match(direct_vm, decision="MATCH", confidence="HIGH"):
    direct_vm.mock_web(
        r".*shop\.example\.test.*",
        {"status": 200, "body": "Romorgniz 12-drawer fabric dresser, model RG-12, sold on Amazon."},
    )
    direct_vm.mock_web(
        r".*cpsc\.gov.*",
        {"status": 200, "body": "CPSC recall: Romorgniz 12-drawer fabric dressers recalled for tip-over and entrapment hazards."},
    )
    direct_vm.mock_llm(
        r".*verifying a public product safety recall bounty.*",
        json.dumps({"decision": decision, "confidence_band": confidence, "reason": "The listing and recall source name the same dresser line."}),
    )


def test_initial_count_zero(deploy_recall):
    assert deploy_recall.get_watch_count() == 0


def test_create_watch_stores_fields(direct_vm, deploy_recall, direct_alice):
    warp_to(direct_vm, "2026-07-28T10:00:00Z")
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice)
    watch = deploy_recall.get_watch(watch_id)
    assert watch["watch_id"] == "RS-1"
    assert watch["sponsor"].lower() == str(direct_alice).lower()
    assert watch["status"] == "OPEN"
    assert watch["bounty"] == str(ONE_GEN)
    assert watch["created_at"].endswith("Z")


def test_create_requires_funding(direct_vm, deploy_recall, direct_alice):
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    with direct_vm.expect_revert("Recall watch must be funded"):
        deploy_recall.create_watch("Recall", "Furniture", "Find official recall matches", "CPSC", "")


def test_create_rejects_short_title(direct_vm, deploy_recall, direct_alice):
    direct_vm.sender = direct_alice
    direct_vm.value = ONE_GEN
    with direct_vm.expect_revert("Invalid title"):
        deploy_recall.create_watch("No", "Furniture", "Find official recall matches", "CPSC", "")
    direct_vm.value = 0


def test_deadline_must_be_utc(direct_vm, deploy_recall, direct_alice):
    direct_vm.sender = direct_alice
    direct_vm.value = ONE_GEN
    with direct_vm.expect_revert("UTC ISO"):
        deploy_recall.create_watch("Valid recall watch", "Furniture", "Find official recall matches", "CPSC", "2026-08-01T12:00:00")
    direct_vm.value = 0


def test_get_watch_id_bounds(direct_vm, deploy_recall, direct_alice):
    create_watch(direct_vm, deploy_recall, direct_alice)
    assert deploy_recall.get_watch_id(0) == "RS-1"
    with direct_vm.expect_revert("Watch index out of range"):
        deploy_recall.get_watch_id(1)


def test_watch_page_limits_to_twenty(direct_vm, deploy_recall, direct_alice):
    for _ in range(22):
        create_watch(direct_vm, deploy_recall, direct_alice)
    assert len(deploy_recall.get_watch_page(0, 50)) == 20


def test_party_page_tracks_sponsor(direct_vm, deploy_recall, direct_alice):
    create_watch(direct_vm, deploy_recall, direct_alice)
    page = deploy_recall.get_party_watch_page(direct_alice, 0, 10)
    assert len(page) == 1
    assert page[0]["watch_id"] == "RS-1"


def test_submit_report_stores_provenance(direct_vm, deploy_recall, direct_alice, direct_bob):
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice)
    submit_report(direct_vm, deploy_recall, direct_bob, watch_id)
    watch = deploy_recall.get_watch(watch_id)
    assert watch["status"] == "REPORTED"
    assert watch["product_hash"] == GOOD_HASH
    assert watch["recall_url"].startswith("https://www.cpsc.gov")
    assert watch["scout"].lower() == str(direct_bob).lower()


def test_submit_requires_scout_bond(direct_vm, deploy_recall, direct_alice, direct_bob):
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice)
    direct_vm.sender = direct_bob
    direct_vm.value = 0
    with direct_vm.expect_revert("Scout bond is required"):
        deploy_recall.submit_report(watch_id, "https://shop.example.test/dresser", GOOD_HASH, "https://www.cpsc.gov/Recalls/example", "CPSC", "")


def test_sponsor_cannot_submit_own_watch(direct_vm, deploy_recall, direct_alice):
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.value = BOND
    with direct_vm.expect_revert("Sponsor cannot submit"):
        deploy_recall.submit_report(watch_id, "https://shop.example.test/dresser", GOOD_HASH, "https://www.cpsc.gov/Recalls/example", "CPSC", "")
    direct_vm.value = 0


def test_submit_rejects_non_https(direct_vm, deploy_recall, direct_alice, direct_bob):
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice)
    direct_vm.sender = direct_bob
    direct_vm.value = BOND
    with direct_vm.expect_revert("product URL must start with https://"):
        deploy_recall.submit_report(watch_id, "http://shop.example.test/dresser", GOOD_HASH, "https://www.cpsc.gov/Recalls/example", "CPSC", "")
    direct_vm.value = 0


def test_submit_rejects_bad_hash(direct_vm, deploy_recall, direct_alice, direct_bob):
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice)
    direct_vm.sender = direct_bob
    direct_vm.value = BOND
    with direct_vm.expect_revert("sha256 plus 64 hex"):
        deploy_recall.submit_report(watch_id, "https://shop.example.test/dresser", "sha256:abc", "https://www.cpsc.gov/Recalls/example", "CPSC", "")
    direct_vm.value = 0


def test_submit_after_deadline_reverts(direct_vm, deploy_recall, direct_alice, direct_bob):
    warp_to(direct_vm, "2026-07-28T10:00:00Z")
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice, deadline="2026-07-28T10:10:00Z")
    warp_to(direct_vm, "2026-07-28T10:10:01Z")
    direct_vm.sender = direct_bob
    direct_vm.value = BOND
    with direct_vm.expect_revert("deadline has passed"):
        deploy_recall.submit_report(watch_id, "https://shop.example.test/dresser", GOOD_HASH, "https://www.cpsc.gov/Recalls/example", "CPSC", "")
    direct_vm.value = 0


def test_submit_exact_deadline_reverts(direct_vm, deploy_recall, direct_alice, direct_bob):
    warp_to(direct_vm, "2026-07-28T10:00:00Z")
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice, deadline="2026-07-28T10:10:00Z")
    warp_to(direct_vm, "2026-07-28T10:10:00Z")
    direct_vm.sender = direct_bob
    direct_vm.value = BOND
    with direct_vm.expect_revert("deadline has passed"):
        deploy_recall.submit_report(watch_id, "https://shop.example.test/dresser", GOOD_HASH, "https://www.cpsc.gov/Recalls/example", "CPSC", "")
    direct_vm.value = 0


def test_verify_match_pays_scout_branch(direct_vm, deploy_recall, direct_alice, direct_bob, direct_charlie):
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice)
    submit_report(direct_vm, deploy_recall, direct_bob, watch_id)
    mock_match(direct_vm, "MATCH", "HIGH")
    direct_vm.sender = direct_charlie
    deploy_recall.verify_report(watch_id)
    watch = deploy_recall.get_watch(watch_id)
    assert watch["status"] == "MATCHED"
    assert watch["released_to"].lower() == str(direct_bob).lower()


def test_verify_no_match_pays_sponsor_branch(direct_vm, deploy_recall, direct_alice, direct_bob, direct_charlie):
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice)
    submit_report(direct_vm, deploy_recall, direct_bob, watch_id)
    mock_match(direct_vm, "NO_MATCH", "MEDIUM")
    direct_vm.sender = direct_charlie
    deploy_recall.verify_report(watch_id)
    watch = deploy_recall.get_watch(watch_id)
    assert watch["status"] == "REJECTED"
    assert watch["released_to"].lower() == str(direct_alice).lower()


def test_verify_unknown_keeps_funds_resting(direct_vm, deploy_recall, direct_alice, direct_bob):
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice)
    submit_report(direct_vm, deploy_recall, direct_bob, watch_id)
    mock_match(direct_vm, "UNKNOWN", "LOW")
    deploy_recall.verify_report(watch_id)
    watch = deploy_recall.get_watch(watch_id)
    assert watch["status"] == "UNKNOWN"
    assert watch["released_to"].endswith("0000000000000000000000000000000000000000")


def test_verify_requires_reported_status(direct_vm, deploy_recall, direct_alice):
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice)
    with direct_vm.expect_revert("not ready for consensus"):
        deploy_recall.verify_report(watch_id)


def test_cooldown_before_boundary_blocks(direct_vm, deploy_recall, direct_alice, direct_bob):
    warp_to(direct_vm, "2026-07-28T10:00:00Z")
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice)
    submit_report(direct_vm, deploy_recall, direct_bob, watch_id)
    mock_match(direct_vm, "UNKNOWN", "LOW")
    deploy_recall.verify_report(watch_id)
    submit_report(direct_vm, deploy_recall, direct_bob, watch_id)
    warp_to(direct_vm, "2026-07-28T10:04:59Z")
    with direct_vm.expect_revert("Review cooldown active"):
        deploy_recall.verify_report(watch_id)


def test_cooldown_exact_boundary_allows_retry(direct_vm, deploy_recall, direct_alice, direct_bob):
    warp_to(direct_vm, "2026-07-28T10:00:00Z")
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice)
    submit_report(direct_vm, deploy_recall, direct_bob, watch_id)
    mock_match(direct_vm, "UNKNOWN", "LOW")
    deploy_recall.verify_report(watch_id)
    submit_report(direct_vm, deploy_recall, direct_bob, watch_id)
    warp_to(direct_vm, "2026-07-28T10:05:00Z")
    deploy_recall.verify_report(watch_id)
    assert deploy_recall.get_watch(watch_id)["attempts"] == "2"


def test_sponsor_accept_pays_scout_branch(direct_vm, deploy_recall, direct_alice, direct_bob):
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice)
    submit_report(direct_vm, deploy_recall, direct_bob, watch_id)
    direct_vm.sender = direct_alice
    deploy_recall.sponsor_accept(watch_id)
    watch = deploy_recall.get_watch(watch_id)
    assert watch["status"] == "MATCHED"
    assert watch["decision"] == "SPONSOR_ACCEPTED"


def test_sponsor_accept_only_sponsor(direct_vm, deploy_recall, direct_alice, direct_bob, direct_charlie):
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice)
    submit_report(direct_vm, deploy_recall, direct_bob, watch_id)
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Only sponsor can accept"):
        deploy_recall.sponsor_accept(watch_id)


def test_cancel_open_after_deadline_pays_sponsor_branch(direct_vm, deploy_recall, direct_alice):
    warp_to(direct_vm, "2026-07-28T10:00:00Z")
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice, deadline="2026-07-28T10:01:00Z")
    warp_to(direct_vm, "2026-07-28T10:01:00Z")
    direct_vm.sender = direct_alice
    deploy_recall.cancel_open_watch(watch_id)
    assert deploy_recall.get_watch(watch_id)["status"] == "CANCELED"


def test_cancel_open_before_deadline_blocks(direct_vm, deploy_recall, direct_alice):
    warp_to(direct_vm, "2026-07-28T10:00:00Z")
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice, deadline="2026-07-28T10:01:00Z")
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("deadline has not passed"):
        deploy_recall.cancel_open_watch(watch_id)


def test_unwind_unknown_requires_attempts(direct_vm, deploy_recall, direct_alice, direct_bob):
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice)
    submit_report(direct_vm, deploy_recall, direct_bob, watch_id)
    mock_match(direct_vm, "UNKNOWN", "LOW")
    deploy_recall.verify_report(watch_id)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("attempts are not exhausted"):
        deploy_recall.unwind_unknown(watch_id)


def test_unwind_unknown_after_two_attempts_pays_both_resting_funds(direct_vm, deploy_recall, direct_alice, direct_bob):
    warp_to(direct_vm, "2026-07-28T10:00:00Z")
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice)
    submit_report(direct_vm, deploy_recall, direct_bob, watch_id)
    mock_match(direct_vm, "UNKNOWN", "LOW")
    deploy_recall.verify_report(watch_id)
    submit_report(direct_vm, deploy_recall, direct_bob, watch_id)
    warp_to(direct_vm, "2026-07-28T10:05:00Z")
    deploy_recall.verify_report(watch_id)
    warp_to(direct_vm, "2026-07-28T10:10:00Z")
    direct_vm.sender = direct_alice
    deploy_recall.unwind_unknown(watch_id)
    watch = deploy_recall.get_watch(watch_id)
    assert watch["status"] == "UNWOUND"
    assert watch["released_to"].lower() == str(direct_alice).lower()


def test_profile_counts(direct_vm, deploy_recall, direct_alice, direct_bob):
    watch_id = create_watch(direct_vm, deploy_recall, direct_alice)
    submit_report(direct_vm, deploy_recall, direct_bob, watch_id)
    mock_match(direct_vm, "MATCH", "HIGH")
    deploy_recall.verify_report(watch_id)
    sponsor = deploy_recall.get_profile(direct_alice)
    scout = deploy_recall.get_profile(direct_bob)
    assert sponsor["sponsored"] == "1"
    assert scout["reported"] == "1"
    assert scout["matched"] == "1"
