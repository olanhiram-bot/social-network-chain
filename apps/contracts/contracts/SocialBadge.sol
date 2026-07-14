// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ISocialBadgeIds {
    function ownerOf(uint256 id) external view returns (address);
}

/// @notice Non-transferable, on-chain attestations for a social identity.
contract SocialBadge {
    address public owner;
    ISocialBadgeIds public immutable ids;
    mapping(uint256 => mapping(bytes32 => bool)) public hasBadge;

    event BadgeGranted(uint256 indexed id, bytes32 indexed badge, address indexed recipient, string uri);
    event BadgeRevoked(uint256 indexed id, bytes32 indexed badge, address indexed recipient);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address idRegistry) {
        require(idRegistry != address(0), "invalid registry");
        owner = msg.sender;
        ids = ISocialBadgeIds(idRegistry);
    }

    function grant(uint256 id, bytes32 badge, string calldata uri) external onlyOwner {
        require(ids.ownerOf(id) != address(0), "unknown id");
        require(badge != bytes32(0), "invalid badge");
        require(!hasBadge[id][badge], "already granted");
        hasBadge[id][badge] = true;
        emit BadgeGranted(id, badge, ids.ownerOf(id), uri);
    }

    function revoke(uint256 id, bytes32 badge) external onlyOwner {
        require(hasBadge[id][badge], "not granted");
        hasBadge[id][badge] = false;
        emit BadgeRevoked(id, badge, ids.ownerOf(id));
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        require(nextOwner != address(0), "invalid owner");
        emit OwnershipTransferred(owner, nextOwner);
        owner = nextOwner;
    }
}
