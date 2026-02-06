import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import WeatherShieldABI from './abi/WeatherShield.json'

const CONTRACT_ADDRESS = '0x0988119B3526C21129E0254f5E8bd995Bed51F6D'

const ARBITRUM_SEPOLIA = {
  chainId: '0x66eee',
  chainName: 'Arbitrum Sepolia',
  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
  blockExplorerUrls: ['https://sepolia.arbiscan.io/']
}

const WEATHER_TYPES = [
  { id: 0, name: 'Drought', icon: '☀️', desc: 'Payout if rainfall below threshold' },
  { id: 1, name: 'Flood', icon: '🌊', desc: 'Payout if rainfall above threshold' },
  { id: 2, name: 'Frost', icon: '❄️', desc: 'Payout if temp below threshold' },
  { id: 3, name: 'Heat', icon: '🔥', desc: 'Payout if temp above threshold' }
]

function App() {
  const [account, setAccount] = useState(null)
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [networkOk, setNetworkOk] = useState(false)
  
  const [stats, setStats] = useState({
    policies: 0, premiums: '0', payouts: '0', balance: '0'
  })
  const [myPolicies, setMyPolicies] = useState([])
  
  const [form, setForm] = useState({
    type: 0,
    threshold: '100',
    lat: '40.7128',
    lon: '-74.0060',
    premium: '0.01'
  })
  
  const [weather, setWeather] = useState(null)

  // switch network if needed
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

  async function connect() {
    if (!window.ethereum) {
      showMsg('Install MetaMask', 'error')
      return
    }
    
    setLoading(true)
    try {
      const accts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      
      // check network
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
      if (err.code === 4001) {
        showMsg('Connection rejected', 'error')
      } else {
        showMsg('Connection failed', 'error')
      }
    }
    setLoading(false)
  }
  
  async function loadData(c, addr) {
    try {
      const [cnt, prem, pays, bal] = await Promise.all([
        c.policyCounter(),
        c.totalPremiumsCollected(),
        c.totalPayouts(),
        c.getContractBalance()
      ])
      
      setStats({
        policies: Number(cnt),
        premiums: ethers.formatEther(prem),
        payouts: ethers.formatEther(pays),
        balance: ethers.formatEther(bal)
      })
      
      const ids = await c.getUserPolicies(addr)
      const policies = await Promise.all(
        ids.map(async id => {
          const p = await c.getPolicy(id)
          // ethers v6 returns struct as array-like, extract named props
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
            status: Number(p.status)
          }
        })
      )
      setMyPolicies(policies)
    } catch (err) {
      console.error('load error:', err)
    }
  }
  
  async function fetchWeather() {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${form.lat}&longitude=${form.lon}&current=temperature_2m,rain`
      const res = await fetch(url)
      const data = await res.json()
      setWeather({
        temp: data.current.temperature_2m,
        rain: data.current.rain
      })
    } catch (e) {
      console.error('weather fetch failed')
    }
  }
  
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
      await tx.wait()
      
      showMsg('Policy purchased!', 'success')
      loadData(contract, account)
    } catch (err) {
      console.error(err)
      showMsg(err.reason || 'Transaction failed', 'error')
    }
    setLoading(false)
  }
  
  function showMsg(text, type) {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }
  
  function handleInput(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }
  
  // fetch weather when location changes
  useEffect(() => {
    if (form.lat && form.lon) fetchWeather()
  }, [form.lat, form.lon])
  
  // listen for network/account changes
  useEffect(() => {
    if (!window.ethereum) return
    
    const handleChainChanged = (chainId) => {
      // Just update network status, don't auto-reconnect
      if (chainId === ARBITRUM_SEPOLIA.chainId) {
        setNetworkOk(true)
      } else {
        setNetworkOk(false)
      }
    }
    
    const handleAccountsChanged = (accts) => {
      if (accts.length === 0) {
        setAccount(null)
        setContract(null)
        setNetworkOk(false)
      } else {
        // Just clear state, user must click connect again
        setAccount(null)
        setContract(null)
      }
    }
    
    window.ethereum.on('chainChanged', handleChainChanged)
    window.ethereum.on('accountsChanged', handleAccountsChanged)
    
    return () => {
      window.ethereum.removeListener('chainChanged', handleChainChanged)
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
    }
  }, [])

  const statusLabels = ['Active', 'Claimed', 'Expired', 'Cancelled']

  return (
    <div className="app">
      <header>
        <h1>WeatherShield</h1>
        <div className="header-right">
          {account && (
            <span className={`network ${networkOk ? 'ok' : 'bad'}`}>
              {networkOk ? 'Arbitrum Sepolia' : 'Wrong Network'}
            </span>
          )}
          <button onClick={connect} disabled={loading}>
            {loading ? '...' : account ? `${account.slice(0,6)}...${account.slice(-4)}` : 'Connect'}
          </button>
        </div>
      </header>
      
      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
      
      {account && !networkOk && (
        <div className="warning">
          Switch to Arbitrum Sepolia to continue
          <button onClick={switchNetwork}>Switch</button>
        </div>
      )}
      
      <div className="stats">
        <div className="stat"><label>Policies</label><span>{stats.policies}</span></div>
        <div className="stat"><label>Premiums</label><span>{stats.premiums} ETH</span></div>
        <div className="stat"><label>Payouts</label><span>{stats.payouts} ETH</span></div>
        <div className="stat"><label>Balance</label><span>{stats.balance} ETH</span></div>
      </div>
      
      <div className="main">
        <div className="card">
          <h2>Buy Insurance</h2>
          
          {weather && (
            <div className="weather">
              <span>{weather.temp}°C</span>
              <span>{weather.rain}mm rain</span>
            </div>
          )}
          
          <form onSubmit={buyPolicy}>
            <label>Type</label>
            <select name="type" value={form.type} onChange={handleInput}>
              {WEATHER_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
              ))}
            </select>
            
            <label>Threshold</label>
            <input name="threshold" value={form.threshold} onChange={handleInput} placeholder="100" />
            <small>{WEATHER_TYPES[form.type].desc}</small>
            
            <div className="row">
              <div>
                <label>Latitude</label>
                <input name="lat" value={form.lat} onChange={handleInput} />
              </div>
              <div>
                <label>Longitude</label>
                <input name="lon" value={form.lon} onChange={handleInput} />
              </div>
            </div>
            
            <label>Premium (ETH)</label>
            <input name="premium" value={form.premium} onChange={handleInput} placeholder="0.01" />
            <small>Coverage: {(parseFloat(form.premium || 0) * 10).toFixed(2)} ETH</small>
            
            <button type="submit" disabled={loading || !account}>
              {loading ? 'Processing...' : 'Buy Policy'}
            </button>
          </form>
        </div>
        
        <div className="card">
          <h2>My Policies</h2>
          {myPolicies.length === 0 ? (
            <p className="empty">No policies yet</p>
          ) : (
            <div className="policies">
              {myPolicies.map(p => (
                <div key={p.id} className={`policy ${statusLabels[p.status].toLowerCase()}`}>
                  <div className="policy-header">
                    <span>#{p.id}</span>
                    <span className="status">{statusLabels[p.status]}</span>
                  </div>
                  <div className="policy-info">
                    <span>{WEATHER_TYPES[p.weatherType].icon} {WEATHER_TYPES[p.weatherType].name}</span>
                    <span>Threshold: {Number(p.triggerThreshold)}</span>
                    <span>Coverage: {ethers.formatEther(p.coverageAmount)} ETH</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
