import React from 'react';

const CITIES = [
    { name: 'New York', lat: '40.7128', lon: '-74.0060' },
    { name: 'London', lat: '51.5074', lon: '-0.1278' },
    { name: 'Lagos', lat: '6.5244', lon: '3.3792' },
    { name: 'Tokyo', lat: '35.6762', lon: '139.6503' },
    { name: 'Dubai', lat: '25.2048', lon: '55.2708' },
    { name: 'São Paulo', lat: '-23.5505', lon: '-46.6333' },
    { name: 'Mumbai', lat: '19.0760', lon: '72.8777' },
    { name: 'Nairobi', lat: '-1.2921', lon: '36.8219' },
    { name: 'Sydney', lat: '-33.8688', lon: '151.2093' },
    { name: 'Berlin', lat: '52.5200', lon: '13.4050' },
];

const LocationPicker = ({ lat, lon, onSelect }) => {
    const currentKey = `${lat},${lon}`;

    return (
        <div className="form-group">
            <label>📍 Location</label>
            <div className="location-presets">
                {CITIES.map(city => {
                    const key = `${city.lat},${city.lon}`;
                    return (
                        <button
                            key={city.name}
                            type="button"
                            className={`location-preset ${currentKey === key ? 'active' : ''}`}
                            onClick={() => onSelect(city.lat, city.lon)}
                        >
                            {city.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default LocationPicker;
