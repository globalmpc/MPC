# MPC Pre CheckIn

A community check-in app deployed on **opBNB Mainnet**, part of the BNB Chain ecosystem.

Website: https://pre-check-in.globalmpc.tech

## Technology stack

- Blockchain: opBNB Mainnet (BNB Chain ecosystem).
- Smart contracts: Solidity 0.8.36, OpenZeppelin 5.7.0.
- Frontend: Next.js, React, TypeScript, Tailwind CSS, wagmi and viem.

## Supported network

- opBNB Mainnet (Chain ID: 204).

## Contract address

| Network | Contract | Address |
| --- | --- | --- |
| opBNB Mainnet | MPCCheckinCore | [`0x843e4ff9242c3e81b676434b2876fb090d4a5783`](https://opbnbscan.com/address/0x843e4ff9242c3e81b676434b2876fb090d4a5783?view=contract_code) |

## Features

- One check-in per wallet per UTC day.
- Community participation totals and personal check-in counts and streaks.
- Browser wallet support and optional WalletConnect support.
- Check-in transactions with zero BNB value; users pay network gas fees.
- Links to the MPC website and social channels.
