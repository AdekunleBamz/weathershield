import React, { useState } from 'react';

const PARAM_OPTIONS = [
    { value: 'minPremium', label: 'Min Premium (wei)', desc: 'Minimum premium amount' },
    { value: 'policyDuration', label: 'Policy Duration (seconds)', desc: 'How long policies last' },
    { value: 'protocolFeePercent', label: 'Protocol Fee %', desc: 'Fee percentage (max 50)' },
];

const STATUS_LABELS = ['Pending', 'Approved', 'Rejected', 'Executed'];
const STATUS_CLASSES = ['pending', 'executed', 'rejected', 'executed'];

const Governance = ({ proposals, isLP, loading, onVote, onPropose, onExecute }) => {
    const [param, setParam] = useState('minPremium');
    const [value, setValue] = useState('');

    const handlePropose = (e) => {
        e.preventDefault();
        if (!value) return;
        onPropose(param, value);
        setValue('');
    };

    return (
        <div className="governance-section">
            <h2>🏛️ Governance</h2>
            <p className="subtitle">LP holders vote on protocol parameters. Your shares = your voting power.</p>

            <div className="proposal-list">
                {proposals.length === 0 ? (
                    <div className="empty-state" style={{ padding: 40 }}>
                        <span className="empty-icon">🗳️</span>
                        <p>No proposals yet</p>
                        <small>LP holders can propose parameter changes</small>
                    </div>
                ) : (
                    proposals.map((prop) => {
                        const totalVotes = Number(prop.votesFor) + Number(prop.votesAgainst);
                        const forPct = totalVotes > 0 ? (Number(prop.votesFor) / totalVotes) * 100 : 50;
                        const againstPct = 100 - forPct;
                        const isPending = prop.status === 0;
                        const isExpired = Date.now() / 1000 >= Number(prop.deadline);

                        return (
                            <div key={prop.id} className="proposal-card">
                                <div className="proposal-header">
                                    <span className="proposal-id">Proposal #{prop.id}</span>
                                    <span className={`proposal-status ${STATUS_CLASSES[prop.status]}`}>
                                        {STATUS_LABELS[prop.status]}
                                    </span>
                                </div>

                                <div className="proposal-body">
                                    <span className="proposal-param">{prop.paramName}</span>
                                    {' → '}
                                    <span className="proposal-value">{prop.newValue}</span>
                                </div>

                                <div className="vote-bar">
                                    <div className="vote-for" style={{ width: `${forPct}%` }} />
                                    <div className="vote-against" style={{ width: `${againstPct}%` }} />
                                </div>
                                <div className="vote-labels">
                                    <span>For: {prop.votesFor}</span>
                                    <span>Against: {prop.votesAgainst}</span>
                                </div>

                                {isPending && !isExpired && isLP && (
                                    <div className="vote-actions">
                                        <button className="btn-vote-for" onClick={() => onVote(prop.id, true)} disabled={loading}>
                                            ✓ Vote For
                                        </button>
                                        <button className="btn-vote-against" onClick={() => onVote(prop.id, false)} disabled={loading}>
                                            ✗ Vote Against
                                        </button>
                                    </div>
                                )}

                                {isPending && isExpired && (
                                    <button
                                        className="btn-buy" style={{ marginTop: 12, fontSize: 13 }}
                                        onClick={() => onExecute(prop.id)}
                                        disabled={loading}
                                    >
                                        Execute Proposal
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {isLP && (
                <form className="create-proposal-form" onSubmit={handlePropose}>
                    <h3>Create Proposal</h3>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Parameter</label>
                            <select value={param} onChange={(e) => setParam(e.target.value)}>
                                {PARAM_OPTIONS.map(p => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>New Value</label>
                            <input
                                type="number"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder="Enter value"
                            />
                        </div>
                    </div>
                    <button type="submit" className="btn-propose" disabled={loading || !value}>
                        Submit Proposal
                    </button>
                </form>
            )}
        </div>
    );
};

export default Governance;
