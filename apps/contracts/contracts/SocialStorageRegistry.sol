// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IStorageIdRegistry {
    function ownerOf(uint256 id) external view returns (address);
}

contract SocialStorageRegistry {
    IStorageIdRegistry public immutable ids;
    uint256 public unitPrice;
    uint256 public unitSeconds = 365 days;

    mapping(uint256 => uint256) public paidUntil;

    event Rent(uint256 indexed id, uint256 paidUntil);
    event SetUnitPrice(uint256 unitPrice);

    constructor(address idRegistry, uint256 initialUnitPrice) {
        ids = IStorageIdRegistry(idRegistry);
        unitPrice = initialUnitPrice;
    }

    function rent(uint256 id) external payable {
        require(ids.ownerOf(id) == msg.sender, "not owner");
        require(msg.value >= unitPrice, "underpaid");

        uint256 startsAt = paidUntil[id] > block.timestamp ? paidUntil[id] : block.timestamp;
        paidUntil[id] = startsAt + unitSeconds;

        emit Rent(id, paidUntil[id]);
    }
}
