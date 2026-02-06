const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WeatherShield", function () {
  let contract;
  let owner, user1, user2;
  
  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const Factory = await ethers.getContractFactory("WeatherShield");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
    
    // fund for payouts
    await owner.sendTransaction({
      to: await contract.getAddress(),
      value: ethers.parseEther("10")
    });
  });
  
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
      expect(await contract.maxCoverageMultiplier()).to.equal(10);
    });
  });
  
  describe("policies", function () {
    it("can purchase policy", async function () {
      const premium = ethers.parseEther("0.01");
      
      await expect(
        contract.connect(user1).purchasePolicy(0, 100, "40.71,-74.00", { value: premium })
      ).to.emit(contract, "PolicyCreated");
      
      expect(await contract.policyCounter()).to.equal(1);
      
      const policy = await contract.getPolicy(0);
      expect(policy.holder).to.equal(user1.address);
      expect(policy.premium).to.equal(premium);
      expect(policy.coverageAmount).to.equal(premium * 10n);
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
  
  describe("weather updates", function () {
    it("owner can update weather", async function () {
      await expect(
        contract.updateWeatherData("40.71,-74.00", 50)
      ).to.emit(contract, "WeatherDataUpdated");
      
      const data = await contract.getWeatherData("40.71,-74.00");
      expect(data.value).to.equal(50);
      expect(data.isValid).to.be.true;
    });
    
    it("non-owner cant update", async function () {
      await expect(
        contract.connect(user1).updateWeatherData("40.71,-74.00", 50)
      ).to.be.revertedWith("Not authorized");
    });
  });
  
  describe("claims", function () {
    beforeEach(async function () {
      // create a drought policy - triggers if precip < 100
      await contract.connect(user1).purchasePolicy(0, 100, "40.71,-74.00", { 
        value: ethers.parseEther("0.1") 
      });
    });
    
    it("processes claim when conditions met", async function () {
      // update weather to 50 (below 100 threshold)
      await contract.updateWeatherData("40.71,-74.00", 50);
      
      const balBefore = await ethers.provider.getBalance(user1.address);
      
      await expect(
        contract.processClaim(0, 50)
      ).to.emit(contract, "PolicyClaimed");
      
      const balAfter = await ethers.provider.getBalance(user1.address);
      expect(balAfter - balBefore).to.equal(ethers.parseEther("1")); // 10x premium
      
      const policy = await contract.getPolicy(0);
      expect(policy.status).to.equal(1); // Claimed
    });
    
    it("rejects if conditions not met", async function () {
      // precip at 150, above 100 threshold
      await contract.updateWeatherData("40.71,-74.00", 150);
      
      await expect(
        contract.processClaim(0, 150)
      ).to.be.revertedWith("Conditions not met");
    });
  });
  
  describe("cancel", function () {
    it("can cancel early for 50% refund", async function () {
      const premium = ethers.parseEther("0.1");
      await contract.connect(user1).purchasePolicy(0, 100, "40.71,-74.00", { value: premium });
      
      const balBefore = await ethers.provider.getBalance(user1.address);
      const tx = await contract.connect(user1).cancelPolicy(0);
      const receipt = await tx.wait();
      const gas = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(user1.address);
      
      // should get back ~0.05 ETH minus gas
      const refund = balAfter - balBefore + gas;
      expect(refund).to.equal(premium / 2n);
    });
  });
});
