# MPCCheckinCore Specification

This document specifies the behavior of `MPCCheckinCore`, the community check-in contract deployed on opBNB Mainnet. It describes what the contract does, not how the surrounding application is built; see [TECHNICAL.md](TECHNICAL.md) for the system view.

| Item | Value |
| --- | --- |
| Source | [`contracts/MPCCheckinCore.sol`](../contracts/MPCCheckinCore.sol) |
| Network | opBNB Mainnet (Chain ID 204) |
| Address | [`0x843e4ff9242c3e81b676434b2876fb090d4a5783`](https://opbnbscan.com/address/0x843e4ff9242c3e81b676434b2876fb090d4a5783?view=contract_code) |
| Compiler | Solidity `0.8.36+commit.8a079791` |
| Dependencies | OpenZeppelin Contracts 5.7.0: `Ownable2Step`, `Pausable`, `ReentrancyGuard` |
| Upgradeability | None. The contract is not a proxy; any change requires a new deployment. |

## 1. Purpose

The contract records one check-in per wallet per UTC day, tracks consecutive-day streaks, and awards **credits** as an internal participation score. It also keeps community-wide and per-day statistics that the application displays.

Credits are **internal accounting values only**. They are not ERC-20 tokens, cannot be transferred between wallets, and have no redemption path inside the contract.

## 2. Definitions

| Term | Definition |
| --- | --- |
| Day index | `block.timestamp / 1 days`. Days start at 00:00 UTC. |
| Check-in | A successful call to `checkIn()` by a wallet. |
| Streak | Number of consecutive day indexes on which the wallet checked in, ending with its most recent check-in. |
| Credits | Internal points added on each check-in. `totalCredits` only increases; `availableCredits` is reduced by `spendCredits`. |
| Owner | The account returned by `owner()`. At the time of writing, it is a Safe multisig (see [TECHNICAL.md](TECHNICAL.md#4-access-control)). |

## 3. State

### Per wallet: `users(address)`

| Field | Meaning |
| --- | --- |
| `lastCheckInDay` | Day index of the latest check-in. `0` if the wallet has never checked in. |
| `currentStreak` | Streak as of the latest check-in. |
| `longestStreak` | Highest streak the wallet has reached. |
| `totalCheckIns` | Number of check-ins by the wallet. |
| `totalCredits` | Credits earned over the wallet's lifetime. |
| `availableCredits` | Credits earned minus credits spent. |

`hasCheckedInOnDay(address, dayIndex)` records whether a wallet checked in on a given day.

### Global

| Variable | Meaning |
| --- | --- |
| `totalUsers` | Number of distinct wallets with at least one check-in. |
| `totalCheckIns` | Number of check-ins across all wallets. |
| `totalCreditsIssued` | Credits issued across all wallets. |
| `dailyStats(dayIndex)` | `checkIns` and `creditsIssued` for that day. |

### Reward settings (owner-configurable)

| Variable | Initial value | Meaning |
| --- | --- | --- |
| `baseReward` | 10 | Credits for a check-in with streak 1. |
| `streakRewardIncrement` | 2 | Extra credits per additional consecutive day. |
| `weeklyBonusThreshold` | 7 | Streak multiple that triggers the weekly bonus. |
| `monthlyBonusThreshold` | 30 | Streak multiple that triggers the monthly bonus. |
| `weeklyBonus` | 50 | Weekly bonus credits. |
| `monthlyBonus` | 200 | Monthly bonus credits. |

The values above are the constructor defaults. The live values can differ if the owner has called `setRewardSettings`; read them from the contract.

## 4. Reward formula

For a check-in that results in streak `s` (where `s ≥ 1`):

```
milestoneBonus(s) = (s % weeklyBonusThreshold  == 0 ? weeklyBonus  : 0)
                  + (s % monthlyBonusThreshold == 0 ? monthlyBonus : 0)

reward(s) = baseReward + (s - 1) * streakRewardIncrement + milestoneBonus(s)
```

`reward(0)` is defined as `0`. Both bonuses apply when `s` is a multiple of both thresholds.

With the initial settings:

| Streak | Base + increment | Milestone bonus | Credits |
| --- | --- | --- | --- |
| 1 | 10 | 0 | 10 |
| 2 | 12 | 0 | 12 |
| 7 | 22 | 50 (weekly) | 72 |
| 14 | 36 | 50 (weekly) | 86 |
| 30 | 68 | 200 (monthly) | 268 |
| 210 | 428 | 250 (weekly + monthly) | 678 |

Credits for a check-in are fixed at the time of that check-in. Changing reward settings affects only later check-ins.

## 5. Functions

### 5.1 User functions

#### `checkIn() payable returns (uint256 streak, uint256 credits)`

Records a check-in for `msg.sender` on the current day index.

- **Modifiers:** `whenNotPaused`, `nonReentrant`.
- **Reverts:** `AlreadyCheckedInToday` if the wallet has already checked in on the current day index; `EnforcedPause` if the contract is paused.
- **Streak rule:**
  - First check-in ever → `1`.
  - `lastCheckInDay + 1 == today` → `currentStreak + 1`.
  - Otherwise (one or more days missed) → `1`.
- **Effects:**
  - Increments `totalUsers` on the wallet's first check-in.
  - Updates the wallet's `lastCheckInDay`, `currentStreak`, `longestStreak` (if exceeded), `totalCheckIns`, `totalCredits` and `availableCredits`.
  - Sets `hasCheckedInOnDay[msg.sender][today]`.
  - Increments `totalCheckIns`, `totalCreditsIssued` and `dailyStats[today]`.
- **Events:** `CheckedIn` always; `StreakBonusAwarded` when the milestone bonus is non-zero; `NativeReceived` when `msg.value > 0`.
- **Returns:** the new streak and the credits earned by this check-in.
- **BNB:** not required. The function is `payable`; any BNB sent is kept by the contract and can only be withdrawn by the owner (§5.3). The application always sends `0`.

#### `spendCredits(uint256 amount)`

Reduces the caller's own `availableCredits` by `amount`.

- **Modifiers:** `whenNotPaused`, `nonReentrant`.
- **Reverts:** `ZeroAmount` if `amount == 0`; `InsufficientCredits` if `amount > availableCredits`; `EnforcedPause` if paused.
- **Effects:** `availableCredits -= amount`. `totalCredits` and global statistics are unchanged.
- **Events:** `CreditsSpent(user, amount, remainingCredits)`.

A wallet can only spend its own credits. No other contract function reads spent credits; any use of them is defined off-chain.

### 5.2 View functions

| Function | Returns |
| --- | --- |
| `currentDay()` | Current day index. |
| `canCheckIn(address account)` | `true` if `account` has not checked in on the current day index. Does not account for the pause state. |
| `previewNextStreak(address account)` | The streak that a check-in now would produce; the current streak if the account has already checked in today. |
| `previewNextReward(address account)` | Credits that a check-in now would earn; `0` if the account has already checked in today. |
| `getUserStatus(address account)` | All `users` fields plus `canCheckInToday`, `nextStreak` and `nextReward` in one call. |
| `calculateReward(uint256 streak)` | `reward(streak)` from §4 under the current settings. |
| `calculateMilestoneBonus(uint256 streak)` | `milestoneBonus(streak)` from §4 under the current settings. |

Public state variables in §3 and inherited `owner()`, `pendingOwner()` and `paused()` are also readable.

### 5.3 Owner functions

All functions below are restricted by `onlyOwner` and revert with `OwnableUnauthorizedAccount` for any other caller.

| Function | Behavior | Reverts |
| --- | --- | --- |
| `setRewardSettings(base, increment, weeklyThreshold, monthlyThreshold, weeklyBonus, monthlyBonus)` | Replaces all six reward settings. Emits `RewardSettingsUpdated`. | `InvalidRewardConfiguration` if either threshold is `0`. |
| `pause()` | Blocks `checkIn` and `spendCredits`. | `EnforcedPause` if already paused. |
| `unpause()` | Re-enables them. | `ExpectedPause` if not paused. |
| `withdrawNative(address payable recipient, uint256 amount)` | Sends `amount` of the contract's BNB to `recipient`. `nonReentrant`; not affected by pause. Emits `NativeWithdrawn`. | `InvalidRecipient` (zero address), `ZeroAmount`, `InsufficientNativeBalance`, `NativeTransferFailed`. |
| `transferOwnership(address)` / `acceptOwnership()` | Two-step ownership transfer inherited from `Ownable2Step`. The new owner must accept. | — |
| `renounceOwnership()` | Inherited from `Ownable`. Sets the owner to the zero address and permanently disables every owner function. | — |

### 5.4 Receiving BNB

`receive()` accepts plain BNB transfers and emits `NativeReceived`. The contract has no fallback for calls with unknown data.

## 6. Events

| Event | Emitted when |
| --- | --- |
| `CheckedIn(user, dayIndex, streak, credits)` | Every successful check-in. `credits` includes any milestone bonus. |
| `StreakBonusAwarded(user, dayIndex, streak, bonus)` | A check-in's milestone bonus is non-zero. Informational: `bonus` is already included in `CheckedIn.credits`. |
| `CreditsSpent(user, amount, remainingCredits)` | `spendCredits` succeeds. |
| `RewardSettingsUpdated(...)` | `setRewardSettings` succeeds. Contains the six new values. |
| `NativeReceived(sender, amount)` | BNB is received through `receive()` or `checkIn()`. |
| `NativeWithdrawn(recipient, amount)` | `withdrawNative` succeeds. |

Inherited OpenZeppelin events: `OwnershipTransferStarted`, `OwnershipTransferred`, `Paused`, `Unpaused`.

## 7. Custom errors

| Error | Raised by |
| --- | --- |
| `AlreadyCheckedInToday()` | `checkIn` |
| `InsufficientCredits()` | `spendCredits` |
| `ZeroAmount()` | `spendCredits`, `withdrawNative` |
| `InvalidRewardConfiguration()` | `setRewardSettings` |
| `InvalidRecipient()` | `withdrawNative` |
| `InsufficientNativeBalance()` | `withdrawNative` |
| `NativeTransferFailed()` | `withdrawNative` |

## 8. Invariants

The following hold for every wallet `u` and day index `d` after any transaction:

1. A wallet has at most one check-in per day index: `hasCheckedInOnDay[u][d]` is set at most once and never cleared.
2. `users[u].availableCredits ≤ users[u].totalCredits`.
3. `users[u].currentStreak ≤ users[u].longestStreak`, and `currentStreak ≥ 1` once `totalCheckIns ≥ 1`.
4. `users[u].currentStreak ≤ users[u].totalCheckIns`.
5. `totalCheckIns` equals the sum of `users[u].totalCheckIns` over all wallets, and the sum of `dailyStats[d].checkIns` over all days.
6. `totalCreditsIssued` equals the sum of `users[u].totalCredits` over all wallets, and the sum of `dailyStats[d].creditsIssued` over all days.
7. `totalUsers` equals the number of wallets with `totalCheckIns ≥ 1`.
8. No function moves BNB out of the contract except `withdrawNative`, which only the owner can call.

## 9. Trust assumptions and limitations

- **Owner control.** The owner can pause user actions, change reward settings at any time without an upper bound, withdraw BNB held by the contract, and renounce ownership. `setRewardSettings` does not validate magnitudes; values large enough to overflow the reward calculation would make `checkIn` revert under Solidity's checked arithmetic until corrected.
- **Time source.** Day boundaries depend on `block.timestamp` as produced by the opBNB sequencer.
- **Wallet identity.** One check-in is allowed per address, not per person. The contract does not attempt Sybil resistance.
- **Credits have no on-chain value.** They are not transferable and are not redeemable through this contract. `spendCredits` only reduces a counter.
- **BNB sent to the contract** through `checkIn` or a direct transfer is not refunded; only the owner can withdraw it.
- **No upgrade path.** Behavior changes require deploying a new contract; state does not migrate automatically.
