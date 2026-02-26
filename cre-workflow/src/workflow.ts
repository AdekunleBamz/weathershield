import { cre, http, evm, cron } from '@chainlink/cre-sdk';

// Configuration
const CONFIG = {
    CONTRACT_ADDRESS: "0x85A61e33CA36d1b52A74f9E4E4d4F363685F0bB2",
    OPEN_METEO_URL: "https://api.open-meteo.com/v1/forecast",
    WEATHER_API_URL: "https://api.weatherapi.com/v1/forecast.json",
    VISUAL_CROSSING_URL: "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline",
    GAS_LIMIT: 500_000,
};

// ABI definitions
const ABI = [
    "function updateWeatherData(string location, int256 value)",
    "function updateWeatherDataMultiSource(string location, int256 val1, int256 val2, int256 val3)",
    "function isPolicyClaimable(uint256 policyId) view returns (bool)",
    "function processClaim(uint256 policyId, int256 currentValue)",
    "function getPolicy(uint256 policyId) view returns (tuple(address holder, uint256 premium, uint256 coverageAmount, uint256 startTime, uint256 endTime, uint8 weatherType, int256 triggerThreshold, string location, uint8 status, uint8 riskTier))",
    "function policyCounter() view returns (uint256)"
];

// Weather types: 0=Drought, 1=Flood (Precipitation), 2=Frost (Min Temp), 3=Heat (Max Temp)
interface WeatherReading {
    dailyPrecip: number;
    tempMin: number;
    tempMax: number;
    source: string;
}

/**
 * Fetch weather from Open-Meteo (free, no API key)
 */
async function fetchOpenMeteo(lat: string, lon: string): Promise<WeatherReading | null> {
    try {
        const response = await http.fetch({
            url: CONFIG.OPEN_METEO_URL,
            method: 'GET',
            params: {
                latitude: lat,
                longitude: lon,
                current: 'temperature_2m,rain',
                daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
                timezone: 'auto'
            },
            timeout: 10000
        });
        const data = response.data;
        return {
            dailyPrecip: data.daily.precipitation_sum[0] || 0,
            tempMin: data.daily.temperature_2m_min[0] || 0,
            tempMax: data.daily.temperature_2m_max[0] || 0,
            source: 'Open-Meteo'
        };
    } catch (err) {
        return null;
    }
}

/**
 * Fetch weather from WeatherAPI.com (free tier, needs API key)
 */
async function fetchWeatherAPI(location: string): Promise<WeatherReading | null> {
    try {
        const response = await http.fetch({
            url: CONFIG.WEATHER_API_URL,
            method: 'GET',
            params: {
                key: cre.getSecret('WEATHERAPI_KEY'),
                q: location,
                days: '1'
            },
            timeout: 10000
        });
        const data = response.data;
        return {
            dailyPrecip: data.forecast.forecastday[0].day.totalprecip_mm || 0,
            tempMin: data.forecast.forecastday[0].day.mintemp_c || 0,
            tempMax: data.forecast.forecastday[0].day.maxtemp_c || 0,
            source: 'WeatherAPI'
        };
    } catch (err) {
        return null;
    }
}

/**
 * Fetch weather from Visual Crossing (free tier, needs API key)
 */
async function fetchVisualCrossing(location: string): Promise<WeatherReading | null> {
    try {
        const response = await http.fetch({
            url: `${CONFIG.VISUAL_CROSSING_URL}/${location}/today`,
            method: 'GET',
            params: {
                key: cre.getSecret('VISUAL_CROSSING_KEY'),
                unitGroup: 'metric',
                include: 'current,days',
                contentType: 'json'
            },
            timeout: 10000
        });
        const data = response.data;
        return {
            dailyPrecip: data.days[0].precip || 0,
            tempMin: data.days[0].tempmin || 0,
            tempMax: data.days[0].tempmax || 0,
            source: 'Visual Crossing'
        };
    } catch (err) {
        return null;
    }
}

/**
 * Calculate median of an array of numbers
 */
function calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }
    return sorted[mid];
}

/**
 * Extract weather value based on type
 */
function extractValue(reading: WeatherReading, weatherType: number): number {
    if (weatherType === 0 || weatherType === 1) {
        return Math.round(reading.dailyPrecip * 10);
    } else if (weatherType === 2) {
        return Math.round(reading.tempMin * 10);
    } else {
        return Math.round(reading.tempMax * 10);
    }
}

/**
 * Main callback function triggered by cron
 */
async function weatherPolicyCheck(event: cron.Event, runtime: cre.Runtime) {
    runtime.logger.info("Starting WeatherShield multi-source policy check cycle");

    // 1. Get total policy count
    const countResult = await evm.read({
        address: CONFIG.CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "policyCounter",
        args: []
    });

    const totalPolicies = Number(countResult);
    runtime.logger.info(`Found ${totalPolicies} total policies`);

    if (totalPolicies === 0) return;

    // 2. Process only active policies
    for (let i = 0; i < totalPolicies; i++) {
        await processPolicy(i, runtime);
    }

    runtime.logger.info("WeatherShield cycle completed");
}

/**
 * Process a single policy with multi-source weather data
 */
async function processPolicy(policyId: number, runtime: cre.Runtime) {
    // Fetch policy details
    const policy = await evm.read({
        address: CONFIG.CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "getPolicy",
        args: [policyId]
    });

    // ── SKIP if not Active (status 0) ──
    if (policy.status !== 0) {
        runtime.logger.info(`Policy ${policyId}: skipped (status=${policy.status})`);
        return;
    }

    // ── SKIP if expired ──
    const now = Math.floor(Date.now() / 1000);
    if (now > Number(policy.endTime)) {
        runtime.logger.info(`Policy ${policyId}: skipped (expired)`);
        return;
    }

    const [lat, lon] = policy.location.split(',');
    const location = policy.location;

    // ── Fetch from all 3 sources in parallel ──
    runtime.logger.info(`Policy ${policyId}: fetching weather from 3 sources for ${location}`);

    const results = await Promise.allSettled([
        fetchOpenMeteo(lat.trim(), lon.trim()),
        fetchWeatherAPI(location),
        fetchVisualCrossing(location)
    ]);

    // Collect successful readings
    const readings: WeatherReading[] = [];
    const sourceNames = ['Open-Meteo', 'WeatherAPI', 'Visual Crossing'];

    results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value !== null) {
            readings.push(result.value);
            runtime.logger.info(`  ✓ ${sourceNames[idx]}: precip=${result.value.dailyPrecip}mm, min=${result.value.tempMin}°C, max=${result.value.tempMax}°C`);
        } else {
            runtime.logger.info(`  ✗ ${sourceNames[idx]}: unavailable`);
        }
    });

    if (readings.length === 0) {
        runtime.logger.info(`Policy ${policyId}: all sources failed, skipping`);
        return;
    }

    // ── Extract and aggregate values ──
    const values = readings.map(r => extractValue(r, policy.weatherType));
    const medianValue = calculateMedian(values);

    runtime.logger.info(`Policy ${policyId}: values=[${values.join(', ')}], median=${medianValue}, sources=${readings.length}`);

    // ── Update contract ──
    if (readings.length >= 3) {
        // Use multi-source update (3 values for on-chain median)
        await evm.write({
            address: CONFIG.CONTRACT_ADDRESS,
            abi: ABI,
            functionName: "updateWeatherDataMultiSource",
            args: [location, values[0], values[1], values[2]],
            gasLimit: CONFIG.GAS_LIMIT
        });
    } else {
        // Fallback to single-source with our computed median
        await evm.write({
            address: CONFIG.CONTRACT_ADDRESS,
            abi: ABI,
            functionName: "updateWeatherData",
            args: [location, medianValue],
            gasLimit: CONFIG.GAS_LIMIT
        });
    }

    // ── Check if claimable ──
    const isClaimable = await evm.read({
        address: CONFIG.CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "isPolicyClaimable",
        args: [policyId]
    });

    if (isClaimable) {
        runtime.logger.info(`Policy ${policyId} TRIGGERED! Processing payout...`);

        await evm.write({
            address: CONFIG.CONTRACT_ADDRESS,
            abi: ABI,
            functionName: "processClaim",
            args: [policyId, medianValue],
            gasLimit: CONFIG.GAS_LIMIT
        });

        runtime.logger.info(`Payout processed for policy ${policyId}`);
    }
}

// Define the workflow handler
export const handler = cre.Handler(
    cron.Trigger({ schedule: "0 */6 * * *" }), // Run every 6 hours
    weatherPolicyCheck
);
