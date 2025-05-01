// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/access/Ownable.sol";

contract WishBook is Ownable {
    struct Wish {
        address sender;
        uint id;
        uint likes;
        uint createdAt;
        bool isDeleted;
        string message;
        string ipfsHash;
    }
    Wish[] public wishes;
    mapping(uint => mapping(address => bool)) public hasLiked;
    mapping(address => uint) public lastSent;
    uint internal nextId = 0;

    event WishAdded(address indexed sender, uint indexed wishId, string message);
    event LikeToggled(address indexed sender, uint indexed wishId, bool liked);
    event WishDeleted(uint indexed id);

    constructor() Ownable(msg.sender) {
    }
    modifier onlySenderOrOwner(uint _id) {
        require(
            msg.sender == wishes[_id].sender || msg.sender == owner(),
            "Not allowed"
        );
        _;
    }

    function getNextId() public view returns (uint) {
        return nextId;
    }

    function leaveWish(string calldata _message, string calldata _ipfsHash) public {
        require(
            block.timestamp >= lastSent[msg.sender] + 5 minutes,
            "You must wait 5 minutes between wishes"
        );
        require(bytes(_message).length > 0 || bytes(_ipfsHash).length > 0, "Message or IPFS required");
        require(bytes(_message).length <= 200, 'Message too long');
        Wish memory newWish = Wish(
            msg.sender,
            nextId,
            0,
            block.timestamp,
            false,
            _message,
            _ipfsHash
        );
        wishes.push(newWish);
        lastSent[msg.sender] = newWish.createdAt;
        emit WishAdded(msg.sender, newWish.id, _message);
        nextId++;
    }

    function toggleLike(uint _id) public {
        require(_id < wishes.length, "Invalid wish ID");
        bool liked;

        if (hasLiked[_id][msg.sender]) {
            wishes[_id].likes -= 1;
            hasLiked[_id][msg.sender] = false;
            liked = false;
        } else {
            wishes[_id].likes += 1;
            hasLiked[_id][msg.sender] = true;
            liked = true;
        }

        emit LikeToggled(msg.sender, _id, liked);
    }

    function deleteWish(uint _id) public onlySenderOrOwner(_id){
        require(_id < wishes.length, "Invalid wish ID");
        wishes[_id].isDeleted = true;
        emit WishDeleted(_id);
    }

    function isWishDeleted(uint id) public view returns (bool) {
        require(id < wishes.length, "Invalid wish ID");
        return wishes[id].isDeleted;
    }

    function getLikedWishIds(address _sender) public view returns (uint[] memory) {
        uint count = 0;
        for (uint i = 0; i < wishes.length; i++) {
            if (hasLiked[wishes[i].id][_sender]) {
                count++;
            }
        }
        uint[] memory likedIds = new uint[](count);

        uint index = 0;
        for (uint i = 0; i < wishes.length; i++) {
            if (hasLiked[wishes[i].id][_sender]) {
                likedIds[index] = wishes[i].id;
                index++;
            }
        }
        return likedIds;
    }

    function getLikedWishIdsInRange(address _sender, uint offset, uint limit) public view returns (uint[] memory) {
        uint found = 0;
        uint[] memory tempWishes = new uint[](wishes.length);
        for (uint i = 0; i < wishes.length; i++) {
            if (hasLiked[wishes[i].id][_sender]) {
                if (found >= offset && found < offset + limit) {
                    tempWishes[found - offset] = wishes[i].id;
                }
                found++;
                if (found >= offset + limit) break;
            }
        }
        uint resultLength = found > offset + limit ? limit : found - offset;
        uint[] memory result = new uint[](resultLength);
        for (uint j = 0; j < resultLength; j++) {
            result[j] = tempWishes[j];
        }

        return result;
    }

    function getActiveWishes() public view returns(Wish[] memory) {
        uint count = 0;
        for (uint i = 0; i < wishes.length; i++) {
            if (!wishes[i].isDeleted) {
                count++;
            }
        }
        Wish[] memory activeWishes = new Wish[](count);

        uint index = 0;
        for (uint i = 0; i < wishes.length; i++) {
            if (!wishes[i].isDeleted) {
                activeWishes[index] = wishes[i];
                index++;
            }
        }
        return activeWishes;
    }

    function getAllWishes() public view onlyOwner returns(Wish[] memory) {
        return wishes;
    }
}
