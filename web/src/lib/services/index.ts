/**
 * Service layer.
 *
 * One rule holds across all of it: a service never owns a key. Chain services are handed a wallet
 * client belonging to the connected account, simulate before requesting a signature, and return
 * the hash. That is what keeps the platform non-custodial — there is no server-side path that can
 * move a user's funds, by construction rather than by policy.
 */
export {ChainService, ServiceUnavailableError, WalletRequiredError, readableError} from './context';
export type {ServiceContext} from './context';

export {TokenService} from './token-service';
export {TradeService} from './trade-service';
export type {CreateTradeInput} from './trade-service';
export {CollateralService} from './collateral-service';
export {FinancingService} from './financing-service';
export type {FinancingQuote} from './financing-service';
export {FaucetService} from './faucet-service';
export type {FaucetState} from './faucet-service';
export {DocumentService} from './document-service';
export type {RegisterDocumentInput} from './document-service';

export {createAttestationService} from './attestation';
export type {AttestationService} from './attestation';
