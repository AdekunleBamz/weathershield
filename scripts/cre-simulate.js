/**
 * CRE Workflow Simulation Script
 * Simulates the Chainlink CRE workflow locally for testing
 * 
 * This script:
 * 1. Fetches weather data from Open-Meteo API (FREE)
 * 2. Transforms the data
 * 3. Simulates what the CRE workflow would do
 */

import fetch from 'node-fetch';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  // Default location (New York City)
  location: {
    latitude: 40.7128,
    longitude: -74.0060
  },
  // Weather types: 0=Drought, 1=Flood, 2=Frost, 3=Heat
  weatherType: 0,
  // Policy ID to check (for simulation)
  policyId: 0,
  // RPC URL for local testing
  rpcUrl: 'http://127.0.0.1:8545'
};

// Weather type configurations
const WEATHER_CONFIGS = {
  0: { name: 'Drought', field: 'precipitation', unit: 'mm', compare: 'below' },
  1: { name: 'Flood', field: 'precipitation', unit: 'mm', compare: 'above' },
  2: { name: 'Frost', field: 'temp_min', unit: '°C', compare: 'below' },
  3: { name: 'Heat', field: 'temp_max', unit: '°C', compare: 'above' }
};

async function fetchWeatherData(latitude, longitude) {
  console.log('\n📡 Fetching weather data from Open-Meteo API...');
  console.log(`   Location: ${latitude}, ${longitude}`);
  
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,precipitation,rain&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  console.log('\n✅ Weather data received:');
  console.log(`   Current Temperature: ${data.current.temperature_2m}°C`);
  console.log(`   Current Rain: ${data.current.rain}mm`);
  console.log(`   Daily Precipitation: ${data.daily.precipitation_sum[0]}mm`);
  console.log(`   Daily Max Temp: ${data.daily.temperature_2m_max[0]}°C`);
  console.log(`   Daily Min Temp: ${data.daily.temperature_2m_min[0]}°C`);
  
  return {
    current: {
      temperature: data.current.temperature_2m,
      rain: data.current.rain
    },
    daily: {
      precipitation: data.daily.precipitation_sum[0],
      tempMax: data.daily.temperature_2m_max[0],
      tempMin: data.daily.temperature_2m_min[0]
    }
  };
}

function transformWeatherData(weatherData, weatherType) {
  console.log('\n🔄 Transforming weather data...');
  
  const config = WEATHER_CONFIGS[weatherType];
  let value;
  let rawValue;
  
  switch (weatherType) {
    case 0: // Drought
    case 1: // Flood
      rawValue = weatherData.daily.precipitation;
      value = Math.round(rawValue * 10); // Convert to 0.1mm precision
      break;
    case 2: // Frost
      rawValue = weatherData.daily.tempMin;
      value = Math.round(rawValue * 10); // Convert to 0.1°C precision
      break;
    case 3: // Heat
      rawValue = weatherData.daily.tempMax;
      value = Math.round(rawValue * 10); // Convert to 0.1°C precision
      break;
  }
  
  console.log(`   Weather Type: ${config.name}`);
  console.log(`   Raw Value: ${rawValue}${config.unit}`);
  console.log(`   Transformed Value (for contract): ${value}`);
  
  return { value, rawValue, config };
}

function checkTrigger(value, threshold, weatherType) {
  const config = WEATHER_CONFIGS[weatherType];
  let triggered;
  
  if (config.compare === 'below') {
    triggered = value < threshold;
  } else {
    triggered = value > threshold;
  }
  
  console.log('\n🎯 Checking trigger condition...');
  console.log(`   Condition: ${config.name} - value ${config.compare} ${threshold / 10}${config.unit}`);
  console.log(`   Current value: ${value / 10}${config.unit}`);
  console.log(`   Triggered: ${triggered ? '✅ YES' : '❌ NO'}`);
  
  return triggered;
}

async function simulateWorkflow(options = {}) {
  const {
    latitude = CONFIG.location.latitude,
    longitude = CONFIG.location.longitude,
    weatherType = CONFIG.weatherType,
    threshold = null,
    contractAddress = null
  } = options;
  
  console.log('\n' + '='.repeat(60));
  console.log('🌦️  WEATHERSHIELD CRE WORKFLOW SIMULATION');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Fetch weather data
    const weatherData = await fetchWeatherData(latitude, longitude);
    
    // Step 2: Transform data
    const { value, rawValue, config } = transformWeatherData(weatherData, weatherType);
    
    // Step 3: Check trigger (if threshold provided)
    if (threshold !== null) {
      const triggered = checkTrigger(value, threshold, weatherType);
      
      if (triggered) {
        console.log('\n🚨 INSURANCE CLAIM WOULD BE TRIGGERED!');
        console.log('   In a live CRE workflow, this would:');
        console.log('   1. Call updateWeatherData() on the contract');
        console.log('   2. Call processClaim() to execute payout');
      } else {
        console.log('\n⏳ No claim triggered - conditions not met');
      }
    }
    
    // Step 4: Simulate on-chain interaction (if contract address provided)
    if (contractAddress) {
      console.log('\n📝 Simulating on-chain update...');
      console.log(`   Contract: ${contractAddress}`);
      console.log(`   Would call: updateWeatherData("${latitude},${longitude}", ${value})`);
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SIMULATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Location: ${latitude}, ${longitude}`);
    console.log(`   Weather Type: ${config.name}`);
    console.log(`   Current Value: ${rawValue}${config.unit}`);
    console.log(`   Contract Value: ${value}`);
    if (threshold !== null) {
      console.log(`   Threshold: ${threshold / 10}${config.unit}`);
      console.log(`   Would Trigger: ${checkTrigger(value, threshold, weatherType) ? 'YES' : 'NO'}`);
    }
    console.log('='.repeat(60) + '\n');
    
    return {
      success: true,
      weatherData,
      transformedValue: value,
      rawValue,
      weatherType: config.name
    };
    
  } catch (error) {
    console.error('\n❌ Simulation failed:', error.message);
    return { success: false, error: error.message };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  // Parse CLI arguments
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--lat':
        options.latitude = parseFloat(args[++i]);
        break;
      case '--lon':
        options.longitude = parseFloat(args[++i]);
        break;
      case '--type':
        options.weatherType = parseInt(args[++i]);
        break;
      case '--threshold':
        options.threshold = parseInt(args[++i]);
        break;
      case '--contract':
        options.contractAddress = args[++i];
        break;
      case '--help':
        console.log(`
WeatherShield CRE Simulation

Usage: node scripts/cre-simulate.js [options]

Options:
  --lat <latitude>      Latitude (default: 40.7128)
  --lon <longitude>     Longitude (default: -74.0060)
  --type <0-3>          Weather type:
                          0 = Drought (rain below threshold)
                          1 = Flood (rain above threshold)
                          2 = Frost (temp below threshold)
                          3 = Heat (temp above threshold)
  --threshold <value>   Trigger threshold (value × 10, e.g., 100 = 10mm or 10°C)
  --contract <address>  Contract address for simulation
  --help                Show this help

Examples:
  # Check for drought conditions in NYC
  node scripts/cre-simulate.js --type 0 --threshold 100

  # Check for heat wave in LA
  node scripts/cre-simulate.js --lat 34.05 --lon -118.24 --type 3 --threshold 350

  # Full simulation with contract
  node scripts/cre-simulate.js --type 2 --threshold 0 --contract 0x123...
`);
        return;
    }
  }
  
  await simulateWorkflow(options);
}

// Run if called directly
main().catch(console.error);

// Export for use as module
export { simulateWorkflow, fetchWeatherData, transformWeatherData, checkTrigger };
