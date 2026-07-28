from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded


def test_studionet_deterministic_surface():
    factory = get_contract_factory("RecallScout")
    contract = factory.deploy(args=[])
    tx = contract.create_watch(
        args=[
            "Integration recall watch",
            "Consumer product safety",
            "Create a funded watch and verify that deterministic indexing works on StudioNet.",
            "CPSC recalls",
            "2026-08-30T12:00:00Z",
        ]
    ).transact(value=1)
    assert tx_execution_succeeded(tx)
    assert contract.get_watch_count(args=[]).call() == 1
    watch = contract.get_watch(args=["RS-1"]).call()
    assert watch["status"] == "OPEN"
