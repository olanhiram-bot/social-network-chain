// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract SocialIdRegistry {
    uint256 public nextId = 1;

    mapping(address => uint256) public idOf;
    mapping(uint256 => address) public ownerOf;
    mapping(uint256 => address) public recoveryOf;

    event Register(uint256 indexed id, address indexed owner, address indexed recovery);
    event Transfer(uint256 indexed id, address indexed from, address indexed to);
    event ChangeRecovery(uint256 indexed id, address indexed recovery);

    function register(address recovery) external returns (uint256 id) {
        require(idOf[msg.sender] == 0, "already registered");

        id = nextId++;
        idOf[msg.sender] = id;
        ownerOf[id] = msg.sender;
        recoveryOf[id] = recovery;

        emit Register(id, msg.sender, recovery);
    }

    function transfer(uint256 id, address to) external {
        require(ownerOf[id] == msg.sender || recoveryOf[id] == msg.sender, "not authorized");
        require(to != address(0), "invalid recipient");
        require(idOf[to] == 0, "recipient registered");

        address from = ownerOf[id];
        idOf[from] = 0;
        idOf[to] = id;
        ownerOf[id] = to;

        emit Transfer(id, from, to);
    }

    function changeRecovery(uint256 id, address recovery) external {
        require(ownerOf[id] == msg.sender, "not owner");
        recoveryOf[id] = recovery;

        emit ChangeRecovery(id, recovery);
    }
}
