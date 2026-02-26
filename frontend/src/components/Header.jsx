import React, { useState } from 'react';

const Header = ({ account, networkOk, connect, disconnect, switchNetwork, ethPrice, activeTab, onTabChange }) => {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header className="header">
            <div className="logo-section">
                <span className="logo-icon">🌦️</span>
                <h1>WeatherShield</h1>
            </div>

            <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
                {menuOpen ? '✕' : '☰'}
            </button>

            <div className={`header-right ${menuOpen ? 'open' : ''}`}>
                <div className="nav-links">
                    <button className={`nav-link ${activeTab === 'policies' ? 'active' : ''}`} onClick={() => { onTabChange('policies'); setMenuOpen(false); }}>
                        🛡️ Policies
                    </button>
                    <button className={`nav-link ${activeTab === 'pool' ? 'active' : ''}`} onClick={() => { onTabChange('pool'); setMenuOpen(false); }}>
                        💧 Pool
                    </button>
                    <button className={`nav-link ${activeTab === 'governance' ? 'active' : ''}`} onClick={() => { onTabChange('governance'); setMenuOpen(false); }}>
                        🏛️ Governance
                    </button>
                </div>

                {ethPrice > 0 && (
                    <div className="eth-price-badge">
                        <span className="chainlink-dot" />
                        ETH ${ethPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                )}

                {account && (
                    <button
                        className={`network-badge ${networkOk ? 'ok' : 'warning'}`}
                        onClick={!networkOk ? switchNetwork : undefined}
                    >
                        {networkOk ? '✓ Arbitrum Sepolia' : '⚠ Wrong Network'}
                    </button>
                )}

                {account ? (
                    <div className="account-container">
                        <span className="account-address">
                            {account.slice(0, 6)}...{account.slice(-4)}
                        </span>
                        <button onClick={disconnect} className="btn-disconnect">
                            Disconnect
                        </button>
                    </div>
                ) : (
                    <button onClick={connect} className="btn-connect">
                        Connect Wallet
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;
