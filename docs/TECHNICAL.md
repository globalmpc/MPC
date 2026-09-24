# MPC Check-in Technical Documentation

This document describes the live MPC community check-in system: its components, deployment, access control, operations and verification. Contract-level behavior is specified in [SPECIFICATION.md](SPECIFICATION.md).

Scope is limited to what is deployed today. The broader MPC RWA infrastructure is described in the [whitepaper](https://www.globalmpc.tech/docs) and the [README roadmap](../README.md#roadmap); none of it is implemented in this repository.

## 1. System overview

```
 User wallet ──(signs checkIn tx, value 0)──▶ opBNB Mainnet ──▶ MPCCheckinCore
      ▲                                              │
      │                                    view calls │ (public RPC)
      │                                              ▼
      └──────────── Web app (pre-check-in.globalmpc.tech) ◀──┘

 Safe multisig (2-of-2) ──(owner-only admin txs)──▶ MPCCheckinCore
```

| Component | Description |
| --- | --- |
| `MPCCheckinCore` | Single, non-upgradeable Solidity contract on opBNB Mainnet. Holds all check-in state. |
| Web app | Next.js single-page application at https://pre-check-in.globalmpc.tech. Reads contract state and asks the user's wallet to sign check-in transactions. Has no backend or database. |
| Owner | Safe multisig that controls the contract's admin functions. |

There are no other contracts, oracles, bridges, off-chain signers or relayers in the system.

## 2. Deployment

| Item | Value |
| --- | --- |
| Network | opBNB Mainnet (Chain ID 204) |
| Contract | [`0x843e4ff9242c3e81b676434b2876fb090d4a5783`](https://opbnbscan.com/address/0x843e4ff9242c3e81b676434b2876fb090d4a5783?view=contract_code) |
| Creation transaction | [`0x8df5f7382fb3a6d6c06afaabee90919522fe596cc8c6b2a9c5f72991fb64c6f9`](https://opbnbscan.com/tx/0x8df5f7382fb3a6d6c06afaabee90919522fe596cc8c6b2a9c5f72991fb64c6f9) |
| Creation block | 182636005 |
| Compiler | Solidity `0.8.36+commit.8a079791` |
| Source verification | Verified on opBNBScan |
| Upgradeability | None (no proxy) |

The repository stores the exact verified artifacts in [`contracts/verification/`](../contracts/verification/):

- `standard-input.json`: Solidity standard JSON input used for verification.
- `explorer-result.json`: explorer verification result, including ABI and bytecode.
- `deployment.json`: address, chain, creation block and transaction, compiler version.

## 3. Source-to-deployment verification

`pnpm contracts:verify` runs [`contracts/scripts/verify-contract.mjs`](../contracts/scripts/verify-contract.mjs), which:

1. Downloads the official Solidity WASM compiler `0.8.36` and checks it against a pinned SHA-256 before running it.
2. Confirms that `contracts/MPCCheckinCore.sol` is byte-identical to the source in the verified compiler input.
3. Recompiles and asserts that the creation bytecode, runtime bytecode and ABI match the verified explorer artifact.

`pnpm contracts:verify --live` additionally fetches the runtime code from the opBNB public RPC and asserts that it matches the compiled output.

Anyone with the repository can reproduce the check. Both steps passed on 2026-09-24.

## 4. Access control

The contract uses OpenZeppelin `Ownable2Step`. The owner is a Safe multisig:

| Item | Value |
| --- | --- |
| Owner | [`0x9d6da4c60d76cf5a06d5271e062b0ab2123d9302`](https://opbnbscan.com/address/0x9d6da4c60d76cf5a06d5271e062b0ab2123d9302) |
| Type | Safe `1.4.1` |
| Threshold | 2 of 2 signers |

Owner-only functions (details in [SPECIFICATION.md §5.3](SPECIFICATION.md#53-owner-functions)):

| Function | Purpose |
| --- | --- |
| `pause()` / `unpause()` | Emergency stop for check-ins and credit spending. |
| `setRewardSettings(...)` | Adjust credit amounts and milestone thresholds for future check-ins. |
| `withdrawNative(recipient, amount)` | Recover BNB sent to the contract. |
| `transferOwnership` / `acceptOwnership` | Two-step owner change. |
| `renounceOwnership()` | Permanently remove the owner. |

Users hold no special roles. The contract has no minting, token transfer or allowance logic, and it never holds user funds as part of normal use.

## 5. Web application

### Stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4, wagmi 3 and viem 2. The app is a static client-side page; it has no server-side state.

### Contract interaction

- The contract address and ABI are fixed at build time ([`src/lib/deployment.ts`](../src/lib/deployment.ts), [`src/lib/checkin-abi.ts`](../src/lib/checkin-abi.ts)). The app calls no other contract.
- Community statistics (`currentDay`, `totalUsers`, `totalCheckIns`, `dailyStats`) and personal state (`users`, `canCheckIn`, `paused`) are read from the opBNB public RPC and refreshed every 30 seconds.
- Before submitting a check-in, the app re-reads `paused` and `canCheckIn`, switches the wallet to opBNB if needed, and estimates gas. It then sends `checkIn()` with `value: 0` and a 20% gas buffer, and waits for the receipt.
- Users pay only the opBNB network fee.

### Wallets

Injected browser wallets are supported. WalletConnect is enabled when `NEXT_PUBLIC_REOWN_PROJECT_ID` is set at build time; the Reown project is configured with the production domain in its origin allowlist.

### Analytics

Optional GA4, enabled by `NEXT_PUBLIC_GA_MEASUREMENT_ID`. Only four allowlisted events are sent (`wallet_connect`, `checkin_submit`, `checkin_confirm`, `project_click`). Wallet addresses and transaction hashes are never sent. Analytics failures cannot interrupt a wallet action.

## 6. Testing and quality checks

| Check | Command | Covers |
| --- | --- | --- |
| Deployment verification | `pnpm contracts:verify [--live]` | Source, compiler, ABI and bytecode match the verified and live deployment (§3). |
| ABI consistency | `pnpm test` | Every frontend ABI entry matches the verified contract ABI. |
| Frontend unit tests | `pnpm test` | Check-in flow and analytics behavior (Vitest, Testing Library). |
| Type check | `pnpm typecheck` | TypeScript. |
| Lint | `pnpm lint` | ESLint with zero warnings allowed. |

The repository does not contain a Solidity unit test suite. Contract behavior is documented in [SPECIFICATION.md](SPECIFICATION.md), and the contract is under independent security audit (see §8).

## 7. Operations

| Situation | Response |
| --- | --- |
| Suspected contract issue | Owner multisig calls `pause()`. The app re-reads `paused` before each submission and shows a paused message instead of sending a transaction. |
| Reward change | Owner multisig calls `setRewardSettings`. The change is public through `RewardSettingsUpdated`. |
| BNB sent to the contract by mistake | Owner multisig can return it with `withdrawNative`. |
| Contract change required | Deploy a new contract, verify it, update the address in the app and this repository. State does not migrate automatically. |

At the time of writing, the contract is not paused and holds no BNB.

## 8. Security

- OpenZeppelin 5.7.0 building blocks for ownership, pausing and reentrancy protection.
- All admin actions require two Safe signatures.
- The only function that transfers value out is owner-only `withdrawNative`, protected by `nonReentrant`.
- No external contract calls other than the BNB transfer in `withdrawNative`.
- Independent audit: in progress. The report link will be added here when published.

Trust assumptions and known limitations are listed in [SPECIFICATION.md §9](SPECIFICATION.md#9-trust-assumptions-and-limitations).
