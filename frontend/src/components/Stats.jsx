import React from 'react';

const Stats = ({ stats, ethPrice, loading }) => {
    const formatUsd = (ethVal) => {
        if (!ethPrice || !ethVal || ethVal === '0') return '';
        return `≈ $${(parseFloat(ethVal) * ethPrice).toFixed(2)}`;
    };

    if (loading) {
        return (
            <div className="stats-grid">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="skeleton-card">
                        <div className="skeleton skeleton-text" style={{ width: '60%' }} />
                        <div className="skeleton skeleton-value" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="stats-grid">
            <div className="stat-card fade-in-up fade-in-up-1">
                <label>Total Policies</label>
                <span className="stat-value">{stats.policies}</span>
            </div>
            <div className="stat-card fade-in-up fade-in-up-2">
                <label>Premiums Collected</label>
                <span className="stat-value">{stats.premiums} <small>ETH</small></span>
                <span className="stat-usd">{formatUsd(stats.premiums)}</span>
            </div>
            <div className="stat-card fade-in-up fade-in-up-3">
                <label>Total Payouts</label>
                <span className="stat-value">{stats.payouts} <small>ETH</small></span>
                <span className="stat-usd">{formatUsd(stats.payouts)}</span>
            </div>
            <div className="stat-card fade-in-up fade-in-up-4">
                <label>Contract Balance</label>
                <span className="stat-value">{stats.balance} <small>ETH</small></span>
                <span className="stat-usd">{formatUsd(stats.balance)}</span>
            </div>
            <div className="stat-card fade-in-up fade-in-up-4">
                <label>Pool Liquidity</label>
                <span className="stat-value">{stats.liquidity || '0'} <small>ETH</small></span>
                <span className="stat-usd">{formatUsd(stats.liquidity)}</span>
            </div>
        </div>
    );
};

export default Stats;
