// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Interface for CRE workflow to interact with WeatherShield
interface IWeatherShield {
    
    enum PolicyStatus { Active, Claimed, Expired, Cancelled }
    enum WeatherType { Drought, Flood, Frost, Heat }
    
    struct Policy {
        address holder;
        uint256 premium;
        uint256 coverageAmount;
        uint256 startTime;
        uint256 endTime;
        WeatherType weatherType;
        int256 triggerThreshold;
        string location;
        PolicyStatus status;
    }
    
    struct WeatherData {
        int256 value;
        uint256 timestamp;
        bool isValid;
    }
    
    // CRE will call these
    function updateWeatherData(string calldata location, int256 value) external;
    function processClaim(uint256 policyId, int256 currentValue) external;
    
    // read functions for CRE
    function getPolicy(uint256 policyId) external view returns (Policy memory);
    function getWeatherData(string calldata location) external view returns (WeatherData memory);
    function isPolicyClaimable(uint256 policyId) external view returns (bool);
    function policyCounter() external view returns (uint256);
}
