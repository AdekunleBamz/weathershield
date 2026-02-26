import React, { useState } from 'react';

const LiquidityPool = ({ contract, poolStats, ethPrice, loading, onAction }) => {
    const [depositAmount, setDepositAmount] = useState('');
    const [withdrawShares, setWithdrawShares] = useState('');

    const formatUsd = (ethVal) => {
        if (!ethPrice || !ethVal) return '';
        return `≈ $${(parseFloat(ethVal) * ethPrice).toFixed(2)}`;
    };

    return (
        <div className="pool-section">
            <h2>💧 Liquidity Pool</h2>
            <p className="subtitle">Provide coverage capital. Earn yield from premiums.</p>

            <div className="pool-grid">
                <div className="pool-card">
                    <h3>Pool Overview</h3>
                    <div className="pool-stat">
                        <span className="label">Total Liquidity</span>
                        <span className="value">{poolStats.totalLiquidity} ETH</span>
                    </div>
                    <div className="pool-stat">
                        <span className="label">Reserved for Policies</span>
                        <span className="value">{poolStats.reservedFunds} ETH</span>
                    </div>
                    <div className="pool-stat">
                        <span className="label">Available</span>
                        <span className="value" style={{ color: '#22c55e' }}>{poolStats.availableLiquidity} ETH</span>
                    </div>
                    <div className="pool-stat">
                        <span className="label">Protocol Fees</span>
                        <span className="value">{poolStats.protocolFees} ETH</span>
                    </div>
                    <div className="pool-stat">
                        <span className="label">Your Shares</span>
                        <span className="value">{poolStats.userShares || '0'}</span>
                    </div>
                    <div className="pool-stat">
                        <span className="label">Your Value</span>
                        <span className="value" style={{ color: '#60a5fa' }}>
                            {poolStats.userValue || '0'} ETH
                            <span className="coverage-usd"> {formatUsd(poolStats.userValue)}</span>
                        </span>
                    </div>
                </div>

                <div className="pool-card">
                    <h3>Manage Position</h3>

                    <div className="form-group">
                        <label>Deposit ETH</label>
                        <div className="pool-input-group">
                            <input
                                type="number"
                                step="0.01"
                                placeholder="0.1"
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(e.target.value)}
                            />
                            <button
                                className="btn-deposit"
                                disabled={loading || !depositAmount}
                                onClick={() => { onAction('deposit', depositAmount); setDepositAmount(''); }}
                            >
                                Deposit
                            </button>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginTop: 20 }}>
                        <label>Withdraw (shares)</label>
                        <div className="pool-input-group">
                            <input
                                type="number"
                                placeholder="Shares to withdraw"
                                value={withdrawShares}
                                onChange={(e) => setWithdrawShares(e.target.value)}
                            />
                            <button
                                className="btn-withdraw"
                                disabled={loading || !withdrawShares}
                                onClick={() => { onAction('withdraw', withdrawShares); setWithdrawShares(''); }}
                            >
                                Withdraw
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiquidityPool;
