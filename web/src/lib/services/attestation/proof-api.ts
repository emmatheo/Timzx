/**
 * Client for the Creditcoin proof-generation API.
 *
 * Speaks the same HTTP contract as `ProofBuilder` in the gluwa usc-sdk package
 * (`/api/v1/proof-by-tx/{chainKey}/{txHash}`, `/api/v1/attested-height/{chainKey}`), implemented
 * with `fetch` so the frontend keeps a single web3 stack — viem — instead of pulling ethers in
 * behind the SDK. Swapping this file for the SDK's `ProofBuilder` is a drop-in change: the
 * response types are the ones the SDK returns.
 */
import type {ProofPayload} from './types';

const PROOF_BY_TX = '/api/v1/proof-by-tx';
const ATTESTED_HEIGHT = '/api/v1/attested-height';

export class ProofApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProofApiError';
  }
}

export class ProofApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 20_000,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(new URL(path, this.baseUrl).toString(), {
        ...init,
        signal: controller.signal,
        headers: {'Content-Type': 'application/json', ...init?.headers},
      });
      if (!response.ok) {
        throw new ProofApiError(
          `Proof API returned ${response.status} for ${path}`,
          response.status,
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ProofApiError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ProofApiError(`Proof API timed out after ${this.timeoutMs}ms`);
      }
      throw new ProofApiError(
        error instanceof Error ? error.message : 'Unknown proof API failure',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Fetch an inclusion proof for a source-chain transaction.
   * The block containing it must already be attested; see {@link attestedHeight}.
   */
  async getProof(chainKey: number, transactionHash: string): Promise<ProofPayload> {
    return this.request<ProofPayload>(`${PROOF_BY_TX}/${chainKey}/${transactionHash}`);
  }

  /** Highest source-chain height the attestor set has attested. */
  async attestedHeight(chainKey: number): Promise<number | undefined> {
    const result = await this.request<{attestedHeight?: number}>(
      `${ATTESTED_HEIGHT}/${chainKey}`,
    );
    return result.attestedHeight;
  }
}
