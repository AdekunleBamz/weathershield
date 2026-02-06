# CRE Workflow Explanation

WeatherShield uses Chainlink CRE to automate the entire insurance process. No manual intervention needed once a policy is purchased.

## Trigger Schedule

The workflow runs **every 6 hours** via cron trigger (`0 */6 * * *`).

## Workflow Steps

### Step 1: Fetch Weather Data

CRE makes an HTTP GET request to Open-Meteo API:

```
https://api.open-meteo.com/v1/forecast
  ?latitude={lat}
  &longitude={lon}
  &current=temperature_2m,rain
  &daily=temperature_2m_max,temperature_2m_min,precipitation_sum
```

This returns current temperature, rainfall, and daily min/max values.

### Step 2: Transform Data

Raw weather values are converted to contract-compatible format:

- Multiply by 10 to preserve one decimal place as integer
- Select relevant field based on policy type:
  - Drought/Flood → daily precipitation
  - Frost → daily minimum temperature
  - Heat → daily maximum temperature

Example: `23.5°C` becomes `235` in the contract.

### Step 3: Update On-Chain

CRE calls `updateWeatherData(location, value)` on the smart contract.

This stores the latest weather reading with timestamp.

### Step 4: Check Trigger Condition

CRE calls `isPolicyClaimable(policyId)` to check if:

1. Policy is still active
2. Policy hasn't expired
3. Weather conditions meet the threshold

Trigger logic:
- **Drought**: `currentValue < threshold` (not enough rain)
- **Flood**: `currentValue > threshold` (too much rain)
- **Frost**: `currentValue < threshold` (too cold)
- **Heat**: `currentValue > threshold` (too hot)

### Step 5: Process Payout

If conditions are met, CRE calls `processClaim(policyId, currentValue)`.

This:
1. Marks policy as claimed
2. Transfers coverage amount to policyholder
3. Emits `PolicyClaimed` event

## Why CRE?

Without CRE, someone would need to manually:
- Check weather APIs
- Call contract functions
- Monitor all active policies

CRE automates all of this trustlessly. The workflow runs on decentralized infrastructure, ensuring payouts happen even if the original deployer disappears.

## Workflow File

See [`cre-workflows/weather-monitor.yaml`](../cre-workflows/weather-monitor.yaml) for the full configuration.
