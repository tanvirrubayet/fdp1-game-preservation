import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { getAddress, isAddress, verifyMessage } from "viem";
import { createSiweMessage, generateSiweNonce } from "viem/siwe";
import { checkSepolia, chainId, connectSepolia, contract, packageName } from "./sepolia.mjs";

const [role, directory, rpc] = process.argv.slice(2);
if (!["primary", "backup"].includes(role) || !directory || !rpc) {
  throw new Error("Usage: node archive/server.mjs primary|backup <package directory> <Sepolia RPC>");
}
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8"));
const packageBytes = await readFile(resolve(directory, packageName));
const digest = createHash("sha256").update(packageBytes).digest("hex");
if (manifest.fileName !== packageName || manifest.sha256 !== digest || manifest.bytes !== packageBytes.length) {
  throw new Error("The archive's local package does not match its manifest.");
}

const client = connectSepolia(rpc);
await checkSepolia(client);
const challenges = new Map();
const challengeLifetimeMs = 120_000;
const maxChallenges = 128;
let origin;

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

function createChallenge(address) {
  const now = Date.now();
  for (const [nonce, entry] of challenges) {
    if (entry.expires <= now) challenges.delete(nonce);
  }
  if (challenges.size >= maxChallenges) return null;

  const nonce = generateSiweNonce();
  const expires = now + challengeLifetimeMs;
  const message = createSiweMessage({
    address,
    chainId,
    domain: new URL(origin).host,
    expirationTime: new Date(expires),
    issuedAt: new Date(now),
    nonce,
    scheme: "http",
    statement: "Verify your wallet to download the Freedoom Phase 1 pilot edition.",
    uri: origin + "/download",
    version: "1",
  });
  challenges.set(nonce, { address, message, expires });
  return { nonce, message };
}

async function readProof(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 4096) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function download(request, response) {
  let proof;
  try {
    proof = await readProof(request);
  } catch {
    return json(response, 400, { error: "Invalid proof request." });
  }
  const { nonce, signature } = proof ?? {};
  const challenge = challenges.get(nonce);
  // Consume the challenge before the asynchronous checks to prevent parallel reuse.
  challenges.delete(nonce);
  if (!challenge || challenge.expires <= Date.now() || typeof signature !== "string") {
    return json(response, 401, { error: "Unknown, expired or used wallet challenge." });
  }

  let valid = false;
  try {
    // Verify the exact server-issued SIWE message with the pilot's EOA wallet.
    valid = await verifyMessage({ address: challenge.address, message: challenge.message, signature });
  } catch {
    // Malformed signatures are rejected alongside valid signatures from a different wallet.
  }
  if (!valid) return json(response, 401, { error: "Wallet signature does not match the challenge." });

  const blockNumber = await client.getBlockNumber();
  const balance = await client.readContract({
    ...contract,
    functionName: "balanceOf",
    args: [challenge.address],
    blockNumber,
  });
  const ownership = { block: blockNumber.toString(), balance: balance.toString() };
  if (balance < 1n) return json(response, 403, { error: "Wallet holds no FDP1 licence.", ...ownership });

  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": "application/zip",
    "Content-Length": packageBytes.length,
    "Content-Disposition": 'attachment; filename="' + packageName + '"',
    "X-Archive-SHA256": digest,
    "X-Archive-Role": role,
    "X-Ownership-Block": ownership.block,
    "X-FDP1-Balance": ownership.balance,
  });
  response.end(packageBytes);
}

async function handle(request, response) {
  const url = new URL(request.url, origin);
  if (request.method === "GET" && url.pathname === "/health") {
    return json(response, 200, { role, sha256: digest });
  }
  if (request.method === "GET" && url.pathname === "/challenge") {
    const address = url.searchParams.get("address") ?? "";
    if (!isAddress(address)) return json(response, 400, { error: "Invalid wallet address." });
    const challenge = createChallenge(getAddress(address));
    return challenge
      ? json(response, 200, challenge)
      : json(response, 429, { error: "Too many active challenges." });
  }
  if (request.method === "POST" && url.pathname === "/download") {
    return download(request, response);
  }
  return json(response, 404, { error: "Unknown route." });
}

const server = createServer({ requestTimeout: 15_000, headersTimeout: 10_000 }, (request, response) => {
  handle(request, response).catch(() => {
    if (!response.headersSent) json(response, 503, { error: "Archive or Sepolia check unavailable." });
    else response.destroy();
  });
});

const port = Number(process.env.FDP1_ARCHIVE_PORT ?? 0);
server.listen(port, "127.0.0.1", () => {
  origin = "http://127.0.0.1:" + server.address().port;
  console.log(JSON.stringify({ ready: true, origin, role, sha256: digest, rpc }));
});
