# Security Notes

## Access Control

### CRE Authorization
Only the authorized CRE address (or contract owner) can:
- Update weather data via `updateWeatherData()`
- Process claims via `processClaim()`

This prevents malicious actors from submitting fake weather data or triggering unauthorized payouts.

```solidity
modifier onlyCRE() {
    require(
        msg.sender == creAuthorized || msg.sender == owner(),
        "Not authorized"
    );
    _;
}
```

The CRE address can be updated by owner via `setCREAuthorized()`.

### Owner Functions
Only contract owner can:
- Change CRE authorized address
- Modify policy parameters (min premium, coverage multiplier, duration)
- Deposit/withdraw funds

---

## Reentrancy Protection

All functions that transfer ETH use OpenZeppelin's `ReentrancyGuard`:

```solidity
contract WeatherShield is Ownable, ReentrancyGuard {
    
    function processClaim(...) external onlyCRE nonReentrant {
        // ...
        (bool ok, ) = payable(policy.holder).call{value: amount}("");
        // ...
    }
    
    function cancelPolicy(...) external nonReentrant {
        // ...
    }
}
```

This prevents reentrancy attacks during payouts and refunds.

---

## Funding Model

The contract must hold sufficient ETH to cover potential payouts:

- Coverage = 10x premium (configurable)
- Owner deposits funds via `depositFunds()`
- Contract checks balance before processing claims

```solidity
require(address(this).balance >= policy.coverageAmount, "Insufficient funds");
```

In production, this would be managed via:
- Insurance pools with multiple depositors
- Yield-generating strategies for idle funds
- Risk-based capital requirements

---

## Testnet Disclaimer

**This is a hackathon demonstration deployed on Arbitrum Sepolia testnet.**

Not audited for production use. Known limitations:
- Single weather data source (Open-Meteo)
- No multi-sig for admin functions
- No time-lock on parameter changes
- Simplified trigger logic

---

## Trust Assumptions

1. **Weather Data**: We trust Open-Meteo API provides accurate data. Production would use multiple sources with consensus.

2. **CRE Execution**: We trust Chainlink CRE infrastructure executes workflows reliably.

3. **Owner Honesty**: Owner could theoretically drain funds. Production would use DAO governance or multi-sig.

4. **Block Timestamp**: Trigger timing depends on `block.timestamp`, which miners can manipulate slightly (±15 seconds). Acceptable for weather insurance.

---

## Potential Improvements

- [ ] Multi-source oracle aggregation
- [ ] Decentralized governance for parameters
- [ ] Time-locked admin functions
- [ ] Formal verification of trigger logic
- [ ] Insurance pool with multiple stakeholders
