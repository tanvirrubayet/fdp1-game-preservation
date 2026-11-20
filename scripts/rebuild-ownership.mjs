// Rebuild an ERC-20 balance snapshot from public events and compare it to safe chain state.
import { decodeEventLog, getAddress, parseAbi, zeroAddress } from "viem";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkSepolia, connectSepolia, contract } from "../archive/sepolia.mjs";

const events = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event LegacyLicenceIssued(address indexed holder, bytes32 indexed claimId)",
  "event PaidLicenceIssued(address indexed holder, bytes32 indexed orderId)",
]);
const reads = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function legacyIssued() view returns (uint256)",
  "function paidIssued() view returns (uint256)",
  "function balanceOf(address holder) view returns (uint256)",
]);
const deploymentBlock = 12_154_860n;

export function rebuildBalances(logs) {
  // ERC-20 units are interchangeable: events recover balances, not a unit's original issue class.
  const balances = new Map();
  let supply = 0n, legacyIssued = 0n, paidIssued = 0n;
  for (const log of logs) {
    if (log.eventName === "LegacyLicenceIssued") { legacyIssued += 1n; continue; }
    if (log.eventName === "PaidLicenceIssued") { paidIssued += 1n; continue; }
    if (log.eventName !== "Transfer") continue;
    const { from, to, value } = log.args;
    if (value < 0n) throw new Error("A transfer cannot have a negative value.");
    if (from === zeroAddress) supply += value;
    else {
      const previous = balances.get(from) ?? 0n;
      if (previous < value) throw new Error("Event history spends more than the reconstructed balance.");
      balances.set(from, previous - value);
    }
    if (to === zeroAddress) supply -= value;
    else balances.set(to, (balances.get(to) ?? 0n) + value);
  }
  for (const [address, balance] of balances) if (balance === 0n) balances.delete(address);
  if (supply < 0n || [...balances.values()].reduce((sum, value) => sum + value, 0n) !== supply) {
    throw new Error("Event balances do not reconcile to event supply.");
  }
  if (legacyIssued + paidIssued !== supply) {
    throw new Error("Issuance events do not reconcile to token supply.");
  }
  return { balances, supply, legacyIssued, paidIssued };
}

async function indexedLogs(fromBlock, toBlock) {
  // The public RPCs used for downloads prune old logs. Read indexed history, then verify it on-chain.
  const base = `https://eth-sepolia.blockscout.com/api/v2/addresses/${contract.address}/logs`;
  const history = [];
  let next = null;
  for (let page = 0; page < 1_000; page++) {
    const url = new URL(base);
    if (next) for (const [key, value] of Object.entries(next)) url.searchParams.set(key, String(value));
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Explorer log request failed with HTTP ${response.status}.`);
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error("Explorer returned an invalid log page.");
    for (const log of data.items) {
      if (getAddress(log.address?.hash) !== getAddress(contract.address)) {
        throw new Error("Explorer returned a log from another contract.");
      }
      const block = BigInt(log.block_number);
      if (block < fromBlock || block > toBlock) continue;
      history.push(log);
    }
    if (!data.next_page_params) {
      return history.sort((a, b) => a.block_number - b.block_number || a.index - b.index);
    }
    next = data.next_page_params;
  }
  throw new Error("Explorer history exceeded the bounded pagination limit.");
}

export async function snapshot(client, fromBlock = deploymentBlock) {
  // Fix the safe block before fetching logs so new transfers cannot race the snapshot.
  await checkSepolia(client);
  const safe = await client.getBlock({ blockTag: "safe" });
  if (fromBlock > safe.number) throw new Error("Deployment block is after the safe block.");
  const decoded = [];
  for (const log of await indexedLogs(fromBlock, safe.number)) {
    try {
      decoded.push(decodeEventLog({
        abi: events, data: log.data, topics: log.topics.filter(Boolean),
      }));
    } catch { /* Approval and unrelated logs do not change balances. */ }
  }
  const result = rebuildBalances(decoded);
  const atSafe = (functionName, args = []) => client.readContract({
    address: contract.address, abi: reads, functionName, args, blockNumber: safe.number,
  });
  if (result.supply !== await atSafe("totalSupply") ||
      result.legacyIssued !== await atSafe("legacyIssued") ||
      result.paidIssued !== await atSafe("paidIssued")) {
    throw new Error("Event snapshot differs from contract counters at the safe block.");
  }
  for (const [address, balance] of result.balances) {
    if (balance !== await atSafe("balanceOf", [address])) {
      throw new Error("Event snapshot differs from an on-chain holder balance.");
    }
  }
  return {
    chainId: 11155111, contract: getAddress(contract.address),
    safeBlock: safe.number.toString(), safeBlockHash: safe.hash,
    totalSupply: result.supply.toString(),
    legacyIssued: result.legacyIssued.toString(), paidIssued: result.paidIssued.toString(),
    balances: Object.fromEntries([...result.balances]
      .sort(([a], [b]) => a.localeCompare(b)).map(([address, balance]) => [address, balance.toString()])),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Print a reproducible public snapshot; never export wallet keys or order records.
  const rpc = process.argv[2] ?? "https://ethereum-sepolia-rpc.publicnode.com";
  const result = await snapshot(connectSepolia(rpc));
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
