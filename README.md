# FDP1 Game Preservation

FDP1 is an Option B coursework prototype for keeping a single-player PC game
available after a storefront closes. One whole ERC-20 token records the right
to download the pilot edition. An archive checks a wallet signature and the
wallet's current balance before serving a copy. The playable pilot combines
Freedoom Phase 1 and Crispy Doom.

## Coursework files

| File | What it contains |
| --- | --- |
| [Analytical white paper](docs/FDP1%20Analytical%20White%20Paper%20Concise.docx) | Five-page report covering token design, economics, governance, deployment results and AI-use declaration |
| [Project record and workflow](docs/FDP1%20Project%20Record%20and%20Workflow.docx) | Steps taken to build, deploy and test the prototype |
| [Project decisions](docs/Game%20Preservation%20Project%20Decisions.docx) | Early design choices and the reasons for them |
| [Python economics notebook](preservation_economics.ipynb) | Commented calculations, assumptions, sales scenarios, royalties and reserve simulations with saved outputs |
| [Solidity contract](contracts/PreservationLicence.sol) and [tests](test/PreservationLicence.ts) | Issuance, ERC-20 transfers and local contract tests |
| [Sepolia deployment snapshot](evidence/sepolia) and [archive test record](archive-evidence/handover-Lj0gBC/TEST-RESULTS.md) | Deployment addresses, transaction journal, archive handover and offline playback logs |

The analytical white paper was revised on 20 November and covers all ten Option B
sections in ten core pages, followed by references, appendices and the AI declaration.
The other Word documents record the 17 November pilot. The [current entitlement and
recovery policy](docs/ENTITLEMENT-AND-RECOVERY.md) and notebook Sections 12–15
record the 19 November improvements. See the
[improvement results](docs/IMPROVEMENTS.md) for executed scenarios and test scope,
and the [package licence inventory](docs/PACKAGE-LICENCES.md) for component checks.
The [second review implementation record](docs/SECOND-REVIEW-IMPLEMENTATION.md) explains
the newer tax, gas, demand and funded-term examples, archive sign-in changes and
the decisions that still need a real publisher or operator.

## Recorded Sepolia pilot

The [FDP1 contract](https://sepolia.etherscan.io/address/0x5DfF8B39c7e37787553425979bE6b9F6b9441ecc)
runs on Ethereum Sepolia, chain ID 11155111. Its decimals are zero and its cap
is 1,200 whole licences, including 200 protected prior-purchase claims and up
to 1,000 paid issues. The issuer checks purchase and order records off-chain.
Each issue creates one token. Transfers move an issued token without changing
the supply. The economics notebook models royalties and preservation costs.

| Recorded action | Block | Receipt |
| --- | ---: | --- |
| Deploy FDP1 | 12,154,860 | [Deployment](https://sepolia.etherscan.io/tx/0x7df923cd4c7c48242be4df8fd244023266f717b42f9e4bc568c050ff0a1df062) |
| Issue one pilot licence for a mock order | 12,154,865 | [Issue](https://sepolia.etherscan.io/tx/0x8f7871ad9413ae0c3a17568fe7f92b197f21ac7ddbe7ff768b13377d58d7fd85) |
| Transfer the licence | 12,154,871 | [Transfer](https://sepolia.etherscan.io/tx/0xd8861dafc93b02765c5882a4650b009bd1175ee581ca4fb9363df4f1ad878614) |
| Transfer again with the primary archive stopped | 12,155,007 | [Archive handover](https://sepolia.etherscan.io/tx/0x9b6ee7afc5998ed7c21fae3c13ac665d406c9da48e9c8dd922d4993a01d8fee8) |

The contract source is verified on
[Blockscout](https://eth-sepolia.blockscout.com/address/0x5DfF8B39c7e37787553425979bE6b9F6b9441ecc#code)
and [Sourcify](https://sourcify.dev/server/repo-ui/11155111/0x5DfF8B39c7e37787553425979bE6b9F6b9441ecc).
The archived Ignition state lives under `evidence/sepolia/`. New deployments
write their own state under `ignition/deployments/`.

## Run the economics notebook

Open the notebook above to read its saved results. To change the assumptions
and recalculate, use Python 3.13 and run these commands from the repository
root in PowerShell. In JupyterLab, run all cells from top to bottom.

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt jupyterlab
.\.venv\Scripts\python.exe -m jupyterlab preservation_economics.ipynb
```

## Build and test the contract

Use Node.js 24 and [pnpm 11.25.0](https://pnpm.io/installation). Run the
commands from the repository root. Contract tests use a local chain, including
an HTTP archive transfer demonstration.

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm test:archive
```

The contract uses OpenZeppelin's [ERC-20](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20)
and [two-step ownership](https://docs.openzeppelin.com/contracts/5.x/api/access#Ownable2Step).

## Rebuild the offline game package

```powershell
py -3.13 archive/build_package.py
```

The builder downloads specific upstream releases, checks their SHA-256
digests and creates `archive-data/freedoom-phase1-pilot-win64.zip` with a copy
for each archive. On Windows, extract the ZIP and open `Play.cmd` to play
offline. The [recorded package manifest](archive-evidence/handover-Lj0gBC/package-manifest.json)
lists the inputs and the digest of the ZIP used in the handover.

## Re-run the Sepolia demos

On Windows, the [issuer helper](scripts/sepolia-issuer.ps1) keeps dedicated
test-wallet keys encrypted under LocalAppData. Run the address command,
fund the displayed address with test ETH, then deploy and demonstrate a
transfer using the fresh local Ignition state.

```powershell
.\scripts\sepolia-issuer.ps1 -Action Address
.\scripts\sepolia-issuer.ps1 -Action Deploy
.\scripts\sepolia-issuer.ps1 -Action Demo
```

The recorded archive handover uses the original pilot contract and three
specific test wallets. The maintainer can replay that test with
`-Action TestArchive`. The [handover log](archive-evidence/handover-Lj0gBC/handover.json)
and [offline playback record](archive-evidence/handover-Lj0gBC/offline-0k4u2gug/offline.json)
are available for review. The test used separate processes and package copies
on one Windows PC.

To rebuild a current ownership snapshot from public events and compare it to
safe-block balances, run `node scripts/rebuild-ownership.mjs`. The
[recorded snapshot](evidence/sepolia/ownership-snapshot-2026-11-20.json) shows
the reconciled state on 20 November. The script uses Blockscout's indexed
history because the pilot's public RPC does not retain the older logs.

## Licence updates and operational checks

FDP1 covers the base-game edition and its approved patches and free updates.
The current holder can request new archive downloads. A transfer of the last
token ends future download eligibility after the safe blockchain state recognises
the transfer. Previously downloaded files remain technically playable under
their applicable licences. Paid DLC would have a separate entitlement.

The server verifies ordinary and ERC-1271 wallet signatures at the safe block,
checks ownership at that same block and rejects a latest block older than two
minutes. It limits challenge requests per connecting IP address and keeps one
live challenge per wallet. A delayed provider produces a retryable service error. See the
[policy](docs/ENTITLEMENT-AND-RECOVERY.md) for refunds, lost signing keys,
issuer succession and funding intervention.

The [player guide](docs/PLAYER-GUIDE.md) explains downloads, transfers and recovery
in plain language. This repository records a local prototype, not a public
checkout or a guaranteed future preservation service.

The project-authored code is available under the [MIT licence](LICENSE). The
[licensing scope](LICENSING.md) identifies third-party materials that retain
their own terms.

GitHub Actions executes the contract, archive and financial checks on pushes
and pull requests. Run the financial check locally with the notebook environment.

```powershell
python scripts/check_notebook.py
```
