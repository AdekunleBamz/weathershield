import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import WeatherShieldABI from './abi/WeatherShield.json'

// Contract address - deployed on Arbitrum Sepolia
const CONTRACT_ADDRESS = '0x0988119B3526C21129E0254f5E8bd995Bed51F6D'

// Arbitrum Sepolia Network Configuration
const ARBITRUM_SEPOLIA = {
  chainId: '0x66eee', // 421614 in hex
  chainName: 'Arbitrum Sepolia',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
  blockExplorerUrls: ['https://sepolia.arbiscan.io/']
}

// Weather types
const WEATHER_TYPES = [
  { id: 0, name: 'Drought', icon: '🏜️', description: 'Triggers when rainfall is below threshold' },
  { id: 1, name: 'Flood', icon: '🌊', description: 'Triggers when rainfall exceeds threshold' },
  { id: 2, name: 'Frost', icon: '❄️', description: 'Triggers when temperature drops below threshold' },
  { id: 3, name: 'Heat', icon: '🔥', description: 'Triggers when temperature exceeds threshold' }
]

// Policy status mapping
const STATUS_MAP = {
  0: { label: 'Active', class: 'active' },
  1: { label: 'Claimed', class: 'claimed' },
  2: { label: 'Expired', class: 'expired' },
  3: { label: 'Cancelled', class: 'expired' }
}

function App() {
  // State
  const [account, setAccount] = useState(null)
  const [provider, setProvider] = useState(null)
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState(null)
  const [networkOk, setNetworkOk] = useState(false)
  
  // Contract data
  const [stats, setStats] = useState({
    totalPolicies: 0,
    totalPremiums: '0',
    totalPayouts: '0',
    contractBalance: '0'
  })
  const [userPolicies, setUserPolicies] = useState([])
  
  // Form state
  const [formData, setFormData] = useState({
    weatherType: 0,
    threshold: '100',
    latitude: '40.7128',
    longitude: '-74.0060',
    premium: '0.01'
  })
  
  // Weather data
  const [weather, setWeather] = useState(null)

  // Check and switch to Arbitrum Sepolia
  const switchToArbitrumSepolia = async () => {
    if (!window.ethereum) {
      showAlert('Please install MetaMask!', 'error')
      return false
    }

    try {
      // Try to switch to Arbitrum Sepolia
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARBITRUM_SEPOLIA.chainId }]
      })
      setNetworkOk(true)
      return true
    } catch (switchError) {
      // Chain not added - add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [ARBITRUM_SEPOLIA]
          })
          setNetworkOk(true)
          return true
        } catch (addError) {
          console.error('Failed to add Arbitrum Sepolia:', addError)
          showAlert('Failed to add Arbitrum Sepolia network. Please add it manually.', 'error')
          return false
        }
      } else {
        console.error('Failed to switch network:', switchError)
        showAlert('Please switch to Arbitrum Sepolia network', 'error')
        return false
      }
    }
  }

  // Check current network
  const checkNetwork = async () => {
    if (!window.ethereum) return false
    
    const chainId = await window.ethereum.request({ method: 'eth_chainId' })
    const isCorrectNetwork = chainId === ARBITRUM_SEPOLIA.chainId
    setNetworkOk(isCorrectNetwork)
    return isCorrectNetwork
  }

  // Connect wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      showAlert('Please install MetaMask!', 'error')
      return
    }
    
    try {
      setLoading(true)
      
      // Step 1: Request account access (this WILL trigger wallet popup)
      showAlert('Please approve the connection in your wallet...', 'info')
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      })
      
      if (!accounts || accounts.length === 0) {
        showAlert('No accounts found. Please unlock your wallet.', 'error')
        return
      }
      
      // Step 2: Check and switch network
      const isCorrectNetwork = await checkNetwork()
      if (!isCorrectNetwork) {
        showAlert('Switching to Arbitrum Sepolia network...', 'info')
        const switched = await switchToArbitrumSepolia()
        if (!switched) {
          showAlert('Please switch to Arbitrum Sepolia to use this app', 'error')
          return
        }
      }
      
      // Step 3: Setup provider and contract
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, WeatherShieldABI.abi, signer)
      
      setAccount(accounts[0])
      setProvider(provider)
      setContract(contract)
      
      showAlert(`Connected to Arbitrum Sepolia! Address: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`, 'success')
      
      // Load data
      await loadContractData(contract, accounts[0])
    } catch (error) {
      console.error('Connect wallet error:', error)
      if (error.code === 4001) {
        showAlert('Connection rejected. Please approve the connection in your wallet.', 'error')
      } else {
        showAlert('Failed to connect wallet: ' + (error.message || 'Unknown error'), 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  // Listen for network changes
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('chainChanged', (chainId) => {
        console.log('Network changed to:', chainId)
        if (chainId !== ARBITRUM_SEPOLIA.chainId) {
          setNetworkOk(false)
          showAlert('Please switch back to Arbitrum Sepolia', 'error')
        } else {
          setNetworkOk(true)
          showAlert('Connected to Arbitrum Sepolia', 'success')
          // Reload the page to reset state
          window.location.reload()
        }
      })

      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          setAccount(null)
          setContract(null)
          showAlert('Wallet disconnected', 'info')
        } else {
          setAccount(accounts[0])
          showAlert(`Switched to account: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`, 'info')
          window.location.reload()
        }
      })
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('chainChanged')
        window.ethereum.removeAllListeners('accountsChanged')
      }
    }
  }, [])

  // Load contract data
  const loadContractData = async (contractInstance, userAddress) => {
    try {
      const policyCounter = await contractInstance.policyCounter()
      const totalPremiums = await contractInstance.totalPremiumsCollected()
      const totalPayouts = await contractInstance.totalPayouts()
      const balance = await contractInstance.getContractBalance()
      
      setStats({
        totalPolicies: policyCounter.toString(),
        totalPremiums: ethers.formatEther(totalPremiums),
        totalPayouts: ethers.formatEther(totalPayouts),
        contractBalance: ethers.formatEther(balance)
      })
      
      // Load user policies
      const policyIds = await contractInstance.getUserPolicies(userAddress)
      const policies = await Promise.all(
        policyIds.map(async (id) => {
          const policy = await contractInstance.getPolicy(id)
          return {
            id: id.toString(),
            holder: policy.holder,
            premium: ethers.formatEther(policy.premium),
            coverageAmount: ethers.formatEther(policy.coverageAmount),
            startTime: new Date(Number(policy.startTime) * 1000),
            endTime: new Date(Number(policy.endTime) * 1000),
            weatherType: Number(policy.weatherType),
            threshold: policy.triggerThreshold.toString(),
            location: policy.location,
            status: Number(policy.status)
          }
        })
      )
      
      setUserPolicies(policies)
    } catch (error) {
      console.error('Error loading contract data:', error)
    }
  }

  // Fetch weather
  const fetchWeather = async () => {
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${formData.latitude}&longitude=${formData.longitude}&current=temperature_2m,precipitation,rain&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`
      )
      const data = await response.json()
      setWeather({
        temp: data.current.temperature_2m,
        rain: data.current.rain,
        location: `${formData.latitude}, ${formData.longitude}`
      })
    } catch (error) {
      console.error('Error fetching weather:', error)
    }
  }

  // Purchase policy
  const purchasePolicy = async (e) => {
    e.preventDefault()
    
    if (!contract) {
      showAlert('Please connect your wallet first', 'error')
      return
    }
    
    try {
      setLoading(true)
      
      const location = `${formData.latitude},${formData.longitude}`
      const threshold = parseInt(formData.threshold) || 100
      const premium = ethers.parseEther(formData.premium || '0.01')
      
      // Validate inputs
      if (isNaN(threshold) || threshold <= 0) {
        showAlert('Please enter a valid threshold value', 'error')
        setLoading(false)
        return
      }
      
      console.log('Purchasing policy:', {
        weatherType: formData.weatherType,
        threshold,
        location,
        premium: formData.premium
      })
      
      const tx = await contract.purchasePolicy(
        formData.weatherType,
        threshold,
        location,
        { value: premium }
      )
      
      showAlert('Transaction submitted! Waiting for confirmation...', 'info')
      await tx.wait()
      
      showAlert('Policy purchased successfully!', 'success')
      await loadContractData(contract, account)
    } catch (error) {
      console.error(error)
      showAlert(error.reason || 'Transaction failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Show alert
  const showAlert = (message, type) => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 5000)
  }

  // Handle form change
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  // Fetch weather on location change
  useEffect(() => {
    if (formData.latitude && formData.longitude) {
      fetchWeather()
    }
  }, [formData.latitude, formData.longitude])

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <img src="/shield.svg" alt="WeatherShield" />
          <h1>WeatherShield</h1>
        </div>
        <div className="header-right">
          {/* Network Badge */}
          <div className={`network-badge ${networkOk ? 'connected' : 'wrong-network'}`}>
            {networkOk ? '🟢 Arbitrum Sepolia' : '🔴 Wrong Network'}
          </div>
          {/* Switch Network Button (shown when on wrong network and connected) */}
          {account && !networkOk && (
            <button 
              className="switch-network-btn"
              onClick={switchToArbitrumSepolia}
              disabled={loading}
            >
              Switch Network
            </button>
          )}
          {/* Connect/Account Button */}
          <button 
            className={`connect-btn ${account ? 'connected' : ''}`}
            onClick={connectWallet}
            disabled={loading}
          >
            {loading ? (
              <span className="spinner"></span>
            ) : account ? (
              `${account.slice(0, 6)}...${account.slice(-4)}`
            ) : (
              '🔗 Connect Wallet'
            )}
          </button>
        </div>
      </header>

      {/* Network Warning Banner */}
      {account && !networkOk && (
        <div className="network-warning">
          ⚠️ Please switch to <strong>Arbitrum Sepolia</strong> network to use this dApp.
          <button onClick={switchToArbitrumSepolia}>Switch Now</button>
        </div>
      )}

      {/* Alert */}
      {alert && (
        <div className={`alert ${alert.type}`}>
          {alert.message}
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Policies</h3>
          <div className="value primary">{stats.totalPolicies}</div>
        </div>
        <div className="stat-card">
          <h3>Premiums Collected</h3>
          <div className="value secondary">{stats.totalPremiums} ETH</div>
        </div>
        <div className="stat-card">
          <h3>Total Payouts</h3>
          <div className="value warning">{stats.totalPayouts} ETH</div>
        </div>
        <div className="stat-card">
          <h3>Contract Balance</h3>
          <div className="value">{stats.contractBalance} ETH</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Purchase Policy Card */}
        <div className="card">
          <h2><span className="icon">🛡️</span> Purchase Insurance</h2>
          
          {/* Weather Display */}
          {weather && (
            <div className="weather-display">
              <div className="weather-icon">
                {weather.temp > 30 ? '☀️' : weather.rain > 0 ? '🌧️' : '⛅'}
              </div>
              <div className="weather-temp">{weather.temp}°C</div>
              <div className="weather-location">{weather.location}</div>
            </div>
          )}
          
          <form onSubmit={purchasePolicy}>
            <div className="form-group">
              <label>Insurance Type</label>
              <select 
                name="weatherType" 
                value={formData.weatherType}
                onChange={handleChange}
              >
                {WEATHER_TYPES.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.icon} {type.name} - {type.description}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Latitude</label>
                <input 
                  type="text" 
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleChange}
                  placeholder="40.7128"
                />
              </div>
              <div className="form-group">
                <label>Longitude</label>
                <input 
                  type="text" 
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleChange}
                  placeholder="-74.0060"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>
                Trigger Threshold 
                {formData.weatherType <= 1 ? ' (mm × 10)' : ' (°C × 10)'}
              </label>
              <input 
                type="number" 
                name="threshold"
                value={formData.threshold}
                onChange={handleChange}
                placeholder={formData.weatherType <= 1 ? "e.g., 100 = 10mm" : "e.g., 400 = 40°C"}
              />
            </div>
            
            <div className="form-group">
              <label>Premium Amount (ETH)</label>
              <input 
                type="text" 
                name="premium"
                value={formData.premium}
                onChange={handleChange}
                placeholder="0.01"
              />
              <small style={{color: 'var(--text-secondary)', marginTop: '4px', display: 'block'}}>
                Coverage: {(parseFloat(formData.premium || 0) * 10).toFixed(3)} ETH (10x premium)
              </small>
            </div>
            
            <button 
              type="submit" 
              className="submit-btn"
              disabled={loading || !account}
            >
              {loading ? <span className="spinner"></span> : '🛡️ Purchase Policy'}
            </button>
          </form>
        </div>

        {/* User Policies Card */}
        <div className="card">
          <h2><span className="icon">📋</span> Your Policies</h2>
          
          {userPolicies.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📭</div>
              <p>No policies yet. Purchase your first insurance policy!</p>
            </div>
          ) : (
            <div className="policy-list">
              {userPolicies.map(policy => (
                <div key={policy.id} className="policy-item">
                  <div className="policy-header">
                    <span className="policy-id">
                      {WEATHER_TYPES[policy.weatherType].icon} Policy #{policy.id}
                    </span>
                    <span className={`policy-status ${STATUS_MAP[policy.status].class}`}>
                      {STATUS_MAP[policy.status].label}
                    </span>
                  </div>
                  <div className="policy-details">
                    <span>Premium:</span>
                    <strong>{policy.premium} ETH</strong>
                    <span>Coverage:</span>
                    <strong>{policy.coverageAmount} ETH</strong>
                    <span>Location:</span>
                    <strong>{policy.location}</strong>
                    <span>Threshold:</span>
                    <strong>{policy.threshold / 10}{policy.weatherType <= 1 ? 'mm' : '°C'}</strong>
                    <span>Expires:</span>
                    <strong>{policy.endTime.toLocaleDateString()}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        <p>Powered by Chainlink CRE | Built for Hackathon 2026</p>
        <div className="chainlink-badge">
          ⛓️ Chainlink Compute Runtime Environment
        </div>
      </footer>
    </div>
  )
}

export default App
