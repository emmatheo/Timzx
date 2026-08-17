/**
 * Creditcoin network definitions.
 *
 * Values come from the gluwa/creditcoin-usc-networks configuration map and the public Creditcoin
 * endpoint documentation. Endpoints move between environments, so the network the app uses is
 * selected by `NEXT_PUBLIC_CREDITCOIN_NETWORK` rather than hardcoded at a call site.
 */
import {defineChain} from 'viem';
import {sepolia} from 'viem/chains';

export const creditcoinTestnet = defineChain({
  id: 102031,
  name: 'Creditcoin Testnet',
  nativeCurrency: {name: 'Creditcoin', symbol: 'CTC', decimals: 18},
  rpcUrls: {
    default: {http: ['https://rpc.cc3-testnet.creditcoin.network']},
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: 'https://creditcoin-testnet.blockscout.com',
    },
  },
  testnet: true,
});

export const creditcoinDevnet = defineChain({
  id: 102030,
  name: 'Creditcoin CC3 Devnet',
  nativeCurrency: {name: 'Creditcoin', symbol: 'CTC', decimals: 18},
  rpcUrls: {
    default: {http: ['https://rpc.cc3-devnet.creditcoin.network']},
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: 'https://creditcoin-devnet.blockscout.com',
    },
  },
  testnet: true,
});

/**
 * The source chain proofs are generated from. Sepolia is where `TradeEventEmitter` is deployed and
 * where shipment and delivery events originate.
 */
export const sourceChain = sepolia;

const networks = {
  'cc3-testnet': creditcoinTestnet,
  'cc3-devnet': creditcoinDevnet,
} as const;

export type NetworkName = keyof typeof networks;

function resolveNetwork(): NetworkName {
  const configured = process.env.NEXT_PUBLIC_CREDITCOIN_NETWORK;
  return configured === 'cc3-devnet' ? 'cc3-devnet' : 'cc3-testnet';
}

export const activeNetworkName = resolveNetwork();
export const creditcoin = networks[activeNetworkName];

/** Every chain the wallet connection needs to know about. */
export const supportedChains = [creditcoin, sourceChain] as const;

/** Creditcoin precompiles the app reads directly. */
export const precompiles = {
  /** Block prover / native query verifier. */
  blockProver: '0x0000000000000000000000000000000000000FD2',
  /** Chain info: supported chains and attestation progress. */
  chainInfo: '0x0000000000000000000000000000000000000fD3',
} as const;

export function explorerTxUrl(chainId: number, hash: string): string | null {
  if (chainId === creditcoin.id) {
    return `${creditcoin.blockExplorers.default.url}/tx/${hash}`;
  }
  if (chainId === sourceChain.id) {
    return `${sourceChain.blockExplorers.default.url}/tx/${hash}`;
  }
  return null;
}

export function explorerAddressUrl(chainId: number, address: string): string | null {
  if (chainId === creditcoin.id) {
    return `${creditcoin.blockExplorers.default.url}/address/${address}`;
  }
  if (chainId === sourceChain.id) {
    return `${sourceChain.blockExplorers.default.url}/address/${address}`;
  }
  return null;
}
