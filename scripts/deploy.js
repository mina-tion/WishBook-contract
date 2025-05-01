const hre = require("hardhat");

async function main() {
  const WishBook = await hre.ethers.getContractFactory("WishBook");

  const wishBook = await WishBook.deploy();
  console.log("WishBook deployed to:", wishBook.target);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
