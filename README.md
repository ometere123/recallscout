# RecallScout

RecallScout is a public recall bounty board. A sponsor funds a watch for a product category or product family, a scout submits public product evidence plus an official recall source, and GenLayer consensus decides whether the product appears to match the recall.

The first target users are small resellers, parent groups, school administrators, and safety-minded shoppers who need a public way to verify dangerous listings without trusting one private operator.

## Why This Needs GenLayer

Delete GenLayer and the core workflow breaks: one app operator would decide whether a scout gets paid, whether a sponsor recovers funds, and whether ambiguous recall evidence is good enough. The parties do not fully trust each other. Sponsors do not want false positives. Scouts do not want a sponsor to refuse payment after a real find. Buyers and communities need the reasoning to be visible.

The contract owns the source of truth:

- funded recall watches
- scout submissions and content-hash commitments
- contract-fetched product and recall evidence
- consensus decision, confidence band, reasoning, attempts, and terminal status
- value movement for bounty, scout bond, cancellation, sponsor acceptance, rejection, and bounded unknown unwind

There is no backend service, database, or API route storing state.

## Contract Design

Contract: `contracts/recall_scout.py`

StudioNet address: `0x9434722c6E747E31e4e5BdFbcc458aF6b2DA8360`

Explorer: `https://explorer-studio.genlayer.com/address/0x9434722c6E747E31e4e5BdFbcc458aF6b2DA8360`

The slow semantic step is `verify_report(watch_id)`. It fetches:

- the scout's product evidence URL
- the cited recall URL
- an optional corroborating URL

Validators classify the result as:

- `MATCH`
- `NO_MATCH`
- `UNKNOWN`

The equivalence principle compares meaning and final decision, not JSON shape. It requires validators to agree on the same decision category and confidence band. `UNKNOWN` is mandatory when a source cannot be fetched, is too broad, is not an official/corroborating recall source, lacks product identifiers, or leaves the match ambiguous.

Everything else is deterministic: caps, indexes, validation, status transitions, UTC timestamps, cooldowns, and payment math.

### Resubmission Fix

The reviewed version pooled scout bonds on the watch. That meant scout B could replace scout A's inconclusive report, and a later settlement could accidentally include scout A's bond in scout B's payout or the sponsor's recovery. The contract now records each report as its own attempt with its own scout, bond, evidence URLs, decision, and settlement flag. Replacing an `UNKNOWN` report settles the previous attempt by returning that attempt's bond to its original scout, then the new scout starts a fresh bonded attempt. `MATCH`, `NO_MATCH`, sponsor acceptance, and unknown unwind settle only the active attempt's bond.

Recall-source provenance is also stricter. `submit_report` now binds the declared source name to recognized official domains: CPSC, FDA, USDA/FSIS, NHTSA/SaferCar, and Health Canada recall URLs. A report that says `CPSC` but cites `example.com` is rejected before consensus.

## App Flow

- **Overview:** explains the product and shows live board metrics.
- **Watches:** public read-only recall board.
- **Sponsor:** creates a funded watch with a deadline.
- **Scout Desk:** submits product URL, sha256 content commitment, official recall URL, source name, and optional corroborating URL with a bond.
- **Review:** permissionless consensus queue.
- **History:** active wallet's sponsored or scouted watches.
- **Watch detail:** deep link for every watch, including reasoning and evidence links.
- **Profile:** address-scoped activity view.

The wallet system supports injected wallets and generated browser wallets. The generated wallet is persisted in `localStorage`, exportable, importable, and clearly labeled as browser-local custody.

## Verified Results

Local gates:

- `genvm-lint`: passed, 13 methods, 7 views, 6 writes.
- Direct tests: `31 passed`.
- Frontend lint: passed.
- Frontend production build: passed.
- StudioNet integration test: `1 passed`.
- Frontend schema verification: 13 function names checked against the deployed contract.

Fresh deployed read checks on `0x9434722c6E747E31e4e5BdFbcc458aF6b2DA8360`:

- Initial `get_watch_count` returned `0`.
- After the exercise script, `get_watch_count` returned `3`.
- `get_watch("RS-1")` returned `MATCHED`, `decision: SPONSOR_ACCEPTED`, `active_attempt_id: RS-1-A1`.
- `get_watch("RS-2")` returned `CANCELED`, with no scout bond.
- `get_watch("RS-3")` returned `MATCHED`, `decision: MATCH`, `confidence_band: HIGH`, `attempts: 1`, `active_attempt_id: RS-3-A1`.

On-chain writes exercised:

- `create_watch`
- `submit_report`
- `verify_report`
- `sponsor_accept`
- `cancel_open_watch`
- `unwind_unknown`

Selected transaction hashes:

- Resubmission deploy with per-attempt bonds: `0x6853cf5300b179c3b7fcd206d4a88fd9e2f3ddc24cd84a728ca4b53328743bb4`
- Submit sponsor-accepted report: `0x96f7a6413d2f79127d6301f124ea4b1e59923f2ce0d5f86dd3a0e80c91285576`
- Sponsor accept: `0x6a2e17b60ef14aca9d38388d3a80f0f4a459ac245ef6bcd18ccaace7d80a9648`
- Cancel expired watch: `0xdb5876e9546a7707bb9f116b6e0c3b1d55156757b0e9639574a8a71d18ceefb3`
- Submit consensus report: `0x2bf70aaa18a1561f926c8781f2f9d646ad7c6dea577d774b30dc063c8fa74dfe`
- Verify consensus report: `0x3bf510038d8ba8a4f1a498d97b3f73532c0592ca0c79d339c1e5a5dcd98ef999`
- Fresh demo deploy: `0xe505f0ae5dccba60c87344862403eb6d5d3f9c76dc5022efd6cf61335331d76c`
- Original exercised deploy: `0xc8dee5d1ead5bf1a764ca084c753063a806b66839c77b60f0bd938e54148313c`

Observed real result:

`RS-3` used the official CPSC Romorgniz dresser recall page as both product evidence and recall source. `verify_report` returned `MATCH`, `HIGH` confidence, and stored validator reasoning identifying the same recall number, product line, hazard, remedy, units, sale platform, sale period, dimensions, importer, and manufacturer.

The cross-scout retry bug was reproduced as a local regression case before the fix. The current direct tests assert that after scout A receives `UNKNOWN`, scout B's retry creates `RS-1-A2`, resets the active bond to scout B's bond only, and a later `MATCH` releases funds to scout B without pooling scout A's bond. A second regression covers unknown unwind after a cross-scout retry.

## Setup

```bash
npm install
npm run lint
npm run build
```

Contract checks:

```bash
C:\Users\USER\AppData\Local\Python\pythoncore-3.14-64\Scripts\genvm-lint.exe check contracts\recall_scout.py --json
python -m pytest tests\direct -v
C:\Users\USER\AppData\Local\Python\pythoncore-3.14-64\Scripts\gltest.exe tests\integration -v -s --network studionet
npm run verify:schema
```

Optional env vars:

```bash
NEXT_PUBLIC_GENLAYER_CHAIN=studionet
NEXT_PUBLIC_RECALLSCOUT_ADDRESS=0x9434722c6E747E31e4e5BdFbcc458aF6b2DA8360
NEXT_PUBLIC_GENLAYER_EXPLORER=https://explorer-studio.genlayer.com
```

## Honest Limits

StudioNet balances are simulated, so the app demonstrates contract value paths in the Studio environment rather than production GEN settlement on a public EVM chain.

Consensus writes can take minutes. The UI persists in-flight transactions and shows lifecycle state, but users should expect `verify_report` to be slower than deterministic sponsor/scout actions.

The first version asks scouts to provide public URLs. It does not yet include source presets for CPSC/FDA/USDA/NHTSA APIs or image screenshot mode. Those are natural next steps, not hidden dependencies.
