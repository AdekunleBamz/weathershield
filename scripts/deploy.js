const hre = require("hardhat");

async function main() {
  console.log("Deploying WeatherShield...");
  
  const WeatherShield = await hre.ethers.getContractFactory("WeatherShield");
  const contract = await WeatherShield.deploy();
  await contract.waitForDeployment();
  
  const addr = await contract.getAddress();
  console.log("WeatherShield deployed to:", addr);
  
  // fund it with some ETH for payouts
  const [owner] = await hre.ethers.getSigners();
  const tx = await owner.sendTransaction({
    to: addr,
    value: hre.ethers.parseEther("0.1")
  });
  await tx.wait();
  console.log("Funded contract with 0.1 ETH");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
