import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

const compiler = {
  version: "0.8.30",
  settings: {
    evmVersion: "cancun",
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
};

export default defineConfig({
  plugins: [hardhatToolboxViem],
  solidity: {
    profiles: {
      default: compiler,
      production: compiler,
    },
  },
  verify: {
    etherscan: {
      enabled: Boolean(process.env.ETHERSCAN_API_KEY),
      apiKey: configVariable("ETHERSCAN_API_KEY"),
    },
  },
  networks: {
    sepolia: {
      type: "http",
      chainType: "l1",
      chainId: 11155111,
      url: process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: [
        configVariable("SEPOLIA_PRIVATE_KEY"),
        ...[
          process.env.SEPOLIA_DEMO_HOLDER_A_PRIVATE_KEY,
          process.env.SEPOLIA_DEMO_HOLDER_B_PRIVATE_KEY,
        ].filter((key) => key !== undefined),
      ],
    },
  },
});

