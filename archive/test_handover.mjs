import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createWalletClient, http, isAddressEqual, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { backupRpc, chainId, checkSepolia, connectSepolia, contract, primaryRpc } from "./sepolia.mjs";

const credentials = [
  ["SEPOLIA_PRIVATE_KEY", "0x3BCb335bb8a463E6AB6Cdee0D4ad65c2bc2F1BE9"],
  ["SEPOLIA_DEMO_HOLDER_A_PRIVATE_KEY", "0x4e4204bb27B76e9bfcC91f49536B72fD0b9961A3"],
  ["SEPOLIA_DEMO_HOLDER_B_PRIVATE_KEY", "0x485f4Cff16cc001df068641FE91c81e6A741a53a"],
];
const [issuer, walletA, walletB] = credentials.map(([name, address]) => {
  const key = process.env[name];
  if (!/^0x[0-9a-fA-F]{64}$/.test(key ?? "")) throw new Error("Load the dedicated project test wallets.");
  const account = privateKeyToAccount(key);
  assert.ok(isAddressEqual(account.address, address), "Expected the wallet recorded for this pilot.");
  return account;
});

const root = resolve("archive-evidence");
await mkdir(root, { recursive: true });
const evidenceDir = await mkdtemp(resolve(root, "handover-"));
const record = {
  startedAt: new Date().toISOString(),
  chainId,
  contract: contract.address,
  walletA: walletA.address,
  walletB: walletB.address,
  steps: [],
};
const evidencePath = resolve(evidenceDir, "handover.json");
const hosts = [];

async function save(step, details = {}) {
  record.steps.push({ step, ...details });
  await writeFile(evidencePath, JSON.stringify(record, null, 2) + "\n");
  console.log(step, JSON.stringify(details));
}

async function stop({ child, exited }) {
  if (child.exitCode === null && child.signalCode === null) child.kill();
  await exited;
}

async function start(role, rpc) {
  const directory = resolve("archive-data", role);
  const server = fileURLToPath(new URL("./server.mjs", import.meta.url));
  // Archive processes get only public network configuration and their own data folder.
  const child = spawn(process.execPath, [server, role, directory, rpc], {
    cwd: directory,
    env: { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const exited = once(child, "exit");
  const host = { child, exited, directory };
  hosts.push(host);
  let stderr = "";
  child.stderr.on("data", (part) => { stderr += part.toString(); });

  const lines = createInterface({ input: child.stdout });
  const abort = new AbortController();
  let line;
  try {
    [line] = await Promise.race([
      once(lines, "line", { signal: abort.signal }),
      exited.then(() => { throw new Error(role + " archive exited during start: " + stderr); }),
      delay(45_000, undefined, { signal: abort.signal }).then(() => {
        throw new Error(role + " archive did not become ready.");
      }),
    ]);
  } finally {
    abort.abort();
    lines.close();
  }
  Object.assign(host, JSON.parse(line));
  assert.equal(host.ready, true);
  await save(role + " started", {
    pid: child.pid, origin: host.origin, directory, rpc, sha256: host.sha256,
  });
  return host;
}

async function signedProof(host, address, signingWallet) {
  const challenge = await fetch(host.origin + "/challenge?address=" + address, {
    signal: AbortSignal.timeout(12_000),
  });
  assert.equal(challenge.status, 200);
  const { nonce, message } = await challenge.json();
  return { nonce, signature: await signingWallet.signMessage({ message }) };
}

function requestDownload(host, proof) {
  return fetch(host.origin + "/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(proof),
    signal: AbortSignal.timeout(30_000),
  });
}

async function verifyDownload(host, proof, afterBlock) {
  const response = await requestDownload(host, proof);
  assert.equal(response.status, 200, host.role + " must serve the current holder");
  assert.equal(response.headers.get("x-archive-role"), host.role);
  assert.equal(response.headers.get("x-archive-sha256"), host.sha256);
  const blockNumber = BigInt(response.headers.get("x-ownership-block"));
  assert.ok(blockNumber >= afterBlock);
  const data = Buffer.from(await response.arrayBuffer());
  assert.equal(createHash("sha256").update(data).digest("hex"), host.sha256);
  return {
    data, details: {
      httpStatus: response.status, ownershipBlock: blockNumber.toString(),
      balance: response.headers.get("x-fdp1-balance"), bytes: data.length, sha256: host.sha256,
    },
  };
}

async function verifyDenied(host, proof, status) {
  const response = await requestDownload(host, proof);
  assert.equal(response.status, status);
  assert.match(response.headers.get("content-type"), /^application\/json\b/);
  return { httpStatus: response.status, ...await response.json() };
}

const publicClient = connectSepolia(primaryRpc);
const backupClient = connectSepolia(backupRpc);
const balance = (account) => publicClient.readContract({
  ...contract, functionName: "balanceOf", args: [account.address],
});
const txClient = (account) => createWalletClient({ account, chain: sepolia, transport: http(primaryRpc) });

async function confirmed(hash, label) {
  await save(label + " submitted", { hash });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 2, timeout: 110_000 });
  assert.equal(receipt.status, "success", label);
  await save(label + " confirmed", { hash, blockNumber: receipt.blockNumber.toString() });
  return receipt.blockNumber;
}

async function transfer(from, to, label) {
  assert.equal(await balance(from), 1n);
  assert.equal(await balance(to), 0n);
  if (await publicClient.getBalance({ address: from.address }) < parseEther("0.0001")) {
    const hash = await txClient(issuer).sendTransaction({ to: from.address, value: parseEther("0.001") });
    await confirmed(hash, "Test gas top-up for " + from.address);
  }
  const hash = await txClient(from).writeContract({
    ...contract, functionName: "transfer", args: [to.address, 1n],
  });
  return confirmed(hash, label);
}

try {
  await Promise.all([checkSepolia(publicClient), checkSepolia(backupClient)]);
  assert.ok(isAddressEqual(await publicClient.readContract({ ...contract, functionName: "owner" }), issuer.address));

  const primary = await start("primary", primaryRpc);
  const backup = await start("backup", backupRpc);
  assert.notEqual(primary.directory, backup.directory);
  assert.notEqual(primary.child.pid, backup.child.pid);
  const manifest = JSON.parse(await readFile(resolve("archive-data", "primary", "manifest.json"), "utf8"));
  assert.equal(primary.sha256, manifest.sha256);
  assert.equal(backup.sha256, manifest.sha256);
  record.package = manifest;

  const [initialA, initialB, supply] = await Promise.all([
    balance(walletA), balance(walletB),
    publicClient.readContract({ ...contract, functionName: "totalSupply" }),
  ]);
  assert.equal(initialA + initialB, 1n, "Expected one demo licence across the two test wallets.");
  await save("Observed initial Sepolia balances", {
    walletA: initialA.toString(), walletB: initialB.toString(), totalSupply: supply.toString(),
  });

  const setupBlock = initialB === 1n
    ? await transfer(walletB, walletA, "Setup transfer from B to A")
    : await publicClient.getBlockNumber();
  const primaryProof = await signedProof(primary, walletA.address, walletA);
  const original = await verifyDownload(primary, primaryProof, setupBlock);
  await save("Primary served wallet A", original.details);
  await save("Primary rejected replay of its used challenge", await verifyDenied(primary, primaryProof, 401));
  await save("Backup rejected a primary challenge", await verifyDenied(backup, primaryProof, 401));
  const wrongWallet = await signedProof(primary, walletA.address, walletB);
  await save("Primary rejected signature from wrong wallet", await verifyDenied(primary, wrongWallet, 401));

  await stop(primary);
  await assert.rejects(fetch(primary.origin + "/health", { signal: AbortSignal.timeout(5_000) }),
    (error) => error.cause?.code === "ECONNREFUSED");
  assert.equal((await fetch(backup.origin + "/health", { signal: AbortSignal.timeout(5_000) })).status, 200);
  await save("Primary stopped and refused connections while backup stayed online");

  const transferBlock = await transfer(walletA, walletB, "Handover from A to B with primary stopped");
  const deadline = Date.now() + 35_000;
  while (await backupClient.getBlockNumber() < transferBlock) {
    assert.ok(Date.now() < deadline, "Backup RPC did not catch up to the transfer.");
    await delay(1_500);
  }

  const newProof = await signedProof(backup, walletB.address, walletB);
  const restored = await verifyDownload(backup, newProof, transferBlock);
  assert.ok(restored.data.equals(original.data), "Independent copies must serve identical bytes.");
  const downloaded = resolve(evidenceDir, "backup-download.zip");
  await writeFile(downloaded, restored.data);
  await save("Backup served new holder B with an identical SHA-256 and identical bytes", {
    ...restored.details, downloaded,
  });

  const previousProof = await signedProof(backup, walletA.address, walletA);
  const denied = await verifyDenied(backup, previousProof, 403);
  assert.ok(BigInt(denied.block) >= transferBlock);
  assert.equal(denied.balance, "0");
  await save("Backup denied the former holder A", denied);

  assert.equal(await publicClient.readContract({ ...contract, functionName: "totalSupply" }), supply);
  assert.equal(await balance(walletA), 0n);
  assert.equal(await balance(walletB), 1n);
  await save("Handover passed", { walletA: "0", walletB: "1", totalSupply: supply.toString() });
  console.log("Evidence directory " + evidenceDir);
} finally {
  await Promise.allSettled(hosts.map(stop));
}
