# FDP1 archive handover and offline launch

The test used the deployed FDP1 contract on Ethereum Sepolia and the one existing
demo licence. Two local archive processes on the same Windows PC each held
their own package and manifest. The primary queried PublicNode and the backup
queried Nodies for the on-chain balance. [FDP1 on Sepolia](https://sepolia.etherscan.io/address/0x5DfF8B39c7e37787553425979bE6b9F6b9441ecc)

| Check | Observed result |
| --- | --- |
| Wallet A requested a download from the primary with one FDP1 | HTTP 200 and 25,033,364 bytes |
| Reused challenge, request signed by the wrong wallet, and primary challenge sent to the backup | HTTP 401 in all three checks |
| Primary archive process stopped | Primary connection refused. Backup health check returned HTTP 200. |
| The existing licence transferred from A to B while the primary was stopped | Confirmed on Sepolia at block 12,155,007. [Transfer receipt](https://sepolia.etherscan.io/tx/0x9b6ee7afc5998ed7c21fae3c13ac665d406c9da48e9c8dd922d4993a01d8fee8) |
| Wallet B proved control of its wallet and downloaded from the backup | HTTP 200 and the same package bytes and SHA-256 as the primary |
| Former holder A requested a new download | HTTP 403 with a confirmed balance of zero |
| Total issued supply after the test | One FDP1 held by wallet B |

The SHA-256 of the package served by both archives was
`bdb6c948d4f976b4984c847ac1f353747809cf1ccedde67d58f0f2389e006b5b`.
[Handover log](handover.json) · [Package manifest](package-manifest.json)

## Offline extraction and playback

The actual backup download was extracted into an empty directory inside a fresh
Windows x64 AppContainer. The host could reach the test HTTP listener, while the
AppContainer's connection timed out. The installed game was started in the same
network-restricted profile. It opened using the SDL Windows video driver and ran
all **7,117 game ticks** of Freedoom's included DEMO1. The automated run ran
with audio disabled. Crispy Doom reports the completed timed demo through its exit
message, which the test checks in the engine log.
[Offline record](offline-0k4u2gug/offline.json) · [Engine log](offline-0k4u2gug/engine.log) · [Network probe](offline-0k4u2gug/network.log)

The package combines Freedoom Phase 1 v0.13.0 with Crispy Doom 7.2.0 for
Windows x64 and includes the upstream notices and matching engine source.
[Freedoom release](https://github.com/freedoom/freedoom/releases/tag/v0.13.0) · [Crispy Doom release](https://github.com/fabiangreffrath/crispy-doom/releases/tag/crispy-doom-7.2)

Windows AppContainer applies the process-level network isolation used in
the clean launch test. [Microsoft AppContainer documentation](https://learn.microsoft.com/en-us/windows/win32/secauthz/appcontainer-isolation)

The archive ZIP can be rebuilt from pinned upstream releases using the [package builder](../../archive/build_package.py). The JSON records retain the original output locations as paths relative to the project root. [First offline attempt](offline-w2md3xl0/offline.json) records the earlier diagnostic run. The engine logs abbreviate the temporary test directory.
