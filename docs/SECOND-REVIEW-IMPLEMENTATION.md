# Second independent review implementation

Updated 20 November 2026. The eight-page review supplied by a second reader was dated 19 November. This record identifies the changes made after that review and the conditions for using them outside coursework. The 20 November analytical white paper had already corrected its earlier test count and refund coverage.

The project-authored code now has an MIT licence. [LICENSING.md](../LICENSING.md) explains why it does not grant rights over third-party software or report prose. The README's broken code fence was repaired. The recorded `backup-download.zip` remains excluded by `.gitignore` and can be rebuilt from pinned upstream inputs. The AppContainer `engineExit` value 4294967295 is the unsigned 32-bit representation of −1; the test's success condition is the completed 7,117 game ticks reported in the engine log, not a zero process exit. The later interactive sound and save/load result remains a user confirmation without an archived save file.

## Financial model changes

The executed [notebook](../preservation_economics.ipynb) retains its original €7.50 contribution as a clearly labelled reference. Sections 16–19 add optional VAT, gas, repeat-download, dispute, ten-year and demand-decay cases. All amounts are hypothetical, and no checkout or real payment exists in this pilot.

For the review's example, a €12 price **including 20% VAT** gives €10 before VAT. If the 30% royalty applies to that €10, the royalty is €3. After the existing €0.66 checkout fee and €0.24 initial delivery cost, €6.10 remains per paid issue. This conditional case closes at €876 after 60 months, versus €2,052 without VAT. The royalty base and tax treatment require actual sales terms and the seller's tax assessment. EU cross-border consumer sales may involve the VAT One Stop Shop; the notebook does not determine registration or filing obligations.

The example uses 463,530 gas units observed for one paid Sepolia issue and assumes the same units for each free claim. At €3,000 per ETH, it varies gas from 0.5 to 5 gwei. A 1 gwei case costs €1.39 per issue. Combining that fee with the VAT example makes the cash balance negative in month 50 and leaves a €569.60 shortfall at month 60. The 200 protected free claims also consume assumed gas without payment. Gas must be paid in ETH, so an issuer needs a measured ETH budget on the chosen chain. One testnet receipt does not establish future gas prices or free-claim usage.

A separate case adds twenty repeat downloads per month at €0.05 each and two €15 dispute fees. These are examples, not bandwidth or processor quotes. The notebook also models a 3% monthly demand decay from 28 potential buyers and an invented unit price-response exponent. The plotted price cases cannot be treated as demand forecasts.

The ten-year illustration assumes 14 paid issues monthly in year one, then none, with the 20% VAT and 1 gwei cases. It needs €15,434.72 total opening funding to keep every month paid, €10,934.72 more than the existing €4,500 example. Its first gap with only existing funding occurs in month 29. A €48,000 endowment illustration assumes €1,440 annual fixed bills and a reliable 3% real return with no real cost growth. No such return is guaranteed. A real service must state its funded term and exit plan, backed by committed cash and distribution permission.

## Potential publisher-funded service

A prospective publisher could pay an upfront preservation fee for an agreed offline edition and service term. The publisher would authorise the archive's distribution, eligible prior-buyer claims, transfers, patches, free updates and any final handover. The agency would maintain versioned files and an independent backup. The fee should be calculated from a quoted restoration, hosting, support, transaction, tax and exit budget. Primary consumer sales, if any, would reduce the needed upfront commitment only when reasonably evidenced. Secondary transfers are assumed to provide no archive income.

Deferring part of the royalty until a reserve target is met is a negotiation option. The existing model assumes the agreed primary royalty is paid on each sale; it does not silently withhold payment when cash is low. A future contract must specify any priority order, reporting and arrears before such a scenario becomes a service rule.

This is a business proposal, not an existing partner agreement. Freedoom is freely available and validates the technical workflow, not willingness to buy FDP1. GOG already offers offline installers for some games. FDP1's proposed extra capability is a transferable archive entitlement recognised by separate processes if a store closes. The recorded backup test used two processes and package copies on one PC, not geographically independent operators. The project does not claim that an open token prevents people from copying files they already downloaded.

## Partner and player rules before a paid pilot

The two proposed partners should name a decision maker, a response deadline and an independent escalation or mediator for a deadlock about reserve spending or wind-down. A legal operator, accountable budget holder and bank or escrow arrangement must be identified before a commercial sale. The €600 exit allowance remains an illustrative warning-floor input, not money already placed in escrow. Publisher permission should state whether final copies can be given to holders or a named archive at expiry. No library has agreed to receive these files.

Legacy claims require proof from the former storefront or publisher. Before closure, agree a minimal data exchange or a verifiable signed receipt format. Store only the data needed to verify a claim, issue one opaque reference per approved purchase, restrict access and set deletion periods. A player's Discord or Steam tag alone does not prove a purchase or permit a lost-wallet replacement. The current contract cannot reverse an issue or recover a token from a wallet that can no longer sign.

The 1,200-token cap is a coursework value, not an access or marketing target. Any real cap should match the publisher's authorised licence volume. Unused legacy slots stay protected in the deployed contract. No scarcity or resale value is promised. A token represents current archive-download eligibility, not copyright, revenue or exclusive ownership of game files. Files already downloaded remain governed by their applicable software licence or publisher agreement.

For a future issuer, prepare a 2-of-3 multisig with named independent signers, written approval records, a tested backup and a local rehearsal of Ownable2Step handover and issuance. Do not move ownership of the current Sepolia contract to an unspecified address. A later chain decision must compare issuance and transfer cost, chain longevity and migration risk. Keep an event-based balance snapshot and reconcile it to `balanceOf` before any migration. A replacement archive must deactivate old entitlements before accepting new ones.

The [snapshot script](../scripts/rebuild-ownership.mjs) reads the contract's public event history from Blockscout because the pilot's public RPC prunes old logs. It reconstructs balances and issuance counts, then checks them against `totalSupply`, issue counters and each holder's `balanceOf` at a single Sepolia safe block. Two local tests cover a transfer and inconsistent history. The [20 November snapshot](../evidence/sepolia/ownership-snapshot-2026-11-20.json) reconciled one paid token held by one address. A later migration still requires fresh data and an explicit old-service deactivation plan. ERC-20 transfers cannot preserve whether a particular unit began as a legacy or paid issue.

## Archive changes and limits

The server now calls viem's chain-aware SIWE verifier at the same safe block used for ownership. A local contract test issues FDP1 to an ERC-1271 wallet and downloads with its owner's signature. This supports contract-wallet sign-in; it does not provision passkeys or rescue existing lost ordinary wallets. A fresh challenge replaces an earlier challenge for the same address. One connecting IP may request at most twenty challenges in a two-minute window. The server ignores caller-supplied forwarding headers. These controls reduce a single-client exhaustion attack, but a public service still needs network-edge abuse protection and load tests.

The package is about 25 MB, so whole-file memory loading and lack of HTTP Range are acceptable for the local coursework pilot. Large commercial games would require streamed and resumable downloads, signed short-lived requests, bandwidth quotes and stronger RPC redundancy. They are not implemented here. The existing evidence demonstrates a local handover; a remote-host expansion was excluded from this work.

## Sources and legal checks

- [EU place-of-taxation guidance](https://taxation-customs.ec.europa.eu/taxation/vat/vat-directive/place-taxation_en) and [VAT special schemes](https://taxation-customs.ec.europa.eu/taxation/vat/vat-special-schemes_en).
- [EU consumer-rights guidance on immediate digital content and withdrawal](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=OJ:JOC_2021_525_R_0001). Any paid checkout would require transaction-specific review and express consent, acknowledgement and confirmation where applicable; a checkbox does not cure an unrecoverable token after a refund.
- [Viem public-client message verification](https://viem.sh/docs/actions/public/verifyMessage) and [SIWE verification](https://viem.sh/docs/siwe/actions/verifySiweMessage).
- [European Commission response to Stop Destroying Videogames](https://citizens-initiative.europa.eu/stop-destroying-videogames-commissions-reply-european-citizens-initiative_en). The initiative gathered 1,294,188 verified supporters; the response did not impose a general obligation to preserve games.
- [California AB 2426 official legislative analysis](https://sjud.senate.ca.gov/system/files/2024-06/ab-2426-irwin-sjud-analysis.pdf). It concerns disclosure of licence terms, with a permanent offline-download exception. It does not grant FDP1 distribution rights.
