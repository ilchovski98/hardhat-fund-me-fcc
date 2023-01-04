const { expect, assert } = require("chai");
const { deployments, ethers, getNamedAccounts } = require("hardhat");
const { developmentChains } = require('../../helper-hardhat-config');

!developmentChains.includes(network.name) 
? describe.skip
: describe("FundMe", function() {
    let fundMe;
    let deployer;
    let mockV3Aggregator;
    const sendValue = ethers.utils.parseEther("1");
    
    beforeEach(async function() {
      // Another way to get accounts is by using await ethers.getSigners()
      // It returns the specified accounts in the hardhat.config.js for each network:
      // goerli: {
      //   url: GOERLI_RPC_URL,
      //   accounts: [PRIVATE_KEY], <---------------------
      //   chainId: 5,
      //   blockConfirmations: 10
      // },

      // Example:
      // const accounts = await ethers.getSigners();
      // const accountOne = accounts[0];

      // doing the same thing just to be able to save the deployer address in the let variable above:
      //const { deployer } = await getNamedAccounts();
      deployer = (await getNamedAccounts()).deployer;

      // fixture (from hardhat-deploy) - deployment snapshot on contracts based on tags
      // fixture function runs the deployment scripts once and creates a snapshot of them
      // this way hardhat avoids the deployment process for each little test and reuses the snapshot of the contracts
      await deployments.fixture(["all"]);
      // hardhat-deploy gets the most recent deployment of the FundMe contract
      fundMe = await ethers.getContract("FundMe", deployer);
      mockV3Aggregator = await ethers.getContract('MockV3Aggregator', deployer);
    });

    describe("Constructor", function() {
      it("sets the aggregator addresses correctly", async function() {
        const response = await fundMe.getPriceFeed();
        assert.equal(response, mockV3Aggregator.address);
      });
    });

    describe("fund", function() {
      it("Fails if you don't send enough ETH", async function() {
        await expect(fundMe.fund()).to.be.revertedWith("You need to spend more ETH!");
      });

      it("updated the amount funded data structure", async function() {
        await fundMe.fund({ value: sendValue });
        await fundMe.fund({ value: sendValue });
        const response = await fundMe.getAddressToAmountFunded(deployer);
        assert.equal(response.toString(), (sendValue * 2).toString());
      });

      it("updated the funders data structure", async function() {
        await fundMe.fund({ value: sendValue });
        const funder = await fundMe.getFunder(0);
        assert.equal(funder, deployer);
      });
    });

    describe("Withdraw", function() {
      beforeEach(async function() {
        await fundMe.fund({ value: sendValue });
      });
      
      it("withdraw ETH from a single founder", async function() {
        // Arrange
        const startingFundMeBalance = await fundMe.provider.getBalance(fundMe.address);
        const startingDeployer = await fundMe.provider.getBalance(deployer);

        // Act
        const transactionResponse = await fundMe.withdraw();
        const transactionReceipt = await transactionResponse.wait(1);
        const { gasUsed, effectiveGasPrice } = transactionReceipt;
        const gasCost = gasUsed.mul(effectiveGasPrice);
        const endingFundingBalance = await fundMe.provider.getBalance(fundMe.address);
        const endingDeployerBalance = await fundMe.provider.getBalance(deployer);
        
        // Assert
        assert.equal(endingFundingBalance, 0);
        assert.equal(endingDeployerBalance.add(gasCost).toString(), startingFundMeBalance.add(startingDeployer).toString());
      });

      it("cheaperWithdraw ETH from a single founder", async function() {
        // Arrange
        const startingFundMeBalance = await fundMe.provider.getBalance(fundMe.address);
        const startingDeployer = await fundMe.provider.getBalance(deployer);

        // Act
        const transactionResponse = await fundMe.cheaperWithdraw();
        const transactionReceipt = await transactionResponse.wait(1);
        const { gasUsed, effectiveGasPrice } = transactionReceipt;
        const gasCost = gasUsed.mul(effectiveGasPrice);
        const endingFundingBalance = await fundMe.provider.getBalance(fundMe.address);
        const endingDeployerBalance = await fundMe.provider.getBalance(deployer);
        
        // Assert
        assert.equal(endingFundingBalance, 0);
        assert.equal(endingDeployerBalance.add(gasCost).toString(), startingFundMeBalance.add(startingDeployer).toString());
      });

      it("allows us to withdraw with multiple getFunder", async function() {
        const accounts = await ethers.getSigners();
        for (let i = 1; i < 6; i++) {
          const currentFundMeContract = await fundMe.connect(accounts[i]);
          const transactionResponse = await currentFundMeContract.fund({ value: sendValue });
          transactionResponse.wait(1);
        }

        const startingFundMeBalance = await fundMe.provider.getBalance(fundMe.address);
        const startingDeployer = await fundMe.provider.getBalance(deployer);

        const transactionResponse = await fundMe.withdraw();
        const transactionReceipt = await transactionResponse.wait(1);
        const { gasUsed, effectiveGasPrice } = transactionReceipt;
        const gasCost = gasUsed.mul(effectiveGasPrice);
        const endingFundingBalance = await fundMe.provider.getBalance(fundMe.address);
        const endingDeployerBalance = await fundMe.provider.getBalance(deployer);

        assert.equal(endingFundingBalance, 0);
        assert.equal(endingDeployerBalance.add(gasCost).toString(), startingFundMeBalance.add(startingDeployer).toString());

        // Make sure that the getFunder are reset properly
        await expect(fundMe.getFunder(0)).to.be.reverted;

        for (let i = 1; i < 6; i++) {
          assert.equal((await fundMe.getAddressToAmountFunded(accounts[i].address)).toString(), "0");
        }
      });

      it("Cheaper withdraw testing...", async function() {
        const accounts = await ethers.getSigners();
        for (let i = 1; i < 6; i++) {
          const currentFundMeContract = await fundMe.connect(accounts[i]);
          const transactionResponse = await currentFundMeContract.fund({ value: sendValue });
          transactionResponse.wait(1);
        }

        const startingFundMeBalance = await fundMe.provider.getBalance(fundMe.address);
        const startingDeployer = await fundMe.provider.getBalance(deployer);

        const transactionResponse = await fundMe.cheaperWithdraw();
        const transactionReceipt = await transactionResponse.wait(1);
        const { gasUsed, effectiveGasPrice } = transactionReceipt;
        const gasCost = gasUsed.mul(effectiveGasPrice);
        const endingFundingBalance = await fundMe.provider.getBalance(fundMe.address);
        const endingDeployerBalance = await fundMe.provider.getBalance(deployer);

        assert.equal(endingFundingBalance, 0);
        assert.equal(endingDeployerBalance.add(gasCost).toString(), startingFundMeBalance.add(startingDeployer).toString());

        // Make sure that the getFunder are reset properly
        await expect(fundMe.getFunder(0)).to.be.reverted;

        for (let i = 1; i < 6; i++) {
          assert.equal((await fundMe.getAddressToAmountFunded(accounts[i].address)).toString(), "0");
        }
      });

      it("Only allows the owner to withdraw", async function() {
        const accounts = await ethers.getSigners();
        const attacker = accounts[1];
        const connectAttackerToContract = await fundMe.connect(attacker);
        await expect(connectAttackerToContract.withdraw()).to.be.revertedWithCustomError(connectAttackerToContract, "FundMe__NotOwner");
      });
    });
  })
