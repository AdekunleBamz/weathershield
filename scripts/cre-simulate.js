/*
  CRE Workflow Simulation
  
  Tests the Chainlink CRE workflow locally by fetching real weather data
  and checking if it would trigger a claim.
  
  Usage:
    node scripts/cre-simulate.js
    node scripts/cre-simulate.js --type 0 --threshold 100
    node scripts/cre-simulate.js --lat 34.05 --lon -118.24 --type 3
*/

import fetch from 'node-fetch';

// defaults - NYC
let lat = 40.7128;
let lon = -74.0060;
let weatherType = 0;
let threshold = 100;

// parse args
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  const flag = args[i];
  const val = args[i + 1];
  if (flag === '--lat') lat = parseFloat(val);
  if (flag === '--lon') lon = parseFloat(val);
  if (flag === '--type') weatherType = parseInt(val);
  if (flag === '--threshold') threshold = parseInt(val);
}

const typeNames = ['Drought', 'Flood', 'Frost', 'Heat'];
const typeFields = ['precipitation', 'precipitation', 'temp_min', 'temp_max'];

async function run() {
  console.log('\n--- WeatherShield CRE Simulation ---\n');
  console.log(`Location: ${lat}, ${lon}`);
  console.log(`Type: ${typeNames[weatherType]} (${weatherType})`);
  console.log(`Threshold: ${threshold}`);
  
  // fetch weather
  console.log('\nFetching weather from Open-Meteo...');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,rain&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
  
  const res = await fetch(url);
  const data = await res.json();
  
  console.log('\nWeather data:');
  console.log(`  Temp: ${data.current.temperature_2m}°C`);
  console.log(`  Rain: ${data.current.rain}mm`);
  console.log(`  Daily precip: ${data.daily.precipitation_sum[0]}mm`);
  console.log(`  Daily max: ${data.daily.temperature_2m_max[0]}°C`);
  console.log(`  Daily min: ${data.daily.temperature_2m_min[0]}°C`);
  
  // get relevant value
  let value;
  let unit;
  switch (weatherType) {
    case 0: // drought
    case 1: // flood
      value = Math.round(data.daily.precipitation_sum[0] * 10);
      unit = 'mm';
      break;
    case 2: // frost
      value = Math.round(data.daily.temperature_2m_min[0] * 10);
      unit = '°C';
      break;
    case 3: // heat
      value = Math.round(data.daily.temperature_2m_max[0] * 10);
      unit = '°C';
      break;
  }
  
  console.log(`\nContract value: ${value} (${value/10}${unit})`);
  
  // check trigger
  let triggered = false;
  if (weatherType === 0 || weatherType === 2) {
    triggered = value < threshold;
    console.log(`Trigger: value < ${threshold}? ${triggered ? 'YES' : 'NO'}`);
  } else {
    triggered = value > threshold;
    console.log(`Trigger: value > ${threshold}? ${triggered ? 'YES' : 'NO'}`);
  }
  
  if (triggered) {
    console.log('\n✓ CLAIM WOULD TRIGGER');
  } else {
    console.log('\n✗ No trigger');
  }
  console.log('');
}

run().catch(console.error);
