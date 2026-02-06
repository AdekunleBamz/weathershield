# WeatherShield

Parametric weather insurance on Arbitrum. Pay a premium, pick your weather threshold, get paid automatically if conditions hit.

Built for Chainlink CRE hackathon.

## What it does

- Farmers buy drought/flood/frost/heat protection
- Chainlink CRE monitors weather via Open-Meteo API
- When conditions trigger, payout happens automatically
- No claims process, no paperwork, no delays

## Deployed

**Arbitrum Sepolia:** `0x0988119B3526C21129E0254f5E8bd995Bed51F6D`

## Setup

```bash
npm install
cd frontend && npm install
```

## Run locally

```bash
# compile
npx hardhat compile

# test
npx hardhat test

# run frontend
cd frontend && npm run dev
```

## CRE simulation

Test the workflow locally:

```bash
node scripts/cre-simulate.js

# with options
node scripts/cre-simulate.js --type 0 --threshold 100
node scripts/cre-simulate.js --lat 34.05 --lon -118.24 --type 3
```

## How weather triggers work

| Type | Triggers when |
|------|---------------|
| Drought (0) | rainfall < threshold |
| Flood (1) | rainfall > threshold |
| Frost (2) | temp < threshold |
| Heat (3) | temp > threshold |

## Files

- `contracts/WeatherShield.sol` - main contract
- `cre-workflows/weather-monitor.yaml` - CRE workflow definition
- `scripts/cre-simulate.js` - local CRE testing
- `frontend/` - React UI

## Stack

- Solidity 0.8.24
- Hardhat
- Chainlink CRE
- Open-Meteo API (free, no key needed)
- React + Vite
- Arbitrum Sepolia

## License

MIT
