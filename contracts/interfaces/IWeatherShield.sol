// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Interface for CRE workflow to interact with WeatherShield
interface IWeatherShield {

    enum PolicyStatus { Active, Claimed, Expired, Cancelled }
    enum WeatherType { Drought, Flood, Frost, Heat }
    enum RiskTier { Low, Medium, High, Critical }

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
        RiskTier riskTier;
    }

    struct WeatherData {
        int256 value;
        uint256 timestamp;
        bool isValid;
        uint8 sourceCount;
    }

    // CRE workflow calls
    function updateWeatherData(string calldata location, int256 value) external;
    function updateWeatherDataMultiSource(string calldata location, int256 val1, int256 val2, int256 val3) external;
    function processClaim(uint256 policyId, int256 currentValue) external;

    // Read functions for CRE
    function getPolicy(uint256 policyId) external view returns (Policy memory);
    function getWeatherData(string calldata location) external view returns (WeatherData memory);
    function isPolicyClaimable(uint256 policyId) external view returns (bool);
    function policyCounter() external view returns (uint256);

    // Price feed
    function getEthUsdPrice() external view returns (int256);
    function ethToUsd(uint256 ethAmount) external view returns (uint256);
}
