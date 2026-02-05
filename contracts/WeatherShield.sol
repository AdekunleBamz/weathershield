// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title WeatherShield - Parametric Weather Insurance
 * @notice Automated insurance payouts based on weather conditions
 * @dev Integrates with Chainlink CRE for weather data and automated triggers
 * 
 * ██╗    ██╗███████╗ █████╗ ████████╗██╗  ██╗███████╗██████╗ ███████╗██╗  ██╗██╗███████╗██╗     ██████╗ 
 * ██║    ██║██╔════╝██╔══██╗╚══██╔══╝██║  ██║██╔════╝██╔══██╗██╔════╝██║  ██║██║██╔════╝██║     ██╔══██╗
 * ██║ █╗ ██║█████╗  ███████║   ██║   ███████║█████╗  ██████╔╝███████╗███████║██║█████╗  ██║     ██║  ██║
 * ██║███╗██║██╔══╝  ██╔══██║   ██║   ██╔══██║██╔══╝  ██╔══██╗╚════██║██╔══██║██║██╔══╝  ██║     ██║  ██║
 * ╚███╔███╔╝███████╗██║  ██║   ██║   ██║  ██║███████╗██║  ██║███████║██║  ██║██║███████╗███████╗██████╔╝
 *  ╚══╝╚══╝ ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚═════╝ 
 */
contract WeatherShield is Ownable, ReentrancyGuard {
    
    // ============ Enums ============
    enum PolicyStatus { Active, Claimed, Expired, Cancelled }
    enum WeatherType { Drought, Flood, Frost, Heat }
    
    // ============ Structs ============
    struct Policy {
        address holder;
        uint256 premium;
        uint256 coverageAmount;
        uint256 startTime;
        uint256 endTime;
        WeatherType weatherType;
        int256 triggerThreshold;  // e.g., rainfall < 10mm or temp > 40C
        string location;          // lat,lon format
        PolicyStatus status;
    }
    
    struct WeatherData {
        int256 value;             // Weather measurement
        uint256 timestamp;
        bool isValid;
    }
    
    // ============ State Variables ============
    uint256 public policyCounter;
    uint256 public totalPremiumsCollected;
    uint256 public totalPayouts;
    uint256 public minPremium = 0.001 ether;
    uint256 public maxCoverageMultiplier = 10; // Max 10x premium as coverage
    uint256 public policyDuration = 30 days;
    
    // Authorized CRE workflow address
    address public creAuthorized;
    
    // Mappings
    mapping(uint256 => Policy) public policies;
    mapping(address => uint256[]) public userPolicies;
    mapping(string => WeatherData) public latestWeatherData; // location => data
    
    // ============ Events ============
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
    
    event PolicyExpired(uint256 indexed policyId);
    event PolicyCancelled(uint256 indexed policyId, uint256 refundAmount);
    
    event WeatherDataUpdated(
        string location,
        int256 value,
        uint256 timestamp
    );
    
    event CREAuthorizedUpdated(address indexed newAddress);
    
    // ============ Modifiers ============
    modifier onlyCRE() {
        require(
            msg.sender == creAuthorized || msg.sender == owner(),
            "Not authorized: CRE or owner only"
        );
        _;
    }
    
    modifier policyExists(uint256 _policyId) {
        require(_policyId < policyCounter, "Policy does not exist");
        _;
    }
    
    // ============ Constructor ============
    constructor() Ownable(msg.sender) {
        creAuthorized = msg.sender; // Initially owner is CRE authorized
    }
    
    // ============ Core Functions ============
    
    /**
     * @notice Purchase a new insurance policy
     * @param _weatherType Type of weather event to insure against
     * @param _triggerThreshold The threshold that triggers payout
     * @param _location Location in "latitude,longitude" format
     */
    function purchasePolicy(
        WeatherType _weatherType,
        int256 _triggerThreshold,
        string calldata _location
    ) external payable nonReentrant returns (uint256 policyId) {
        require(msg.value >= minPremium, "Premium below minimum");
        require(bytes(_location).length > 0, "Location required");
        
        uint256 coverageAmount = msg.value * maxCoverageMultiplier;
        
        policyId = policyCounter++;
        
        policies[policyId] = Policy({
            holder: msg.sender,
            premium: msg.value,
            coverageAmount: coverageAmount,
            startTime: block.timestamp,
            endTime: block.timestamp + policyDuration,
            weatherType: _weatherType,
            triggerThreshold: _triggerThreshold,
            location: _location,
            status: PolicyStatus.Active
        });
        
        userPolicies[msg.sender].push(policyId);
        totalPremiumsCollected += msg.value;
        
        emit PolicyCreated(
            policyId,
            msg.sender,
            msg.value,
            coverageAmount,
            _weatherType,
            _location
        );
    }
    
    /**
     * @notice Update weather data - called by CRE workflow
     * @param _location Location identifier
     * @param _value Weather measurement value
     */
    function updateWeatherData(
        string calldata _location,
        int256 _value
    ) external onlyCRE {
        latestWeatherData[_location] = WeatherData({
            value: _value,
            timestamp: block.timestamp,
            isValid: true
        });
        
        emit WeatherDataUpdated(_location, _value, block.timestamp);
    }
    
    /**
     * @notice Process claim - called by CRE workflow when trigger conditions are met
     * @param _policyId The policy to process
     * @param _currentValue Current weather value that triggered the claim
     */
    function processClaim(
        uint256 _policyId,
        int256 _currentValue
    ) external onlyCRE policyExists(_policyId) nonReentrant {
        Policy storage policy = policies[_policyId];
        
        require(policy.status == PolicyStatus.Active, "Policy not active");
        require(block.timestamp <= policy.endTime, "Policy expired");
        require(
            address(this).balance >= policy.coverageAmount,
            "Insufficient contract balance"
        );
        
        // Verify trigger condition based on weather type
        bool triggered = _checkTrigger(
            policy.weatherType,
            _currentValue,
            policy.triggerThreshold
        );
        require(triggered, "Trigger condition not met");
        
        policy.status = PolicyStatus.Claimed;
        totalPayouts += policy.coverageAmount;
        
        // Transfer payout to policyholder
        (bool success, ) = payable(policy.holder).call{value: policy.coverageAmount}("");
        require(success, "Payout transfer failed");
        
        emit PolicyClaimed(
            _policyId,
            policy.holder,
            policy.coverageAmount,
            _currentValue
        );
    }
    
    /**
     * @notice Check if trigger condition is met
     */
    function _checkTrigger(
        WeatherType _type,
        int256 _currentValue,
        int256 _threshold
    ) internal pure returns (bool) {
        if (_type == WeatherType.Drought) {
            // Drought: rainfall BELOW threshold (e.g., < 10mm)
            return _currentValue < _threshold;
        } else if (_type == WeatherType.Flood) {
            // Flood: rainfall ABOVE threshold (e.g., > 100mm)
            return _currentValue > _threshold;
        } else if (_type == WeatherType.Frost) {
            // Frost: temperature BELOW threshold (e.g., < 0°C)
            return _currentValue < _threshold;
        } else if (_type == WeatherType.Heat) {
            // Heat: temperature ABOVE threshold (e.g., > 40°C)
            return _currentValue > _threshold;
        }
        return false;
    }
    
    /**
     * @notice Expire a policy that has passed its end time
     */
    function expirePolicy(uint256 _policyId) external policyExists(_policyId) {
        Policy storage policy = policies[_policyId];
        require(policy.status == PolicyStatus.Active, "Policy not active");
        require(block.timestamp > policy.endTime, "Policy not yet expired");
        
        policy.status = PolicyStatus.Expired;
        emit PolicyExpired(_policyId);
    }
    
    /**
     * @notice Cancel policy and get partial refund (before 50% of duration)
     */
    function cancelPolicy(uint256 _policyId) external nonReentrant policyExists(_policyId) {
        Policy storage policy = policies[_policyId];
        require(msg.sender == policy.holder, "Not policy holder");
        require(policy.status == PolicyStatus.Active, "Policy not active");
        
        uint256 elapsed = block.timestamp - policy.startTime;
        uint256 duration = policy.endTime - policy.startTime;
        require(elapsed < duration / 2, "Cannot cancel after 50% duration");
        
        policy.status = PolicyStatus.Cancelled;
        
        // Refund 50% of premium
        uint256 refund = policy.premium / 2;
        (bool success, ) = payable(policy.holder).call{value: refund}("");
        require(success, "Refund transfer failed");
        
        emit PolicyCancelled(_policyId, refund);
    }
    
    // ============ View Functions ============
    
    function getPolicy(uint256 _policyId) external view returns (Policy memory) {
        return policies[_policyId];
    }
    
    function getUserPolicies(address _user) external view returns (uint256[] memory) {
        return userPolicies[_user];
    }
    
    function getWeatherData(string calldata _location) external view returns (WeatherData memory) {
        return latestWeatherData[_location];
    }
    
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    function isPolicyClaimable(uint256 _policyId) external view policyExists(_policyId) returns (bool) {
        Policy storage policy = policies[_policyId];
        if (policy.status != PolicyStatus.Active) return false;
        if (block.timestamp > policy.endTime) return false;
        
        WeatherData storage weather = latestWeatherData[policy.location];
        if (!weather.isValid) return false;
        
        return _checkTrigger(policy.weatherType, weather.value, policy.triggerThreshold);
    }
    
    // ============ Admin Functions ============
    
    function setCREAuthorized(address _creAuthorized) external onlyOwner {
        require(_creAuthorized != address(0), "Invalid address");
        creAuthorized = _creAuthorized;
        emit CREAuthorizedUpdated(_creAuthorized);
    }
    
    function setMinPremium(uint256 _minPremium) external onlyOwner {
        minPremium = _minPremium;
    }
    
    function setMaxCoverageMultiplier(uint256 _multiplier) external onlyOwner {
        require(_multiplier > 0 && _multiplier <= 20, "Invalid multiplier");
        maxCoverageMultiplier = _multiplier;
    }
    
    function setPolicyDuration(uint256 _duration) external onlyOwner {
        require(_duration >= 1 days, "Duration too short");
        policyDuration = _duration;
    }
    
    /**
     * @notice Deposit funds to cover potential payouts
     */
    function depositFunds() external payable onlyOwner {
        require(msg.value > 0, "Must deposit something");
    }
    
    /**
     * @notice Withdraw excess funds (only funds not needed for active policies)
     */
    function withdrawExcess(uint256 _amount) external onlyOwner nonReentrant {
        require(_amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = payable(owner()).call{value: _amount}("");
        require(success, "Withdrawal failed");
    }
    
    // ============ Receive Function ============
    receive() external payable {}
}
