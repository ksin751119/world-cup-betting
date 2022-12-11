//SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ERC20PresetMinterPauser} from "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract WCShareToken is Ownable, ERC20PresetMinterPauser {
    uint8 private immutable _decimals;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) ERC20PresetMinterPauser(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}

contract BetWorldCup is Ownable {
    using SafeERC20 for IERC20Metadata;

    struct TeamPlayer {
        string name;
        uint256 bettingOdds;
        WCShareToken shareToken;
    }

    event Bet(string player, address user, uint256 amount);
    event SubmitMatchResult(TeamPlayer player);
    event Claim(address user, uint256 amount, uint256 reward);

    uint256 constant base = 1e18;
    uint256 public immutable bettingEndTime;
    uint256 public immutable estimateMatchEndTime;
    bool public matchResultSubmitted;
    IERC20Metadata public bettingToken;
    TeamPlayer public redPlayer;
    TeamPlayer public bluePlayer;
    TeamPlayer public winner;

    constructor(
        string memory redPlayer_,
        string memory bluePlayer_,
        IERC20Metadata bettingToken_,
        uint256 bettingEndTime_
    ) {
        bettingToken = bettingToken_;
        bettingEndTime = bettingEndTime_;
        estimateMatchEndTime = bettingEndTime + 3 * 60 * 60; // 3 hours

        // Setup Team information
        redPlayer = TeamPlayer({
            name: redPlayer_,
            bettingOdds: 0,
            shareToken: new WCShareToken("RED_SHARE", "RST", bettingToken.decimals())
        });

        bluePlayer = TeamPlayer({
            name: bluePlayer_,
            bettingOdds: 0,
            shareToken: new WCShareToken("BLUE_SHARE", "BST", bettingToken.decimals())
        });
    }

    // View Function
    function redOdds() external view returns (uint256) {
        return _calOdds(redPlayer.shareToken, 1);
    }

    function blueOdds() external view returns (uint256) {
        return _calOdds(bluePlayer.shareToken, 1);
    }

    function blueBetting() external view returns (uint256) {
        return bluePlayer.shareToken.totalSupply();
    }

    function redBetting() external view returns (uint256) {
        return redPlayer.shareToken.totalSupply();
    }

    // External Function
    function betRed(uint256 betAmount_) external {
        _bet(redPlayer.shareToken, betAmount_);
        emit Bet("RED", msg.sender, betAmount_);
    }

    function betBlue(uint256 betAmount_) external {
        _bet(bluePlayer.shareToken, betAmount_);
        emit Bet("BLUE", msg.sender, betAmount_);
    }

    function submitMatchResult(bool isRedWinner_) external onlyOwner {
        require(!matchResultSubmitted, "Submitted");
        require(block.timestamp > estimateMatchEndTime, "Match may not over yet");

        // set winner
        if (isRedWinner_) {
            winner = redPlayer;
            bluePlayer.shareToken.pause();
        } else {
            winner = bluePlayer;
            redPlayer.shareToken.pause();
        }
        matchResultSubmitted = true;
        emit SubmitMatchResult(winner);
    }

    function claimReward(uint256 amount_) external returns (uint256) {
        require(matchResultSubmitted, "Not submit match result yet");
        WCShareToken shareToken = winner.shareToken;
        shareToken.transferFrom(msg.sender, address(this), amount_);

        // Calculate how many reward user could get
        uint256 reward = _calOdds(winner.shareToken, amount_) / base;

        // Send reward to claimer
        bettingToken.transfer(msg.sender, reward);
        shareToken.burn(amount_);

        emit Claim(msg.sender, amount_, reward);
        return reward;
    }

    // Internal Function
    function _bet(WCShareToken shareToken_, uint256 amount_) internal returns (uint256) {
        require(block.timestamp < bettingEndTime, "Exceeded betting time");
        bettingToken.transferFrom(msg.sender, address(this), amount_);
        shareToken_.mint(msg.sender, amount_);
        return amount_;
    }

    function _calOdds(WCShareToken shareToken_, uint256 amount_) internal view returns (uint256) {
        uint256 balance = bettingToken.balanceOf(address(this));
        uint256 totalShares = shareToken_.totalSupply();
        if (totalShares == 0) return type(uint256).max;
        return (balance * base * amount_) / (totalShares);
    }
}
