# WeatherShield 🌦️

[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)](https://soliditylang.org/)
[![Chainlink](https://img.shields.io/badge/Chainlink-CRE-375BD2?logo=chainlink)](https://chain.link/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Parametric weather insurance that pays out automatically when conditions hit your threshold. No claims process, no paperwork, no waiting.**

> WeatherShield is a parametric insurance protocol that uses Chainlink CRE to monitor real-world weather data and automatically execute on-chain payouts — no centralized backend, no manual claims.

> Submission for Chainlink Block Magic Hackathon 2026 — DeFi Track

---

## Demo

| Resource | Link |
|----------|------|
| **Live App** | [weathershield-app.vercel.app](https://weathershield-app.vercel.app) |
| **Video Demo** | [YouTube](https://youtu.be/VsvxXYtLxF4) |
| **Contract** | [Arbiscan](https://sepolia.arbiscan.io/address/0x0988119B3526C21129E0254f5E8bd995Bed51F6D) |

---

## Screenshot

<p align="center">
  <img src="./docs/Screenshot.png" alt="WeatherShield Interface" width="700"/>
</p>

---

## The Problem

Traditional crop insurance is broken:
- Claims take weeks or months to process
- Farmers must prove damage with documentation
- Adjusters make subjective assessments
- High admin costs eat into payouts
- Often unavailable in developing regions

## The Solution

WeatherShield uses **parametric insurance** — payouts trigger automatically based on objective weather data:
- No claim forms or inspections
- Funds arrive within minutes
- Transparent trigger conditions on-chain
- Works anywhere with weather data

This model is already used in developing countries. WeatherShield brings it on-chain with Chainlink CRE handling automation.

---

## Chainlink Integration

This project leverages **Chainlink Cross-Chain Runtime Environment (CRE)** to bridge off-chain weather data with on-chain insurance logic.

- **Workflow Definition**: [cre-workflows/weather-monitor.yaml](cre-workflows/weather-monitor.yaml)
- **Smart Contract**: [contracts/WeatherShield.sol](contracts/WeatherShield.sol) (Protected by `onlyCRE`)
- **Simulation Script**: [scripts/cre-simulate.js](scripts/cre-simulate.js)
- **CRE Config**: [cre.config.yaml](cre.config.yaml)

## Why Chainlink CRE?

CRE enables:
- **Automated off-chain data retrieval** — fetch weather data on a schedule without a server
- **Scheduled execution** — check conditions every 6 hours without centralized cron jobs
- **Trust-minimized orchestration** — bridge external APIs and smart contracts without a middleman

Without CRE, this system would require a centralized backend to poll weather APIs and trigger payouts — introducing a single point of failure. CRE makes the entire pipeline decentralized.

---

## Architecture

<p align="center">
  <img src="./docs/architecture.png" alt="WeatherShield Architecture" width="700"/>
</p>

---

## How It Works

### User Flow
1. Connect wallet → App prompts switch to Arbitrum Sepolia
2. Choose coverage → Drought, flood, frost, or heat
3. Set threshold → e.g., "pay me if rainfall < 10mm"
4. Pay premium → Coverage = 10x premium
5. Automatic monitoring → CRE checks every 6 hours
6. Instant payout → Funds sent when conditions trigger

### CRE Workflow

The `weather-monitor.yaml` workflow runs every 6 hours:

| Step | Action | Details |
|------|--------|---------|
| 1 | **Fetch** | HTTP GET to Open-Meteo API for weather |
| 2 | **Transform** | Convert readings to int256 (scaled by 10) |
| 3 | **Update** | Call `updateWeatherData()` on contract |
| 4 | **Check** | Call `isPolicyClaimable()` for active policies |
| 5 | **Payout** | If triggered, call `processClaim()` |

### Trigger Logic

| Type | Condition | Example |
|------|-----------|---------|
| Drought | rainfall < threshold | Less than 10mm rain |
| Flood | rainfall > threshold | More than 100mm rain |
| Frost | temp < threshold | Below 0°C |
| Heat | temp > threshold | Above 40°C |

---

## Use Cases

**Farmers** — Drought protection before planting season. If rainfall drops below threshold, automatic payout covers losses.

**Event Organizers** — Rain/heat protection for outdoor events. If weather ruins the day, payout covers refunds.

**Supply Chain** — Frost protection for temperature-sensitive goods. If temps drop during transit, payout covers spoilage.

**Renewable Energy** — Hedge against low solar/wind periods (future extension).

---

## Quick Start

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

> ✅ **Test Coverage:** 11 tests passing across policy creation, claims, access control, and edge cases.

### Run Frontend

```bash
cd frontend && npm run dev
```

### Simulate CRE Workflow

Run the simulation script ([scripts/cre-simulate.js](scripts/cre-simulate.js)) to test the CRE logic locally:

```bash
node scripts/cre-simulate.js
node scripts/cre-simulate.js --type 0 --threshold 100
node scripts/cre-simulate.js --lat 34.05 --lon -118.24 --type 3
```

---

## Project Structure

- [contracts/WeatherShield.sol](contracts/WeatherShield.sol) — Main parametric insurance contract.
- [cre-workflows/weather-monitor.yaml](cre-workflows/weather-monitor.yaml) — Chainlink CRE workflow for weather monitoring.
- [frontend/](frontend/) — React + Vite web dashboard.
- [scripts/cre-simulate.js](scripts/cre-simulate.js) — Simulation script for CRE logic.
- [test/WeatherShield.test.cjs](test/WeatherShield.test.cjs) — Comprehensive test suite (11 passing tests).
- [cre.config.yaml](cre.config.yaml) — CRE environment configuration.

---

## Security

**Access Control**
- Only CRE-authorized address or owner can update weather/process claims
- Protected by `onlyCRE` modifier

**Reentrancy Protection**
- All ETH transfers use OpenZeppelin's `ReentrancyGuard`

**Funding Model**
- Contract must hold sufficient ETH for payouts
- Owner deposits via `depositFunds()`
- Balance checked before processing claims

**Testnet Disclaimer**
- Deployed on Arbitrum Sepolia for demonstration
- Not audited for production use

---

## Limitations

- Uses a single weather API source (future: multi-source verification)
- Premium pricing is static (future: dynamic risk-based pricing)
- Policies are not yet tokenized as NFTs
- Single location per policy (future: area-based coverage)

---

## Future Improvements

- [ ] Multi-chain deployment
- [ ] Area-based policies (cover a region)
- [ ] Multi-source oracle verification
- [ ] Dynamic premium pricing based on risk
- [ ] Tradeable policy NFTs
- [ ] DAO governance for parameters

---

## Deployed Contract

| Network | Address |
|---------|---------|
| Arbitrum Sepolia | `0x0988119B3526C21129E0254f5E8bd995Bed51F6D` |

---

## Tech Stack

- Solidity 0.8.24 + OpenZeppelin
- Hardhat + Chai
- Chainlink CRE
- Open-Meteo API (free)
- React + Vite + ethers.js
- Arbitrum Sepolia

---

## License

MIT

---

Built by [@AdekunleBamz](https://github.com/AdekunleBamz) for Chainlink Block Magic Hackathon 2026
