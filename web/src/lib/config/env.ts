/**
 * Environment configuration.
 *
 * Every address and endpoint the app talks to is resolved here, once, from `NEXT_PUBLIC_*`
 * variables. Nothing else in the codebase reads `process.env`, so there is a single place to look
 * when a deployment misbehaves — and a single place that decides whether the app is running
 * against real contracts or not.
 */
import type {Address} from 'viem';

/** A configuration value that may legitimately be absent before deployment. */
type MaybeAddress = Address | null;

function readAddress(value: string | undefined): MaybeAddress {
  if (!value) return null;
  const trimmed = value.trim();
  // Reject anything that is not a well-formed address rather than letting viem throw deep in a
  // hook, where the cause is much harder to see.
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return null;
  return trimmed as Address;
}

function readUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

/**
 * Contract addresses for the active Creditcoin deployment.
 * `null` means "not deployed yet", which the UI surfaces explicitly instead of failing silently.
 */
export const contractAddresses = {
  tradeFinance: readAddress(process.env.NEXT_PUBLIC_TRADE_FINANCE_ADDRESS),
  collateralVault: readAddress(process.env.NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS),
  tradeEscrow: readAddress(process.env.NEXT_PUBLIC_TRADE_ESCROW_ADDRESS),
  repaymentManager: readAddress(process.env.NEXT_PUBLIC_REPAYMENT_MANAGER_ADDRESS),
  uscAdapter: readAddress(process.env.NEXT_PUBLIC_USC_ADAPTER_ADDRESS),
  settlementToken: readAddress(process.env.NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS),
  faucet: readAddress(process.env.NEXT_PUBLIC_FAUCET_ADDRESS),
  /** On the SOURCE chain (Sepolia), not on Creditcoin. */
  sourceEmitter: readAddress(process.env.NEXT_PUBLIC_SOURCE_EMITTER_ADDRESS),
} as const;

export const uscConfig = {
  /**
   * Creditcoin's identifier for the source chain. NOT the EVM chain id — the two are different
   * numbers, and the mapping differs per Creditcoin environment, so this is configuration rather
   * than a constant. The Developer page reads the authoritative value from the ChainInfo
   * precompile and warns when it disagrees with this setting.
   */
  sourceChainKey: Number(process.env.NEXT_PUBLIC_SOURCE_CHAIN_KEY ?? '3'),
  /** Proof generation API, e.g. https://proof-gen-api.cc3-devnet.creditcoin.network */
  proofApiUrl: readUrl(process.env.NEXT_PUBLIC_PROOF_API_URL),
  /** Source-chain RPC used to read receipts when preparing a proof. */
  sourceRpcUrl: readUrl(process.env.NEXT_PUBLIC_SOURCE_RPC_URL),
  /** Attestation indexer (GraphQL), optional. */
  graphqlUrl: readUrl(process.env.NEXT_PUBLIC_ATTESTATIONS_GRAPHQL_URL),
} as const;

export const supabaseConfig = {
  url: readUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null,
} as const;

/** True when the protocol contracts are configured and the app can transact for real. */
export const isChainConfigured = contractAddresses.tradeFinance !== null;

/** True when Supabase is configured for off-chain metadata. */
export const isSupabaseConfigured =
  supabaseConfig.url !== null && supabaseConfig.anonKey !== null;

/**
 * True when a cross-chain event can actually be proved: the proof API is reachable, the adapter is
 * deployed, and the QueryBuilder offsets the adapter reads have been pinned. All three are
 * required — without the offsets the client refuses to submit rather than guess where in the
 * proven bytes the fields live.
 */
export const isProofPipelineConfigured =
  uscConfig.proofApiUrl !== null &&
  contractAddresses.uscAdapter !== null &&
  contractAddresses.sourceEmitter !== null;
