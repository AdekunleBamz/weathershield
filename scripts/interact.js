const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Interact with deployed WeatherShield contract
 * Usage: npx hardhat run scripts/interact.js --network <network>
 */

async function main() {
  // Load deployment info
  const deploymentPath = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ No deployment found for network:", hre.network.name);
    console.log("   Run: npm run deploy:" + hre.network.name + " first");
    return;
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  console.log("📋 Contract Address:", deployment.contractAddress);
  
  const [signer] = await hre.ethers.getSigners();
  console.log("👤 Using account:", signer.address);
  
  // Get contract instance
  const WeatherShield = await hre.ethers.getContractFactory("WeatherShield");
  const contract = WeatherShield.attach(deployment.contractAddress);
  
  // Display contract info
  console.log("\n📊 Contract Status:");
  console.log("   Total Policies:", (await contract.policyCounter()).toString());
  console.log("   Total Premiums:", hre.ethers.formatEther(await contract.totalPremiumsCollected()), "ETH");
  console.log("   Total Payouts:", hre.ethers.formatEther(await contract.totalPayouts()), "ETH");
  console.log("   Contract Balance:", hre.ethers.formatEther(await contract.getContractBalance()), "ETH");
  
  // Example: Purchase a policy
  console.log("\n🛡️ Purchasing test policy...");
  
  const tx = await contract.purchasePolicy(
    0, // Drought
    100, // Threshold: 10mm
    "40.7128,-74.0060", // NYC
    { value: hre.ethers.parseEther("0.01") }
  );
  
  const receipt = await tx.wait();
  console.log("✅ Policy purchased! Tx:", receipt.hash);
  
  // Get the policy
  const policyCount = await contract.policyCounter();
  const policyId = policyCount - 1n;
  const policy = await contract.getPolicy(policyId);
  
  console.log("\n📄 Policy Details:");
  console.log("   ID:", policyId.toString());
  console.log("   Holder:", policy.holder);
  console.log("   Premium:", hre.ethers.formatEther(policy.premium), "ETH");
  console.log("   Coverage:", hre.ethers.formatEther(policy.coverageAmount), "ETH");
  console.log("   Location:", policy.location);
  console.log("   Threshold:", policy.triggerThreshold.toString());
  
  // Simulate weather update
  console.log("\n🌤️ Updating weather data...");
  const weatherTx = await contract.updateWeatherData("40.7128,-74.0060", 50); // 5mm rainfall
  await weatherTx.wait();
  console.log("✅ Weather data updated!");
  
  // Check if claimable
  const claimable = await contract.isPolicyClaimable(policyId);
  console.log("\n🎯 Policy Claimable:", claimable ? "YES ✅" : "NO ❌");
  
  if (claimable) {
    console.log("   Claim would be triggered because rainfall (5mm) < threshold (10mm)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
