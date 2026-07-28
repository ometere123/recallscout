# RecallScout Decision Record

RecallScout lets shoppers, resellers, schools, and small retailers post recall bounties, then pays scouts when GenLayer consensus verifies that a product listing or label matches an official safety recall.

## Candidate Set

| Candidate | Core Capability | Native GEN | Why It Was Not Chosen |
|---|---:|---:|---|
| RecallScout | Web/API fetch, visual/product evidence, semantic consensus | Yes | Chosen. It is easy to explain and has real repeat use. |
| TrialDrift | ClinicalTrials.gov fetch, semantic change detection | Optional | Strong, but more specialized and slower to demo. |
| RegNotice | Federal Register fetch, policy-change judgment | Optional | Useful, but harder for reviewers to test quickly. |
| LabelGuard | Food/allergen page and package evidence | Yes | Close to RecallScout; held as future vertical. |
| DataFresh Bond | API/dashboard freshness challenge | Yes | Good protocol-native shape, but more infra-facing. |
| DocketWatch | Public docket/PDF change verification | Optional | Fragmented public sources make first version brittle. |
| BenchmarkBond | Public AI benchmark claim challenges | Yes | Timely, but close to claim/proof apps already on this machine. |
| SafetyBulletin Relay | Public safety bulletin applicability | Optional | Similar to RecallScout but less concrete for first users. |
| PolicyDiff Rooms | Terms/policy material-change watches | Optional | Useful, but could look like generic document review. |

## Chosen Product

RecallScout is a public recall bounty board. A sponsor funds a watch for a category or product family. A scout submits a product evidence URL, a sha256 content commitment, an official recall URL, and an optional corroborating source. Anyone can trigger consensus. Validators fetch the product page and recall source inside the contract and decide whether the product appears to match the official recall.

## Gates

**Gate A, counterfactual:** without GenLayer, a single website operator decides whether a scout gets paid or slashed. That breaks the trust model between sponsors, scouts, and affected buyers.

**Gate B, distrusting parties:** sponsors want useful recall matches and may not want to pay false claims; scouts want payment for real finds; marketplaces or sellers may have incentives to hide risky listings.

**Gate C, irreducibly semantic:** recall matching is not a regex. Validators must compare product names, model numbers, hazard language, date ranges, brands, packaging, and context across inconsistent pages.

**Gate D, contract-fetched evidence:** product and recall URLs are inputs, not facts. The contract fetches both inside consensus before deciding.

**Gate E, repeat use:** resellers, school administrators, parent groups, and small retailers can post or check recall watches weekly.

**Gate F, path beyond submission:** add official-source presets for CPSC, FDA, USDA, and NHTSA; add watch templates for product categories; add community safety reports and periodic public keeper review.

**Gate G, latency:** create and submit are deterministic writes. The slow semantic step is a separate permissionless `verify_report` transaction with two fetches in one consensus round.

## Non-Determinism Budget

RecallScout uses one non-deterministic consensus round per report:

1. `web.render(product_url, mode="text")` to inspect the submitted product evidence.
2. `web.render(recall_url, mode="text")` to inspect the official/corroborating recall source.
3. `exec_prompt(..., response_format="json")` to classify the match into enumerated bands.

Everything else is deterministic: validation, caps, indexing, payment amounts, deadline/cooldown arithmetic, status transitions, and bounded unknown unwind.

## Self-Audit

The candidates span web/API consensus, native GEN bounties/bonds, images/visual evidence paths, semantic change detection, and possible embeddings/search extensions. LabelGuard and SafetyBulletin Relay are related to RecallScout; they were kept as future verticals, not separate first builds. If web access did not exist, the best alternative would be DataFresh Bond with signed provider submissions and deterministic hash commitments, but that would be less compelling for GenLayer because validators could not independently inspect the world.
