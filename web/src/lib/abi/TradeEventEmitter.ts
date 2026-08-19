// Generated from contracts/out/TradeEventEmitter.sol/TradeEventEmitter.json by script/export-abi.mjs.
// Do not edit by hand; run `node script/export-abi.mjs` from contracts/ after changing the Solidity.
export const tradeEventEmitterAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "initialOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "confirmDelivery",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "documentHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "confirmShipment",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "documentHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
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
    "name": "reporters",
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
    "name": "setReporter",
    "inputs": [
      {
        "name": "reporter",
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
    "name": "verifySupplier",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "supplier",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "DeliveryConfirmed",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "documentHash",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "reporter",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "occurredAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ReporterSet",
    "inputs": [
      {
        "name": "reporter",
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
    "name": "ShipmentConfirmed",
    "inputs": [
      {
        "name": "tradeId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "documentHash",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "reporter",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "occurredAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
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
        "name": "reporter",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "occurredAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "NotOwner",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotReporter",
    "inputs": []
  }
] as const;
