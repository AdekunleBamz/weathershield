// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/*
    WeatherShield - Parametric Weather Insurance

    Built for Chainlink hackathon. Uses CRE to fetch weather data
    and automatically pay out claims when conditions trigger.
    
    The idea: farmers/businesses pay a premium, pick a weather threshold,
    and if conditions hit that threshold (drought, flood, etc), they get
    paid automatically. No paperwork, no claims adjusters.
*/

contract WeatherShield is Ownable, ReentrancyGuard {
    
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
        string location; // lat,lon
        PolicyStatus status;
    }
    
    struct WeatherData {
        int256 value;
        uint256 timestamp;
        bool isValid;
    }
    
    uint256 public policyCounter;
    uint256 public totalPremiumsCollected;
    uint256 public totalPayouts;
    uint256 public minPremium = 0.001 ether;
    uint256 public maxCoverageMultiplier = 10;
    uint256 public policyDuration = 30 days;
    
    address public creAuthorized; // CRE workflow address
    
    mapping(uint256 => Policy) public policies;
    mapping(address => uint256[]) public userPolicies;
    mapping(string => WeatherData) public latestWeatherData;
    
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
    event WeatherDataUpdated(string location, int256 value, uint256 timestamp);
    event CREAuthorizedUpdated(address indexed newAddress);
    
    modifier onlyCRE() {
        require(
            msg.sender == creAuthorized || msg.sender == owner(),
            "Not authorized"
        );
        _;
    }
    
    modifier policyExists(uint256 _policyId) {
        require(_policyId < policyCounter, "Policy doesn't exist");
        _;
    }
    
    constructor() Ownable(msg.sender) {
        creAuthorized = msg.sender;
    }
    
    // Buy insurance policy
    function purchasePolicy(
        WeatherType _weatherType,
        int256 _triggerThreshold,
        string calldata _location
    ) external payable nonReentrant returns (uint256 policyId) {
        require(msg.value >= minPremium, "Premium too low");
        require(bytes(_location).length > 0, "Need location");
        
        uint256 coverage = msg.value * maxCoverageMultiplier;
        policyId = policyCounter++;
        
        policies[policyId] = Policy({
            holder: msg.sender,
            premium: msg.value,
            coverageAmount: coverage,
            startTime: block.timestamp,
            endTime: block.timestamp + policyDuration,
            weatherType: _weatherType,
            triggerThreshold: _triggerThreshold,
            location: _location,
            status: PolicyStatus.Active
        });
        
        userPolicies[msg.sender].push(policyId);
        totalPremiumsCollected += msg.value;
        
        emit PolicyCreated(policyId, msg.sender, msg.value, coverage, _weatherType, _location);
    }
    
    // CRE calls this to update weather
    function updateWeatherData(string calldata _location, int256 _value) external onlyCRE {
        latestWeatherData[_location] = WeatherData({
            value: _value,
            timestamp: block.timestamp,
            isValid: true
        });
        emit WeatherDataUpdated(_location, _value, block.timestamp);
    }
    
    // CRE calls this when weather triggers a claim
    function processClaim(
        uint256 _policyId,
        int256 _currentValue
    ) external onlyCRE policyExists(_policyId) nonReentrant {
        Policy storage policy = policies[_policyId];
        
        require(policy.status == PolicyStatus.Active, "Not active");
        require(block.timestamp <= policy.endTime, "Expired");
        require(address(this).balance >= policy.coverageAmount, "Insufficient funds");
        
        bool triggered = checkTrigger(policy.weatherType, _currentValue, policy.triggerThreshold);
        require(triggered, "Conditions not met");
        
        policy.status = PolicyStatus.Claimed;
        totalPayouts += policy.coverageAmount;
        
        (bool ok, ) = payable(policy.holder).call{value: policy.coverageAmount}("");
        require(ok, "Transfer failed");
        
        emit PolicyClaimed(_policyId, policy.holder, policy.coverageAmount, _currentValue);
    }
    
    function checkTrigger(
        WeatherType _type,
        int256 _current,
        int256 _threshold
    ) internal pure returns (bool) {
        // drought/frost = value below threshold
        // flood/heat = value above threshold
        if (_type == WeatherType.Drought || _type == WeatherType.Frost) {
            return _current < _threshold;
        } else {
            return _current > _threshold;
        }
    }
    
    function expirePolicy(uint256 _policyId) external policyExists(_policyId) {
        Policy storage policy = policies[_policyId];
        require(policy.status == PolicyStatus.Active, "Not active");
        require(block.timestamp > policy.endTime, "Not expired yet");
        
        policy.status = PolicyStatus.Expired;
        emit PolicyExpired(_policyId);
    }
    
    // can cancel within first half of policy period, get 50% back
    function cancelPolicy(uint256 _policyId) external nonReentrant policyExists(_policyId) {
        Policy storage policy = policies[_policyId];
        require(msg.sender == policy.holder, "Not your policy");
        require(policy.status == PolicyStatus.Active, "Not active");
        
        uint256 elapsed = block.timestamp - policy.startTime;
        uint256 duration = policy.endTime - policy.startTime;
        require(elapsed < duration / 2, "Too late to cancel");
        
        policy.status = PolicyStatus.Cancelled;
        
        uint256 refund = policy.premium / 2;
        (bool ok, ) = payable(policy.holder).call{value: refund}("");
        require(ok, "Refund failed");
        
        emit PolicyCancelled(_policyId, refund);
    }
    
    // view funcs
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
        
        return checkTrigger(policy.weatherType, weather.value, policy.triggerThreshold);
    }
    
    // admin stuff
    function setCREAuthorized(address _addr) external onlyOwner {
        require(_addr != address(0), "Bad address");
        creAuthorized = _addr;
        emit CREAuthorizedUpdated(_addr);
    }
    
    function setMinPremium(uint256 _min) external onlyOwner {
        minPremium = _min;
    }
    
    function setMaxCoverageMultiplier(uint256 _mult) external onlyOwner {
        require(_mult > 0 && _mult <= 20, "Invalid");
        maxCoverageMultiplier = _mult;
    }
    
    function setPolicyDuration(uint256 _dur) external onlyOwner {
        require(_dur >= 1 days, "Too short");
        policyDuration = _dur;
    }
    
    function depositFunds() external payable onlyOwner {
        require(msg.value > 0, "Send something");
    }
    
    function withdrawExcess(uint256 _amt) external onlyOwner nonReentrant {
        require(_amt <= address(this).balance, "Not enough");
        (bool ok, ) = payable(owner()).call{value: _amt}("");
        require(ok, "Withdraw failed");
    }
    
    receive() external payable {}
}
