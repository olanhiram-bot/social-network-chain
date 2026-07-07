// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ISocialIdRegistry {
    function ownerOf(uint256 id) external view returns (address);
}

contract SocialKeyRegistry {
    ISocialIdRegistry public immutable ids;

    mapping(uint256 => mapping(bytes32 => bool)) public keyOf;

    event AddKey(uint256 indexed id, bytes32 indexed key);
    event RemoveKey(uint256 indexed id, bytes32 indexed key);

    constructor(address idRegistry) {
        ids = ISocialIdRegistry(idRegistry);
    }

    function addKey(uint256 id, bytes32 key) external {
        require(ids.ownerOf(id) == msg.sender, "not owner");
        keyOf[id][key] = true;

        emit AddKey(id, key);
    }

    function removeKey(uint256 id, bytes32 key) external {
        require(ids.ownerOf(id) == msg.sender, "not owner");
        keyOf[id][key] = false;

        emit RemoveKey(id, key);
    }
}
