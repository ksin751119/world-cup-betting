//SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ERC20PresetMinterPauser} from "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import {BetWorldCup} from "./BetWorldCup.sol";
import {WCShareToken} from "./WCShareToken.sol";

contract BetWorldCupFactory {
    event NewBetWorldCup(address newBwc, uint256 bwcIndex);

    using SafeERC20 for IERC20Metadata;
    uint256 public count;
    mapping(uint256 => BetWorldCup) public BWCs;

    // Constructor
    function createBWC(
        string memory redPlayer_,
        string memory bluePlayer_,
        IERC20Metadata bettingToken_,
        uint256 bettingEndTime_
    ) external returns (address) {
        // Generate new bet contract
        BetWorldCup bwc = new BetWorldCup(redPlayer_, bluePlayer_, bettingToken_, bettingEndTime_);

        // Initial bet contract
        uint256 totalInitializeBet = bwc.initializeBet() * 2;
        bettingToken_.safeTransferFrom(msg.sender, address(this), totalInitializeBet);
        bettingToken_.approve(address(bwc), totalInitializeBet);
        bwc.initialize();

        // Transfer ownership and share token to msg.sender
        bwc.transferOwnership(msg.sender);
        (, , WCShareToken redShareToken) = bwc.redPlayer();
        (, , WCShareToken blueShareToken) = bwc.bluePlayer();
        redShareToken.transfer(msg.sender, redShareToken.balanceOf(address(this)));
        blueShareToken.transfer(msg.sender, blueShareToken.balanceOf(address(this)));

        // Update factory information
        emit NewBetWorldCup(address(bwc), count);
        BWCs[count] = bwc;
        count++;
        return address(bwc);
    }
}
