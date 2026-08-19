// Generated from contracts/out/UscAttestationAdapter.sol/UscAttestationAdapter.json by script/export-abi.mjs.
// Do not edit by hand; run `node script/export-abi.mjs` from contracts/ after changing the Solidity.
export const uscAttestationAdapterAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "initialOwner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "verifier_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "chainInfo_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "attestationId",
    "inputs": [
      {
        "name": "sourceChainKey",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "sourceTxHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "logIndex",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "chainInfo",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IChainInfo"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "expectedTopic0",
    "inputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "enum TradeTypes.EventKind"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAttestation",
    "inputs": [
      {
        "name": "id",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct TradeTypes.Attestation",
        "components": [
          {
            "name": "tradeId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum TradeTypes.EventKind"
          },
          {
            "name": "proofKind",
            "type": "uint8",
            "internalType": "enum TradeTypes.ProofKind"
          },
          {
            "name": "sourceChainKey",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "sourceHeight",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "sourceTxHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "emitter",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "recordedAt",
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
    "name": "isRecorded",
    "inputs": [
      {
        "name": "id",
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
    "name": "proofKind",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "enum TradeTypes.ProofKind"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "registerTopic",
    "inputs": [
      {
        "name": "kind",
        "type": "uint8",
        "internalType": "enum TradeTypes.EventKind"
      },
      {
        "name": "topic0",
        "type": "bytes32",
        "internalType": "bytes32"
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
    "name": "setTrustedEmitter",
    "inputs": [
      {
        "name": "sourceChainKey",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "emitter",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "trusted",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "submitProof",
    "inputs": [
      {
        "name": "s",
        "type": "tuple",
        "internalType": "struct UscAttestationAdapter.ProofSubmission",
        "components": [
          {
            "name": "tradeId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum TradeTypes.EventKind"
          },
          {
            "name": "sourceChainKey",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "sourceHeight",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "sourceTxHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "logIndex",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "encodedTransaction",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "merkleProof",
            "type": "tuple",
            "internalType": "struct INativeQueryVerifier.MerkleProof",
            "components": [
              {
                "name": "root",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "siblings",
                "type": "tuple[]",
                "internalType": "struct INativeQueryVerifier.MerkleProofEntry[]",
                "components": [
                  {
                    "name": "hash",
                    "type": "bytes32",
                    "internalType": "bytes32"
                  },
                  {
                    "name": "isLeft",
                    "type": "bool",
                    "internalType": "bool"
                  }
                ]
              }
            ]
          },
          {
            "name": "continuityProof",
            "type": "tuple",
            "internalType": "struct INativeQueryVerifier.ContinuityProof",
            "components": [
              {
                "name": "lowerEndpointDigest",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "roots",
                "type": "bytes32[]",
                "internalType": "bytes32[]"
              }
            ]
          },
          {
            "name": "fields",
            "type": "tuple",
            "internalType": "struct UscAttestationAdapter.QueryFields",
            "components": [
              {
                "name": "rxStatus",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "logAddress",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "topic0",
                "type": "uint32",
                "internalType": "uint32"
              },
              {
                "name": "tradeId",
                "type": "uint32",
                "internalType": "uint32"
              }
            ]
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "id",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "nonpayable"
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
    "name": "trustedEmitter",
    "inputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      },
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
    "name": "verifier",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract INativeQueryVerifier"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "AttestationRecorded",
    "inputs": [
      {
        "name": "attestationId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "tradeId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "kind",
        "type": "uint8",
        "indexed": true,
        "internalType": "enum TradeTypes.EventKind"
      },
      {
        "name": "proofKind",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum TradeTypes.ProofKind"
      },
      {
        "name": "sourceChainKey",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "sourceTxHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EmitterTrustSet",
    "inputs": [
      {
        "name": "sourceChainKey",
        "type": "uint64",
        "indexed": true,
        "internalType": "uint64"
      },
      {
        "name": "emitter",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "trusted",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
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
    "name": "TopicRegistered",
    "inputs": [
      {
        "name": "kind",
        "type": "uint8",
        "indexed": true,
        "internalType": "enum TradeTypes.EventKind"
      },
      {
        "name": "topic0",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AttestationReplayed",
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
    "name": "FieldOutOfRange",
    "inputs": [
      {
        "name": "offset",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "length",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "HeightNotAttested",
    "inputs": [
      {
        "name": "sourceChainKey",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "height",
        "type": "uint64",
        "internalType": "uint64"
      }
    ]
  },
  {
    "type": "error",
    "name": "InclusionProofFailed",
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
    "name": "SourceTransactionReverted",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TopicMismatch",
    "inputs": [
      {
        "name": "expected",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "found",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "TopicNotRegistered",
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
    "name": "TradeIdMismatch",
    "inputs": [
      {
        "name": "expected",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "found",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "UnknownEventKind",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UnsupportedSourceChain",
    "inputs": [
      {
        "name": "sourceChainKey",
        "type": "uint64",
        "internalType": "uint64"
      }
    ]
  },
  {
    "type": "error",
    "name": "UntrustedEmitter",
    "inputs": [
      {
        "name": "sourceChainKey",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "emitter",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  }
] as const;
