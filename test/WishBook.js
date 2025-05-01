const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WishBook", function () {
  async function deployWishBookFixture() {
    const [owner, otherUser] = await ethers.getSigners();
    const WishBook = await ethers.getContractFactory("WishBook");
    const wishBook = await WishBook.deploy();
    await wishBook.waitForDeployment();

    return {wishBook, owner, otherUser};
  }

  describe("Deployment", function () {
    it("should deploy successfully", async function () {
      const {wishBook} = await loadFixture(deployWishBookFixture);
      expect(wishBook.target).to.properAddress;
    });
    it("should set deployer as owner", async function () {
      const {wishBook, owner} = await loadFixture(deployWishBookFixture);
      const contractOwner = await wishBook.owner();
      expect(contractOwner).to.equal(owner.address);
    });
    it("should check if nextId equal to 0", async function () {
      const {wishBook} = await loadFixture(deployWishBookFixture);
      expect(await wishBook.getNextId()).to.equal(0);
    });
  });

  describe("leaveWish()", function () {
    describe("Success cases", function () {
      it("should allow submitting a wish with a message", async function () {
        const {wishBook, owner} = await loadFixture(deployWishBookFixture);
        await wishBook.leaveWish("Hello, world!", "");
        const wishes = await wishBook.getAllWishes();
        expect(wishes.length).to.equal(1);
        expect(wishes[0].sender).to.equal(owner.address);
        expect(wishes[0].message).to.equal("Hello, world!");
      });

      it("should allow submitting a wish with IPFS hash only", async function () {
        const {wishBook, owner} = await loadFixture(deployWishBookFixture);
        await wishBook.leaveWish("", "QmTestHash123");
        const wishes = await wishBook.getAllWishes();
        expect(wishes[0].ipfsHash).to.equal("QmTestHash123");
      });

      it("should emit WishAdded event with correct parameters", async function () {
        const {wishBook, owner} = await loadFixture(deployWishBookFixture);
        const tx = await wishBook.leaveWish("Event check", "");
        await expect(tx).to.emit(wishBook, "WishAdded").withArgs(owner.address, 0, "Event check");
      });

      it("should increment nextId after each wish", async function () {
        const {wishBook} = await loadFixture(deployWishBookFixture);
        await wishBook.leaveWish("First wish", "");
        expect(await wishBook.getNextId()).to.equal(1);
        await network.provider.send("evm_increaseTime", [5 * 60]);
        await network.provider.send("evm_mine");
        await wishBook.leaveWish("Second wish", "");
        expect(await wishBook.getNextId()).to.equal(2);
      });

      it("should store createdAt from block.timestamp", async function () {
        const {wishBook} = await loadFixture(deployWishBookFixture);
        const tx = await wishBook.leaveWish("Timestamp test", "");
        const receipt = await tx.wait();
        const block = await ethers.provider.getBlock(receipt.blockNumber);
        const wishes = await wishBook.getAllWishes();
        expect(wishes[0].createdAt).to.equal(block.timestamp);
      });

      it("should allow multiple users to leave wishes", async function () {
        const {wishBook, otherUser} = await loadFixture(deployWishBookFixture);
        await wishBook.leaveWish("User1", "");
        await wishBook.connect(otherUser).leaveWish("User2", "");
        const wishes = await wishBook.getAllWishes();
        expect(wishes.length).to.equal(2);
      });

      it("should store wishes in correct order", async function () {
        const {wishBook} = await loadFixture(deployWishBookFixture);
        await wishBook.leaveWish("First", "");
        await network.provider.send("evm_increaseTime", [5 * 60]);
        await network.provider.send("evm_mine");
        await wishBook.leaveWish("Second", "");
        const wishes = await wishBook.getAllWishes();
        expect(wishes[0].message).to.equal("First");
        expect(wishes[1].message).to.equal("Second");
      });

      it("should update lastSent with current timestamp", async function () {
        const {wishBook, owner} = await loadFixture(deployWishBookFixture);
        const tx = await wishBook.leaveWish("Check lastSent", "");
        const receipt = await tx.wait();
        const block = await ethers.provider.getBlock(receipt.blockNumber);
        const last = await wishBook.lastSent(owner.address);
        expect(last).to.equal(block.timestamp);
      });
    });

    describe("Failure cases", function () {
      it("should revert if message and IPFS are both empty", async function () {
        const {wishBook} = await loadFixture(deployWishBookFixture);
        await expect(wishBook.leaveWish("", "")).to.be.revertedWith("Message or IPFS required");
      });

      it("should revert if message exceeds 200 characters", async function () {
        const {wishBook} = await loadFixture(deployWishBookFixture);
        const longMessage = "a".repeat(201);
        await expect(wishBook.leaveWish(longMessage, "")).to.be.revertedWith("Message too long");
      });

      it("should revert if user sends another wish within 5 minutes", async function () {
        const {wishBook} = await loadFixture(deployWishBookFixture);
        await wishBook.leaveWish("First wish", "");
        await expect(wishBook.leaveWish("Too soon", "")).to.be.revertedWith("You must wait 5 minutes between wishes");
      });
    });
  });

  describe("toggleLike()", function () {
    describe("Success cases", function () {
      it("should increase like count when liked", async function () {
        const {wishBook} = await loadFixture(deployWishBookFixture);
        await wishBook.leaveWish("Like this!", "");
        await wishBook.toggleLike(0);
        const wishes = await wishBook.getAllWishes();
        expect(wishes[0].likes).to.equal(1);
      });

      it("should decrease like count when unliked (toggle off)", async function () {
        const {wishBook} = await loadFixture(deployWishBookFixture);
        await wishBook.leaveWish("Like then unlike", "");
        await wishBook.toggleLike(0);
        await wishBook.toggleLike(0);
        const wishes = await wishBook.getAllWishes();
        expect(wishes[0].likes).to.equal(0);
      });

      it("should allow different users to like the same wish", async function () {
        const {wishBook, otherUser} = await loadFixture(deployWishBookFixture);
        await wishBook.leaveWish("Shared like", "");
        await wishBook.toggleLike(0);
        await wishBook.connect(otherUser).toggleLike(0);
        const wishes = await wishBook.getAllWishes();
        expect(wishes[0].likes).to.equal(2);
      });

      it("should emit LikeToggled event with correct parameters", async function () {
        const {wishBook, owner} = await loadFixture(deployWishBookFixture);
        await wishBook.leaveWish("Emit test", "");
        await expect(wishBook.toggleLike(0))
          .to.emit(wishBook, "LikeToggled")
          .withArgs(owner.address, 0, true);
      });

      it("should not change isDeleted status when liking", async function () {
        const {wishBook} = await loadFixture(deployWishBookFixture);
        await wishBook.leaveWish("Will be liked", "");
        const before = await wishBook.getAllWishes();
        expect(before[0].isDeleted).to.equal(false);
        await wishBook.toggleLike(0);
        const after = await wishBook.getAllWishes();
        expect(after[0].isDeleted).to.equal(false);
      });

      it("should return liked wish IDs for the user", async function () {
        const {wishBook, otherUser} = await loadFixture(deployWishBookFixture);

        await wishBook.leaveWish("Wish 1", "");
        await network.provider.send("evm_increaseTime", [5 * 60]);
        await network.provider.send("evm_mine");
        await wishBook.leaveWish("Wish 2", "");

        await wishBook.toggleLike(0);
        await wishBook.toggleLike(1);
        await wishBook.connect(otherUser).toggleLike(1);

        const likedByOwner = await wishBook.getLikedWishIds(await wishBook.owner());
        expect(likedByOwner.map(n => Number(n))).to.deep.equal([0, 1]);

        const likedByOther = await wishBook.getLikedWishIds(otherUser.address);
        expect(likedByOther.map(n => Number(n))).to.deep.equal([1]);
      });
    });

    describe("Failure cases", function () {
      it("should revert if wish ID does not exist", async function () {
        const {wishBook} = await loadFixture(deployWishBookFixture);
        await expect(wishBook.toggleLike(999)).to.be.revertedWith("Invalid wish ID");
      });
    });
  });
  describe("deleteWish()", function () {
    describe("Success cases", function () {

      it("should allow the sender to delete their own wish", async function () {
        const {wishBook} = await loadFixture(deployWishBookFixture);
        await wishBook.leaveWish("To delete", "");
        await wishBook.deleteWish(0);
        const deleted = await wishBook.isWishDeleted(0);
        expect(deleted).to.be.true;
      });

      it("should allow the owner to delete any wish", async function () {
        const {wishBook, otherUser} = await loadFixture(deployWishBookFixture);
        await wishBook.connect(otherUser).leaveWish("Admin deletes this", "");
        await wishBook.deleteWish(0);
        const deleted = await wishBook.isWishDeleted(0);
        expect(deleted).to.be.true;
      });

      it("should emit WishDeleted event", async function () {
        const {wishBook} = await loadFixture(deployWishBookFixture);
        await wishBook.leaveWish("Emit delete", "");
        await expect(wishBook.deleteWish(0)).to.emit(wishBook, "WishDeleted").withArgs(0);
      });
    });
    describe("Failure cases", function () {
      it("should revert if non-sender and non-owner tries to delete", async function () {
        const {wishBook, otherUser} = await loadFixture(deployWishBookFixture);
        await wishBook.leaveWish("Can't delete", "");
        await expect(wishBook.connect(otherUser).deleteWish(0)).to.be.revertedWith("Not allowed");
      });

      it("should revert if wish ID is invalid", async function () {
        const {wishBook} = await loadFixture(deployWishBookFixture);
        await expect(wishBook.deleteWish(999)).to.be.revertedWith("Invalid wish ID");
      });
    });
  });
  describe("getActiveWishes()", function () {
    describe("Success cases", function () {
      it("should return only active (not deleted) wishes", async function () {
        const {wishBook} = await loadFixture(deployWishBookFixture);
        await wishBook.leaveWish("Wish 1", "");
        await network.provider.send("evm_increaseTime", [5 * 60]);
        await network.provider.send("evm_mine");
        await wishBook.leaveWish("Wish 2", "");
        await wishBook.deleteWish(0);
        const activeWishes = await wishBook.getActiveWishes();
        expect(activeWishes.length).to.equal(1);
        expect(activeWishes[0].message).to.equal("Wish 2");
      });

      it("should return all wishes if none are deleted", async function () {
        const {wishBook} = await loadFixture(deployWishBookFixture);
        await wishBook.leaveWish("One", "");
        await network.provider.send("evm_increaseTime", [5 * 60]);
        await network.provider.send("evm_mine");
        await wishBook.leaveWish("Two", "");
        const active = await wishBook.getActiveWishes();
        expect(active.length).to.equal(2);
      });

      it("should return an empty array if all wishes are deleted", async function () {
        const {wishBook} = await loadFixture(deployWishBookFixture);
        await wishBook.leaveWish("Temp", "");
        await wishBook.deleteWish(0);
        const active = await wishBook.getActiveWishes();
        expect(active.length).to.equal(0);
      });
    });
  });
  describe("getAllWishes()", function () {
    describe("Success cases", function () {
      it("should return all wishes including deleted ones", async function () {
        const {wishBook} = await loadFixture(deployWishBookFixture);

        await wishBook.leaveWish("Active wish", "");
        await network.provider.send("evm_increaseTime", [5 * 60]);
        await network.provider.send("evm_mine");

        await wishBook.leaveWish("Deleted wish", "");
        await wishBook.deleteWish(1);

        const allWishes = await wishBook.getAllWishes();
        expect(allWishes.length).to.equal(2);
        expect(allWishes[0].isDeleted).to.equal(false);
        expect(allWishes[1].isDeleted).to.equal(true);
        expect(allWishes[1].message).to.equal("Deleted wish");
      });
    });
  });
});
