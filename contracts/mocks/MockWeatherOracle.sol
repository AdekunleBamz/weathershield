// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockWeatherOracle - For local testing
 * @notice Simulates weather data for testing without CRE
 */
contract MockWeatherOracle is Ownable {
    
    mapping(string => int256) public weatherValues;
    
    event WeatherSet(string location, int256 value);
    
    constructor() Ownable(msg.sender) {}
    
    function setWeather(string calldata _location, int256 _value) external onlyOwner {
        weatherValues[_location] = _value;
        emit WeatherSet(_location, _value);
    }
    
    function getWeather(string calldata _location) external view returns (int256) {
        return weatherValues[_location];
    }
}
