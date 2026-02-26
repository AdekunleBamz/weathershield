import React from 'react';
import { ethers } from 'ethers';

const STATUS_LABELS = ['Active', 'Claimed', 'Expired', 'Cancelled'];
const WEATHER_ICONS = ['☀️', '🌊', '❄️', '🔥'];
const WEATHER_NAMES = ['Drought', 'Flood', 'Frost', 'Heat'];
const RISK_LABELS = ['Low', 'Medium', 'High', 'Critical'];
const RISK_COLORS = ['#22c55e', '#3b82f6', '#eab308', '#ef4444'];

const PolicyCard = ({ policy, onTrigger, loading, ethPrice }) => {
    const statusClass = STATUS_LABELS[policy.status].toLowerCase();

    // Calculate time progress
    const now = Date.now() / 1000;
    const start = Number(policy.startTime);
    const end = Number(policy.endTime);
    const total = end - start;
    const elapsed = Math.min(now - start, total);
    const progressPct = total > 0 ? Math.min((elapsed / total) * 100, 100) : 0;
    const daysLeft = Math.max(0, Math.ceil((end - now) / 86400));

    const coverageEth = ethers.formatEther(policy.coverageAmount);
    const premiumEth = ethers.formatEther(policy.premium);
    const usdCoverage = ethPrice ? `≈ $${(parseFloat(coverageEth) * ethPrice).toFixed(2)}` : '';

    const riskTier = policy.riskTier !== undefined ? Number(policy.riskTier) : 1;

    return (
        <div className={`policy-card ${statusClass}`}>
            <div className="policy-header">
                <div>
                    <span className="policy-id">#{policy.id}</span>
                    <span className="nft-indicator">🖼 NFT</span>
                </div>
                <span className={`status-badge ${statusClass}`}>
                    {STATUS_LABELS[policy.status]}
                </span>
            </div>

            <div className="policy-body">
                <div className="policy-row">
                    <span className="label">Type</span>
                    <span className="value">
                        {WEATHER_ICONS[policy.weatherType]} {WEATHER_NAMES[policy.weatherType]}
                    </span>
                </div>

                <div className="policy-row">
                    <span className="label">Risk Tier</span>
                    <span className="value" style={{ color: RISK_COLORS[riskTier] }}>
                        {RISK_LABELS[riskTier]}
                    </span>
                </div>

                <div className="policy-row">
                    <span className="label">Threshold</span>
                    <span className="value">{Number(policy.triggerThreshold)}</span>
                </div>

                <div className="policy-row">
                    <span className="label">Location</span>
                    <span className="value">{policy.location}</span>
                </div>

                <div className="policy-row">
                    <span className="label">Premium</span>
                    <span className="value">{premiumEth} ETH</span>
                </div>

                <div className="policy-row">
                    <span className="label">Coverage</span>
                    <span className="value highlight">
                        {coverageEth} ETH
                    </span>
                </div>
                {usdCoverage && (
                    <div className="policy-row">
                        <span className="label" />
                        <span className="coverage-usd">{usdCoverage}</span>
                    </div>
                )}
            </div>

            {/* Time progress bar */}
            {policy.status === 0 && (
                <div className="policy-progress">
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                    </div>
                    <div className="progress-labels">
                        <small>{new Date(start * 1000).toLocaleDateString()}</small>
                        <small>{daysLeft}d left</small>
                    </div>
                </div>
            )}

            <div className="policy-dates">
                <small>Start: {new Date(start * 1000).toLocaleDateString()}</small>
                <small>End: {new Date(end * 1000).toLocaleDateString()}</small>
            </div>

            {policy.status === 0 && (
                <button
                    className="btn-trigger"
                    onClick={() => onTrigger(policy.id)}
                    disabled={loading}
                >
                    {loading ? 'Starting Check...' : '⚡ Check & Claim'}
                </button>
            )}
        </div>
    );
};

export default PolicyCard;
