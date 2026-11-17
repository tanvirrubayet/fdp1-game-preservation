import { createPublicClient, getAddress, http, parseAbi } from "viem";
import { sepolia } from "viem/chains";
import { readFileSync } from "node:fs";

const deployment = JSON.parse(readFileSync(new URL(
  "../evidence/sepolia/deployed_addresses.json", import.meta.url,
), "utf8"));

export const contract = {
  address: getAddress(deployment["PreservationLicence#PreservationLicence"]),
  abi: parseAbi([
    "function balanceOf(address holder) view returns (uint256)",
    "function owner() view returns (address)",
    "function totalSupply() view returns (uint256)",
    "function transfer(address recipient, uint256 amount) returns (bool)",
  ]),
};

export const packageName = "freedoom-phase1-pilot-win64.zip";
export const chainId = sepolia.id;
export const primaryRpc = "https://ethereum-sepolia-rpc.publicnode.com";
export const backupRpc = "https://ethereum-sepolia-public.nodies.app";

export function connectSepolia(rpc) {
  return createPublicClient({ chain: sepolia, transport: http(rpc, { timeout: 10_000 }), cacheTime: 0 });
}

export async function checkSepolia(client) {
  if (await client.getChainId() !== chainId || !await client.getCode({ address: contract.address })) {
    throw new Error("Expected the deployed FDP1 contract on Sepolia.");
  }
}
