// Generated from contracts/out/TradeFinance.sol/TradeFinance.json by script/export-abi.mjs.
// Do not edit by hand; run `npm run abi` in contracts/ after changing the Solidity.
export const tradeFinanceAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "initialOwner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "collateralVault_",
        "type": "address",
        "internalType": "contract CollateralVault"
      },
      {
        "name": "escrow_",
        "type": "address",
        "internalType": "contract TradeEscrow"
      },
      {
        "name": "repayments_",
        "type": "address",
        "internalType": "contract RepaymentManager"
      },
      {
        "name": "adapter_",
        "type": "address",
        "internalType": "contract IAttestationAdapter"
      },
      {
        "name": "requireProofBacked_",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "advanceWithAttestation",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "attestationId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "attestationAdapter",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IAttestationAdapter"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "attestationConsumed",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "cancel",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "collateralVault",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract CollateralVault"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "commitFinancing",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "complete",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "createTrade",
    "inputs": [
      {
        "name": "supplier",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "tradeValue",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "collateral",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "interestBps",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "termDays",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "metadataHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "creditRecordOf",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct TradeFinance.CreditRecord",
        "components": [
          {
            "name": "tradesAsBuyer",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "tradesCompleted",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "tradesDefaulted",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "tradesFinanced",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "volumeTransacted",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "volumeFinanced",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "volumeRepaid",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "cumulativeRepaymentDays",
            "type": "uint64",
            "internalType": "uint64"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "declareDefault",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "depositCollateral",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "escrow",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract TradeEscrow"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTrade",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct TradeTypes.Trade",
        "components": [
          {
            "name": "id",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "buyer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "supplier",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "financier",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "terms",
            "type": "tuple",
            "internalType": "struct TradeTypes.Terms",
            "components": [
              {
                "name": "tradeValue",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "collateral",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "financing",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "interestBps",
                "type": "uint16",
                "internalType": "uint16"
              },
              {
                "name": "termDays",
                "type": "uint16",
                "internalType": "uint16"
              }
            ]
          },
          {
            "name": "state",
            "type": "uint8",
            "internalType": "enum TradeTypes.TradeState"
          },
          {
            "name": "createdAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "fundedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "maturityAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "metadataHash",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nextTradeId",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "outstandingOf",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "releaseFunds",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "repay",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "repayments",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract RepaymentManager"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "requireProofBacked",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setAttestationAdapter",
    "inputs": [
      {
        "name": "adapter_",
        "type": "address",
        "internalType": "contract IAttestationAdapter"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setRequireProofBacked",
    "inputs": [
      {
        "name": "required",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setSupplierVerifier",
    "inputs": [
      {
        "name": "verifier",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "allowed",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "supplierVerifiers",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "tradeCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "verifySupplier",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "AttestationAdapterChanged",
    "inputs": [
      {
        "name": "adapter",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "proofKind",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum TradeTypes.ProofKind"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AttestationApplied",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "attestationId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "kind",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum TradeTypes.EventKind"
      },
      {
        "name": "proofKind",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum TradeTypes.ProofKind"
      },
      {
        "name": "newState",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum TradeTypes.TradeState"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "FinancingCommitted",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "financier",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "FundsReleased",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "supplier",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ProofRequirementChanged",
    "inputs": [
      {
        "name": "required",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SupplierVerified",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "supplier",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "byAttestation",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SupplierVerifierSet",
    "inputs": [
      {
        "name": "verifier",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "allowed",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TradeCancelled",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "actor",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TradeCompleted",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "collateralReturned",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TradeCreated",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "buyer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "supplier",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "tradeValue",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "collateral",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "financing",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "interestBps",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      },
      {
        "name": "termDays",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      },
      {
        "name": "metadataHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TradeDefaulted",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "collateralSeized",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "shortfall",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TradeRepaid",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "outstanding",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TradeStateChanged",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "from",
        "type": "uint8",
        "indexed": true,
        "internalType": "enum TradeTypes.TradeState"
      },
      {
        "name": "to",
        "type": "uint8",
        "indexed": true,
        "internalType": "enum TradeTypes.TradeState"
      },
      {
        "name": "actor",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AttestationAlreadyApplied",
    "inputs": [
      {
        "name": "attestationId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "AttestationMismatch",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidCounterparty",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidState",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "actual",
        "type": "uint8",
        "internalType": "enum TradeTypes.TradeState"
      },
      {
        "name": "required",
        "type": "uint8",
        "internalType": "enum TradeTypes.TradeState"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidTerms",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotAuthorized",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "caller",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "required",
        "type": "uint8",
        "internalType": "enum TradeTypes.Party"
      }
    ]
  },
  {
    "type": "error",
    "name": "NotMatured",
    "inputs": [
      {
        "name": "maturityAt",
        "type": "uint64",
        "internalType": "uint64"
      }
    ]
  },
  {
    "type": "error",
    "name": "NotSupplierVerifier",
    "inputs": [
      {
        "name": "caller",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "NothingToRepay",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ProofRequired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SelfFinancingForbidden",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UnexpectedEventKind",
    "inputs": [
      {
        "name": "kind",
        "type": "uint8",
        "internalType": "enum TradeTypes.EventKind"
      }
    ]
  },
  {
    "type": "error",
    "name": "UnknownTrade",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAmount",
    "inputs": []
  }
] as const;
