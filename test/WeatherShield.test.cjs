const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WeatherShield", function () {
  let contract;
  let mockPriceFeed;
  let owner, user1, user2, lp1, lp2;

  beforeEach(async function () {
    [owner, user1, user2, lp1, lp2] = await ethers.getSigners();

    // Deploy mock price feed (ETH/USD = $2000)
    const MockFeed = await ethers.getContractFactory("MockV3Aggregator");
    mockPriceFeed = await MockFeed.deploy(8, 200000000000n); // 8 decimals, $2000
    await mockPriceFeed.waitForDeployment();

    // Deploy WeatherShield with price feed
    const Factory = await ethers.getContractFactory("WeatherShield");
    contract = await Factory.deploy(await mockPriceFeed.getAddress());
    await contract.waitForDeployment();

    // Fund for payouts
    await owner.sendTransaction({
      to: await contract.getAddress(),
      value: ethers.parseEther("10")
    });
  });

  // ────── Deployment ──────
  describe("deployment", function () {
    it("sets owner correctly", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("owner is CRE authorized", async function () {
      expect(await contract.creAuthorized()).to.equal(owner.address);
    });

    it("has correct defaults", async function () {
      expect(await contract.policyCounter()).to.equal(0);
      expect(await contract.minPremium()).to.equal(ethers.parseEther("0.001"));
    });

    it("is an ERC-721 token", async function () {
      expect(await contract.name()).to.equal("WeatherShield Policy");
      expect(await contract.symbol()).to.equal("WSP");
    });
  });

  // ────── Chainlink Price Feed ──────
  describe("price feed", function () {
    it("returns ETH/USD price", async function () {
      const price = await contract.getEthUsdPrice();
      expect(price).to.equal(200000000000n); // $2000 with 8 decimals
    });

    it("converts ETH to USD", async function () {
      const usd = await contract.ethToUsd(ethers.parseEther("1"));
      expect(usd).to.equal(200000000000n); // 1 ETH = $2000
    });
  });

  // ────── Risk-Based Pricing ──────
  describe("risk pricing", function () {
    it("returns Low risk for conservative drought threshold", async function () {
      const tier = await contract.getRiskTier(0, 20); // Drought, threshold 20
      expect(tier).to.equal(0); // Low
    });

    it("returns Critical risk for aggressive drought threshold", async function () {
      const tier = await contract.getRiskTier(0, 150); // Drought, threshold 150
      expect(tier).to.equal(3); // Critical
    });

    it("calculates coverage with risk multiplier", async function () {
      const premium = ethers.parseEther("0.1");
      const coverage = await contract.calculateCoverage(premium, 0, 20); // Low risk
      expect(coverage).to.equal(premium * 12n); // 12x for Low
    });

    it("lower multiplier for higher risk", async function () {
      const premium = ethers.parseEther("0.1");
      const coverageLow = await contract.calculateCoverage(premium, 0, 20);
      const coverageCritical = await contract.calculateCoverage(premium, 0, 150);
      expect(coverageLow).to.be.greaterThan(coverageCritical);
    });
  });

  // ────── Policies & NFT ──────
  describe("policies", function () {
    it("can purchase policy and mint NFT", async function () {
      const premium = ethers.parseEther("0.01");

      await expect(
        contract.connect(user1).purchasePolicy(0, 100, "40.71,-74.00", { value: premium })
      ).to.emit(contract, "PolicyCreated");

      expect(await contract.policyCounter()).to.equal(1);

      // Check NFT was minted
      expect(await contract.ownerOf(0)).to.equal(user1.address);
      expect(await contract.balanceOf(user1.address)).to.equal(1);
    });

    it("generates on-chain tokenURI", async function () {
      await contract.connect(user1).purchasePolicy(0, 100, "40.71,-74.00", {
        value: ethers.parseEther("0.01")
      });

      const uri = await contract.tokenURI(0);
      expect(uri).to.include("data:application/json;base64,");
    });

    it("prevents transfer of active policy (soulbound)", async function () {
      await contract.connect(user1).purchasePolicy(0, 100, "40.71,-74.00", {
        value: ethers.parseEther("0.01")
      });

      await expect(
        contract.connect(user1).transferFrom(user1.address, user2.address, 0)
      ).to.be.revertedWith("Active policies are soulbound");
    });

    it("rejects low premium", async function () {
      await expect(
        contract.connect(user1).purchasePolicy(0, 100, "40.71,-74.00", { value: ethers.parseEther("0.0001") })
      ).to.be.revertedWith("Premium too low");
    });

    it("rejects empty location", async function () {
      await expect(
        contract.connect(user1).purchasePolicy(0, 100, "", { value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("Need location");
    });
  });

  // ────── Multi-Source Weather ──────
  describe("multi-source weather", function () {
    it("owner can update single-source weather", async function () {
      await expect(
        contract.updateWeatherData("40.71,-74.00", 50)
      ).to.emit(contract, "WeatherDataUpdated");

      const data = await contract.getWeatherData("40.71,-74.00");
      expect(data.value).to.equal(50);
      expect(data.isValid).to.be.true;
      expect(data.sourceCount).to.equal(1);
    });

    it("updates with multi-source median", async function () {
      await contract.updateWeatherDataMultiSource("40.71,-74.00", 45, 55, 50);

      const data = await contract.getWeatherData("40.71,-74.00");
      expect(data.value).to.equal(50); // Median of 45, 55, 50
      expect(data.sourceCount).to.equal(3);
    });

    it("calculates correct median (sorted)", async function () {
      await contract.updateWeatherDataMultiSource("test", 100, 50, 75);
      const data = await contract.getWeatherData("test");
      expect(data.value).to.equal(75); // Median
    });

    it("non-owner cant update weather", async function () {
      await expect(
        contract.connect(user1).updateWeatherData("40.71,-74.00", 50)
      ).to.be.revertedWith("Not authorized");
    });
  });

  // ────── Claims ──────
  describe("claims", function () {
    beforeEach(async function () {
      await contract.connect(user1).purchasePolicy(0, 100, "40.71,-74.00", {
        value: ethers.parseEther("0.1")
      });
    });

    it("processes claim when conditions met", async function () {
      await contract.updateWeatherData("40.71,-74.00", 50);

      const balBefore = await ethers.provider.getBalance(user1.address);
      await expect(contract.processClaim(0, 50)).to.emit(contract, "PolicyClaimed");
      const balAfter = await ethers.provider.getBalance(user1.address);

      expect(balAfter - balBefore).to.be.greaterThan(0);

      const policy = await contract.getPolicy(0);
      expect(policy.status).to.equal(1); // Claimed
    });

    it("rejects if conditions not met", async function () {
      await contract.updateWeatherData("40.71,-74.00", 150);
      await expect(contract.processClaim(0, 150)).to.be.revertedWith("Conditions not met");
    });

    it("rejects claim for expired policy", async function () {
      await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      await contract.updateWeatherData("40.71,-74.00", 50);
      await expect(contract.processClaim(0, 50)).to.be.revertedWith("Expired");
    });

    it("rejects double claim", async function () {
      await contract.updateWeatherData("40.71,-74.00", 50);
      await contract.processClaim(0, 50);
      await expect(contract.processClaim(0, 50)).to.be.revertedWith("Not active");
    });
  });

  // ────── Cancel ──────
  describe("cancel", function () {
    it("can cancel early for 50% refund", async function () {
      const premium = ethers.parseEther("0.1");
      await contract.connect(user1).purchasePolicy(0, 100, "40.71,-74.00", { value: premium });

      const balBefore = await ethers.provider.getBalance(user1.address);
      const tx = await contract.connect(user1).cancelPolicy(0);
      const receipt = await tx.wait();
      const gas = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(user1.address);

      const refund = balAfter - balBefore + gas;
      expect(refund).to.equal(premium / 2n);
    });
  });

  // ────── Liquidity Pool ──────
  describe("liquidity pool", function () {
    it("can deposit liquidity", async function () {
      const amount = ethers.parseEther("1");
      await expect(
        contract.connect(lp1).depositLiquidity({ value: amount })
      ).to.emit(contract, "LiquidityDeposited");

      const pos = await contract.lpPositions(lp1.address);
      expect(pos.deposited).to.equal(amount);
      expect(pos.shares).to.be.greaterThan(0);
    });

    it("can withdraw liquidity", async function () {
      await contract.connect(lp1).depositLiquidity({ value: ethers.parseEther("2") });
      const pos = await contract.lpPositions(lp1.address);

      const balBefore = await ethers.provider.getBalance(lp1.address);
      await contract.connect(lp1).withdrawLiquidity(pos.shares);
      const balAfter = await ethers.provider.getBalance(lp1.address);

      expect(balAfter).to.be.greaterThan(balBefore);
    });

    it("gets LP value", async function () {
      await contract.connect(lp1).depositLiquidity({ value: ethers.parseEther("5") });
      const value = await contract.getLPValue(lp1.address);
      expect(value).to.equal(ethers.parseEther("5"));
    });

    it("pool stats are correct", async function () {
      await contract.connect(lp1).depositLiquidity({ value: ethers.parseEther("3") });

      const stats = await contract.getPoolStats();
      expect(stats._totalLiquidity).to.equal(ethers.parseEther("3"));
    });
  });

  // ────── Governance ──────
  describe("governance", function () {
    beforeEach(async function () {
      // Make lp1 and lp2 liquidity providers
      await contract.connect(lp1).depositLiquidity({ value: ethers.parseEther("3") });
      await contract.connect(lp2).depositLiquidity({ value: ethers.parseEther("1") });
    });

    it("LP can create proposal", async function () {
      await expect(
        contract.connect(lp1).proposeParameterChange("minPremium", ethers.parseEther("0.01"))
      ).to.emit(contract, "ProposalCreated");
    });

    it("LP can vote on proposal", async function () {
      await contract.connect(lp1).proposeParameterChange("minPremium", ethers.parseEther("0.01"));

      await expect(
        contract.connect(lp1).voteOnProposal(0, true)
      ).to.emit(contract, "VoteCast");
    });

    it("prevents double voting", async function () {
      await contract.connect(lp1).proposeParameterChange("minPremium", ethers.parseEther("0.01"));
      await contract.connect(lp1).voteOnProposal(0, true);

      await expect(
        contract.connect(lp1).voteOnProposal(0, true)
      ).to.be.revertedWith("Already voted");
    });

    it("non-LP cannot propose", async function () {
      await expect(
        contract.connect(user1).proposeParameterChange("minPremium", 100)
      ).to.be.revertedWith("Not a liquidity provider");
    });

    it("can execute approved proposal", async function () {
      await contract.connect(lp1).proposeParameterChange("minPremium", ethers.parseEther("0.005"));
      await contract.connect(lp1).voteOnProposal(0, true);
      await contract.connect(lp2).voteOnProposal(0, true);

      // Fast forward past voting period
      await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");

      await contract.executeProposal(0);

      expect(await contract.minPremium()).to.equal(ethers.parseEther("0.005"));
    });
  });
});
