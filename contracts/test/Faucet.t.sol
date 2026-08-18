// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {TestnetFaucet} from "../src/TestnetFaucet.sol";
import {SettlementToken} from "../src/SettlementToken.sol";

/// @notice The faucet's cooldown is enforced on-chain, so the UI cannot be tricked into showing a
///         request as available when the contract would reject it.
contract FaucetTest is Test {
    uint256 internal constant USD = 1e6;

    address internal owner = makeAddr("owner");
    address internal user = makeAddr("user");

    SettlementToken internal token;
    TestnetFaucet internal faucet;

    function setUp() public {
        vm.startPrank(owner);
        token = new SettlementToken("TImx Settlement USD", "tUSD", owner);
        faucet = new TestnetFaucet(owner, address(token), 25_000 * USD, 12 hours);
        token.mint(owner, 1_000_000 * USD);
        token.approve(address(faucet), type(uint256).max);
        faucet.fund(500_000 * USD);
        vm.stopPrank();
    }

    function test_firstRequestSucceeds() public {
        assertEq(faucet.availableAt(user), 0);
        vm.prank(user);
        faucet.request();
        assertEq(token.balanceOf(user), 25_000 * USD);
    }

    function test_secondRequestBlockedByCooldown() public {
        vm.startPrank(user);
        faucet.request();
        uint64 next = faucet.availableAt(user);
        assertGt(next, block.timestamp);
        vm.expectRevert(abi.encodeWithSelector(TestnetFaucet.CooldownActive.selector, next));
        faucet.request();
        vm.stopPrank();
    }

    function test_requestSucceedsAfterCooldown() public {
        vm.prank(user);
        faucet.request();
        vm.warp(block.timestamp + 12 hours + 1);
        assertEq(faucet.availableAt(user), 0);
        vm.prank(user);
        faucet.request();
        assertEq(token.balanceOf(user), 50_000 * USD);
    }

    function test_emptyFaucetRevertsRatherThanSilentlySucceeding() public {
        uint256 remaining = token.balanceOf(address(faucet));
        vm.prank(owner);
        faucet.sweep(owner, remaining);
        vm.prank(user);
        vm.expectRevert();
        faucet.request();
    }
}
