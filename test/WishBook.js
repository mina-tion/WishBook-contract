const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WishBook", function () {
  async function deployWishBookFixture() {
    const [owner, otherUser] = await ethers.getSigners();
    const WishBook = await ethers.getContractFactory("WishBook");
    const wishBook = await WishBook.deploy();
    await wishBook.waitForDeployment();

    return { wishBook, owner, otherUser };
  }

  describe("Deployment", function () {
    it("should deploy successfully", async function () {
      const { wishBook } = await loadFixture(deployWishBookFixture);
      expect(wishBook.target).to.properAddress;
    });
    it("should set deployer as owner", async function () {
      const { wishBook, owner } = await loadFixture(deployWishBookFixture);
      const contractOwner = await wishBook.owner();
      expect(contractOwner).to.equal(owner.address);
    });
    it("should check if nextId equal to 0", async function () {
      const { wishBook } = await loadFixture(deployWishBookFixture);
      expect(await wishBook.getNextId()).to.equal(0);
    });
  });

  describe("Wishes", function () {
    it("should return empty array if no wishes yet", async function () {
      const { wishBook } = await loadFixture(deployWishBookFixture);
      const wishes = await wishBook.getAllWishes();
      expect(wishes.length).to.equal(0);
    });
    it("should allow submitting a wish with a message", async function () {
      const { wishBook, owner } = await loadFixture(deployWishBookFixture);
      const tx = await wishBook.leaveWish("Hello, world!", "");
      await tx.wait();
      const wishes = await wishBook.getAllWishes();
      expect(wishes.length).to.equal(1);
      expect(wishes[0].sender).to.equal(owner.address);
      expect(wishes[0].message).to.equal("Hello, world!");
    });
    it("should allow submitting a wish with IPFS hash only", async function () {
      const { wishBook, owner } = await loadFixture(deployWishBookFixture);
      const tx = await wishBook.leaveWish("", "QmTestHash123");
      await tx.wait();
      const wishes = await wishBook.getAllWishes();
      expect(wishes.length).to.equal(1);
      expect(wishes[0].sender).to.equal(owner.address);
      expect(wishes[0].ipfsHash).to.equal("QmTestHash123");
    });
    it("should emit WishAdded event with correct parameters", async function () {
      const { wishBook, owner } = await loadFixture(deployWishBookFixture);
      const tx = await wishBook.leaveWish("Event check", "");
      await tx.wait();
      await expect(tx)
        .to.emit(wishBook, "WishAdded")
        .withArgs(owner.address, 0, "Event check");
    });
    it("should increment nextId after each new wish", async function () {
      const { wishBook } = await loadFixture(deployWishBookFixture);

      await wishBook.leaveWish("First wish", "");
      expect(await wishBook.getNextId()).to.equal(1);

      await network.provider.send("evm_increaseTime", [5 * 60]);
      await network.provider.send("evm_mine");

      await wishBook.leaveWish("Second wish", "");
      expect(await wishBook.getNextId()).to.equal(2);
    });
    it("should store wishes with isDeleted set to false", async function () {
      const { wishBook } = await loadFixture(deployWishBookFixture);
      await wishBook.leaveWish("Hello", "");
      const wishes = await wishBook.getAllWishes();
      expect(wishes[0].isDeleted).to.equal(false);
    });
    it("should allow different users to send wishes without delay", async function () {
      const { wishBook, owner, otherUser } = await loadFixture(deployWishBookFixture);
      await wishBook.leaveWish("User1", "");
      await wishBook.connect(otherUser).leaveWish("User2", "");
      const wishes = await wishBook.getAllWishes();
      expect(wishes.length).to.equal(2);
    });
    it("should set createdAt to the block timestamp", async function () {
      const { wishBook } = await loadFixture(deployWishBookFixture);
      const tx = await wishBook.leaveWish("Timestamp test", "");
      const receipt = await tx.wait();

      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const wishes = await wishBook.getAllWishes();

      expect(wishes[0].createdAt).to.equal(block.timestamp);
    });
    it("should store wishes in order", async function () {
      const { wishBook } = await loadFixture(deployWishBookFixture);
      await wishBook.leaveWish("First", "");

      await network.provider.send("evm_increaseTime", [5 * 60]); // 5 minutes
      await network.provider.send("evm_mine"); // mine next block

      await wishBook.leaveWish("Second", "");

      const wishes = await wishBook.getAllWishes();
      await expect(wishes[0].message).to.equal("First");
      await expect(wishes[1].message).to.equal("Second");
    });
    it("should allow other accounts to send wishes", async function () {
      const { wishBook, otherUser } = await loadFixture(deployWishBookFixture);

      await wishBook.connect(otherUser).leaveWish("Other user wish", "");

      const wishes = await wishBook.getAllWishes();
      expect(wishes[0].sender).to.equal(otherUser.address);
      expect(wishes[0].message).to.equal("Other user wish");
    });
    it("should update lastSent with current timestamp", async function () {
      const { wishBook, owner } = await loadFixture(deployWishBookFixture);

      const tx = await wishBook.leaveWish("Check lastSent", "");
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      const last = await wishBook.lastSent(owner.address);
      expect(last).to.equal(block.timestamp);
    });
    it("should revert if message and IPFS are empty", async function () {
      const { wishBook } = await loadFixture(deployWishBookFixture);
      await expect(wishBook.leaveWish("", "")).to.be.revertedWith("Message or IPFS required");
    });
    it("should revert if message exceeds 200 characters", async function () {
      const { wishBook } = await loadFixture(deployWishBookFixture);
      const longMessage = 'a'.repeat(201);
      await expect(wishBook.leaveWish(longMessage, "")).to.be.revertedWith("Message too long");
    });
    it("should revert if user tries to send another wish within 5 minutes", async function () {
      const { wishBook } = await loadFixture(deployWishBookFixture);

      await wishBook.leaveWish("First wish", "");

      await expect(
        wishBook.leaveWish("Second too soon", "")
      ).to.be.revertedWith("You must wait 5 minutes between wishes");
    });
  });
  describe("Likes", function () {
    it("should increase like count when liked", async function () {
      const { wishBook } = await loadFixture(deployWishBookFixture);

      await wishBook.leaveWish("Like this!", "");

      await wishBook.toggleLike(0);
      const wishes = await wishBook.getAllWishes();
      expect(wishes[0].likes).to.equal(1);
    });

    it("should decrease like count when unliked (toggle off)", async function () {
      const { wishBook } = await loadFixture(deployWishBookFixture);

      await wishBook.leaveWish("Like then unlike", "");
      await wishBook.toggleLike(0);
      await wishBook.toggleLike(0);

      const wishes = await wishBook.getAllWishes();
      expect(wishes[0].likes).to.equal(0);
    });

    it("should allow different users to like the same wish", async function () {
      const { wishBook, otherUser } = await loadFixture(deployWishBookFixture);

      await wishBook.leaveWish("Shared like", "");

      await wishBook.toggleLike(0);
      await wishBook.connect(otherUser).toggleLike(0);

      const wishes = await wishBook.getAllWishes();
      expect(wishes[0].likes).to.equal(2);
    });

    it("should emit LikeToggled event with correct parameters", async function () {
      const { wishBook, owner } = await loadFixture(deployWishBookFixture);

      await wishBook.leaveWish("Emit test", "");

      await expect(wishBook.toggleLike(0))
        .to.emit(wishBook, "LikeToggled")
        .withArgs(owner.address, 0, true);
    });
    it("should revert if wish ID does not exist", async function () {
      const { wishBook } = await loadFixture(deployWishBookFixture);
      await expect(wishBook.toggleLike(999)).to.be.revertedWith("Invalid wish ID");
    });
    it("should not change isDeleted status when liking", async function () {
      const { wishBook } = await loadFixture(deployWishBookFixture);

      await wishBook.leaveWish("Will be liked", "");
      const wishesBefore = await wishBook.getAllWishes();
      expect(wishesBefore[0].isDeleted).to.equal(false);

      await wishBook.toggleLike(0);
      const wishesAfter = await wishBook.getAllWishes();
      expect(wishesAfter[0].isDeleted).to.equal(false);
    });

    it("should return liked wish IDs for the user", async function () {
      const { wishBook, otherUser } = await loadFixture(deployWishBookFixture);

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

});
