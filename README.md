# 🌦️ WeatherShield

## Parametric Weather Insurance Powered by Chainlink CRE

[![Chainlink CRE](https://img.shields.io/badge/Chainlink-CRE-blue?style=for-the-badge&logo=chainlink)](https://chain.link/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=for-the-badge&logo=solidity)](https://soliditylang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)

---

## 🏆 Hackathon Submission

**Track:** Risk & Compliance / DeFi & Tokenization

**Video Demo:** [Link to your 3-5 minute video]

**Live Demo:** [Link to deployed frontend]

---

## 📋 Table of Contents

- [Overview](#-overview)
- [How It Works](#-how-it-works)
- [Chainlink CRE Integration](#-chainlink-cre-integration)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [CRE Workflow Simulation](#-cre-workflow-simulation)
- [Smart Contract](#-smart-contract)
- [API Integration](#-api-integration)
- [Deployment](#-deployment)
- [Links to Chainlink Files](#-links-to-chainlink-files)

---

## 🌟 Overview

**WeatherShield** is a decentralized parametric insurance platform that automatically pays out claims when weather conditions meet predefined thresholds. No claims adjusters, no paperwork, no delays.

### Key Features

- ☀️ **Drought Protection** - Triggers when rainfall drops below threshold
- 🌊 **Flood Protection** - Triggers when rainfall exceeds threshold  
- ❄️ **Frost Protection** - Triggers when temperature drops below threshold
- 🔥 **Heat Protection** - Triggers when temperature exceeds threshold

### Why Parametric Insurance?

| Traditional Insurance | WeatherShield |
|----------------------|---------------|
| Claims take weeks/months | Automatic payouts in minutes |
| Requires proof & documentation | Based on objective weather data |
| Subjective claim assessment | Transparent trigger conditions |
| High administrative costs | Zero overhead with smart contracts |

---

## ⚙️ How It Works

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  User Purchases │────▶│  CRE Monitors    │────▶│  Auto Payout    │
│  Insurance      │     │  Weather Data    │     │  When Triggered │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
   Pays Premium           Fetches from            Sends Coverage
   on-chain              Open-Meteo API           to Policyholder
```

### User Flow

1. **Purchase Policy**: User selects weather type, location, threshold, and pays premium
2. **Coverage Activated**: Smart contract holds 10x premium as coverage
3. **CRE Monitors**: Chainlink CRE workflow checks weather conditions periodically
4. **Auto-Payout**: When conditions are met, payout is automatically sent

---

## 🔗 Chainlink CRE Integration

WeatherShield uses **Chainlink Compute Runtime Environment (CRE)** as the orchestration layer to:

1. **Fetch External Data**: Connects to Open-Meteo weather API
2. **Transform Data**: Processes weather readings for on-chain use
3. **Update Blockchain**: Writes weather data to the smart contract
4. **Trigger Claims**: Automatically processes payouts when conditions are met

### CRE Workflow Architecture

```yaml
┌─────────────────────────────────────────────────────────────────┐
│                    CRE WORKFLOW                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   TRIGGER    │───▶│  HTTP_REQUEST│───▶│   COMPUTE    │      │
│  │  (Cron/Hook) │    │  (Weather)   │    │  (Transform) │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                  │               │
│                                                  ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ PROCESS_CLAIM│◀───│  EVM_READ    │◀───│  EVM_WRITE   │      │
│  │ (If trigger) │    │ (Claimable?) │    │ (Update data)│      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
weathershield/
├── contracts/                    # Solidity smart contracts
│   ├── WeatherShield.sol        # Main insurance contract ⭐
│   ├── interfaces/
│   │   └── IWeatherShield.sol   # Contract interface
│   └── mocks/
│       └── MockWeatherOracle.sol # Testing mock
├── cre-workflows/               # Chainlink CRE workflows ⭐
│   ├── weather-monitor.yaml     # Main monitoring workflow ⭐
│   └── batch-monitor.yaml       # Batch processing workflow
├── frontend/                    # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx             # Main application
│   │   ├── abi/                # Contract ABIs
│   │   └── index.css           # Styles
│   └── package.json
├── scripts/
│   ├── deploy.js               # Deployment script
│   ├── cre-simulate.js         # CRE workflow simulator ⭐
│   └── interact.js             # Contract interaction
├── test/
│   └── WeatherShield.test.js   # Comprehensive tests
├── cre.config.yaml             # CRE configuration ⭐
├── hardhat.config.cjs          # Hardhat configuration
└── package.json
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js v18+
- MetaMask wallet
- Sepolia testnet ETH (free from [faucets](https://sepoliafaucet.com/))

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/weathershield.git
cd weathershield

# Install dependencies
npm install
cd frontend && npm install && cd ..

# Copy environment file
cp .env.example .env
# Edit .env with your private key and RPC URLs
```

### Compile & Test

```bash
# Compile contracts
npm run compile

# Run tests
npm run test

# Start local node
npm run node
```

### Deploy

```bash
# Deploy to local node
npm run deploy:local

# Deploy to Sepolia
npm run deploy:sepolia
```

### Run Frontend

```bash
npm run frontend:dev
```

---

## 🧪 CRE Workflow Simulation

Test the CRE workflow locally without deploying:

```bash
# Basic simulation (NYC, default settings)
node scripts/cre-simulate.js

# Check drought conditions
node scripts/cre-simulate.js --type 0 --threshold 100

# Check heat wave in Los Angeles
node scripts/cre-simulate.js --lat 34.05 --lon -118.24 --type 3 --threshold 350

# Full help
node scripts/cre-simulate.js --help
```

### Example Output

```
═══════════════════════════════════════════════════════════════
🌦️  WEATHERSHIELD CRE WORKFLOW SIMULATION
═══════════════════════════════════════════════════════════════

📡 Fetching weather data from Open-Meteo API...
   Location: 40.7128, -74.006

✅ Weather data received:
   Current Temperature: 22°C
   Daily Precipitation: 5mm
   Daily Max Temp: 25°C

🔄 Transforming weather data...
   Weather Type: Drought
   Raw Value: 5mm
   Transformed Value: 50

🎯 Checking trigger condition...
   Condition: Drought - value below 10mm
   Current value: 5mm
   Triggered: ✅ YES

🚨 INSURANCE CLAIM WOULD BE TRIGGERED!
```

---

## 📜 Smart Contract

### WeatherShield.sol

The main contract handles:

| Function | Description |
|----------|-------------|
| `purchasePolicy()` | Buy insurance with ETH premium |
| `updateWeatherData()` | CRE updates weather readings |
| `processClaim()` | Automatic payout execution |
| `isPolicyClaimable()` | Check if conditions are met |

### Weather Types & Triggers

| Type | Trigger Condition | Example |
|------|------------------|---------|
| Drought (0) | Rainfall < threshold | < 10mm |
| Flood (1) | Rainfall > threshold | > 100mm |
| Frost (2) | Temp < threshold | < 0°C |
| Heat (3) | Temp > threshold | > 40°C |

### Events

```solidity
event PolicyCreated(uint256 policyId, address holder, uint256 premium, ...);
event PolicyClaimed(uint256 policyId, address holder, uint256 payoutAmount, ...);
event WeatherDataUpdated(string location, int256 value, uint256 timestamp);
```

---

## 🌐 API Integration

### Open-Meteo (FREE - No API Key Required!)

WeatherShield uses [Open-Meteo](https://open-meteo.com/) for weather data:

```
https://api.open-meteo.com/v1/forecast
  ?latitude=40.7128
  &longitude=-74.0060
  &current=temperature_2m,precipitation,rain
  &daily=temperature_2m_max,temperature_2m_min,precipitation_sum
  &timezone=auto
```

**Why Open-Meteo?**
- ✅ 100% Free
- ✅ No API key required
- ✅ No rate limits for reasonable usage
- ✅ Global coverage
- ✅ Reliable uptime

---

## 🔗 Links to Chainlink Files

> **Required for hackathon submission**

| File | Description | Link |
|------|-------------|------|
| **Main CRE Workflow** | Weather monitoring & claim processing | [cre-workflows/weather-monitor.yaml](./cre-workflows/weather-monitor.yaml) |
| **Batch Workflow** | Multi-policy monitoring | [cre-workflows/batch-monitor.yaml](./cre-workflows/batch-monitor.yaml) |
| **CRE Config** | Network & workflow configuration | [cre.config.yaml](./cre.config.yaml) |
| **CRE Simulation** | Local workflow testing | [scripts/cre-simulate.js](./scripts/cre-simulate.js) |
| **Smart Contract** | On-chain insurance logic | [contracts/WeatherShield.sol](./contracts/WeatherShield.sol) |
| **Contract Interface** | CRE integration interface | [contracts/interfaces/IWeatherShield.sol](./contracts/interfaces/IWeatherShield.sol) |

---

## 📊 Architecture Diagram

```
                    ┌─────────────────────────────────────┐
                    │           FRONTEND (React)          │
                    │      Purchase Policy, View Status   │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                        BLOCKCHAIN (Sepolia)                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    WeatherShield.sol                        │  │
│  │  • purchasePolicy()     • updateWeatherData()              │  │
│  │  • processClaim()       • isPolicyClaimable()              │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                                       ▲
                                       │
┌──────────────────────────────────────┴───────────────────────────┐
│                      CHAINLINK CRE                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  weather-monitor.yaml                       │  │
│  │                                                             │  │
│  │   [Cron Trigger] ──▶ [Fetch Weather] ──▶ [Transform]       │  │
│  │                              │                              │  │
│  │                              ▼                              │  │
│  │   [Process Claim] ◀── [Check Claimable] ◀── [Update Chain] │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                                       ▲
                                       │
                    ┌──────────────────┴──────────────────┐
                    │         OPEN-METEO API (FREE)       │
                    │    Temperature, Precipitation, etc   │
                    └─────────────────────────────────────┘
```

---

## 🛠️ Development

### Test Commands

```bash
npm run compile      # Compile contracts
npm run test         # Run all tests
npm run node         # Start local Hardhat node
npm run deploy:local # Deploy to local node
```

### Frontend Commands

```bash
npm run frontend:dev   # Start dev server
npm run frontend:build # Build for production
```

### CRE Commands

```bash
npm run cre:simulate   # Run CRE simulation
```

---

## 📝 License

MIT License - feel free to use this code for your own projects!

---

## 🙏 Acknowledgments

- [Chainlink](https://chain.link/) for the CRE platform
- [Open-Meteo](https://open-meteo.com/) for free weather data
- [OpenZeppelin](https://openzeppelin.com/) for secure contract libraries

---

## 📞 Contact

- **GitHub:** [your-username]
- **Twitter:** [@your-handle]
- **Email:** your@email.com

---

<p align="center">
  Built with ❤️ for Chainlink Hackathon 2026
</p>
