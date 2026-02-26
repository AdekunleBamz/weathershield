import React from 'react';

const WeatherDisplay = ({ weather }) => {
    if (!weather) return null;

    return (
        <div className="weather-display">
            <div className="weather-item">
                <span className="weather-icon">🌡️</span>
                <div className="weather-info">
                    <span className="weather-value">{weather.temp}°C</span>
                    <label>Current Temp</label>
                </div>
            </div>
            <div className="weather-divider" />
            <div className="weather-item">
                <span className="weather-icon">🌧️</span>
                <div className="weather-info">
                    <span className="weather-value">{weather.rain}mm</span>
                    <label>Current Rain</label>
                </div>
            </div>
            {weather.dailyPrecip !== undefined && (
                <>
                    <div className="weather-divider" />
                    <div className="weather-item">
                        <span className="weather-icon">💧</span>
                        <div className="weather-info">
                            <span className="weather-value">{weather.dailyPrecip}mm</span>
                            <label>Daily Precip</label>
                        </div>
                    </div>
                </>
            )}
            {weather.tempMax !== undefined && (
                <>
                    <div className="weather-divider" />
                    <div className="weather-item">
                        <span className="weather-icon">🔺</span>
                        <div className="weather-info">
                            <span className="weather-value">{weather.tempMax}°C</span>
                            <label>Max</label>
                        </div>
                    </div>
                </>
            )}
            {weather.tempMin !== undefined && (
                <>
                    <div className="weather-divider" />
                    <div className="weather-item">
                        <span className="weather-icon">🔻</span>
                        <div className="weather-info">
                            <span className="weather-value">{weather.tempMin}°C</span>
                            <label>Min</label>
                        </div>
                    </div>
                </>
            )}
            <div className="multi-source-badge">
                <span className="source-dot" /><span className="source-dot" /><span className="source-dot" />
                Multi-source aggregation
            </div>
        </div>
    );
};

export default WeatherDisplay;
