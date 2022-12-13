//SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

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

    function transferFromByAdmin(address from_, uint256 amount_) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Must have admin role to transfer token");
        transferFrom(from_, _msgSender(), amount_);
    }
}
