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
});

