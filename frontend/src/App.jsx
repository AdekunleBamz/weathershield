import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import WeatherShieldABI from './abi/WeatherShield.json'

import Header from './components/Header'
import Stats from './components/Stats'
import PolicyCard from './components/PolicyCard'
import CreatePolicy from './components/CreatePolicy'
import WeatherDisplay from './components/WeatherDisplay'
import LiquidityPool from './components/LiquidityPool'
import Governance from './components/Governance'

const CONTRACT_ADDRESS = '0x85A61e33CA36d1b52A74f9E4E4d4F363685F0bB2'

const ARBITRUM_SEPOLIA = {
  chainId: '0x66eee',
  chainName: 'Arbitrum Sepolia',
  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
  blockExplorerUrls: ['https://sepolia.arbiscan.io/']
}

const ARBISCAN_URL = 'https://sepolia.arbiscan.io/tx/'
const PUBLIC_RPC = 'https://sepolia-rollup.arbitrum.io/rpc'

function App() {
  const [account, setAccount] = useState(null)
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const [networkOk, setNetworkOk] = useState(false)
  const [lastTx, setLastTx] = useState(null)
  const [activeTab, setActiveTab] = useState('policies')

  const [ethPrice, setEthPrice] = useState(0)
  const [stats, setStats] = useState({
    policies: 0, premiums: '0', payouts: '0', balance: '0', liquidity: '0'
  })
  const [myPolicies, setMyPolicies] = useState([])
  const [poolStats, setPoolStats] = useState({
    totalLiquidity: '0', totalShares: '0', reservedFunds: '0',
    availableLiquidity: '0', protocolFees: '0', userShares: '0', userValue: '0'
  })
  const [proposals, setProposals] = useState([])
  const [isLP, setIsLP] = useState(false)

  const [form, setForm] = useState({
    type: 0, threshold: '100', lat: '40.7128', lon: '-74.0060', premium: '0.01'
  })
  const [weather, setWeather] = useState(null)

  // Network
  async function switchNetwork() {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARBITRUM_SEPOLIA.chainId }]
      })
      setNetworkOk(true)
      return true
    } catch (err) {
      if (err.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [ARBITRUM_SEPOLIA]
          })
          setNetworkOk(true)
          return true
        } catch (e) {
          showMsg('Could not add network', 'error')
          return false
        }
      }
      showMsg('Please switch to Arbitrum Sepolia', 'error')
      return false
    }
  }

  // Connect
  async function connect() {
    if (!window.ethereum) {
      showMsg('Install MetaMask', 'error')
      return
    }
    setLoading(true)
    try {
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }]
      })
      const accts = await window.ethereum.request({ method: 'eth_accounts' })
      if (accts.length === 0) {
        showMsg('No account selected', 'error')
        setLoading(false)
        return
      }

      const chainId = await window.ethereum.request({ method: 'eth_chainId' })
      if (chainId !== ARBITRUM_SEPOLIA.chainId) {
        showMsg('Switching network...', 'info')
        if (!await switchNetwork()) {
          setLoading(false)
          return
        }
      }
      setNetworkOk(true)

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const c = new ethers.Contract(CONTRACT_ADDRESS, WeatherShieldABI.abi, signer)

      setAccount(accts[0])
      setContract(c)
      showMsg('Connected!', 'success')
      loadData(c, accts[0])
    } catch (err) {
      console.error(err)
      showMsg(err.code === 4001 ? 'Connection rejected' : 'Connection failed', 'error')
    }
    setLoading(false)
  }

  function disconnect() {
    setAccount(null)
    setContract(null)
    setNetworkOk(false)
    setMyPolicies([])
    showMsg('Disconnected', 'info')
    loadPublicData() // reload public stats without wallet
  }

  // Load public contract data without wallet (read-only)
  async function loadPublicData() {
    setDataLoading(true)
    try {
      const provider = new ethers.JsonRpcProvider(PUBLIC_RPC)
      const c = new ethers.Contract(CONTRACT_ADDRESS, WeatherShieldABI.abi, provider)

      const [cnt, prem, pays, bal] = await Promise.all([
        c.policyCounter(),
        c.totalPremiumsCollected(),
        c.totalPayouts(),
        c.getContractBalance()
      ])

      let poolData = null
      try { poolData = await c.getPoolStats() } catch (e) { }

      try {
        const rawPrice = await c.getEthUsdPrice()
        setEthPrice(Number(rawPrice) / 1e8)
      } catch (e) { }

      const totalLiq = poolData ? ethers.formatEther(poolData[0]) : '0'
      setStats({
        policies: Number(cnt),
        premiums: ethers.formatEther(prem),
        payouts: ethers.formatEther(pays),
        balance: ethers.formatEther(bal),
        liquidity: totalLiq
      })

      if (poolData) {
        setPoolStats({
          totalLiquidity: ethers.formatEther(poolData[0]),
          totalShares: ethers.formatEther(poolData[1]),
          reservedFunds: ethers.formatEther(poolData[2]),
          availableLiquidity: ethers.formatEther(poolData[3]),
          protocolFees: ethers.formatEther(poolData[4]),
          userShares: '0', userValue: '0'
        })
      }

      // Load proposals
      try {
        const propCount = await c.proposalCounter()
        const props = []
        for (let i = 0; i < Number(propCount); i++) {
          const prop = await c.getProposal(i)
          props.push({
            id: i, paramName: prop.paramName, newValue: prop.newValue.toString(),
            proposer: prop.proposer, votesFor: prop.votesFor.toString(),
            votesAgainst: prop.votesAgainst.toString(), deadline: prop.deadline,
            status: Number(prop.status)
          })
        }
        setProposals(props)
      } catch (e) { }
    } catch (err) {
      console.error('public load error:', err)
    }
    setDataLoading(false)
  }

  // Load all data
  async function loadData(c, addr) {
    setDataLoading(true)
    try {
      const [cnt, prem, pays, bal] = await Promise.all([
        c.policyCounter(),
        c.totalPremiumsCollected(),
        c.totalPayouts(),
        c.getContractBalance()
      ])

      // Try to get pool stats and ETH price
      let poolData = null
      let price = 0
      try {
        poolData = await c.getPoolStats()
      } catch (e) { /* contract may not have pool */ }

      try {
        const rawPrice = await c.getEthUsdPrice()
        price = Number(rawPrice) / 1e8 // 8 decimals
        setEthPrice(price)
      } catch (e) { /* price feed may not be configured */ }

      const totalLiq = poolData ? ethers.formatEther(poolData[0]) : '0'
      setStats({
        policies: Number(cnt),
        premiums: ethers.formatEther(prem),
        payouts: ethers.formatEther(pays),
        balance: ethers.formatEther(bal),
        liquidity: totalLiq
      })

      // Pool stats
      if (poolData) {
        let userShares = '0'
        let userValue = '0'
        try {
          const lpPos = await c.lpPositions(addr)
          userShares = ethers.formatEther(lpPos.shares)
          const val = await c.getLPValue(addr)
          userValue = ethers.formatEther(val)
          setIsLP(Number(lpPos.shares) > 0)
        } catch (e) { }

        setPoolStats({
          totalLiquidity: ethers.formatEther(poolData[0]),
          totalShares: ethers.formatEther(poolData[1]),
          reservedFunds: ethers.formatEther(poolData[2]),
          availableLiquidity: ethers.formatEther(poolData[3]),
          protocolFees: ethers.formatEther(poolData[4]),
          userShares,
          userValue
        })
      }

      // User policies
      const ids = await c.getUserPolicies(addr)
      const policies = await Promise.all(
        ids.map(async id => {
          const p = await c.getPolicy(id)
          return {
            id: Number(id),
            holder: p.holder,
            premium: p.premium,
            coverageAmount: p.coverageAmount,
            startTime: p.startTime,
            endTime: p.endTime,
            weatherType: Number(p.weatherType),
            triggerThreshold: p.triggerThreshold,
            location: p.location,
            status: Number(p.status),
            riskTier: Number(p.riskTier)
          }
        })
      )
      setMyPolicies(policies)

      // Governance proposals
      try {
        const propCount = await c.proposalCounter()
        const props = []
        for (let i = 0; i < Number(propCount); i++) {
          const prop = await c.getProposal(i)
          props.push({
            id: i,
            paramName: prop.paramName,
            newValue: prop.newValue.toString(),
            proposer: prop.proposer,
            votesFor: prop.votesFor.toString(),
            votesAgainst: prop.votesAgainst.toString(),
            deadline: prop.deadline,
            status: Number(prop.status)
          })
        }
        setProposals(props)
      } catch (e) { }
    } catch (err) {
      console.error('load error:', err)
    }
    setDataLoading(false)
  }

  // Weather
  async function fetchWeather() {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${form.lat}&longitude=${form.lon}&current=temperature_2m,rain&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`
      const res = await fetch(url)
      const data = await res.json()
      setWeather({
        temp: data.current.temperature_2m,
        rain: data.current.rain,
        dailyPrecip: data.daily?.precipitation_sum?.[0],
        tempMax: data.daily?.temperature_2m_max?.[0],
        tempMin: data.daily?.temperature_2m_min?.[0]
      })
    } catch (e) {
      console.error('weather fetch failed')
    }
  }

  // Buy policy
  async function buyPolicy(e) {
    e.preventDefault()
    if (!contract) {
      showMsg('Connect wallet first', 'error')
      return
    }
    setLoading(true)
    try {
      const loc = `${form.lat},${form.lon}`
      const thresh = parseInt(form.threshold) || 100
      const value = ethers.parseEther(form.premium || '0.01')

      const tx = await contract.purchasePolicy(form.type, thresh, loc, { value })
      showMsg('Tx submitted...', 'info')
      setLastTx(tx.hash)
      await tx.wait()

      showMsg('Policy purchased! NFT minted.', 'success')
      loadData(contract, account)
    } catch (err) {
      console.error(err)
      showMsg(err.reason || 'Transaction failed', 'error')
    }
    setLoading(false)
  }

  // Trigger claim
  async function triggerClaim(policyId) {
    if (!contract) return
    setLoading(true)
    try {
      const policy = myPolicies.find(p => p.id === policyId)
      if (!policy) throw new Error('Policy not found')

      const [lat, lon] = policy.location.split(',')
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,rain&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=auto`
      const res = await fetch(url)
      const data = await res.json()

      let weatherValue
      if (policy.weatherType <= 1) {
        weatherValue = Math.round((data.daily?.precipitation_sum?.[0] || data.current.rain) * 10)
      } else if (policy.weatherType === 2) {
        weatherValue = Math.round((data.daily?.temperature_2m_min?.[0] || data.current.temperature_2m) * 10)
      } else {
        weatherValue = Math.round((data.daily?.temperature_2m_max?.[0] || data.current.temperature_2m) * 10)
      }

      showMsg(`Weather value: ${weatherValue / 10}. Triggering claim...`, 'info')
      const tx = await contract.processClaim(policyId, weatherValue)
      setLastTx(tx.hash)
      showMsg('Claim tx submitted...', 'info')
      await tx.wait()

      showMsg('Payout sent!', 'success')
      loadData(contract, account)
    } catch (err) {
      console.error(err)
      const reason = err.reason || err.message || 'Claim failed'
      showMsg(reason.includes('Conditions not met') ? 'Weather conditions not met yet' : reason, 'error')
    }
    setLoading(false)
  }

  // Pool actions
  async function handlePoolAction(action, value) {
    if (!contract) return
    setLoading(true)
    try {
      let tx
      if (action === 'deposit') {
        tx = await contract.depositLiquidity({ value: ethers.parseEther(value) })
      } else {
        tx = await contract.withdrawLiquidity(ethers.parseEther(value))
      }
      setLastTx(tx.hash)
      showMsg(`${action === 'deposit' ? 'Deposit' : 'Withdrawal'} submitted...`, 'info')
      await tx.wait()
      showMsg(`${action === 'deposit' ? 'Deposited' : 'Withdrawn'} successfully!`, 'success')
      loadData(contract, account)
    } catch (err) {
      console.error(err)
      showMsg(err.reason || 'Pool action failed', 'error')
    }
    setLoading(false)
  }

  // Governance
  async function handleVote(proposalId, support) {
    if (!contract) return
    setLoading(true)
    try {
      const tx = await contract.voteOnProposal(proposalId, support)
      setLastTx(tx.hash)
      await tx.wait()
      showMsg('Vote cast!', 'success')
      loadData(contract, account)
    } catch (err) {
      showMsg(err.reason || 'Vote failed', 'error')
    }
    setLoading(false)
  }

  async function handlePropose(param, value) {
    if (!contract) return
    setLoading(true)
    try {
      const tx = await contract.proposeParameterChange(param, value)
      setLastTx(tx.hash)
      await tx.wait()
      showMsg('Proposal created!', 'success')
      loadData(contract, account)
    } catch (err) {
      showMsg(err.reason || 'Proposal failed', 'error')
    }
    setLoading(false)
  }

  async function handleExecute(proposalId) {
    if (!contract) return
    setLoading(true)
    try {
      const tx = await contract.executeProposal(proposalId)
      setLastTx(tx.hash)
      await tx.wait()
      showMsg('Proposal executed!', 'success')
      loadData(contract, account)
    } catch (err) {
      showMsg(err.reason || 'Execution failed', 'error')
    }
    setLoading(false)
  }

  function showMsg(text, type) {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), type === 'success' ? 15000 : 4000)
  }

  function handleInput(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  // Load public data on mount (no wallet needed)
  useEffect(() => {
    loadPublicData()
  }, [])

  useEffect(() => {
    if (form.lat && form.lon) fetchWeather()
  }, [form.lat, form.lon])

  useEffect(() => {
    if (!window.ethereum) return
    const handleAccountsChanged = (accts) => {
      if (accts.length === 0) disconnect()
    }
    window.ethereum.on('accountsChanged', handleAccountsChanged)
    return () => window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
  }, [])

  return (
    <div className="app-container">
      <Header
        account={account}
        networkOk={networkOk}
        connect={connect}
        disconnect={disconnect}
        switchNetwork={switchNetwork}
        ethPrice={ethPrice}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <main className="main-content">
        {msg && (
          <div className={`notification-banner ${msg.type}`}>
            {msg.text}
            {lastTx && (msg.type === 'success' || msg.type === 'info') && (
              <a href={`${ARBISCAN_URL}${lastTx}`} target="_blank" rel="noreferrer" className="tx-link">
                View on Arbiscan ↗
              </a>
            )}
          </div>
        )}

        <Stats stats={stats} ethPrice={ethPrice} loading={dataLoading} />

        {activeTab === 'policies' && (
          <div className="action-grid">
            <CreatePolicy
              form={form}
              handleInput={handleInput}
              buyPolicy={buyPolicy}
              loading={loading}
              ethPrice={ethPrice}
            >
              <WeatherDisplay weather={weather} />
            </CreatePolicy>

            <div className="policy-list-container">
              <h2>Your Policies</h2>
              {myPolicies.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">🛡️</span>
                  <p>No active policies</p>
                  <small>Purchase insurance to get started</small>
                </div>
              ) : (
                <div className="policy-grid">
                  {myPolicies.map(p => (
                    <PolicyCard
                      key={p.id}
                      policy={p}
                      onTrigger={triggerClaim}
                      loading={loading}
                      ethPrice={ethPrice}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'pool' && (
          <LiquidityPool
            contract={contract}
            poolStats={poolStats}
            ethPrice={ethPrice}
            loading={loading}
            onAction={handlePoolAction}
          />
        )}

        {activeTab === 'governance' && (
          <Governance
            proposals={proposals}
            isLP={isLP}
            loading={loading}
            onVote={handleVote}
            onPropose={handlePropose}
            onExecute={handleExecute}
          />
        )}
      </main>
    </div>
  )
}

export default App
