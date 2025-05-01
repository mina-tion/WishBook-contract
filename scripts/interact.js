const hre = require("hardhat");

async function main() {
  const wishbookContract = await hre.ethers.getContractAt("WishBook", '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512');
  await wishbookContract.leaveWish('Hello, Solidity!');
  await wishbookContract.leaveWish('Hello, JS!');
  const wishes = await wishbookContract.getAllWishes();
  console.log('wishes', wishes);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
