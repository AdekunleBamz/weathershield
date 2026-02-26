# WeatherShield 🌦️

[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)](https://soliditylang.org/)
[![Chainlink](https://img.shields.io/badge/Chainlink-CRE-375BD2?logo=chainlink)](https://chain.link/)
[![Tests](https://img.shields.io/badge/Tests-33%20Passing-22c55e)](test/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Parametric weather insurance protocol with automatic payouts powered by Chainlink CRE, multi-source weather aggregation, NFT policies, liquidity pool, and LP governance.**

> I built WeatherShield to solve a real problem — crop insurance is slow, expensive, and unfair. This protocol uses Chainlink CRE to pull weather data from 3 sources, aggregate via median, and trigger on-chain payouts automatically. No backend server, no middleman.

> Built for Chainlink Block Magic Hackathon 2026 — DeFi & Tokenization Track

---

## Demo

| Resource | Link |
|----------|------|
| **Live App** | [weathershield-app.vercel.app](https://weathershield-app.vercel.app) |
| **Video Demo** | [YouTube](https://youtu.be/_lRcvZZ_p_s) |
| **Contract** | [Arbiscan](https://sepolia.arbiscan.io/address/0x85A61e33CA36d1b52A74f9E4E4d4F363685F0bB2) |
| **Price Feed Mock** | [Arbiscan](https://sepolia.arbiscan.io/address/0x8cc290F69e47D6dCFF7bDB674Cd1f3ec01d65284) |

---

## Key Features

| Feature | Description |
|---------|-------------|
| 🔗 **Chainlink ETH/USD Price Feed** | USD-denominated premiums via `AggregatorV3Interface` |
| 🌐 **Multi-Source Weather** | 3 APIs (Open-Meteo + WeatherAPI + Visual Crossing) → median aggregation |
| 📊 **Risk-Based Pricing** | 4 tiers (Low 12×, Medium 10×, High 8×, Critical 6×) based on threshold severity |
| 🖼️ **ERC-721 Policy NFTs** | On-chain SVG metadata, soulbound while Active, tradeable after expiry |
| 💧 **Liquidity Pool** | Anyone can provide coverage capital, earn yield from premiums (80/20 split) |
| 🏛️ **LP Governance** | LP-weighted voting on protocol parameters (minPremium, duration, fees) |
| ⚡ **CRE Automation** | Weather checked every 6 hours, claims processed automatically |
| 🧪 **33 Tests** | Full coverage: price feed, risk tiers, NFTs, pool, governance, claims |

---

## Screenshot

<p align="center">
  <img src="./docs/Screenshot.png?v=2" alt="WeatherShield Interface" width="700"/>
</p>

---

## The Problem

Crop insurance is terrible:
- Claims take weeks or months
- Farmers have to prove damage with paperwork
- Adjusters make subjective calls
- Admin costs eat into payouts
- In developing countries, it's just not available

## The Solution

WeatherShield uses **parametric insurance** — if weather conditions cross a threshold, payout happens automatically. No claim forms, no inspectors, no delays.

---

## ✅ CRE Quota Compliance

WeatherShield fully implements **Chainlink Runtime Environment (CRE) service quotas**.

| Quota | Status | Details |
|-------|--------|---------|
| Execution Timeout | ✅ | ~2s actual vs 5-min limit |
| HTTP Response Size | ✅ | ~2.7 KB total vs 100 KB/request limit |
| EVM Gas Limit | ✅ | 500K per tx vs 5M limit |
| Concurrent Capabilities | ✅ | 3 used (HTTP, Compute, EVM) |
| Cron Schedule | ✅ | 6 hours vs 30s minimum |

**Verify Locally:**
```bash
npm run cre:simulate
```

<details>
<summary>CRE Simulation Output</summary>

```
╔══════════════════════════════════════════════════════════╗
║       WeatherShield CRE Simulation (Multi-Source)       ║
╚══════════════════════════════════════════════════════════╝

📍 Location: 40.7128, -74.006
🌦️  Type: Drought (0)
📊 Threshold: 100

── CRE Quota Compliance ──────────────────────────────────
✓ Cron schedule: 6 hours (exceeds 30s minimum)
✓ Concurrent capabilities: 3/3 max (HTTP, EVM write, EVM read)

── Fetching Weather Data ─────────────────────────────────
  [1/3] Open-Meteo (live)...
    ✓ 0.74 KB | precip=0mm, max=5.1°C, min=-3.7°C
  [2/3] WeatherAPI (simulated)...
    ✓ 0.80 KB | precip=0.0mm, max=5.0°C, min=-3.7°C
  [3/3] Visual Crossing (simulated)...
    ✓ 1.20 KB | precip=0.0mm, max=4.7°C, min=-3.6°C

  All sources: ✓ 3/3 fetched
  ✓ Total HTTP response size: 2.74 KB (limit: 100 KB each)

── Multi-Source Aggregation ──────────────────────────────
  Values: [0, 0, 0]
  Median: 0 (0 mm)

── Contract Interaction ──────────────────────────────────
  ✓ updateWeatherDataMultiSource("40.7128,-74.006", 0, 0, 0)
  ✓ EVM write gas: ~500,000 (limit: 5,000,000)

── Trigger Evaluation ───────────────────────────────────
  Condition: 0 < 100? YES ✓

── Execution Summary ────────────────────────────────────
  ✓ Execution time: 2.53s (limit: 300s)
  ✓ Sources used: 3 (Open-Meteo + WeatherAPI + Visual Crossing)
  ✓ Aggregation: Median

  🚨 CLAIM WOULD TRIGGER — payout would be processed

═══════════════════════════════════════════════════════════
  All CRE Service Quotas SATISFIED ✓
═══════════════════════════════════════════════════════════
```

</details>

---

## Chainlink Integration

### Data Feeds — ETH/USD Price Feed

The contract integrates `AggregatorV3Interface` for real-time ETH/USD pricing:
- Premiums and coverage displayed in USD throughout the frontend
- `getEthUsdPrice()` and `ethToUsd()` available for on-chain conversion
- Deployed with mock aggregator on Arbitrum Sepolia (simulating $2,000 ETH)

### CRE — Multi-Source Weather Automation

| Step | Action | Details |
|------|--------|---------|
| 1 | **Fetch ×3** | Parallel HTTP requests to Open-Meteo, WeatherAPI, Visual Crossing |
| 2 | **Aggregate** | Calculate median of 3 readings for tamper resistance |
| 3 | **Update** | Call `updateWeatherDataMultiSource()` with all 3 values |
| 4 | **Check** | Call `isPolicyClaimable()` for active policies |
| 5 | **Payout** | If triggered, call `processClaim()` |

Key files:
- [cre-workflows/weather-monitor.yaml](cre-workflows/weather-monitor.yaml) — YAML workflow definition
- [cre-workflow/src/workflow.ts](cre-workflow/src/workflow.ts) — TypeScript CRE SDK implementation
- [scripts/cre-simulate.js](scripts/cre-simulate.js) — local simulation with quota validation
- [cre.config.yaml](cre.config.yaml) — CRE configuration

---

## Architecture

<p align="center">
  <img src="./docs/architecture.png" alt="WeatherShield Architecture" width="700"/>
</p>

### Risk-Based Pricing

Coverage multiplier is dynamically determined by weather type and threshold severity:

| Risk Tier | Multiplier | Example |
|-----------|-----------|---------|
| 🟢 Low | 12× premium | Drought threshold ≤20mm (unlikely to trigger) |
| 🔵 Medium | 10× premium | Drought threshold ≤50mm |
| 🟡 High | 8× premium | Drought threshold ≤100mm |
| 🔴 Critical | 6× premium | Drought threshold >100mm (very likely to trigger) |

### Policy NFTs (ERC-721)

- Each policy mints an NFT with **on-chain SVG** artwork
- **Soulbound while Active** — cannot be transferred during coverage period
- **Tradeable after expiry/claim** — becomes a collectible receipt
- Full metadata: weather type, status, location, policy ID

### Liquidity Pool

- LPs deposit ETH → receive pro-rata shares
- Premiums distributed: **80% to LPs**, 20% protocol fee
- Withdrawals limited to unreserved funds (funds backing active policies are locked)
- `getLPValue()` shows current position value including earned yield

### Governance

- **LP-weighted voting** — shares = voting power (no separate governance token)
- Propose changes to: `minPremium`, `policyDuration`, `protocolFeePercent`
- 3-day voting period, 25% quorum required
- Proposals auto-execute when conditions are met

---

## How It Works

### User Flow
1. Connect wallet → app switches to Arbitrum Sepolia if needed
2. Pick a coverage type — drought, flood, frost, or heat
3. Choose a city (10 presets) or enter custom coordinates
4. Set threshold — risk tier and coverage multiplier shown in real-time
5. Pay premium in ETH — USD equivalent shown via Chainlink price feed
6. NFT policy minted to your wallet
7. CRE monitors weather every 6 hours from 3 sources
8. If conditions trigger, payout lands automatically

### Trigger Logic

| Type | Condition | Example |
|------|-----------|---------| 
| Drought | rainfall < threshold | Less than 10mm rain |
| Flood | rainfall > threshold | More than 100mm rain |
| Frost | temp < threshold | Below 0°C |
| Heat | temp > threshold | Above 40°C |

---

## Quick Start

### Requirements
- Node.js 18+
- MetaMask
- Arbitrum Sepolia ETH — [faucet](https://faucet.quicknode.com/arbitrum/sepolia)

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

> 33 tests passing — covers deployment, price feed, risk pricing, NFT policies, multi-source weather, claims, cancellation, liquidity pool, and governance.

### Run Frontend

```bash
cd frontend && npm run dev
```

### Simulate CRE Workflow

```bash
npm run cre:simulate
node scripts/cre-simulate.js --type 3 --threshold 350 --lat 6.52 --lon 3.38
```

---

## Project Structure

```
contracts/
├── WeatherShield.sol          # Main contract (ERC-721, pool, governance)
├── interfaces/IWeatherShield.sol
└── mocks/MockV3Aggregator.sol # Chainlink price feed mock

cre-workflows/
└── weather-monitor.yaml       # CRE YAML workflow (3-source)

cre-workflow/
└── src/workflow.ts            # CRE TypeScript SDK workflow

frontend/src/
├── App.jsx                    # Main app with tabs (Policies/Pool/Governance)
├── components/
│   ├── Header.jsx             # Mobile nav, ETH price badge, tabs
│   ├── CreatePolicy.jsx       # City picker, risk preview, USD pricing
│   ├── PolicyCard.jsx         # Progress bar, NFT badge, risk tier
│   ├── Stats.jsx              # Skeleton loading, USD conversion
│   ├── WeatherDisplay.jsx     # Multi-source badge, daily data
│   ├── LocationPicker.jsx     # 10 city presets
│   ├── LiquidityPool.jsx      # Deposit/withdraw, pool stats
│   └── Governance.jsx         # Proposals, voting, execution
└── index.css                  # Glassmorphism + animations

scripts/
└── cre-simulate.js            # Multi-source CRE simulation

test/
└── WeatherShield.test.cjs     # 33 tests
```

---

## Security

- **Access control** — `onlyCRE` modifier restricts weather updates and claims
- **Reentrancy** — OpenZeppelin `ReentrancyGuard` on all ETH transfers
- **Soulbound NFTs** — active policies cannot be transferred (prevents gaming)
- **LP withdrawal limits** — funds backing active policies are locked
- **Governance safeguards** — 3-day voting period, 25% quorum, max 50% fee cap

> ⚠️ Deployed on Arbitrum Sepolia for demo purposes. Not audited — don't use with real money.

---

## Future Roadmap

- [ ] CCIP cross-chain deployment (Ethereum ↔ Arbitrum ↔ Polygon)
- [ ] Area-based policies (coverage zones instead of single coordinates)
- [ ] Real WeatherAPI + Visual Crossing API keys for production
- [ ] Subgraph integration for efficient policy indexing
- [ ] Premium yield strategies for LP capital
- [ ] Mobile-optimized PWA

---

## Deployed Contracts

| Contract | Network | Address |
|----------|---------|---------|
| WeatherShield | Arbitrum Sepolia | `0x85A61e33CA36d1b52A74f9E4E4d4F363685F0bB2` |
| MockV3Aggregator | Arbitrum Sepolia | `0x8cc290F69e47D6dCFF7bDB674Cd1f3ec01d65284` |

---

## Tech Stack

- Solidity 0.8.24 + OpenZeppelin (ERC721, Ownable, ReentrancyGuard)
- Chainlink CRE + AggregatorV3Interface
- Hardhat + Chai (33 tests)
- Open-Meteo + WeatherAPI + Visual Crossing (multi-source)
- React + Vite + ethers.js
- Arbitrum Sepolia

---

## License

MIT

---

Built by [@AdekunleBamz](https://github.com/AdekunleBamz) — Chainlink Block Magic Hackathon 2026
