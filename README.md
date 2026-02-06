# WeatherShield 🌦️

[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)](https://soliditylang.org/)
[![Chainlink](https://img.shields.io/badge/Chainlink-CRE-375BD2?logo=chainlink)](https://chain.link/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Parametric weather insurance that pays out automatically when weather conditions hit your threshold. No claims process, no paperwork, no waiting.**

> Submission for Chainlink Block Magic Hackathon 2026 — DeFi Track

---

## 🎬 Demo

| Resource | Link |
|----------|------|
| **Live App** | [weathershield.vercel.app](https://weathershield.vercel.app) |
| **Video Demo** | [YouTube](https://youtube.com/watch?v=xxxxx) |
| **Contract** | [Arbiscan](https://sepolia.arbiscan.io/address/0x0988119B3526C21129E0254f5E8bd995Bed51F6D) |

---

## 📸 Screenshots

<p align="center">
  <img src="./docs/screenshot-main.png" alt="Main Interface" width="700"/>
</p>

<p align="center">
  <img src="./docs/screenshot-policy.png" alt="Policy Purchase" width="700"/>
</p>

---

## 💡 Why This Matters

Traditional crop insurance is broken. Farmers file claims, wait weeks for adjusters, argue over damage assessments, and often receive payouts months after disaster strikes—if at all.

**Parametric insurance fixes this:**
- Payouts trigger automatically based on objective weather data
- No claim forms, no inspections, no disputes
- Funds arrive within minutes of conditions being met
- Completely transparent—the trigger conditions are on-chain

This approach is already being used in developing countries where traditional insurance infrastructure doesn't exist. WeatherShield brings this model on-chain with Chainlink CRE handling the automation.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│                    (React + ethers.js)                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ARBITRUM SEPOLIA                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  WeatherShield.sol                         │  │
│  │                                                            │  │
│  │  • purchasePolicy() ──── User pays premium                 │  │
│  │  • updateWeatherData() ── CRE pushes weather readings      │  │
│  │  • processClaim() ─────── CRE triggers automatic payout    │  │
│  │  • isPolicyClaimable() ── Checks if conditions are met     │  │
│  └───────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            ▲
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│                      CHAINLINK CRE                               │
│                                                                  │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│   │  CRON    │───▶│  FETCH   │───▶│TRANSFORM │───▶│  WRITE   │  │
│   │ (6 hrs)  │    │ WEATHER  │    │  DATA    │    │ ON-CHAIN │  │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                         │        │
│                   ┌──────────┐    ┌──────────┐          │        │
│                   │  PAYOUT  │◀───│  CHECK   │◀─────────┘        │
│                   │ (if met) │    │ TRIGGER  │                   │
│                   └──────────┘    └──────────┘                   │
└──────────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│                     OPEN-METEO API                               │
│              (Free weather data, no API key)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⚙️ How It Works

### User Flow
1. **Connect wallet** — App prompts to switch to Arbitrum Sepolia
2. **Choose coverage type** — Drought, flood, frost, or heat
3. **Set threshold** — e.g., "pay me if rainfall drops below 10mm"
4. **Pay premium** — Coverage amount = 10x your premium
5. **Automatic monitoring** — CRE checks weather every 6 hours
6. **Instant payout** — If conditions trigger, funds sent automatically

### CRE Workflow Steps

The `weather-monitor.yaml` workflow runs every 6 hours:

| Step | Action | Details |
|------|--------|---------|
| 1 | **Fetch** | GET request to Open-Meteo API for location's weather |
| 2 | **Transform** | Convert readings to contract format (int256, scaled by 10) |
| 3 | **Update** | Call `updateWeatherData()` to store on-chain |
| 4 | **Check** | Call `isPolicyClaimable()` for active policies |
| 5 | **Payout** | If triggered, call `processClaim()` to send funds |

### Trigger Logic

| Type | Condition | Example |
|------|-----------|---------|
| Drought | rainfall < threshold | Less than 10mm rain |
| Flood | rainfall > threshold | More than 100mm rain |
| Frost | temperature < threshold | Below 0°C |
| Heat | temperature > threshold | Above 40°C |

> 📖 For detailed CRE workflow explanation, see [docs/workflow-explained.md](docs/workflow-explained.md)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MetaMask
- Arbitrum Sepolia ETH ([faucet](https://faucet.quicknode.com/arbitrum/sepolia))

### Install

```bash
git clone https://github.com/AdekunleBamz/weathershield.git
cd weathershield
npm install
cd frontend && npm install && cd ..
```

### Run Tests

```bash
npx hardhat test
```

### Run Frontend

```bash
cd frontend && npm run dev
```

### Simulate CRE Workflow

```bash
# Default (NYC, drought)
node scripts/cre-simulate.js

# Custom location and type
node scripts/cre-simulate.js --lat 34.05 --lon -118.24 --type 3 --threshold 350
```

---

## 📁 Project Structure

```
weathershield/
├── contracts/
│   ├── WeatherShield.sol          # Main contract
│   └── interfaces/
│       └── IWeatherShield.sol     # Interface for CRE
├── cre-workflows/
│   └── weather-monitor.yaml       # CRE workflow definition
├── docs/
│   ├── workflow-explained.md      # CRE workflow deep dive
│   ├── use-cases.md               # Real-world applications
│   ├── security-notes.md          # Security considerations
│   └── demo-script.md             # Demo recording guide
├── frontend/                       # React app
├── scripts/
│   ├── deploy.js                  # Deployment script
│   └── cre-simulate.js            # Local CRE testing
├── test/
│   └── WeatherShield.test.cjs     # Unit tests
└── cre.config.yaml                # CRE configuration
```

---

## 🔐 Security Considerations

- **Oracle trust**: Contract trusts CRE-authorized address to provide accurate weather data. In production, this would be a decentralized oracle network.
- **Coverage liquidity**: Contract must hold sufficient ETH to cover potential payouts. Owner deposits funds via `depositFunds()`.
- **Reentrancy**: Protected with OpenZeppelin's `ReentrancyGuard`.
- **Access control**: Only owner/CRE can update weather and process claims.

### Assumptions
- Weather data from Open-Meteo is accurate and available
- 6-hour check interval is sufficient for most use cases
- Single location per policy (no area-based coverage yet)

---

## 🛣️ Future Improvements

- [ ] **Multi-chain deployment** — Expand beyond Arbitrum
- [ ] **Area-based policies** — Cover a region instead of single coordinate
- [ ] **Historical verification** — Cross-reference multiple weather sources
- [ ] **Premium calculation** — Dynamic pricing based on location risk
- [ ] **Policy NFTs** — Tradeable insurance positions
- [ ] **DAO governance** — Community-managed parameters

---

## 🔗 Deployed Contract

| Network | Address |
|---------|---------|
| Arbitrum Sepolia | `0x0988119B3526C21129E0254f5E8bd995Bed51F6D` |

---

## 🧰 Tech Stack

- **Smart Contract**: Solidity 0.8.24, OpenZeppelin
- **Testing**: Hardhat, Chai
- **Automation**: Chainlink CRE
- **Weather Data**: Open-Meteo (free, no API key)
- **Frontend**: React, Vite, ethers.js
- **Network**: Arbitrum Sepolia

---

## 📄 License

MIT

---

## 👤 Author

Built by [@AdekunleBamz](https://github.com/AdekunleBamz) for Chainlink Block Magic Hackathon 2026
