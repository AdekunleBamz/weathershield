import React from 'react';
import LocationPicker from './LocationPicker';

const WEATHER_TYPES = [
    { id: 0, name: 'Drought', icon: '☀️', desc: 'Payout if rainfall below threshold' },
    { id: 1, name: 'Flood', icon: '🌊', desc: 'Payout if rainfall above threshold' },
    { id: 2, name: 'Frost', icon: '❄️', desc: 'Payout if temp below threshold' },
    { id: 3, name: 'Heat', icon: '🔥', desc: 'Payout if temp above threshold' }
];

const RISK_LABELS = ['Low Risk (12×)', 'Medium Risk (10×)', 'High Risk (8×)', 'Critical Risk (6×)'];
const RISK_CLASSES = ['low', 'medium', 'high', 'critical'];
const RISK_MULTIPLIERS = [12, 10, 8, 6];

function getRiskTier(type, threshold) {
    const t = parseInt(threshold) || 0;
    if (type === 0) { // Drought
        if (t <= 20) return 0;
        if (t <= 50) return 1;
        if (t <= 100) return 2;
        return 3;
    } else if (type === 1) { // Flood
        if (t >= 200) return 0;
        if (t >= 100) return 1;
        if (t >= 50) return 2;
        return 3;
    } else if (type === 2) { // Frost
        if (t <= -100) return 0;
        if (t <= -20) return 1;
        if (t <= 20) return 2;
        return 3;
    } else { // Heat
        if (t >= 450) return 0;
        if (t >= 400) return 1;
        if (t >= 350) return 2;
        return 3;
    }
}

const CreatePolicy = ({ form, handleInput, buyPolicy, loading, ethPrice, children }) => {
    const premium = parseFloat(form.premium || 0);
    const riskTier = getRiskTier(form.type, form.threshold);
    const multiplier = RISK_MULTIPLIERS[riskTier];
    const coverage = (premium * multiplier).toFixed(4);
    const usdPremium = ethPrice ? `≈ $${(premium * ethPrice).toFixed(2)}` : '';
    const usdCoverage = ethPrice ? `≈ $${(parseFloat(coverage) * ethPrice).toFixed(2)}` : '';

    const handleLocationSelect = (lat, lon) => {
        handleInput({ target: { name: 'lat', value: lat } });
        handleInput({ target: { name: 'lon', value: lon } });
    };

    return (
        <div className="create-policy-card">
            <h2>Protect Your Yield</h2>
            <p className="subtitle">Automatic payouts powered by Chainlink CRE</p>

            {children}

            <form onSubmit={buyPolicy}>
                <div className="form-group">
                    <label>Coverage Type</label>
                    <div className="type-grid">
                        {WEATHER_TYPES.map(t => (
                            <div
                                key={t.id}
                                className={`type-option ${form.type == t.id ? 'selected' : ''}`}
                                onClick={() => handleInput({ target: { name: 'type', value: t.id } })}
                            >
                                <span className="type-icon">{t.icon}</span>
                                <span className="type-name">{t.name}</span>
                            </div>
                        ))}
                    </div>
                    <small className="helper-text">{WEATHER_TYPES[form.type].desc}</small>
                </div>

                <LocationPicker
                    lat={form.lat}
                    lon={form.lon}
                    onSelect={handleLocationSelect}
                />

                <div className="form-row">
                    <div className="form-group">
                        <label>Latitude</label>
                        <input name="lat" value={form.lat} onChange={handleInput} placeholder="40.7128" />
                    </div>
                    <div className="form-group">
                        <label>Longitude</label>
                        <input name="lon" value={form.lon} onChange={handleInput} placeholder="-74.0060" />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label>Threshold Value</label>
                        <input name="threshold" type="number" value={form.threshold} onChange={handleInput} placeholder="100" />
                    </div>
                    <div className="form-group">
                        <label>Premium (ETH)</label>
                        <input name="premium" type="number" step="0.001" value={form.premium} onChange={handleInput} placeholder="0.01" />
                        {usdPremium && <small className="helper-text">{usdPremium}</small>}
                    </div>
                </div>

                <div className={`risk-preview ${RISK_CLASSES[riskTier]}`}>
                    <span className="risk-label">{RISK_LABELS[riskTier]}</span>
                    <span>{multiplier}× coverage</span>
                </div>

                <div className="coverage-preview">
                    <div>
                        <span>Estimated Coverage</span>
                        {usdCoverage && <div className="coverage-usd">{usdCoverage}</div>}
                    </div>
                    <span className="highlight">{coverage} ETH</span>
                </div>

                <button type="submit" className="btn-buy" disabled={loading}>
                    {loading ? 'Processing Transaction...' : '🛡️ Purchase Policy'}
                </button>
            </form>
        </div>
    );
};

export default CreatePolicy;
