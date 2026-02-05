// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IWeatherShield - Interface for WeatherShield contract
 * @notice Interface used by CRE workflows to interact with WeatherShield
 */
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
    
    // Core functions
    function purchasePolicy(
        WeatherType _weatherType,
        int256 _triggerThreshold,
        string calldata _location
    ) external payable returns (uint256 policyId);
    
    function updateWeatherData(
        string calldata _location,
        int256 _value
    ) external;
    
    function processClaim(
        uint256 _policyId,
        int256 _currentValue
    ) external;
    
    function expirePolicy(uint256 _policyId) external;
    function cancelPolicy(uint256 _policyId) external;
    
    // View functions
    function getPolicy(uint256 _policyId) external view returns (Policy memory);
    function getUserPolicies(address _user) external view returns (uint256[] memory);
    function getWeatherData(string calldata _location) external view returns (WeatherData memory);
    function getContractBalance() external view returns (uint256);
    function isPolicyClaimable(uint256 _policyId) external view returns (bool);
    
    // State variables
    function policyCounter() external view returns (uint256);
    function creAuthorized() external view returns (address);
    
    // Events
    event PolicyCreated(
        uint256 indexed policyId,
        address indexed holder,
        uint256 premium,
        uint256 coverageAmount,
        WeatherType weatherType,
        string location
    );
    
    event PolicyClaimed(
        uint256 indexed policyId,
        address indexed holder,
        uint256 payoutAmount,
        int256 triggerValue
    );
    
    event WeatherDataUpdated(
        string location,
        int256 value,
        uint256 timestamp
    );
}
