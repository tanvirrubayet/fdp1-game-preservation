# Improvements after the independent review

Updated 19 November 2026. The current policy covers base-game downloads, hotfixes, compatibility fixes and free updates while holding FDP1. The financial notebook retains the original baseline and adds Sections 12–15 with explicit recovery and continuity costs. The workflow and decisions Word documents remain dated pilot records. The analytical white paper was revised on 20 November to incorporate these results and all ten Option B sections. Read this update and the [effective policy](ENTITLEMENT-AND-RECOVERY.md) alongside them.

## Financial results

All values are illustrative euros over 60 months, using EUR 4,500 opening funding and the existing 1,000 paid allocation. New receipts come from primary issues. Wallet transfers produce zero income. Higher bills mean EUR 180 monthly instead of EUR 120. Growth is 5% on annual anniversaries. Recovery costs comprise a EUR 600 incident in month 24 and ten EUR 25 support cases in month 18. Refunds are five full-price payments in month 12, with fees and royalties unrecovered. Sales-stop cases sell 14 issues a month for 12 months, then zero. The combined case includes all of these stresses.

| Scenario | First cash gap | Closing cash | Additional opening funding required |
| --- | --- | ---: | ---: |
| Baseline | None in 60 months | EUR 2,052.00 | EUR 0.00 |
| Higher monthly bills | Month 40 | EUR -1,548.00 | EUR 1,548.00 |
| Annual bill growth | None in 60 months | EUR 1,295.04 | EUR 0.00 |
| Recovery and refunds | None in 60 months | EUR 1,142.00 | EUR 0.00 |
| Sales stop | Month 36 | EUR -2,988.00 | EUR 2,988.00 |
| Combined stress | Month 22 | EUR -8,633.32 | EUR 8,633.32 |

The reserve warning floor earmarks the next six months of bills and scheduled claims plus EUR 600 for exit administration and final delivery. It is a proposed review threshold, not a second cost charged to the ledger. The first trigger is month 17 for higher bills, month 56 for annual growth, month 49 for recovery and refunds, month 25 for the sales stop and month 14 for combined stress. The baseline stays above the floor during the forecast.

At unchanged demand, the minimum price that keeps every month funded is EUR 8.36 in the baseline, EUR 14.76 for higher bills, EUR 9.70 for annual growth, EUR 9.96 for recovery/refunds, EUR 38.56 for sales stopping and EUR 92.27 for combined stress. These prices fund the 60-month operating term. They exclude the extra reserve floor and assume buyers accept the price without reducing demand. They demonstrate how strongly funding depends on continued sales. They are not measured market prices or recommendations to charge those amounts.

The notebook reconciles every expense against cash, verifies that neutral stress reproduces the original balances, and checks that each calculated price succeeds while the preceding cent fails. Continued negative balances quantify unpaid requirements. The policy requires intervention before accepting unfunded obligations.

## Recovery and access rules

The [policy](ENTITLEMENT-AND-RECOVERY.md) defines lost-device recovery, lost signing keys, optional pre-linked Discord/Steam evidence, incorrect issues, refunds, protected legacy capacity, issuer succession and migration. An identity claim alone cannot move a token. A refunded issue continues to occupy minted capacity. A future replacement service must first prevent both archives from accepting duplicate entitlements.

Archive downloads use safe blockchain state. Providers whose latest block is over two minutes old are rejected. Delayed transfers may temporarily retain the previous eligibility until safe state catches up. Provider failure returns a retryable service message. Local files continue to run under their applicable licences.

## Verification and remaining evidence limits

Twelve contract and integration tests passed locally, including a seeded sequence of 80 operations and an actual local-chain transfer through the HTTP archive. Six archive tests passed for expiry, concurrent replay, altered message domain/chain, provider outage, stale/inconsistent blocks and access after transfer. All 15 financial code cells execute and the saved numerical outputs reproduce. The stress figure was visually inspected.

The HTTP integration uses a small offline-file fixture to establish access and retained bytes. The recorded Sepolia game ZIP was separately extracted and launched for interactive play. The user confirmed sound and save/load. [Session record](../evidence/gameplay/session.json) and [engine log](../evidence/gameplay/engine.log) document this distinction. The earlier AppContainer run remains the evidence of network-blocked timed playback. The updated safe-state handover runner is prepared for future Sepolia replays. This change was tested with local chain and injected provider conditions.

The [licence inventory](PACKAGE-LICENCES.md) lists all 28 DLLs and fingerprints. Exact binary-to-source matching and missing component notices remain to be completed before the bundle is treated as cleared for wider redistribution. The upstream Windows ZIP supplies no individual DLL notice directory. The inventory records current upstream package references and preserves the uncertainty about historical versions.

GitHub Actions runs the contract, archive and financial checks on pushes and pull requests. Requirements and pnpm dependencies are version-pinned. The workflow uses no private wallet credentials. This update adds no remote archive deployment.

## AI assistance

Codex helped interpret the review, implement the notebook scenarios and archive tests, document the policies and package inventory, and run local checks. The user directly confirmed the interactive sound and save/load result. Financial choices are disclosed examples. Exact DLL source coverage and any future commercial service terms require further evidence.
