# FDP1 player guide

FDP1 is a Sepolia test token used in a coursework demonstration. One whole token lets its current holder request the pilot archive package. The package contains Freedoom Phase 1 and Crispy Doom for Windows x64. There is no public game shop or paid licence sale.

1. Hold one FDP1 in a wallet you control. The archive can accept an ordinary wallet or an ERC-1271 contract wallet that can sign its challenge.
2. Request a fresh challenge and sign the message in your wallet. Check the archive address, chain and purpose shown by the wallet. The challenge expires after two minutes, works once and replaces an earlier challenge for the same address.
3. The archive checks the signature and your FDP1 balance at Ethereum's safe block, then sends the ZIP. A recent transfer may take time to appear at the safe block. If you see an eligibility or delayed-chain message, wait and request a new challenge.
4. Save the package and its SHA-256 fingerprint. After download, the offline files can run without an archive check. Their permitted use follows the licences supplied with the package.

You may transfer FDP1 to another wallet. After the safe block recognises the transfer, the recipient can request future downloads and approved free updates. The former holder loses that future archive access if they hold no FDP1. The transfer cannot erase a file already downloaded. It does not transfer copyright or give exclusive ownership of game files. Separately sold DLC would need its own entitlement.

If you lose a device but still have your wallet recovery method, restore the same wallet in trusted software. If another authorised device can still sign, transfer to a new wallet. For a future paid release, the proposed option is to receive FDP1 in a recoverable smart account **before** any key is lost. Its preselected guardians could replace a lost signer after a delay while the token stays at the same account address. This recovery option has not been deployed or tested with a real recovery in the pilot. If no device or key can sign for an ordinary wallet, staff cannot seize or replace its token. Never give staff your seed phrase or private key. A Discord or Steam tag may help staff find a private support record; it cannot authorize recovery or move a token. See the [recovery policy](ENTITLEMENT-AND-RECOVERY.md) for the proposed guardian setup and its limits.

This demonstration uses two local archive processes on one PC. A paid publisher release would need its own written licence, funded service term, customer support and distribution arrangements.
