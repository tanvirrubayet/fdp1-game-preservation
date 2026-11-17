import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("PreservationLicence", (m) => {
  // The illustrative allocations match the saved Python notebook.
  const editionCap = m.getParameter("editionCap", 1_200n);
  const legacyCap = m.getParameter("legacyCap", 200n);
  const issuer = m.getParameter("issuer", m.getAccount(0));
  const licence = m.contract("PreservationLicence", [editionCap, legacyCap, issuer]);

  return { licence };
});
