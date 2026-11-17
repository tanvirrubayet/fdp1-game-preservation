// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Capped} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";

/// @notice Each whole token represents one simulated licence for Freedoom Phase 1.
contract PreservationLicence is ERC20Capped, Ownable2Step {
    uint256 public immutable legacyCap;
    uint256 public immutable paidCap;

    uint256 public legacyIssued;
    uint256 public paidIssued;

    mapping(bytes32 => bool) public usedLegacyClaim;
    mapping(bytes32 => bool) public usedPaidOrder;

    error InvalidLegacyCap(uint256 legacyAllocation, uint256 editionCap);
    error EmptyReference();
    error ReferenceAlreadyUsed(bytes32 referenceId);
    error LegacyCapacityExhausted();
    error PaidCapacityExhausted();

    event LegacyLicenceIssued(address indexed holder, bytes32 indexed claimId);
    event PaidLicenceIssued(address indexed holder, bytes32 indexed orderId);

    constructor(uint256 editionCap, uint256 legacyAllocation, address issuer)
        ERC20("Freedoom Phase 1 Pilot Licence", "FDP1")
        ERC20Capped(editionCap)
        Ownable(issuer)
    {
        if (legacyAllocation > editionCap) {
            revert InvalidLegacyCap(legacyAllocation, editionCap);
        }

        legacyCap = legacyAllocation;
        paidCap = editionCap - legacyAllocation;
    }

    /// @notice The token uses whole licences. A balance of 1 is one entitlement.
    function decimals() public pure override returns (uint8) {
        return 0;
    }

    /// @notice Issue a licence for a legacy purchase the issuer verified off-chain.
    /// @param claimId Stable opaque identifier for that purchase's one free claim.
    function issueLegacy(address holder, bytes32 claimId) external onlyOwner {
        _checkReference(claimId, usedLegacyClaim[claimId]);
        if (legacyIssued == legacyCap) revert LegacyCapacityExhausted();

        usedLegacyClaim[claimId] = true;
        legacyIssued += 1;
        _mint(holder, 1);
        emit LegacyLicenceIssued(holder, claimId);
    }

    /// @notice Issue a licence after the issuer has confirmed an off-chain order.
    /// @param orderId Stable opaque identifier for that order's one paid licence.
    function issuePaid(address holder, bytes32 orderId) external onlyOwner {
        _checkReference(orderId, usedPaidOrder[orderId]);
        if (paidIssued == paidCap) revert PaidCapacityExhausted();

        usedPaidOrder[orderId] = true;
        paidIssued += 1;
        _mint(holder, 1);
        emit PaidLicenceIssued(holder, orderId);
    }

    function _checkReference(bytes32 referenceId, bool alreadyUsed) private pure {
        if (referenceId == bytes32(0)) revert EmptyReference();
        if (alreadyUsed) revert ReferenceAlreadyUsed(referenceId);
    }
}
