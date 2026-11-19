import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { isAddressEqual, keccak256, stringToHex, zeroAddress, zeroHash } from "viem";
import PreservationLicence from "../ignition/modules/PreservationLicence.js";

import LicenceTransferDemo from "../ignition/modules/LicenceTransferDemo.js";

const { viem, networkHelpers, ignition } = await network.create();

function reference(label: string) {
  return keccak256(stringToHex(label));
}

async function deploySmallEdition() {
  const [issuer, walletA, walletB] = await viem.getWalletClients();
  const licence = await viem.deployContract("PreservationLicence", [
    3n,
    1n,
    issuer.account.address,
  ]);

  return { licence, issuer, walletA, walletB };
}

describe("PreservationLicence", () => {
  it("deploys the pilot with whole licences and the notebook's allocation", async () => {
    const { licence } = await ignition.deploy(PreservationLicence);

    assert.equal(await licence.read.name(), "Freedoom Phase 1 Pilot Licence");
    assert.equal(await licence.read.symbol(), "FDP1");
    assert.equal(await licence.read.decimals(), 0);
    assert.equal(await licence.read.cap(), 1_200n);
    assert.equal(await licence.read.legacyCap(), 200n);
    assert.equal(await licence.read.paidCap(), 1_000n);
    assert.equal(await licence.read.totalSupply(), 0n);
  });

  it("restricts both issuance paths to the rights-holder wallet", async () => {
    const { licence, walletA } = await networkHelpers.loadFixture(deploySmallEdition);
    const holder = walletA.account.address;
    const fromHolder = { account: walletA.account };

    await viem.assertions.revertWithCustomError(
      licence.write.issueLegacy([holder, reference("legacy")], fromHolder),
      licence,
      "OwnableUnauthorizedAccount",
    );
    await viem.assertions.revertWithCustomError(
      licence.write.issuePaid([holder, reference("order")], fromHolder),
      licence,
      "OwnableUnauthorizedAccount",
    );
    assert.equal(await licence.read.totalSupply(), 0n);
  });

  it("keeps legacy capacity available after all paid slots are used", async () => {
    const { licence, walletA, walletB } = await networkHelpers.loadFixture(deploySmallEdition);
    const holder = walletA.account.address;

    await licence.write.issuePaid([holder, reference("order-1")]);
    await licence.write.issuePaid([holder, reference("order-2")]);
    await viem.assertions.revertWithCustomError(
      licence.write.issuePaid([holder, reference("order-3")]),
      licence,
      "PaidCapacityExhausted",
    );
    assert.equal(await licence.read.totalSupply(), 2n);

    await licence.write.issueLegacy([walletB.account.address, reference("legacy-1")]);
    assert.equal(await licence.read.totalSupply(), 3n);
    assert.equal(await licence.read.legacyIssued(), 1n);
    assert.equal(await licence.read.paidIssued(), 2n);
    await viem.assertions.revertWithCustomError(
      licence.write.issueLegacy([walletB.account.address, reference("legacy-2")]),
      licence,
      "LegacyCapacityExhausted",
    );
  });

  it("rejects a replay of either reference even if the destination changes", async () => {
    const { licence, walletA, walletB } = await networkHelpers.loadFixture(deploySmallEdition);
    const legacyId = reference("legacy-1");
    const orderId = reference("order-1");

    await licence.write.issueLegacy([walletA.account.address, legacyId]);
    await licence.write.issuePaid([walletA.account.address, orderId]);

    await viem.assertions.revertWithCustomError(
      licence.write.issueLegacy([walletB.account.address, legacyId]),
      licence,
      "ReferenceAlreadyUsed",
    );
    await viem.assertions.revertWithCustomError(
      licence.write.issuePaid([walletB.account.address, orderId]),
      licence,
      "ReferenceAlreadyUsed",
    );
    assert.equal(await licence.read.balanceOf([walletB.account.address]), 0n);
  });

  it("leaves capacity and the order reference available if issuance fails", async () => {
    const { licence, walletA } = await networkHelpers.loadFixture(deploySmallEdition);
    const orderId = reference("valid-order");

    await viem.assertions.revertWithCustomError(
      licence.write.issueLegacy([walletA.account.address, zeroHash]),
      licence,
      "EmptyReference",
    );
    await viem.assertions.revertWithCustomError(
      licence.write.issuePaid([zeroAddress, orderId]),
      licence,
      "ERC20InvalidReceiver",
    );
    assert.equal(await licence.read.usedPaidOrder([orderId]), false);
    assert.equal(await licence.read.paidIssued(), 0n);
    await licence.write.issuePaid([walletA.account.address, orderId]);
    assert.equal(await licence.read.paidIssued(), 1n);
  });

  it("moves an entitlement without issuing another licence", async () => {
    const { licence, walletA, walletB } = await networkHelpers.loadFixture(deploySmallEdition);
    const buyer = walletA.account.address;
    const recipient = walletB.account.address;

    await licence.write.issuePaid([buyer, reference("demo-order")]);
    assert.equal(await licence.read.balanceOf([buyer]), 1n);
    await licence.write.transfer([recipient, 1n], { account: walletA.account });

    assert.equal(await licence.read.balanceOf([buyer]), 0n);
    assert.equal(await licence.read.balanceOf([recipient]), 1n);
    assert.equal(await licence.read.totalSupply(), 1n);
    assert.equal(await licence.read.paidIssued(), 1n);
  });

  it("moves issuer authority only when the new issuer accepts it", async () => {
    const { licence, issuer, walletA, walletB } =
      await networkHelpers.loadFixture(deploySmallEdition);
    const nextOwner = walletA.account.address;
    const orderId = reference("first-order-after-handover");

    await licence.write.transferOwnership([nextOwner]);
    assert.ok(isAddressEqual(await licence.read.owner(), issuer.account.address));
    await licence.write.acceptOwnership({ account: walletA.account });
    assert.ok(isAddressEqual(await licence.read.owner(), nextOwner));

    await viem.assertions.revertWithCustomError(
      licence.write.issuePaid([walletB.account.address, orderId]),
      licence,
      "OwnableUnauthorizedAccount",
    );
    await licence.write.issuePaid([walletB.account.address, orderId], { account: walletA.account });
    assert.equal(await licence.read.balanceOf([walletB.account.address]), 1n);
  });

  it("runs the full testnet demo module with two distinct holders", async () => {
    const [, walletA, walletB] = await viem.getWalletClients();
    const { licence } = await ignition.deploy(LicenceTransferDemo);

    assert.equal(await licence.read.balanceOf([walletA.account.address]), 0n);
    assert.equal(await licence.read.balanceOf([walletB.account.address]), 1n);
    assert.equal(await licence.read.paidIssued(), 1n);
    assert.equal(await licence.read.legacyIssued(), 0n);
  });


  it("rejects invalid caps and documents independent issuance references", async () => {
    const { licence, walletA } = await networkHelpers.loadFixture(deploySmallEdition);
    await assert.rejects(viem.deployContract("PreservationLicence", [0n, 0n, walletA.account.address]));
    await assert.rejects(viem.deployContract("PreservationLicence", [1n, 2n, walletA.account.address]));
    const sharedReference = reference("same-value-separate-purchase-classes");
    await licence.write.issueLegacy([walletA.account.address, sharedReference]);
    await licence.write.issuePaid([walletA.account.address, sharedReference]);
    assert.equal(await licence.read.totalSupply(), 2n);
  });

  it("stops issuance after owner renunciation while holders can transfer", async () => {
    const { licence, walletA, walletB } = await networkHelpers.loadFixture(deploySmallEdition);
    await licence.write.issuePaid([walletA.account.address, reference("pre-renunciation")]);
    await licence.write.renounceOwnership();
    assert.ok(isAddressEqual(await licence.read.owner(), zeroAddress));
    await viem.assertions.revertWithCustomError(
      licence.write.issuePaid([walletB.account.address, reference("after-renunciation")]),
      licence, "OwnableUnauthorizedAccount",
    );
    await licence.write.transfer([walletB.account.address, 1n], { account: walletA.account });
    assert.equal(await licence.read.balanceOf([walletB.account.address]), 1n);
  });

  it("preserves supply and capacity across a seeded sequence of issues and transfers", async () => {
    const [issuer, ...players] = await viem.getWalletClients();
    const wallets = players.slice(0, 3);
    const licence = await viem.deployContract("PreservationLicence", [30n, 10n, issuer.account.address]);
    let seed = 42;
    for (let step = 0; step < 80; step++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const player = wallets[seed % wallets.length];
      const legacy = step % 3 === 0;
      const issued = legacy ? await licence.read.legacyIssued() : await licence.read.paidIssued();
      const cap = legacy ? 10n : 20n;
      if (step % 2 === 0 && issued < cap) {
        const args = [player.account.address, reference("sequence-" + step)] as const;
        if (legacy) await licence.write.issueLegacy(args);
        else await licence.write.issuePaid(args);
      } else if (await licence.read.balanceOf([player.account.address]) > 0n) {
        const recipient = wallets[(seed + 1) % wallets.length];
        await licence.write.transfer([recipient.account.address, 1n], { account: player.account });
      }
      const supply = await licence.read.totalSupply();
      assert.equal(supply, await licence.read.legacyIssued() + await licence.read.paidIssued());
      assert.ok(supply <= 30n);
      assert.ok(await licence.read.legacyIssued() <= 10n);
      assert.ok(await licence.read.paidIssued() <= 20n);
      const balances = await Promise.all(wallets.map(w => licence.read.balanceOf([w.account.address])));
      assert.equal(balances.reduce((sum, value) => sum + value, 0n), supply);
    }
  });


  it("serves the new holder through the HTTP archive after an actual local-chain transfer", async () => {
    const { licence, walletA, walletB } = await networkHelpers.loadFixture(deploySmallEdition);
    const { createArchiveServer } = await import("../archive/server.mjs");
    const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { once } = await import("node:events");
    const { createHash } = await import("node:crypto");
    const publicClient = await viem.getPublicClient();
    const directory = await mkdtemp(join(tmpdir(), "fdp1-chain-access-"));
    const payload = Buffer.from("Saved offline package fixture");
    const sha256 = createHash("sha256").update(payload).digest("hex");
    const fileName = "freedoom-phase1-pilot-win64.zip";
    await writeFile(join(directory, fileName), payload);
    await writeFile(join(directory, "manifest.json"), JSON.stringify({
      fileName, bytes: payload.length, sha256,
    }));
    // The local test chain mines immediately. Use its latest block as safe in this fixture.
    const client = {
      getBlock: () => publicClient.getBlock(),
      readContract: (args: any) => publicClient.readContract({ ...args, address: licence.address }),
    };
    const server = await createArchiveServer({ role: "primary", directory, client });
    try {
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const origin = "http://127.0.0.1:" + (server.address() as any).port;
      const download = async (wallet: typeof walletA) => {
        const r = await fetch(origin + "/challenge?address=" + wallet.account.address);
        assert.equal(r.status, 200);
        const { nonce, message } = await r.json() as any;
        const signature = await wallet.signMessage({ message });
        return fetch(origin + "/download", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nonce, signature }),
        });
      };
      await licence.write.issuePaid([walletA.account.address, reference("http-order")]);
      const before = await download(walletA);
      assert.equal(before.status, 200);
      const saved = Buffer.from(await before.arrayBuffer());
      await licence.write.transfer([walletB.account.address, 1n], { account: walletA.account });
      assert.equal((await download(walletA)).status, 403);
      const after = await download(walletB);
      assert.equal(after.status, 200);
      assert.deepEqual(Buffer.from(await after.arrayBuffer()), saved);
      assert.deepEqual(saved, payload);
    } finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      assert.ok(directory.startsWith(join(tmpdir(), "fdp1-chain-access-")));
      await rm(directory, { recursive: true, force: true });
    }
  });
});

