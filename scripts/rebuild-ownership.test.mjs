import assert from "node:assert/strict";
import { test } from "node:test";
import { zeroAddress } from "viem";
import { rebuildBalances } from "./rebuild-ownership.mjs";

const alice = "0x0000000000000000000000000000000000000001";
const bob = "0x0000000000000000000000000000000000000002";

test("mint, transfer and issue classes rebuild one current owner", () => {
  const result = rebuildBalances([
    { eventName: "Transfer", args: { from: zeroAddress, to: alice, value: 1n } },
    { eventName: "PaidLicenceIssued", args: {} },
    { eventName: "Transfer", args: { from: alice, to: bob, value: 1n } },
  ]);
  assert.equal(result.supply, 1n);
  assert.equal(result.paidIssued, 1n);
  assert.deepEqual([...result.balances], [[bob, 1n]]);
});

test("missing or inconsistent events cannot produce a trusted snapshot", () => {
  assert.throws(() => rebuildBalances([
    { eventName: "Transfer", args: { from: alice, to: bob, value: 1n } },
  ]), /spends more/);
  assert.throws(() => rebuildBalances([
    { eventName: "Transfer", args: { from: zeroAddress, to: alice, value: 1n } },
  ]), /Issuance events/);
});
