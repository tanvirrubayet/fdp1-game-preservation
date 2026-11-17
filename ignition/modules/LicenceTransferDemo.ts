import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { keccak256, parseEther, stringToHex } from "viem";
import PreservationLicence from "./PreservationLicence.js";

export default buildModule("LicenceTransferDemo", (m) => {
  const { licence } = m.useModule(PreservationLicence);
  const walletA = m.getAccount(1);
  const walletB = m.getAccount(2);
  const order = keccak256(stringToHex("FDP1 Sepolia demo order 001"));

  // The issuer funds A's gas and issues one licence for a fictional checkout.
  const funding = m.send("FundWalletA", walletA, parseEther("0.001"));
  const issuance = m.call(licence, "issuePaid", [walletA, order], {
    id: "IssueDemoLicence",
  });
  m.call(licence, "transfer", [walletB, 1n], {
    id: "TransferDemoLicence",
    from: walletA,
    after: [funding, issuance],
  });

  return { licence };
});
