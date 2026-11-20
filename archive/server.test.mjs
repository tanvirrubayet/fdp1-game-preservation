import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyMessage } from "viem";
import { createArchiveServer } from "./server.mjs";
import { packageName } from "./sepolia.mjs";

// These generated wallets are disposable test identities with no network funds.
const alice = privateKeyToAccount(generatePrivateKey());
const bob = privateKeyToAccount(generatePrivateKey());
const smartAddress = "0x0000000000000000000000000000000000001271";
let directory, server, origin, clock;
let holder = alice.address, safeNumber = 10n, latestNumber = 11n;
let unavailable = false, stale = false;
const packageBytes = Buffer.from("Offline package fixture for access tests");
const fingerprint = createHash("sha256").update(packageBytes).digest("hex");

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "fdp1-auth-"));
  await writeFile(join(directory, packageName), packageBytes);
  await writeFile(join(directory, "manifest.json"), JSON.stringify({
    fileName: packageName, bytes: packageBytes.length, sha256: fingerprint,
  }));
  clock = Date.now();
  const client = {
    async getBlock({ blockTag }) {
      if (unavailable) throw new Error("Injected RPC outage");
      return { number: blockTag === "safe" ? safeNumber : latestNumber,
        timestamp: BigInt(Math.floor(clock / 1000) - (stale ? 121 : 0)) };
    },
    async readContract({ args, blockNumber }) {
      assert.equal(blockNumber, safeNumber);
      return args[0] === holder ? 1n : 0n;
    },
    async verifySiweMessage({ address, message, signature, blockNumber }) {
      assert.equal(blockNumber, safeNumber);
      if (address === smartAddress) return signature === "0x1271";
      return verifyMessage({ address, message, signature });
    },
  };
  server = await createArchiveServer({ role: "primary", directory, client, now: () => clock });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = "http://127.0.0.1:" + server.address().port;
});

after(async () => {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  if (directory) {
    assert.ok(directory.startsWith(join(tmpdir(), "fdp1-auth-")));
    await rm(directory, { recursive: true, force: true });
  }
});

async function proof(wallet = alice, alter = message => message) {
  const r = await fetch(origin + "/challenge?address=" + wallet.address);
  assert.equal(r.status, 200);
  const { nonce, message } = await r.json();
  return { nonce, signature: await wallet.signMessage({ message: alter(message) }) };
}

function download(body) {
  return fetch(origin + "/download", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

test("one proof authorises only one concurrent request", async () => {
  const request = await proof();
  const responses = await Promise.all([download(request), download(request)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 401]);
});

test("expired challenge is rejected", async () => {
  const request = await proof();
  clock += 120_001;
  assert.equal((await download(request)).status, 401);
});

test("changing the signed domain or chain fails verification", async () => {
  for (const change of [s => s.replace("127.0.0.1", "example.org"),
                         s => s.replace("Chain ID: 11155111", "Chain ID: 1")]) {
    assert.equal((await download(await proof(alice, change))).status, 401);
  }
});

test("RPC outage returns a retryable service error and consumes the proof", async () => {
  const request = await proof();
  unavailable = true;
  try { assert.equal((await download(request)).status, 503); }
  finally { unavailable = false; }
  assert.equal((await download(request)).status, 401);
});

test("stale provider and inconsistent block numbers are rejected", async () => {
  stale = true;
  try { assert.equal((await download(await proof())).status, 503); }
  finally { stale = false; }
  safeNumber = 12n;
  try { assert.equal((await download(await proof())).status, 503); }
  finally { safeNumber = 10n; }
});

test("eligibility changes at safe state while the previous download remains intact", async () => {
  const saved = Buffer.from(await (await download(await proof())).arrayBuffer());
  const oldProof = await proof(alice);
  // A transfer visible at latest state has not yet changed the simulated safe state.
  assert.equal((await download(await proof(bob))).status, 403);
  holder = bob.address;
  safeNumber = 11n;
  assert.equal((await download(oldProof)).status, 403);
  const current = await download(await proof(bob));
  assert.equal(current.status, 200);
  assert.equal(current.headers.get("x-ownership-policy"), "safe");
  assert.deepEqual(Buffer.from(await current.arrayBuffer()), saved);
  assert.deepEqual(saved, await readFile(join(directory, packageName)));
});

test("smart-wallet proof uses the chain-aware verifier at the safe block", async () => {
  holder = smartAddress;
  try {
    const challenge = await fetch(origin + "/challenge?address=" + smartAddress);
    assert.equal(challenge.status, 200);
    const { nonce } = await challenge.json();
    assert.equal((await download({ nonce, signature: "0x1271" })).status, 200);
  } finally { holder = bob.address; }
});

test("reissuing a challenge invalidates the old proof and limits one IP's requests", async () => {
  const oldProof = await proof(bob);
  const newProof = await proof(bob);
  assert.equal((await download(oldProof)).status, 401);
  assert.equal((await download(newProof)).status, 200);
  let limited = false;
  for (let i = 0; i < 20; i++) {
    // Distinct wallet addresses and spoofed forwarding headers share one TCP peer.
    const address = "0x" + (i + 1).toString(16).padStart(40, "0");
    const response = await fetch(origin + "/challenge?address=" + address, {
      headers: { "X-Forwarded-For": "192.0.2." + (i + 1) },
    });
    if (response.status === 429) { limited = true; break; }
  }
  assert.equal(limited, true);
  clock += 120_001;
  assert.equal((await fetch(origin + "/challenge?address=" + bob.address)).status, 200);
});
