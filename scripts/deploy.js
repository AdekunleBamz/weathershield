const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying WeatherShield...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deploying with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Deploy WeatherShield
  console.log("📝 Deploying WeatherShield contract...");
  const WeatherShield = await hre.ethers.getContractFactory("WeatherShield");
  const weatherShield = await WeatherShield.deploy();
  await weatherShield.waitForDeployment();
  
  const contractAddress = await weatherShield.getAddress();
  console.log("✅ WeatherShield deployed to:", contractAddress);

  // Fund the contract for payouts (on testnet, send some ETH)
  console.log("\n💸 Funding contract for payouts...");
  const fundTx = await deployer.sendTransaction({
    to: contractAddress,
    value: hre.ethers.parseEther("0.1") // Fund with 0.1 ETH for testing
  });
  await fundTx.wait();
  console.log("✅ Contract funded with 0.1 ETH");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: contractAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber()
  };

  // Create deployments folder if it doesn't exist
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save deployment info
  const deploymentPath = path.join(deploymentsDir, `${hre.network.name}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n📁 Deployment info saved to:", deploymentPath);

  // Update frontend .env
  const frontendEnvPath = path.join(__dirname, "..", "frontend", ".env");
  fs.writeFileSync(frontendEnvPath, `VITE_CONTRACT_ADDRESS=${contractAddress}\n`);
  console.log("📁 Frontend .env updated with contract address");

  // Copy ABI to frontend
  const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "WeatherShield.sol", "WeatherShield.json");
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const frontendAbiPath = path.join(__dirname, "..", "frontend", "src", "abi", "WeatherShield.json");
    fs.writeFileSync(frontendAbiPath, JSON.stringify({ abi: artifact.abi }, null, 2));
    console.log("📁 ABI copied to frontend");
  }

  console.log("\n" + "=".repeat(50));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(50));
  console.log("\n📋 Contract Address:", contractAddress);
  console.log("🌐 Network:", hre.network.name);
  console.log("\n📌 Next Steps:");
  console.log("1. Verify contract: npx hardhat verify --network", hre.network.name, contractAddress);
  console.log("2. Start frontend: cd frontend && npm run dev");
  console.log("3. Update CRE workflow with contract address");
  
  return contractAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
