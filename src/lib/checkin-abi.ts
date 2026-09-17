export const COMMUNITY_CHECKIN_ABI = [
  {
    type: 'function', name: 'checkIn', stateMutability: 'payable', inputs: [],
    outputs: [{ name: 'streak', type: 'uint256' }, { name: 'credits', type: 'uint256' }],
  },
  {
    "inputs": [
      {
        "name": "account",
        "type": "address"
      }
    ],
    "name": "canCheckIn",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "currentDay",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "dailyStats",
    "outputs": [
      {
        "name": "checkIns",
        "type": "uint256"
      },
      {
        "name": "creditsIssued",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "paused",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalCheckIns",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalUsers",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "name": "users",
    "outputs": [
      {
        "name": "lastCheckInDay",
        "type": "uint256"
      },
      {
        "name": "currentStreak",
        "type": "uint256"
      },
      {
        "name": "longestStreak",
        "type": "uint256"
      },
      {
        "name": "totalCheckIns",
        "type": "uint256"
      },
      {
        "name": "totalCredits",
        "type": "uint256"
      },
      {
        "name": "availableCredits",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const
