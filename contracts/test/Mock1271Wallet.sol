// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice Test-only contract wallet that accepts messages signed by one owner.
contract Mock1271Wallet {
    address public immutable signer;
    bytes4 private constant VALID_SIGNATURE = 0x1626ba7e;

    constructor(address expectedSigner) {
        signer = expectedSigner;
    }

    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        (address recovered, ECDSA.RecoverError error,) = ECDSA.tryRecover(hash, signature);
        return error == ECDSA.RecoverError.NoError && recovered == signer
            ? VALID_SIGNATURE
            : bytes4(0xffffffff);
    }
}
