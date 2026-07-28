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

StudioNet address: `0xeb93Bc26cd7fB3abf112a30509B1247c1B2b8b2c`

Explorer: `https://explorer-studio.genlayer.com/address/0xeb93Bc26cd7fB3abf112a30509B1247c1B2b8b2c`

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
- Direct tests: `28 passed`.
- Frontend lint: passed.
- Frontend production build: passed.
- StudioNet integration test: `1 passed`.
- Frontend schema verification: 13 function names checked against the deployed contract.

Deployed read checks:

- `get_watch_count` returned `4`.
- `get_watch_id(3)` returned `RS-4`.
- `get_watch("RS-4")` returned status `UNWOUND`.
- `get_watch_page(0, 10)` returned watches `RS-1` through `RS-4`.
- `get_party_watch_count(0x6452D2A18ce678b31ffD3C0a9D9131Af7ef3d45a)` returned `1`.
- `get_profile(0x37222ef5e0ED7B8D9325174a4269694Ee80aF8a5)` returned `reported: 2`, `unknown: 2`.

On-chain writes exercised:

- `create_watch`
- `submit_report`
- `verify_report`
- `sponsor_accept`
- `cancel_open_watch`
- `unwind_unknown`

Selected transaction hashes:

- Deploy: `0xc8dee5d1ead5bf1a764ca084c753063a806b66839c77b60f0bd938e54148313c`
- Submit sponsor-accepted report: `0x14aafc1d57ade4aee7757282149c8923d457d5fcdffeece154bf3a533d528f9e`
- Sponsor accept: `0x376fc72d5201f9e0977f33c3b9fce392488e522a7539b03d79c9e8bfa9b0a61e`
- Cancel expired watch: `0x25021c314fff5a6a8cfd4819353566a0e7fc58f82a4a2f5bf32f4dfb81c19f79`
- Verify broad CPSC evidence: `0x36a82571db8a5d4cf1e79691daa030ef4053b9d7553daf514cd75077e90137e8`
- Verify unknown attempt 1: `0x00855a4acb3a3dba9731d050c43746f6060cba2784069c95d07147f47c0769db`
- Verify unknown attempt 2: `0x668ddcdbd09b6b052128183ae5fbee8bf8a85590e7fe76e97449fe84ddaf7303`
- Unwind unknown: `0x878234ad659d2faff12efcf995c5b9b0a1c5156bf718f6f0fe044df38fcda2bb`

Observed real result:

`RS-4` intentionally used broad CPSC index/data pages instead of a specific recalled product. Consensus returned `UNKNOWN` twice because the evidence did not identify a specific recalled product. After the enforced cooldown and two attempts, the sponsor called `unwind_unknown`, returning the bounty to the sponsor and the accumulated scout bond to the scout.

This is the intended safety behavior. A broad page is not treated as proof.

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
NEXT_PUBLIC_RECALLSCOUT_ADDRESS=0xeb93Bc26cd7fB3abf112a30509B1247c1B2b8b2c
NEXT_PUBLIC_GENLAYER_EXPLORER=https://explorer-studio.genlayer.com
```

## Honest Limits

StudioNet balances are simulated, so the app demonstrates contract value paths in the Studio environment rather than production GEN settlement on a public EVM chain.

Consensus writes can take minutes. The UI persists in-flight transactions and shows lifecycle state, but users should expect `verify_report` to be slower than deterministic sponsor/scout actions.

The first version asks scouts to provide public URLs. It does not yet include source presets for CPSC/FDA/USDA/NHTSA APIs or image screenshot mode. Those are natural next steps, not hidden dependencies.
