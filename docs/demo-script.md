# Demo Recording Script

Use this script when recording your 3-5 minute demo video.

---

## Setup Before Recording

- [ ] MetaMask connected to Arbitrum Sepolia
- [ ] Have some testnet ETH (at least 0.05)
- [ ] Frontend running at localhost:3001
- [ ] Terminal open for CRE simulation
- [ ] Contract has funds deposited

---

## Recording Script

### 1. Introduction (30 seconds)

> "Hey, this is WeatherShield - parametric weather insurance powered by Chainlink CRE."
>
> "The problem: traditional crop insurance takes weeks to process claims. Farmers file paperwork, wait for adjusters, and often get paid months later."
>
> "WeatherShield fixes this with automatic payouts based on real weather data."

### 2. Show the Frontend (45 seconds)

- Open the app in browser
- Point out the dashboard stats (policies, premiums, balance)
- Show the "Buy Insurance" form
- Explain the weather types briefly

> "Here's the interface. Users can buy drought, flood, frost, or heat protection."
>
> "They pick a location, set their threshold, and pay a premium. Coverage is 10x the premium."

### 3. Buy a Policy (60 seconds)

- Select "Drought" as type
- Set threshold to 100 (10mm rainfall)
- Keep default NYC location
- Set premium to 0.01 ETH
- Click "Buy Policy"
- Show MetaMask popup
- Confirm transaction
- Show policy appearing in "My Policies"

> "Let me buy a drought policy. If rainfall drops below 10mm, I get paid automatically."
>
> "Premium is 0.01 ETH, coverage is 0.1 ETH."
>
> *confirm transaction*
>
> "Policy is now active. In production, Chainlink CRE would monitor this every 6 hours."

### 4. Run CRE Simulation (60 seconds)

- Switch to terminal
- Run: `node scripts/cre-simulate.js --type 0 --threshold 100`
- Show the output
- Explain what's happening

> "Let me show what CRE does behind the scenes."
>
> "This simulation fetches real weather data from Open-Meteo API."
>
> *run command*
>
> "It pulled current weather for NYC, transformed the data, and checked if conditions trigger a payout."
>
> "If daily precipitation was below our threshold, the claim would process automatically."

### 5. Show the Contract (30 seconds)

- Open Arbiscan link
- Show contract is verified
- Point out recent transactions

> "Here's the deployed contract on Arbitrum Sepolia."
>
> "Everything is on-chain and verifiable."

### 6. Wrap Up (30 seconds)

> "That's WeatherShield - trustless parametric insurance."
>
> "Chainlink CRE handles the automation: fetching weather, checking triggers, processing payouts."
>
> "No claims adjusters, no paperwork, no delays."
>
> "Thanks for watching!"

---

## Tips

- Speak clearly and at moderate pace
- Don't rush through transactions
- If something fails, just explain and retry
- Keep it under 5 minutes
- Show your face briefly at start/end (optional but personal)

---

## Backup Scenarios

If the policy doesn't trigger naturally:

1. Run simulation with lower threshold: `node scripts/cre-simulate.js --type 0 --threshold 500`
2. Or use a location with known weather extremes
3. Or explain: "In this demo the conditions didn't trigger, but here's what would happen..."
