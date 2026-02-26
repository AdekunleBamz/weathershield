// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/*
    WeatherShield - Parametric Weather Insurance Protocol

    Built for Chainlink Block Magic Hackathon 2026. Uses CRE to fetch
    multi-source weather data, aggregate via median, and automatically
    pay out claims when conditions trigger. Integrates Chainlink ETH/USD
    price feed for USD-denominated premiums.

    Key Features:
    - Multi-source weather data aggregation (3 APIs → median)
    - Chainlink ETH/USD price feed for USD pricing
    - Risk-based dynamic premium pricing
    - ERC-721 policy NFTs (soulbound while active)
    - Liquidity pool for coverage capital
    - Lightweight LP-weighted governance
*/

/// @notice Chainlink V3 Aggregator interface for price feeds
interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function decimals() external view returns (uint8);
}

contract WeatherShield is Ownable, ReentrancyGuard, ERC721 {
    using Strings for uint256;

    // ─── Enums ─────────────────────────────────────────────────────────
    enum PolicyStatus { Active, Claimed, Expired, Cancelled }
    enum WeatherType { Drought, Flood, Frost, Heat }
    enum RiskTier { Low, Medium, High, Critical }
    enum ProposalStatus { Pending, Approved, Rejected, Executed }

    // ─── CRE Service Quotas (reference) ────────────────────────────────
    uint256 private constant CRE_EXECUTION_TIMEOUT_SECONDS = 300;
    uint256 private constant CRE_EVM_GAS_LIMIT = 5_000_000;
    uint256 private constant CRE_HTTP_RESPONSE_LIMIT_KB = 100;
    uint256 private constant CRE_MAX_CONCURRENT_CAPABILITIES = 3;
    uint256 public constant MAX_GAS_PER_TRANSACTION = 500_000;

    // ─── Structs ───────────────────────────────────────────────────────
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
        uint8 sourceCount; // number of sources used in aggregation
    }

    struct LPPosition {
        uint256 deposited;
        uint256 shares;
    }

    struct Proposal {
        string paramName;
        uint256 newValue;
        address proposer;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline;
        ProposalStatus status;
    }

    // ─── State Variables ───────────────────────────────────────────────
    uint256 public policyCounter;
    uint256 public totalPremiumsCollected;
    uint256 public totalPayouts;
    uint256 public minPremium = 0.001 ether;
    uint256 public policyDuration = 30 days;
    uint256 public protocolFeePercent = 20; // 20% of premiums to protocol

    address public creAuthorized;
    AggregatorV3Interface public priceFeed;

    // Risk tier multipliers (coverage = premium × multiplier)
    uint256[4] public riskMultipliers = [12, 10, 8, 6]; // Low, Medium, High, Critical

    // Liquidity pool
    uint256 public totalLiquidity;
    uint256 public totalShares;
    uint256 public reservedFunds; // funds locked for active policies
    uint256 public protocolFees;

    // Governance
    uint256 public proposalCounter;
    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public constant QUORUM_PERCENT = 25; // 25% of total shares

    // ─── Mappings ──────────────────────────────────────────────────────
    mapping(uint256 => Policy) public policies;
    mapping(address => uint256[]) public userPolicies;
    mapping(string => WeatherData) public latestWeatherData;
    mapping(address => LPPosition) public lpPositions;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // ─── Events ────────────────────────────────────────────────────────
    event PolicyCreated(
        uint256 indexed policyId,
        address indexed holder,
        uint256 premium,
        uint256 coverageAmount,
        WeatherType weatherType,
        string location,
        RiskTier riskTier
    );
    event PolicyClaimed(uint256 indexed policyId, address indexed holder, uint256 payoutAmount, int256 triggerValue);
    event PolicyExpired(uint256 indexed policyId);
    event PolicyCancelled(uint256 indexed policyId, uint256 refundAmount);
    event WeatherDataUpdated(string location, int256 value, uint256 timestamp, uint8 sourceCount);
    event CREAuthorizedUpdated(address indexed newAddress);

    // Liquidity pool events
    event LiquidityDeposited(address indexed provider, uint256 amount, uint256 shares);
    event LiquidityWithdrawn(address indexed provider, uint256 amount, uint256 shares);
    event PremiumDistributed(uint256 toLPs, uint256 toProtocol);

    // Governance events
    event ProposalCreated(uint256 indexed proposalId, string paramName, uint256 newValue, address proposer);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);

    // ─── Modifiers ─────────────────────────────────────────────────────
    modifier onlyCRE() {
        require(msg.sender == creAuthorized || msg.sender == owner(), "Not authorized");
        _;
    }

    modifier policyExists(uint256 _policyId) {
        require(_policyId < policyCounter, "Policy doesn't exist");
        _;
    }

    modifier onlyLP() {
        require(lpPositions[msg.sender].shares > 0, "Not a liquidity provider");
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────
    /// @param _priceFeed Chainlink ETH/USD price feed address
    constructor(address _priceFeed) Ownable(msg.sender) ERC721("WeatherShield Policy", "WSP") {
        creAuthorized = msg.sender;
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CHAINLINK PRICE FEED
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Get latest ETH/USD price from Chainlink
    /// @return price ETH price in USD with 8 decimals
    function getEthUsdPrice() public view returns (int256 price) {
        (, price,,,) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price");
    }

    /// @notice Convert ETH amount to USD equivalent
    /// @param ethAmount Amount of ETH in wei
    /// @return usdAmount USD value with 8 decimals
    function ethToUsd(uint256 ethAmount) public view returns (uint256) {
        int256 price = getEthUsdPrice();
        return (ethAmount * uint256(price)) / 1e18;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  RISK-BASED PRICING
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Determine risk tier based on weather type and threshold
    function getRiskTier(WeatherType _type, int256 _threshold) public pure returns (RiskTier) {
        if (_type == WeatherType.Drought) {
            // Lower threshold = less likely to trigger = lower risk
            if (_threshold <= 20) return RiskTier.Low;
            if (_threshold <= 50) return RiskTier.Medium;
            if (_threshold <= 100) return RiskTier.High;
            return RiskTier.Critical;
        } else if (_type == WeatherType.Flood) {
            // Higher threshold = less likely to trigger = lower risk
            if (_threshold >= 200) return RiskTier.Low;
            if (_threshold >= 100) return RiskTier.Medium;
            if (_threshold >= 50) return RiskTier.High;
            return RiskTier.Critical;
        } else if (_type == WeatherType.Frost) {
            if (_threshold <= -100) return RiskTier.Low;     // Below -10°C
            if (_threshold <= -20) return RiskTier.Medium;    // Below -2°C
            if (_threshold <= 20) return RiskTier.High;       // Below 2°C
            return RiskTier.Critical;
        } else {
            // Heat
            if (_threshold >= 450) return RiskTier.Low;       // Above 45°C
            if (_threshold >= 400) return RiskTier.Medium;    // Above 40°C
            if (_threshold >= 350) return RiskTier.High;      // Above 35°C
            return RiskTier.Critical;
        }
    }

    /// @notice Calculate coverage based on premium and risk tier
    function calculateCoverage(uint256 _premium, WeatherType _type, int256 _threshold) public view returns (uint256) {
        RiskTier tier = getRiskTier(_type, _threshold);
        return _premium * riskMultipliers[uint8(tier)];
    }

    // ═══════════════════════════════════════════════════════════════════
    //  POLICY MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Purchase a weather insurance policy (mints ERC-721 NFT)
    function purchasePolicy(
        WeatherType _weatherType,
        int256 _triggerThreshold,
        string calldata _location
    ) external payable nonReentrant returns (uint256 policyId) {
        require(msg.value >= minPremium, "Premium too low");
        require(bytes(_location).length > 0, "Need location");

        RiskTier tier = getRiskTier(_weatherType, _triggerThreshold);
        uint256 coverage = msg.value * riskMultipliers[uint8(tier)];

        // Check pool has enough available liquidity
        uint256 availableLiquidity = totalLiquidity > reservedFunds
            ? totalLiquidity - reservedFunds
            : 0;
        uint256 totalAvailable = availableLiquidity + address(this).balance - totalLiquidity;
        require(totalAvailable >= coverage || address(this).balance >= coverage, "Insufficient pool liquidity");

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
            status: PolicyStatus.Active,
            riskTier: tier
        });

        userPolicies[msg.sender].push(policyId);
        totalPremiumsCollected += msg.value;
        reservedFunds += coverage;

        // Distribute premium: 80% to LP pool, 20% protocol fee
        uint256 fee = (msg.value * protocolFeePercent) / 100;
        uint256 toLPs = msg.value - fee;
        if (totalShares > 0) {
            totalLiquidity += toLPs;
        }
        protocolFees += fee;

        // Mint policy NFT
        _mint(msg.sender, policyId);

        emit PolicyCreated(policyId, msg.sender, msg.value, coverage, _weatherType, _location, tier);
        if (totalShares > 0) {
            emit PremiumDistributed(toLPs, fee);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  WEATHER DATA (CRE WORKFLOW)
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Update weather data from single source (backwards compatible)
    function updateWeatherData(string calldata _location, int256 _value) external onlyCRE {
        latestWeatherData[_location] = WeatherData({
            value: _value,
            timestamp: block.timestamp,
            isValid: true,
            sourceCount: 1
        });
        emit WeatherDataUpdated(_location, _value, block.timestamp, 1);
    }

    /// @notice Update weather data from 3 sources (median aggregation)
    function updateWeatherDataMultiSource(
        string calldata _location,
        int256 _val1,
        int256 _val2,
        int256 _val3
    ) external onlyCRE {
        int256 median = _calculateMedian(_val1, _val2, _val3);

        latestWeatherData[_location] = WeatherData({
            value: median,
            timestamp: block.timestamp,
            isValid: true,
            sourceCount: 3
        });
        emit WeatherDataUpdated(_location, median, block.timestamp, 3);
    }

    /// @notice Calculate median of three values on-chain
    function _calculateMedian(int256 a, int256 b, int256 c) internal pure returns (int256) {
        if ((a >= b && a <= c) || (a <= b && a >= c)) return a;
        if ((b >= a && b <= c) || (b <= a && b >= c)) return b;
        return c;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CLAIMS
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Process insurance claim when trigger conditions are met
    function processClaim(
        uint256 _policyId,
        int256 _currentValue
    ) external onlyCRE policyExists(_policyId) nonReentrant {
        Policy storage policy = policies[_policyId];

        require(policy.status == PolicyStatus.Active, "Not active");
        require(block.timestamp <= policy.endTime, "Expired");
        require(address(this).balance >= policy.coverageAmount, "Insufficient funds");

        bool triggered = _checkTrigger(policy.weatherType, _currentValue, policy.triggerThreshold);
        require(triggered, "Conditions not met");

        policy.status = PolicyStatus.Claimed;
        totalPayouts += policy.coverageAmount;
        reservedFunds -= policy.coverageAmount;
        if (totalLiquidity >= policy.coverageAmount) {
            totalLiquidity -= policy.coverageAmount;
        }

        (bool ok, ) = payable(policy.holder).call{value: policy.coverageAmount}("");
        require(ok, "Transfer failed");

        emit PolicyClaimed(_policyId, policy.holder, policy.coverageAmount, _currentValue);
    }

    function _checkTrigger(WeatherType _type, int256 _current, int256 _threshold) internal pure returns (bool) {
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
        reservedFunds -= policy.coverageAmount;
        emit PolicyExpired(_policyId);
    }

    /// @notice Cancel within first half of policy period for 50% refund
    function cancelPolicy(uint256 _policyId) external nonReentrant policyExists(_policyId) {
        Policy storage policy = policies[_policyId];
        require(msg.sender == policy.holder, "Not your policy");
        require(policy.status == PolicyStatus.Active, "Not active");

        uint256 elapsed = block.timestamp - policy.startTime;
        uint256 duration = policy.endTime - policy.startTime;
        require(elapsed < duration / 2, "Too late to cancel");

        policy.status = PolicyStatus.Cancelled;
        reservedFunds -= policy.coverageAmount;

        uint256 refund = policy.premium / 2;
        (bool ok, ) = payable(policy.holder).call{value: refund}("");
        require(ok, "Refund failed");

        emit PolicyCancelled(_policyId, refund);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  LIQUIDITY POOL
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Deposit ETH to provide coverage liquidity
    function depositLiquidity() external payable nonReentrant {
        require(msg.value > 0, "Send something");

        uint256 shares;
        if (totalShares == 0) {
            shares = msg.value;
        } else {
            shares = (msg.value * totalShares) / totalLiquidity;
        }

        lpPositions[msg.sender].deposited += msg.value;
        lpPositions[msg.sender].shares += shares;
        totalLiquidity += msg.value;
        totalShares += shares;

        emit LiquidityDeposited(msg.sender, msg.value, shares);
    }

    /// @notice Withdraw liquidity (only unreserved portion)
    function withdrawLiquidity(uint256 _shares) external nonReentrant onlyLP {
        LPPosition storage pos = lpPositions[msg.sender];
        require(_shares <= pos.shares, "Exceeds your shares");

        uint256 amount = (_shares * totalLiquidity) / totalShares;
        uint256 available = totalLiquidity - reservedFunds;
        require(amount <= available, "Funds reserved for active policies");

        pos.shares -= _shares;
        pos.deposited = pos.deposited > amount ? pos.deposited - amount : 0;
        totalLiquidity -= amount;
        totalShares -= _shares;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Withdraw failed");

        emit LiquidityWithdrawn(msg.sender, amount, _shares);
    }

    /// @notice Get LP's current value (deposited + earned yield)
    function getLPValue(address _lp) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return (lpPositions[_lp].shares * totalLiquidity) / totalShares;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  GOVERNANCE
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Propose a parameter change (LP holders only)
    function proposeParameterChange(string calldata _param, uint256 _value) external onlyLP returns (uint256) {
        uint256 proposalId = proposalCounter++;

        proposals[proposalId] = Proposal({
            paramName: _param,
            newValue: _value,
            proposer: msg.sender,
            votesFor: 0,
            votesAgainst: 0,
            deadline: block.timestamp + VOTING_PERIOD,
            status: ProposalStatus.Pending
        });

        emit ProposalCreated(proposalId, _param, _value, msg.sender);
        return proposalId;
    }

    /// @notice Vote on a proposal (LP-weighted)
    function voteOnProposal(uint256 _proposalId, bool _support) external onlyLP {
        Proposal storage prop = proposals[_proposalId];
        require(prop.status == ProposalStatus.Pending, "Not active");
        require(block.timestamp < prop.deadline, "Voting ended");
        require(!hasVoted[_proposalId][msg.sender], "Already voted");

        hasVoted[_proposalId][msg.sender] = true;
        uint256 weight = lpPositions[msg.sender].shares;

        if (_support) {
            prop.votesFor += weight;
        } else {
            prop.votesAgainst += weight;
        }

        emit VoteCast(_proposalId, msg.sender, _support, weight);
    }

    /// @notice Execute a passed proposal
    function executeProposal(uint256 _proposalId) external {
        Proposal storage prop = proposals[_proposalId];
        require(prop.status == ProposalStatus.Pending, "Not pending");
        require(block.timestamp >= prop.deadline, "Voting not ended");

        uint256 quorum = (totalShares * QUORUM_PERCENT) / 100;
        uint256 totalVotes = prop.votesFor + prop.votesAgainst;

        if (totalVotes >= quorum && prop.votesFor > prop.votesAgainst) {
            prop.status = ProposalStatus.Approved;
            _applyProposal(prop.paramName, prop.newValue);
            prop.status = ProposalStatus.Executed;
            emit ProposalExecuted(_proposalId);
        } else {
            prop.status = ProposalStatus.Rejected;
        }
    }

    function _applyProposal(string memory _param, uint256 _value) internal {
        bytes32 paramHash = keccak256(abi.encodePacked(_param));

        if (paramHash == keccak256("minPremium")) {
            minPremium = _value;
        } else if (paramHash == keccak256("policyDuration")) {
            require(_value >= 1 days, "Too short");
            policyDuration = _value;
        } else if (paramHash == keccak256("protocolFeePercent")) {
            require(_value <= 50, "Fee too high");
            protocolFeePercent = _value;
        }
        // Unknown params are silently ignored (safe)
    }

    // ═══════════════════════════════════════════════════════════════════
    //  NFT (ERC-721) OVERRIDS
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Policies are soulbound (non-transferable) while Active
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // Allow minting (from == address(0)) and burning
        if (from != address(0) && to != address(0)) {
            require(policies[tokenId].status != PolicyStatus.Active, "Active policies are soulbound");
        }
        return super._update(to, tokenId, auth);
    }

    function _getTypeName(WeatherType t) internal pure returns (string memory) {
        if (t == WeatherType.Drought) return "Drought";
        if (t == WeatherType.Flood) return "Flood";
        if (t == WeatherType.Frost) return "Frost";
        return "Heat";
    }

    function _getStatusName(PolicyStatus s) internal pure returns (string memory) {
        if (s == PolicyStatus.Active) return "Active";
        if (s == PolicyStatus.Claimed) return "Claimed";
        if (s == PolicyStatus.Expired) return "Expired";
        return "Cancelled";
    }

    function _getTypeColor(WeatherType t) internal pure returns (string memory) {
        if (t == WeatherType.Drought) return "#f59e0b";
        if (t == WeatherType.Flood) return "#3b82f6";
        if (t == WeatherType.Frost) return "#8b5cf6";
        return "#ef4444";
    }

    function _svgTop(string memory color, string memory typeName) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="350" height="350" style="background:#0f172a">',
            '<rect width="350" height="350" rx="20" fill="#0f172a"/>',
            '<rect x="10" y="10" width="330" height="330" rx="16" fill="none" stroke="', color, '" stroke-width="2" opacity="0.5"/>',
            '<text x="175" y="50" text-anchor="middle" fill="white" font-size="20" font-weight="bold" font-family="sans-serif">WeatherShield</text>',
            '<text x="175" y="80" text-anchor="middle" fill="', color, '" font-size="14" font-family="sans-serif">', typeName, ' Protection</text>'
        ));
    }

    function _svgBottom(uint256 tokenId, string memory location, string memory color, string memory statusName) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '<text x="175" y="140" text-anchor="middle" fill="#94a3b8" font-size="12" font-family="sans-serif">Policy #', tokenId.toString(), '</text>',
            '<text x="175" y="170" text-anchor="middle" fill="white" font-size="11" font-family="sans-serif">Location: ', location, '</text>',
            '<text x="175" y="250" text-anchor="middle" fill="', color, '" font-size="16" font-weight="bold" font-family="sans-serif">', statusName, '</text>',
            '</svg>'
        ));
    }

    /// @notice On-chain SVG metadata for policy NFTs
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Policy memory p = policies[tokenId];

        string memory color = _getTypeColor(p.weatherType);
        string memory typeName = _getTypeName(p.weatherType);
        string memory statusName = _getStatusName(p.status);
        string memory svg = string(abi.encodePacked(_svgTop(color, typeName), _svgBottom(tokenId, p.location, color, statusName)));

        string memory json = string(abi.encodePacked(
            '{"name":"WeatherShield Policy #', tokenId.toString(),
            '","description":"Parametric weather insurance policy","image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)),
            '","attributes":[{"trait_type":"Weather Type","value":"', typeName,
            '"},{"trait_type":"Status","value":"', statusName,
            '"},{"trait_type":"Location","value":"', p.location, '"}]}'
        ));

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    // ═══════════════════════════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

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

    /// @notice Check if a policy's trigger conditions are currently met
    function isPolicyClaimable(uint256 _policyId) external view policyExists(_policyId) returns (bool) {
        Policy storage policy = policies[_policyId];
        if (policy.status != PolicyStatus.Active) return false;
        if (block.timestamp > policy.endTime) return false;

        WeatherData storage weather = latestWeatherData[policy.location];
        if (!weather.isValid) return false;

        return _checkTrigger(policy.weatherType, weather.value, policy.triggerThreshold);
    }

    function getProposal(uint256 _proposalId) external view returns (Proposal memory) {
        return proposals[_proposalId];
    }

    /// @notice Get pool stats for frontend
    function getPoolStats() external view returns (
        uint256 _totalLiquidity,
        uint256 _totalShares,
        uint256 _reservedFunds,
        uint256 _availableLiquidity,
        uint256 _protocolFees
    ) {
        uint256 available = totalLiquidity > reservedFunds ? totalLiquidity - reservedFunds : 0;
        return (totalLiquidity, totalShares, reservedFunds, available, protocolFees);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  ADMIN
    // ═══════════════════════════════════════════════════════════════════

    function setCREAuthorized(address _addr) external onlyOwner {
        require(_addr != address(0), "Bad address");
        creAuthorized = _addr;
        emit CREAuthorizedUpdated(_addr);
    }

    function setMinPremium(uint256 _min) external onlyOwner {
        minPremium = _min;
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

    function withdrawProtocolFees() external onlyOwner nonReentrant {
        uint256 fees = protocolFees;
        require(fees > 0, "No fees");
        protocolFees = 0;
        (bool ok, ) = payable(owner()).call{value: fees}("");
        require(ok, "Withdraw failed");
    }

    receive() external payable {}
}
