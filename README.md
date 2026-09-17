# MPC

MPC translates the world's mining resources into the language of global capital markets.

MPC is developing blockchain infrastructure for standardized mining real-world asset (RWA) issuance. Its aim is to structure the mining value chain into tokenizable assets with risk and return information that institutional investors can evaluate.

This repository contains MPC's community check-in application and its live contract on **opBNB Mainnet**, part of the BNB Chain ecosystem. Check-in is one current feature of the broader MPC project.

The check-in application provides an on-chain record of community participation as MPC develops its broader RWA infrastructure.

Website: https://pre-check-in.globalmpc.tech

## Technology stack

The current check-in application uses:

- Blockchain: opBNB Mainnet (BNB Chain ecosystem).
- Smart contracts: Solidity 0.8.36, OpenZeppelin 5.7.0.
- Frontend: Next.js, React, TypeScript, Tailwind CSS, wagmi and viem.

## Supported network

- opBNB Mainnet (Chain ID: 204) — current check-in deployment.

## Contract address

| Network | Contract | Address |
| --- | --- | --- |
| opBNB Mainnet | MPCCheckinCore | [`0x843e4ff9242c3e81b676434b2876fb090d4a5783`](https://opbnbscan.com/address/0x843e4ff9242c3e81b676434b2876fb090d4a5783?view=contract_code) |

## Current Features

- One check-in per wallet per UTC day.
- Community participation totals and personal check-in counts and streaks.
- Browser wallet support and optional WalletConnect support.
- Check-in transactions with zero BNB value; users pay network gas fees.
- Links to the MPC website and social channels.

## Roadmap

The broader RWA infrastructure is in the design and build stage. The following development directions reflect the [MPC website](https://www.globalmpc.tech/). The application in this repository currently supports opBNB Mainnet.

### Future Features

| Area | Planned functionality |
| --- | --- |
| RWA issuance | Additional smart contracts for asset tokenization, issuance and token management. |
| On-chain modules | Asset registry, jurisdiction adapters and policy controls. |
| Asset lifecycle management | Resource verification, oracle reporting and ongoing asset disclosures. |
| Investor infrastructure | Due-diligence information, compliance workflows and custody integration. |
| Ecosystem expansion | Additional resource projects and jurisdiction profiles. |

These are development directions, not live capabilities of the check-in contract. Scope and timing depend on technical validation, regulatory requirements and partner readiness.
