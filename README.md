# TImx — Global Trade. Onchain Trust.

Programmable cross-border trade finance on Creditcoin, where shipment and delivery advance a trade
only once the underlying event has been **cryptographically verified across chains**.

Built for BUIDL CTC 2026 Fall.

---

## The idea in one paragraph

A Nigerian importer buys $50,000 of solar panels from a Chinese supplier. They post $10,000 of
collateral; a financier commits the remaining $40,000. The money moves through contracts that
cannot be drained at will. The goods ship — and that shipment happens on *another chain*, recorded
by a logistics contract on Ethereum Sepolia. Creditcoin's attestor set attests the block, a Merkle
and continuity proof is generated, and the **block-prover precompile at `0x…0FD2` verifies that
proof on Creditcoin in the same transaction that advances the trade**. No bridge. No oracle. No
relayer that has to be trusted.

That last sentence is the reason this project exists on Creditcoin rather than anywhere else.

---

## What is real, and what is not

This is the part most hackathon projects fudge. TImx does not.

| Layer | Status |
|---|---|
| Trade lifecycle state machine | **Real.** 12-state enum, invalid transitions revert. 47 passing tests. |
| Collateral, escrow, repayment, default | **Real.** SafeERC20, ReentrancyGuard, controller-gated. |
| Faucet, settlement token, credit record | **Real** on-chain contracts. |
| Documents, messages, trade metadata | **Real** Supabase persistence behind wallet-signature auth. |
| USC proof verification (`UscAttestationAdapter`) | **Real code** against the real precompile interfaces, tested against test doubles. Not yet exercised against a live Creditcoin node. |
| QueryBuilder field offsets | **Deliberately unimplemented.** See below. |

### The honesty mechanism

The rule "do not pretend an API request is an Attestcoin proof" is enforced by the contracts, not
by discipline:

- `TradeTypes.ProofKind` has exactly **one** non-null value: `USC_PROOF`. There is no
  operator-asserted variant to fall back to.
- The **adapter stamps it**, not the caller, and only after `INativeQueryVerifier.verify` returns
  true.
- `TradeFinance` rejects any attestation that is not `USC_PROOF`, unconditionally. There is no
  configuration that relaxes this.
- `setAttestationAdapter` refuses an adapter that reports a different proof kind, so the guarantee
  cannot be swapped out either.
- The UI reads proof kind **back from the chain** after every attestation. A misconfigured frontend
  cannot mislabel anything, because it never decides.

There is no demo mode, no seeded catalogue and no example data anywhere in the product. A trade
appears because it exists on Creditcoin.

### The one thing that is not finished

`UscAttestationAdapter` verifies inclusion and then reads four 32-byte words out of the proven
transaction to bind it to a trade — receipt status, log address, topic0, and the trade id. Those
byte offsets come from `QueryBuilder.build()` in `@gluwa/usc-sdk`, computed against the same
encoding the proof covers.

`SdkFieldOffsetResolver` **throws with instructions rather than returning plausible numbers**.
A wrong offset would bind a valid proof to the wrong bytes — the exact failure the adapter exists
to prevent — so guessing is worse than failing. Offsets can be pinned via
`NEXT_PUBLIC_QUERY_OFFSET_*` once computed with the SDK.

---

## Attestcoin Protocol integration

This section is the technical documentation of how the protocol uses Creditcoin's Universal Smart
Contracts. It describes what the code does, not what it aspires to.

### Why this needs Creditcoin specifically

A shipment is a physical fact recorded on a different chain. Every other way of getting that fact
into a trade-finance contract introduces someone to trust: a bridge, an oracle committee, a relayer
with a signing key, or an operator pressing a button. Creditcoin's attestor set attests source-chain
blocks, and the **block-prover precompile verifies a Merkle plus continuity proof on-chain, inside
the same transaction that advances the trade**. The trust assumption collapses into the attestor
set — there is no additional trusted party bolted on by this project.

### The two precompiles used

| Precompile | Address | Calls used | Purpose here |
|---|---|---|---|
| ChainInfo | `0x…0fD3` | `get_chain_by_key`, `is_height_attested`, `get_supported_chains` | Confirm the source chain is tracked and its height already attested |
| Block prover / native query verifier | `0x…0FD2` | `verify` | Verify inclusion of the source transaction in the attested block |

`get_supported_chains` is also read by the Developer page at runtime. **`chainKey` is not `chainId`** —
they are different numbers and the mapping differs per Creditcoin environment, so the key is
configuration validated against the precompile, never a hardcoded constant.

### The path an event takes

```
Sepolia                          Off-chain                    Creditcoin
───────────────────────          ─────────────────            ────────────────────────────────
TradeEventEmitter
  ShipmentConfirmed(tradeId,…)
        │
        │ attestor set attests the block containing it
        │
        └─► proof API ───────────► inclusion proof   ──►  UscAttestationAdapter.submitProof
            /api/v1/proof-by-tx/       + continuity            │
            {chainKey}/{txHash}          proof                 │ 1. get_chain_by_key    → exists?
                                                               │ 2. is_height_attested  → attested?
                                                               │ 3. verify(...)         → included?
                                                               │ 4. bind proven fields  → is it THIS event?
                                                               ▼
                                                         attestation recorded, ProofKind.USC_PROOF
                                                               │
                                                               ▼
                                                    TradeFinance.advanceWithAttestation
                                                         FUNDED ──► SHIPPED
```

### Step 4 is the part most integrations skip

An inclusion proof proves that *some* transaction was in the block. It does not prove *what the
transaction contained*. Acting on inclusion alone would let anyone advance a trade by proving any
unrelated transaction from the same block.

So after `verify()` returns true, `_bindProvenFields` reads four 32-byte words **out of the same
calldata buffer the proof covered** and checks each one:

| Field | Check | Revert if wrong |
|---|---|---|
| receipt status | must be `1` | `SourceTransactionReverted` |
| `topic0` | must equal the registered topic for the claimed event kind | `TopicMismatch` / `TopicNotRegistered` |
| trade id | must equal the trade being advanced | `TradeIdMismatch` |
| log address | must be a registered trusted emitter for that chain key | `UntrustedEmitter` |

Word loads are bounds-checked (`FieldOutOfRange`) and the address word is rejected if its high
bytes are dirty rather than silently truncated. Replay is prevented twice: the attestation id is
`keccak(chainKey, sourceTxHash, logIndex)` and cannot be recorded twice, and `TradeFinance` marks
each attestation consumed so one source event cannot advance two trades.

### Why an unproved event cannot move a trade

Not by convention — by construction:

- `TradeTypes.ProofKind` has exactly **one** non-null value, `USC_PROOF`. There is no
  operator-asserted variant to fall back to.
- The **adapter stamps it**, never the caller, and only after `verify()` has returned true.
- `TradeFinance._consumeAttestation` rejects anything else unconditionally —
  `if (a.proofKind != ProofKind.USC_PROOF) revert ProofRequired();` — with no flag that relaxes it.
- `setAttestationAdapter` refuses an adapter reporting any other proof kind, so the guarantee
  cannot be swapped out later.
- `UscAttestationAdapter.submitProof` is the **only** external function anywhere that creates an
  attestation; `_record` is `internal`.
- The UI reads proof kind back from the chain, so a misconfigured frontend cannot mislabel
  anything — it never decides.

`submitProof` is permissionless on purpose. Nothing depends on who submits, only on whether the
proof verifies, so a relayer, the buyer or a financier can all submit and none of them can submit
anything false.

### What is not yet proven end-to-end

`SdkFieldOffsetResolver` throws instead of returning the QueryBuilder offsets that step 4 reads.
Those come from `QueryBuilder.build()` in the gluwa usc-sdk, computed against the same
`abiEncode(tx, receipt)` buffer the proof covers, and they depend on the source chain's
`chainEncoding`. A wrong offset would bind a valid proof to the wrong bytes — the exact failure
step 4 exists to prevent — so the resolver fails loudly rather than guessing. Pin them with
`NEXT_PUBLIC_QUERY_OFFSET_*` once computed and `StaticFieldOffsetResolver` takes over; the rest of
the path is already wired.

---

## Deployment status

**NOT DEPLOYED.** No contract in this repository is deployed to Creditcoin testnet, devnet, or any
public network at this commit. The only deployments performed so far were to a local anvil node for
end-to-end verification, and `contracts/deployments/31337.json` is gitignored for that reason.

Once deployed, the script writes `contracts/deployments/<chainid>.json` and that file is committed.
The table below is filled in from it.

| Contract | Network | Address |
|---|---|---|
| TradeFinance | Creditcoin testnet (102031) | _not deployed_ |
| CollateralVault | Creditcoin testnet (102031) | _not deployed_ |
| TradeEscrow | Creditcoin testnet (102031) | _not deployed_ |
| RepaymentManager | Creditcoin testnet (102031) | _not deployed_ |
| UscAttestationAdapter | Creditcoin testnet (102031) | _not deployed_ |
| SettlementToken | Creditcoin testnet (102031) | _not deployed_ |
| TestnetFaucet | Creditcoin testnet (102031) | _not deployed_ |
| TradeEventEmitter | Ethereum Sepolia (11155111) | _not deployed_ |

---

## Architecture

```
Source chain (Sepolia)          Creditcoin
──────────────────────          ──────────────────────────────────────────
TradeEventEmitter
  ShipmentConfirmed  ──────►  attestor set attests the block
                                       │
      off-chain: proof API ────────────┤  Merkle proof + continuity proof
                                       ▼
                              UscAttestationAdapter
                                 ├─ ChainInfo 0x…0FD3   is_height_attested
                                 ├─ BlockProver 0x…0FD2 verify()
                                 └─ bind proven bytes → trade
                                       ▼
                              TradeFinance    FUNDED → SHIPPED
                                       ▼
                              CollateralVault · TradeEscrow · RepaymentManager
```

### Contracts (`contracts/src`)

| Contract | Responsibility |
|---|---|
| `TradeFinance.sol` | The state machine. Sole authorised caller of every money-moving module. |
| `CollateralVault.sol` | Buyer collateral. Three exits: released, seized, refunded. No owner withdrawal. |
| `TradeEscrow.sol` | Financier capital between commitment and disbursement. |
| `RepaymentManager.sol` | Obligation tracking. Overpayment is clamped, not refunded. |
| `UscAttestationAdapter.sol` | Proof verification + binding proven bytes to a trade. The only adapter. |
| `SettlementToken.sol` | ERC-20 the protocol settles in. Deploy only where no stablecoin exists. |
| `TradeEventEmitter.sol` | Deployed on the **source** chain. Origin of cross-chain events. |
| `TestnetFaucet.sol` | On-chain cooldown so the UI cannot show a request the chain would reject. |

Lifecycle: `APPLICATION → SUPPLIER_VERIFIED → COLLATERAL_LOCKED → FINANCING_APPROVED → FUNDED →
SHIPPED → DELIVERED → REPAYING → REPAID → COMPLETED`, plus `DEFAULTED` and `CANCELLED`.

### Frontend (`web/src`)

Next.js 15 App Router, React 19, TypeScript strict, Tailwind v4, wagmi + viem, Supabase.
No ethers anywhere.

```
lib/services/attestation/   the USC seam — proof fetch, verification, submission
lib/config/                 every address and endpoint, resolved once
lib/abi/                    generated from Foundry artifacts, never hand-written
hooks/                      chain reads (multicall) and write paths (simulate-then-sign)
components/                 design system + trade, attestation, shell
```

Writes to Supabase go through route handlers under `src/app/api` that verify a wallet signature
first; the anon key shipped to the browser is read-only by row level security.

---

## Running it

### Prerequisites

Node 20+, [Foundry](https://book.getfoundry.sh/getting-started/installation), and one funded key
with **both** Creditcoin testnet CTC and Sepolia ETH — the deploy touches two chains, and the
Sepolia leg must go first.

### 1. Contracts

```bash
cd contracts
./setup.sh                   # installs forge-std and OpenZeppelin into lib/
forge build --root .
forge test --root .          # 47 tests
```

`--root .` matters: `foundry.toml` lives in `contracts/`, but Foundry walks up to the git root
without it and fails to resolve remappings.

Deploy to Creditcoin testnet — two transactions on two different chains, in this order:

```bash
cp .env.example .env         # fill in PRIVATE_KEY, leave SOURCE_EMITTER blank for now
set -a && source .env && set +a

# 1. Source chain (Sepolia) first. Its address is the only emitter the adapter will trust,
#    so nothing on Creditcoin can be deployed correctly before it exists.
EXPECTED_CHAIN_ID=11155111 forge script script/Deploy.s.sol:DeployEmitter --root . \
  --rpc-url "$SOURCE_RPC_URL" --broadcast

# 2. Put the printed SOURCE_EMITTER into .env, re-source, then deploy to Creditcoin.
forge script script/Deploy.s.sol:Deploy --root . \
  --rpc-url "$CREDITCOIN_RPC_URL" --broadcast
```

Step 2 runs three preflight checks before creating a single contract, and aborts rather than
leaving a half-usable protocol on chain:

| Check | Aborts with | Catches |
|---|---|---|
| `block.chainid == EXPECTED_CHAIN_ID` | `WrongChain(expected, actual)` | a mistyped `--rpc-url` deploying onto a chain with no Creditcoin precompiles |
| ChainInfo precompile responds | `ChainInfoUnavailable(0x…0fD3)` | a chain that is not a Creditcoin USC network, where the protocol would be inert |
| `SOURCE_CHAIN_KEY` is tracked | `SourceChainNotSupported(key)` | the chainKey-is-not-chainId trap |
| `SOURCE_EMITTER` set | `SourceEmitterRequired()` | a protocol where no proof can ever bind to a trade |

The last two preflights are skipped on chain id 31337 only, where the precompiles do not exist by
definition. That skip relaxes a *deployment diagnostic* and nothing else: the proof requirement in
`TradeFinance` is unconditional on every chain, so a trade still cannot pass `FUNDED` on a local
node.

After deploying, the script asserts its own wiring — controllers bound, adapter installed, proof
kind `USC_PROOF`, all three topics registered, emitter trusted — and reverts with
`WiringFailed("what")` if any of it is wrong. A half-wired protocol is indistinguishable from a
working one until the first trade fails, which is too late to find out.

It then prints every address as a `NEXT_PUBLIC_*` line **and** writes
`contracts/deployments/<chainid>.json`. Paste the printed block straight into `web/.env.local`; the
JSON is the durable record, since Foundry's own `broadcast/` output is gitignored and console
output is gone as soon as the terminal scrolls.

Regenerate frontend ABIs after any Solidity change:

```bash
node script/export-abi.mjs
```

### 2. Database

Run `supabase/schema.sql` in the Supabase SQL editor, then set both the public Supabase variables
and the two server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`). Without them the
chain-backed views still work, but documents, messages and sign-in do not.

### 3. Frontend

```bash
cd web
cp .env.example .env.local   # paste deploy output
npm install
npm run dev                  # http://localhost:3000
```

### 4. Deploy to Vercel

Root directory `web`, framework Next.js, build `npm run build`. Add every `NEXT_PUBLIC_*` from
`.env.local` under Settings → Environment Variables. No secrets are involved — every value is
public by design.

---

## Walkthrough

1. **Faucet** — connect a wallet, request tUSD. Cooldown is enforced on-chain.
2. **Create Trade** — $50,000 solar panels, $10,000 collateral, 90 days, 8%. Prefill from the
   Solar Panels corridor.
3. **Verify supplier** — the off-chain KYB path (or prove a `SupplierVerified` event).
4. **Deposit collateral** — approve the *vault*, then lock. `COLLATERAL_LOCKED`.
5. **Financing page**, second wallet — commit $40,000. The modal states the uncovered exposure
   before anything is signed.
6. **Release funds** — escrow pays the supplier, repayment clock starts. `FUNDED`.
7. **Submit shipment event** — attestation recorded, trade advances to `SHIPPED`.
8. **Submit delivery event** — `DELIVERED`.
9. **Repay** — partially first (watch `REPAYING`), then in full. Overpayment is clamped.
10. **Close trade** — collateral returns to the buyer. `COMPLETED`.
11. **Credit Profile** — verified activity and the TImx risk assessment, side by side and
    deliberately not merged.
12. **Developer** — the flow, the live precompile reads, and every attestation with its true
    proof kind.

Steps 7 and 8 require the proof pipeline: a `TradeEventEmitter` transaction on the source chain,
an attested source height, and pinned QueryBuilder offsets. Without them the submission fails with
a specific reason rather than advancing the trade on trust.

---

## Security

Access control on every transition; enum state machine making invalid transitions unrepresentable;
`ReentrancyGuard` on all fund movement; `SafeERC20` throughout; balances zeroed before transfer;
double repayment prevented at two layers; collateral unreleasable before completion; replay
protection keyed on `(chainKey, sourceTxHash, logIndex)`; attestations consumable once; NatSpec on
every non-trivial function.

Never in the repo: private keys, service-role keys, or any secret. Everything the browser receives
is `NEXT_PUBLIC_*` and public by design.

---

## Known limitations

- **QueryBuilder offsets** are unimplemented by design (see above).
- **USC proving is untested against a live node** — the code targets the documented precompile
  interfaces and passes against mocks, but has not run on a real Creditcoin USC network.
- **Financing is all-or-nothing.** Syndication would change the default waterfall; out of scope.
- **Interest is simple and fixed** over the term. The `open`/`repay`/`outstanding` shape survives a
  richer model.
- **Documents and messages are session-state** in this build. The schema and hashing are real; the
  Supabase wiring is a hook swap.
- **Attestation log scans a bounded block window** (200k blocks) rather than full history.
