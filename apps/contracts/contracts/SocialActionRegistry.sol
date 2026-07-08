// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract SocialActionRegistry {
    event ActionRecorded(
        bytes32 indexed actionHash,
        address indexed actor,
        string actionType,
        string resourceType,
        string resourceId,
        string uri
    );

    mapping(bytes32 => bool) public recorded;

    function recordAction(
        bytes32 actionHash,
        string calldata actionType,
        string calldata resourceType,
        string calldata resourceId,
        string calldata uri
    ) external {
        require(actionHash != bytes32(0), "invalid hash");
        require(!recorded[actionHash], "already recorded");

        recorded[actionHash] = true;
        emit ActionRecorded(actionHash, msg.sender, actionType, resourceType, resourceId, uri);
    }
}
