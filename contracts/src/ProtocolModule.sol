// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {TradeTypes} from "./TradeTypes.sol";

/// @title ProtocolModule
/// @notice Base for the vault, escrow and repayment modules.
/// @dev Each module holds funds and is driven exclusively by TradeFinance. Making that the only
///      authorised caller is what keeps the state machine authoritative: there is no way to move
///      money that does not go through a validated state transition. The controller is set once,
///      after deployment (TradeFinance needs the module addresses at construction, so the
///      dependency has to be closed in one direction or the other).
abstract contract ProtocolModule is Ownable {
    /// @notice The settlement token for collateral, financing and repayment.
    IERC20 public immutable token;

    /// @notice The TradeFinance instance permitted to drive this module.
    address public controller;

    event ControllerSet(address indexed controller);

    error ControllerAlreadySet();
    error NotController(address caller);

    constructor(address initialOwner, address token_) Ownable(initialOwner) {
        if (token_ == address(0)) revert TradeTypes.ZeroAddress();
        token = IERC20(token_);
    }

    modifier onlyController() {
        if (msg.sender != controller) revert NotController(msg.sender);
        _;
    }

    /// @notice Bind this module to its TradeFinance controller. Callable once.
    function setController(address controller_) external onlyOwner {
        if (controller != address(0)) revert ControllerAlreadySet();
        if (controller_ == address(0)) revert TradeTypes.ZeroAddress();
        controller = controller_;
        emit ControllerSet(controller_);
    }
}
