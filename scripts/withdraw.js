const { getNamedAccounts, ethers } = require("hardhat");

async function main() {
  const { deployer } = await getNamedAccounts();
  const fundMe = await ethers.getContract("FundMe", deployer);
  console.log('Withdraw contract...');
  const transactionResponse = await fundMe.withdraw();
  transactionResponse.wait(1);
  console.log('Withdrawed!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error);
    process.exit(1);
  })
