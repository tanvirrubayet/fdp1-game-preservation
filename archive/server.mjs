import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, isAddress } from "viem";
import { createSiweMessage, generateSiweNonce } from "viem/siwe";
import { checkSepolia, chainId, connectSepolia, contract, packageName } from "./sepolia.mjs";

export async function createArchiveServer({ role, directory, client, now = Date.now }) {
  if (!["primary", "backup"].includes(role)) throw new Error("Unknown archive role.");
  const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8"));
  const packageBytes = await readFile(resolve(directory, packageName));
  const digest = createHash("sha256").update(packageBytes).digest("hex");
  if (manifest.fileName !== packageName || manifest.sha256 !== digest || manifest.bytes !== packageBytes.length) {
    throw new Error("The archive's local package does not match its manifest.");
  }

  const challenges = new Map();
  const challengesByAddress = new Map();
  const challengeRequestsByIp = new Map();
  const challengeLifetimeMs = 120_000;
  const maxChallenges = 128;
  const maxRequestsPerIp = 20;
  let origin;

  function json(response, status, body) {
    response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(body));
  }

  function createChallenge(address, ip) {
    const issuedAt = now();
    for (const [nonce, entry] of challenges) {
      if (entry.expires <= issuedAt) {
        challenges.delete(nonce);
        challengesByAddress.delete(entry.address);
      }
    }
    // Count requests, including replacements, so one client cannot monopolise the pool.
    for (const [clientIp, requests] of challengeRequestsByIp) {
      const current = requests.filter(time => issuedAt - time < challengeLifetimeMs);
      if (current.length) challengeRequestsByIp.set(clientIp, current);
      else challengeRequestsByIp.delete(clientIp);
    }
    const requests = challengeRequestsByIp.get(ip) ?? [];
    if (requests.length >= maxRequestsPerIp) return null;
    requests.push(issuedAt);
    challengeRequestsByIp.set(ip, requests);

    const previous = challengesByAddress.get(address);
    if (previous) challenges.delete(previous);
    else if (challenges.size >= maxChallenges) return null;

    const nonce = generateSiweNonce();
    const expires = issuedAt + challengeLifetimeMs;
    const message = createSiweMessage({
      address,
      chainId,
      domain: new URL(origin).host,
      expirationTime: new Date(expires),
      issuedAt: new Date(issuedAt),
      nonce,
      scheme: "http",
      statement: "Verify your wallet to download the Freedoom Phase 1 pilot edition.",
      uri: origin + "/download",
      version: "1",
    });
    challenges.set(nonce, { address, message, expires });
    challengesByAddress.set(address, nonce);
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
    if (challenge) challengesByAddress.delete(challenge.address);
    if (!challenge || challenge.expires <= now() || typeof signature !== "string") {
      return json(response, 401, { error: "Unknown, expired or used wallet challenge." });
    }

    // Use safe ownership state and reject a disconnected or stale provider.
    const [latest, safe] = await Promise.all([
      client.getBlock({ blockTag: "latest" }),
      client.getBlock({ blockTag: "safe" }),
    ]);
    const ageSeconds = now() / 1000 - Number(latest.timestamp);
    if (ageSeconds > 120 || ageSeconds < -30 || safe.number > latest.number) {
      return json(response, 503, { error: "Blockchain data is delayed. Please retry shortly." });
    }
    const blockNumber = safe.number;
    let valid = false;
    try {
      // Public-client verification accepts EOAs and ERC-1271/6492 smart wallets.
      // Check the contract signature at the same safe block used for entitlement.
      valid = await client.verifySiweMessage({
        address: challenge.address, message: challenge.message, signature,
        domain: new URL(origin).host, nonce, blockNumber, time: new Date(now()),
      });
    } catch {
      // Malformed signatures and contract-wallet verification failures are rejected.
    }
    if (!valid) return json(response, 401, { error: "Wallet signature does not match the challenge." });
    const balance = await client.readContract({
      ...contract,
      functionName: "balanceOf",
      args: [challenge.address],
      blockNumber,
    });
    const ownership = { block: blockNumber.toString(), balance: balance.toString() };
    if (balance < 1n) return json(response, 403, { error: "This wallet has no FDP1 at the safe block. After a transfer, wait for confirmation and try again.", ...ownership });

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": "application/zip",
      "Content-Length": packageBytes.length,
      "Content-Disposition": 'attachment; filename="' + packageName + '"',
      "X-Archive-SHA256": digest,
      "X-Archive-Role": role,
      "X-Ownership-Block": ownership.block,
      "X-FDP1-Balance": ownership.balance,
      "X-Ownership-Policy": "safe",
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
      // remoteAddress is the TCP peer; never trust a caller-supplied forwarding header.
      const challenge = createChallenge(getAddress(address), request.socket.remoteAddress ?? "unknown");
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
      if (!response.headersSent) json(response, 503, { error: "Ownership checks are temporarily unavailable. Please request a new challenge and retry." });
      else response.destroy();
    });
  });

  server.on("listening", () => {
    origin = "http://127.0.0.1:" + server.address().port;
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [role, directory, rpc] = process.argv.slice(2);
  if (!directory || !rpc) {
    throw new Error("Usage: node archive/server.mjs primary|backup <package directory> <Sepolia RPC>");
  }
  const client = connectSepolia(rpc);
  await checkSepolia(client);
  const server = await createArchiveServer({ role, directory, client });
  server.listen(Number(process.env.FDP1_ARCHIVE_PORT ?? 0), "127.0.0.1", async () => {
    console.log(JSON.stringify({
      ready: true, origin: "http://127.0.0.1:" + server.address().port,
      role, sha256: JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")).sha256, rpc,
    }));
  });
}
