const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WeatherShield", function () {
  let weatherShield;
  let owner;
  let user1;
  let user2;
  
  const WEATHER_TYPE = {
    DROUGHT: 0,
    FLOOD: 1,
    FROST: 2,
    HEAT: 3
  };
  
  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const WeatherShield = await ethers.getContractFactory("WeatherShield");
    weatherShield = await WeatherShield.deploy();
    await weatherShield.waitForDeployment();
    
    // Fund contract for payouts
    await owner.sendTransaction({
      to: await weatherShield.getAddress(),
      value: ethers.parseEther("10")
    });
  });
  
  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await weatherShield.owner()).to.equal(owner.address);
    });
    
    it("Should set owner as CRE authorized", async function () {
      expect(await weatherShield.creAuthorized()).to.equal(owner.address);
    });
    
    it("Should have correct initial values", async function () {
      expect(await weatherShield.policyCounter()).to.equal(0);
      expect(await weatherShield.minPremium()).to.equal(ethers.parseEther("0.001"));
      expect(await weatherShield.maxCoverageMultiplier()).to.equal(10);
    });
  });
  
  describe("Policy Purchase", function () {
    it("Should allow purchasing a drought policy", async function () {
      const premium = ethers.parseEther("0.01");
      const threshold = 100; // 10mm rainfall
      const location = "40.7128,-74.0060";
      
      await expect(
        weatherShield.connect(user1).purchasePolicy(
          WEATHER_TYPE.DROUGHT,
          threshold,
          location,
          { value: premium }
        )
      ).to.emit(weatherShield, "PolicyCreated");
      
      expect(await weatherShield.policyCounter()).to.equal(1);
      
      const policy = await weatherShield.getPolicy(0);
      expect(policy.holder).to.equal(user1.address);
      expect(policy.premium).to.equal(premium);
      expect(policy.coverageAmount).to.equal(premium * 10n);
      expect(policy.weatherType).to.equal(WEATHER_TYPE.DROUGHT);
      expect(policy.triggerThreshold).to.equal(threshold);
      expect(policy.location).to.equal(location);
    });
    
    it("Should reject premium below minimum", async function () {
      await expect(
        weatherShield.connect(user1).purchasePolicy(
          WEATHER_TYPE.DROUGHT,
          100,
          "40.7128,-74.0060",
          { value: ethers.parseEther("0.0001") }
        )
      ).to.be.revertedWith("Premium below minimum");
    });
    
    it("Should track user policies", async function () {
      const premium = ethers.parseEther("0.01");
      
      await weatherShield.connect(user1).purchasePolicy(
        WEATHER_TYPE.DROUGHT, 100, "loc1", { value: premium }
      );
      await weatherShield.connect(user1).purchasePolicy(
        WEATHER_TYPE.FLOOD, 200, "loc2", { value: premium }
      );
      
      const userPolicies = await weatherShield.getUserPolicies(user1.address);
      expect(userPolicies.length).to.equal(2);
      expect(userPolicies[0]).to.equal(0);
      expect(userPolicies[1]).to.equal(1);
    });
  });
  
  describe("Weather Data Update", function () {
    it("Should allow CRE to update weather data", async function () {
      const location = "40.7128,-74.0060";
      const value = 50; // 5mm rainfall
      
      await expect(
        weatherShield.updateWeatherData(location, value)
      ).to.emit(weatherShield, "WeatherDataUpdated");
      
      const data = await weatherShield.getWeatherData(location);
      expect(data.value).to.equal(value);
      expect(data.isValid).to.be.true;
    });
    
    it("Should reject non-authorized weather updates", async function () {
      await expect(
        weatherShield.connect(user1).updateWeatherData("loc", 50)
      ).to.be.revertedWith("Not authorized: CRE or owner only");
    });
  });
  
  describe("Claim Processing", function () {
    let policyId;
    const location = "40.7128,-74.0060";
    const premium = ethers.parseEther("0.1");
    const droughtThreshold = 100; // Trigger if rainfall < 10mm
    
    beforeEach(async function () {
      // Create a drought policy
      await weatherShield.connect(user1).purchasePolicy(
        WEATHER_TYPE.DROUGHT,
        droughtThreshold,
        location,
        { value: premium }
      );
      policyId = 0;
    });
    
    it("Should process claim when drought condition is met", async function () {
      // Set weather below threshold (drought condition)
      const currentRainfall = 50; // 5mm < 10mm threshold
      await weatherShield.updateWeatherData(location, currentRainfall);
      
      const initialBalance = await ethers.provider.getBalance(user1.address);
      
      await expect(
        weatherShield.processClaim(policyId, currentRainfall)
      ).to.emit(weatherShield, "PolicyClaimed");
      
      const finalBalance = await ethers.provider.getBalance(user1.address);
      const payout = premium * 10n; // 10x coverage
      
      expect(finalBalance - initialBalance).to.equal(payout);
      
      const policy = await weatherShield.getPolicy(policyId);
      expect(policy.status).to.equal(1); // Claimed
    });
    
    it("Should reject claim when conditions not met", async function () {
      // Set weather above threshold (no drought)
      const currentRainfall = 150; // 15mm > 10mm threshold
      await weatherShield.updateWeatherData(location, currentRainfall);
      
      await expect(
        weatherShield.processClaim(policyId, currentRainfall)
      ).to.be.revertedWith("Trigger condition not met");
    });
    
    it("Should correctly identify claimable policies", async function () {
      // Set drought condition
      await weatherShield.updateWeatherData(location, 50);
      expect(await weatherShield.isPolicyClaimable(policyId)).to.be.true;
      
      // Set normal condition
      await weatherShield.updateWeatherData(location, 150);
      expect(await weatherShield.isPolicyClaimable(policyId)).to.be.false;
    });
  });
  
  describe("Heat Wave Scenario", function () {
    it("Should trigger payout during heat wave", async function () {
      const location = "34.0522,-118.2437"; // LA
      const premium = ethers.parseEther("0.05");
      const heatThreshold = 400; // 40°C
      
      await weatherShield.connect(user1).purchasePolicy(
        WEATHER_TYPE.HEAT,
        heatThreshold,
        location,
        { value: premium }
      );
      
      // Simulate heat wave (45°C)
      await weatherShield.updateWeatherData(location, 450);
      
      const claimable = await weatherShield.isPolicyClaimable(0);
      expect(claimable).to.be.true;
      
      await expect(
        weatherShield.processClaim(0, 450)
      ).to.emit(weatherShield, "PolicyClaimed");
    });
  });
  
  describe("Admin Functions", function () {
    it("Should allow owner to set CRE authorized address", async function () {
      await weatherShield.setCREAuthorized(user2.address);
      expect(await weatherShield.creAuthorized()).to.equal(user2.address);
      
      // New CRE can update weather
      await expect(
        weatherShield.connect(user2).updateWeatherData("loc", 100)
      ).to.not.be.reverted;
    });
    
    it("Should allow owner to adjust parameters", async function () {
      await weatherShield.setMinPremium(ethers.parseEther("0.01"));
      expect(await weatherShield.minPremium()).to.equal(ethers.parseEther("0.01"));
      
      await weatherShield.setMaxCoverageMultiplier(5);
      expect(await weatherShield.maxCoverageMultiplier()).to.equal(5);
    });
  });
  
  // Helper function
  async function getBlockTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
  }
});
