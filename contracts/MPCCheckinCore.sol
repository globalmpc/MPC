// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Ownable} from "@openzeppelin/contracts@5.7.0/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts@5.7.0/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts@5.7.0/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts@5.7.0/utils/ReentrancyGuard.sol";

/**
 * @title MPCCheckinCore
 * @notice Daily check-in contract designed for opBNB.
 *
 * Core behavior:
 * - One successful check-in per wallet per UTC day.
 * - Correct consecutive-day streak calculation.
 * - Records total users, total check-ins and daily statistics.
 * - Issues non-transferable internal credits.
 * - Emits a CheckedIn event for every successful check-in.
 *
 * Credits are internal accounting values only.
 * They are NOT ERC20 tokens.
 */
contract MPCCheckinCore is
    Ownable2Step,
    Pausable,
    ReentrancyGuard
{
    // =============================================================
    //                           STRUCTS
    // =============================================================

    struct UserInfo {
        uint256 lastCheckInDay;
        uint256 currentStreak;
        uint256 longestStreak;
        uint256 totalCheckIns;
        uint256 totalCredits;
        uint256 availableCredits;
    }

    struct DailyStat {
        uint256 checkIns;
        uint256 creditsIssued;
    }

    // =============================================================
    //                        USER STORAGE
    // =============================================================

    mapping(address => UserInfo) public users;

    // wallet => UTC day => checked in or not
    mapping(address => mapping(uint256 => bool)) public hasCheckedInOnDay;

    // UTC day => statistics
    mapping(uint256 => DailyStat) public dailyStats;

    // =============================================================
    //                       GLOBAL STATISTICS
    // =============================================================

    uint256 public totalUsers;
    uint256 public totalCheckIns;
    uint256 public totalCreditsIssued;

    // =============================================================
    //                        REWARD SETTINGS
    // =============================================================

    // Base credits for every check-in
    uint256 public baseReward = 10;

    // Extra credits for every additional consecutive day
    uint256 public streakRewardIncrement = 2;

    // Weekly milestone
    uint256 public weeklyBonusThreshold = 7;

    // Monthly milestone
    uint256 public monthlyBonusThreshold = 30;

    // Weekly bonus credits
    uint256 public weeklyBonus = 50;

    // Monthly bonus credits
    uint256 public monthlyBonus = 200;

    // =============================================================
    //                           EVENTS
    // =============================================================

    event CheckedIn(
        address indexed user,
        uint256 indexed dayIndex,
        uint256 streak,
        uint256 credits
    );

    event StreakBonusAwarded(
        address indexed user,
        uint256 indexed dayIndex,
        uint256 streak,
        uint256 bonus
    );

    event RewardSettingsUpdated(
        uint256 baseReward,
        uint256 streakRewardIncrement,
        uint256 weeklyBonusThreshold,
        uint256 monthlyBonusThreshold,
        uint256 weeklyBonus,
        uint256 monthlyBonus
    );

    event CreditsSpent(
        address indexed user,
        uint256 amount,
        uint256 remainingCredits
    );

    event NativeReceived(
        address indexed sender,
        uint256 amount
    );

    event NativeWithdrawn(
        address indexed recipient,
        uint256 amount
    );

    // =============================================================
    //                           ERRORS
    // =============================================================

    error AlreadyCheckedInToday();
    error InvalidRewardConfiguration();
    error InsufficientCredits();
    error ZeroAmount();
    error InvalidRecipient();
    error InsufficientNativeBalance();
    error NativeTransferFailed();

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================

    constructor() Ownable(msg.sender) {}

    // =============================================================
    //                          CHECK-IN
    // =============================================================

    /**
     * @notice Check in once per UTC day.
     *
     * BNB is NOT required.
     *
     * Every successful call:
     * - creates an opBNB transaction
     * - updates user state
     * - updates statistics
     * - emits CheckedIn
     */
    function checkIn()
        external
        payable
        whenNotPaused
        nonReentrant
        returns (
            uint256 streak,
            uint256 credits
        )
    {
        uint256 today = currentDay();

        if (hasCheckedInOnDay[msg.sender][today]) {
            revert AlreadyCheckedInToday();
        }

        UserInfo storage user = users[msg.sender];

        // First-time wallet
        if (user.totalCheckIns == 0) {
            totalUsers += 1;
        }

        // =========================================================
        // CORRECT STREAK CALCULATION
        // =========================================================

        uint256 newStreak;

        if (user.totalCheckIns == 0) {

            // First-ever check-in
            newStreak = 1;

        } else if (user.lastCheckInDay + 1 == today) {

            // Checked in yesterday:
            // 1 -> 2 -> 3 -> 4 ...
            newStreak = user.currentStreak + 1;

        } else {

            // Missed at least one day.
            // Restart streak.
            newStreak = 1;
        }

        // Calculate reward
        uint256 earnedCredits = calculateReward(newStreak);

        // Update user
        user.lastCheckInDay = today;
        user.currentStreak = newStreak;
        user.totalCheckIns += 1;

        if (newStreak > user.longestStreak) {
            user.longestStreak = newStreak;
        }

        user.totalCredits += earnedCredits;
        user.availableCredits += earnedCredits;

        // Mark today's check-in
        hasCheckedInOnDay[msg.sender][today] = true;

        // Global statistics
        totalCheckIns += 1;
        totalCreditsIssued += earnedCredits;

        // Daily statistics
        DailyStat storage stat = dailyStats[today];

        stat.checkIns += 1;
        stat.creditsIssued += earnedCredits;

        // Main check-in event
        emit CheckedIn(
            msg.sender,
            today,
            newStreak,
            earnedCredits
        );

        // Emit milestone bonus event if applicable
        uint256 milestoneBonus = calculateMilestoneBonus(newStreak);

        if (milestoneBonus > 0) {
            emit StreakBonusAwarded(
                msg.sender,
                today,
                newStreak,
                milestoneBonus
            );
        }

        // If someone intentionally sends BNB during checkIn,
        // record that as well.
        if (msg.value > 0) {
            emit NativeReceived(
                msg.sender,
                msg.value
            );
        }

        return (
            newStreak,
            earnedCredits
        );
    }

    // =============================================================
    //                       REWARD CALCULATION
    // =============================================================

    /**
     * @notice Calculate credits for a streak.
     *
     * Default examples:
     *
     * Streak 1:
     * 10
     *
     * Streak 2:
     * 12
     *
     * Streak 3:
     * 14
     *
     * Streak 7:
     * 22 + 50 weekly bonus = 72
     */
    function calculateReward(
        uint256 streak
    )
        public
        view
        returns (uint256)
    {
        if (streak == 0) {
            return 0;
        }

        uint256 reward =
            baseReward +
            ((streak - 1) * streakRewardIncrement);

        reward += calculateMilestoneBonus(streak);

        return reward;
    }

    /**
     * @notice Calculate milestone bonuses.
     */
    function calculateMilestoneBonus(
        uint256 streak
    )
        public
        view
        returns (uint256 bonus)
    {
        if (
            weeklyBonusThreshold > 0 &&
            streak % weeklyBonusThreshold == 0
        ) {
            bonus += weeklyBonus;
        }

        if (
            monthlyBonusThreshold > 0 &&
            streak % monthlyBonusThreshold == 0
        ) {
            bonus += monthlyBonus;
        }
    }

    // =============================================================
    //                          READ FUNCTIONS
    // =============================================================

    /**
     * @notice Current UTC day index.
     */
    function currentDay()
        public
        view
        returns (uint256)
    {
        return block.timestamp / 1 days;
    }

    /**
     * @notice Returns true if the wallet can check in today.
     */
    function canCheckIn(
        address account
    )
        public
        view
        returns (bool)
    {
        return !hasCheckedInOnDay[
            account
        ][currentDay()];
    }

    /**
     * @notice Preview what the next streak will be.
     */
    function previewNextStreak(
        address account
    )
        public
        view
        returns (uint256)
    {
        UserInfo storage user = users[account];

        uint256 today = currentDay();

        if (
            hasCheckedInOnDay[
                account
            ][today]
        ) {
            return user.currentStreak;
        }

        if (user.totalCheckIns == 0) {
            return 1;
        }

        if (
            user.lastCheckInDay + 1 ==
            today
        ) {
            return user.currentStreak + 1;
        }

        return 1;
    }

    /**
     * @notice Preview credits for the next check-in.
     */
    function previewNextReward(
        address account
    )
        external
        view
        returns (uint256)
    {
        if (!canCheckIn(account)) {
            return 0;
        }

        return calculateReward(
            previewNextStreak(account)
        );
    }

    /**
     * @notice Convenient function for frontend/API usage.
     */
    function getUserStatus(
        address account
    )
        external
        view
        returns (
            uint256 lastCheckInDay,
            uint256 currentStreak,
            uint256 longestStreak,
            uint256 userTotalCheckIns,
            uint256 totalCredits,
            uint256 availableCredits,
            bool canCheckInToday,
            uint256 nextStreak,
            uint256 nextReward
        )
    {
        UserInfo storage user = users[account];

        bool eligible = canCheckIn(account);

        uint256 calculatedNextStreak =
            eligible
                ? previewNextStreak(account)
                : user.currentStreak;

        uint256 calculatedNextReward =
            eligible
                ? calculateReward(
                    calculatedNextStreak
                )
                : 0;

        return (
            user.lastCheckInDay,
            user.currentStreak,
            user.longestStreak,
            user.totalCheckIns,
            user.totalCredits,
            user.availableCredits,
            eligible,
            calculatedNextStreak,
            calculatedNextReward
        );
    }

    // =============================================================
    //                       CREDIT MANAGEMENT
    // =============================================================

    /**
     * @notice Spend internal credits.
     *
     * Credits are NOT ERC20 tokens.
     */
    function spendCredits(
        uint256 amount
    )
        external
        whenNotPaused
        nonReentrant
    {
        if (amount == 0) {
            revert ZeroAmount();
        }

        UserInfo storage user = users[msg.sender];

        if (
            user.availableCredits <
            amount
        ) {
            revert InsufficientCredits();
        }

        user.availableCredits -= amount;

        emit CreditsSpent(
            msg.sender,
            amount,
            user.availableCredits
        );
    }

    // =============================================================
    //                       OWNER CONFIGURATION
    // =============================================================

    /**
     * @notice Update check-in reward settings.
     */
    function setRewardSettings(
        uint256 newBaseReward,
        uint256 newStreakRewardIncrement,
        uint256 newWeeklyBonusThreshold,
        uint256 newMonthlyBonusThreshold,
        uint256 newWeeklyBonus,
        uint256 newMonthlyBonus
    )
        external
        onlyOwner
    {
        if (
            newWeeklyBonusThreshold == 0 ||
            newMonthlyBonusThreshold == 0
        ) {
            revert InvalidRewardConfiguration();
        }

        baseReward =
            newBaseReward;

        streakRewardIncrement =
            newStreakRewardIncrement;

        weeklyBonusThreshold =
            newWeeklyBonusThreshold;

        monthlyBonusThreshold =
            newMonthlyBonusThreshold;

        weeklyBonus =
            newWeeklyBonus;

        monthlyBonus =
            newMonthlyBonus;

        emit RewardSettingsUpdated(
            newBaseReward,
            newStreakRewardIncrement,
            newWeeklyBonusThreshold,
            newMonthlyBonusThreshold,
            newWeeklyBonus,
            newMonthlyBonus
        );
    }

    // =============================================================
    //                       PAUSE MANAGEMENT
    // =============================================================

    /**
     * @notice Emergency pause.
     */
    function pause()
        external
        onlyOwner
    {
        _pause();
    }

    /**
     * @notice Resume normal operation.
     */
    function unpause()
        external
        onlyOwner
    {
        _unpause();
    }

    // =============================================================
    //                         BNB MANAGEMENT
    // =============================================================

    /**
     * @notice Withdraw BNB held by this contract.
     */
    function withdrawNative(
        address payable recipient,
        uint256 amount
    )
        external
        onlyOwner
        nonReentrant
    {
        if (recipient == address(0)) {
            revert InvalidRecipient();
        }

        if (amount == 0) {
            revert ZeroAmount();
        }

        if (amount > address(this).balance) {
            revert InsufficientNativeBalance();
        }

        (
            bool success,
        ) = recipient.call{
            value: amount
        }("");

        if (!success) {
            revert NativeTransferFailed();
        }

        emit NativeWithdrawn(
            recipient,
            amount
        );
    }

    /**
     * @notice Accept direct BNB transfers.
     */
    receive()
        external
        payable
    {
        emit NativeReceived(
            msg.sender,
            msg.value
        );
    }
}