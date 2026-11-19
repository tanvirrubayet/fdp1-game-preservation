# FDP1 entitlement and recovery policy

Effective for the coursework prototype from 19 November 2026. The issuer verifies purchases and issues tokens. The preservation agency operates archive access and maintains approved packages. Financial values in the notebook are editable examples.

## What holding FDP1 provides

One whole FDP1 provides access to the archive's preserved base-game edition, approved hotfixes, compatibility fixes and free updates. Downloads do not consume the token. Updates change the available packages and require no extra FDP1 issuance. The archive retains approved earlier releases with versioned manifests so holders can recover a working version.

Transferring the last FDP1 ends that wallet's eligibility for future archive downloads and updates once the transfer is recognised by the archive. A former holder can acquire an existing token again or purchase a newly issued token while paid capacity remains. Downloaded files remain technically playable. Their permitted use follows the upstream software licence or the publisher agreement for that edition.

Freedoom and Crispy Doom recipients retain the rights granted by their software licences, including redistribution under those terms. A future proprietary edition needs publisher permission covering the exact files, transfers, updates and continued archive distribution. Separately sold DLC needs its own entitlement. This pilot represents one base-game edition.

## Transfers and service interruptions

Each download requires a fresh wallet proof and a fresh balance check. The archive uses Ethereum's safe block and rejects a provider whose latest block is over two minutes old. Until the safe state includes a transfer, eligibility can reflect the previous holder. Users should wait and request a new challenge. A transfer cannot interrupt a download already authorised or remove files already saved. Safe blocks offer stronger confirmation than latest state and may still be reorganised.

When blockchain checks fail, the archive returns HTTP 503 and asks the player to retry. Saved offline files continue to work. The service uses ordinary Ethereum accounts in this pilot. Smart-wallet recovery requires a separately tested integration.

## Recovery decisions

| Situation | Action and current capability |
| --- | --- |
| Lost device with recovery phrase available | Restore the same wallet in trusted wallet software. Both archives recognise that address without another issue. Staff never request the phrase or private key. |
| Lost phrase but another authorised device still signs | Transfer the entitlement to a new wallet and verify the recipient before retiring the old device. |
| No remaining way to sign | Log a private support case. The deployed token cannot seize, cancel or move the lost balance. A receipt or social account does not enable a replacement issue. The holder can use previously saved files according to their licence. |
| Discord or Steam identity evidence | Accept only a stable account ID linked and verified before the loss as supporting evidence. Keep it private, with restricted access and a retention policy. It does not grant control over the wallet. |
| Wrong address issued by mistake | Check the original order and chain receipt. Seek a voluntary return from the recipient. The contract cannot reverse the mint. Keep the case unresolved or refund under the agreed terms if recovery fails. |
| Duplicate charge | Refund the duplicate payment through the checkout processor and reuse the existing order reference. Check the chain before retrying issuance after a timeout. |
| Refund after a successful issue | Record the refund and the entitlement status together. Returning a token to an operator address does not restore paid capacity. A refund alone cannot revoke the token. Any ongoing access follows the agreed refund terms and the contract's actual capabilities. |
| Unclaimed legacy capacity | Keep the 200 protected slots available. Unused slots cannot be converted to paid capacity in this contract. |
| Issuer key lost | Already issued tokens can transfer and authenticate while the chain and archive work. New issuance and owner actions stop. Restore the same issuer from its protected backup if available. |
| Issuer succession | Begin Ownable2Step handover while the current issuer can still sign. Verify the proposed address, obtain acceptance, and reconcile issued references. Maintain a tested key backup and two-person approval for operational signing. |
| Chain or contract migration | Prepare a published snapshot and explicit migration terms. Deactivate the old entitlement at every participating archive before accepting a replacement. The deployed contract has no administrative cancellation function. A replacement system requires separate implementation and tests. |

Before any issuer-assisted replacement becomes available, implement and test a single authoritative entitlement transition that all archives recognise. Preserve one entitlement per verified purchase and reject repeat claims after a transfer. Generate a random 32-byte reference once per verified order, store its private mapping, and reuse that reference on every retry. Separate legacy and paid references remain separate issuance classes.

## Funding and continuity decisions

The reserve is an off-chain cash budget. The issuer pays the agreed primary-sale royalty and checkout costs. Transfers generate zero model revenue. Staff reconcile cash, refunds, royalty payments and issuance events monthly. Refunds after issue consume cash and leave lifetime minted capacity occupied.

The notebook calculates a proposed intervention floor equal to six coming months of recurring bills, any scheduled free-claim delivery in that interval and a EUR 600 exit budget. Six months gives operators time to seek committed funding or organise an orderly handover. EUR 600 is an illustrative provision for export, administration and final delivery. Replace both with agreed service commitments and quotations before selling access.

When the reserve reaches that floor, review the forecast, contact the responsible partners and publish a service notice. Obtain committed funding or agree a funded service period before accepting additional long-term obligations. Record a wind-down decision before cash exhaustion if funding is unavailable. Provide holders with the last permitted package, manifests and licence notices while funds and permissions allow. Specify the funded service term in commercial terms. An unfunded model continuation records a shortfall, rather than a bill actually paid.
