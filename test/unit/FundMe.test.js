const { network, deployments, ethers, getNamedAccounts } = require("hardhat");
const { assert, expect } = require("chai");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("FundMe", async function () {
      let fundMe;
      let deployer;
      let mockV3Aggregator;
      const sendValue = ethers.utils.parseEther("1");

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;

        // Runs thru the deploy folder and deploys everthing in it
        await deployments.fixture(["all"]);

        // it get the most recent deployed contract
        fundMe = await ethers.getContract("FundMe", deployer);
        mockV3Aggregator = await ethers.getContract(
          "MockV3Aggregator",
          deployer
        );
      });

      describe("constructor", async function () {
        it("sets the aggregator addresses correctly", async () => {
          const response = await fundMe.priceFeed();
          assert.equal(response, mockV3Aggregator.address);
        });
      });

      describe("fund", async function () {
        it("Fails if you dont send enough ETH", async function () {
          await expect(fundMe.fund()).to.be.revertedWith(
            "You need to spend more ETH!"
          );
        });
        it("Updates the amount funded data structure", async () => {
          await fundMe.fund({ value: sendValue });
          const response = await fundMe.addressToAmountFunded(deployer);
          assert.equal(response.toString(), sendValue.toString());
        });

        it("Adds funder to array of funders", async () => {
          await fundMe.fund({ value: sendValue });
          const response = await fundMe.funders(0);
          assert.equal(response, deployer);
        });
      });

      describe("withdraw", function () {
        beforeEach(async () => {
          await fundMe.fund({ value: sendValue });
        });
        it("withdraws ETH from a single funder", async () => {
          // Arrange
          // ** Balance of the contract add before withdraw ** //
          const startingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          );
          // ** Balance of the deployer before withdraw ** //
          const startingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          );

          // Act
          const transactionResponse = await fundMe.withdraw();
          const transactionReceipt = await transactionResponse.wait(1);

          const { gasUsed, effectiveGasPrice } = transactionReceipt;
          const gasCost = gasUsed.mul(effectiveGasPrice);
          // ** Balance of the contract after before withdraw ** //
          const endingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          );

          // get gasCost//

          // ** Balance of the contract after before withdraw ** //
          const endingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          );

          // Assert
          // Maybe clean up to understand the testing
          assert.equal(endingFundMeBalance, 0);
          assert.equal(
            startingFundMeBalance.add(startingDeployerBalance).toString(),
            endingDeployerBalance.add(gasCost).toString()
          );
        });

        it("is allows us to withdraw with multiple funders", async () => {
          const accounts = await ethers.getSigners();
          // Loop thru accounts and have each account call the Fund Function
          for (i = 1; i < 6; i++) {
            // Connect each deployer(account) to the FundMe Contract.
            const fundMeConnectedContract = await fundMe.connect(accounts[i]);
            await fundMeConnectedContract.fund({ value: sendValue });
          }
          const startingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          );
          const startingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          );

          /* ACT */
          const transactionResponse = await fundMe.withdraw();
          const transactionReceipt = await transactionResponse.wait();
          const { gasUsed, effectiveGasPrice } = transactionReceipt;
          const gasCost = gasUsed.mul(effectiveGasPrice);

          /* ASSERT */
          const endingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          );
          const endingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          );
          assert.equal(endingFundMeBalance, 0);
          assert.equal(
            startingFundMeBalance.add(startingDeployerBalance).toString(),
            endingDeployerBalance.add(gasCost).toString()
          );

          // Mkae sure funders and mappingOfAddressToAmount is ZERO
          await expect(fundMe.funders(0)).to.be.reverted;
          for (i = 1; i < 6; i++) {
            assert.equal(
              await fundMe.addressToAmountFunded(accounts[i].address),
              0
            );
          }
        });

        it("Only allows the owner to withdraw", async function () {
          const accounts = await ethers.getSigners();
          const fundMeConnectedContract = await fundMe.connect(accounts[1]);
          await expect(fundMeConnectedContract.withdraw()).to.be.reverted;
        });
      });
    });
