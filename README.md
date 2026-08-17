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
| Trade lifecycle state machine | **Real.** 12-state enum, invalid transitions revert. 49 passing tests. |
| Collateral, escrow, repayment, default | **Real.** SafeERC20, ReentrancyGuard, controller-gated. |
| Faucet, token, credit record | **Real** on-chain contracts. |
| USC proof verification (`UscAttestationAdapter`) | **Real code** against the real precompile interfaces, tested against mocks. Not yet exercised against a live Creditcoin node. |
| QueryBuilder field offsets | **Deliberately unimplemented.** See below. |
| Demo attestations | **Real transactions**, but nothing is proven — and every one is stamped `DEMO_OPERATOR` on-chain. |

### The honesty mechanism

The rule "do not pretend an API request is an Attestcoin proof" is enforced by the contracts, not
by discipline:

- `TradeTypes.ProofKind` has exactly two non-null values: `USC_PROOF` and `DEMO_OPERATOR`.
- The **adapter stamps it**, not the caller. `DemoAttestationAdapter` can only ever write
  `DEMO_OPERATOR`; `UscAttestationAdapter` only writes `USC_PROOF`, and only after
  `INativeQueryVerifier.verify` returns true.
- `TradeFinance.requireProofBacked` — when set, a demo attestation is **rejected on-chain**. A
  production deployment turns this on and the demo path becomes inert.
- The UI reads proof kind **back from the chain** after every attestation. A misconfigured frontend
  cannot label an unproven record as verified, because it never decides.

Demo records are labelled *"Unverified — demo assertion"* everywhere they appear. Never "pending",
never "verified".

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
| `UscAttestationAdapter.sol` | Proof verification + binding proven bytes to a trade. |
| `DemoAttestationAdapter.sol` | Operator assertions. Testnet only. Stamps `DEMO_OPERATOR`. |
| `TradeEventEmitter.sol` | Deployed on the **source** chain. Origin of cross-chain events. |
| `TestnetFaucet.sol` | On-chain cooldown so the UI cannot show a request the chain would reject. |

Lifecycle: `APPLICATION → SUPPLIER_VERIFIED → COLLATERAL_LOCKED → FINANCING_APPROVED → FUNDED →
SHIPPED → DELIVERED → REPAYING → REPAID → COMPLETED`, plus `DEFAULTED` and `CANCELLED`.

### Frontend (`web/src`)

Next.js 15 App Router, React 19, TypeScript strict, Tailwind v4, wagmi + viem, Supabase.
No ethers anywhere.

```
lib/services/attestation/   the USC seam — one interface, two implementations
lib/config/                 every address and endpoint, resolved once
lib/abi/                    generated from Foundry artifacts, never hand-written
hooks/                      chain reads (multicall) and write paths (simulate-then-sign)
components/                 design system + trade, attestation, shell
```

Three separately-labelled data origins, never blended: **on-chain**, **unverified assertion**,
**demo data**.

---

## Running it

### Prerequisites

Node 20+, [Foundry](https://book.getfoundry.sh/getting-started/installation), a wallet with
Creditcoin testnet CTC for gas.

### 1. Contracts

```bash
cd contracts
./setup.sh                   # installs forge-std and OpenZeppelin into lib/
forge build --root .
forge test --root .          # 49 tests
```

`--root .` matters: `foundry.toml` lives in `contracts/`, but Foundry walks up to the git root
without it and fails to resolve remappings.

Deploy:

```bash
cp .env.example .env         # fill in PRIVATE_KEY
set -a && source .env && set +a

# Source chain first — this address is what the adapters trust.
forge script script/Deploy.s.sol:DeployEmitter --root . \
  --rpc-url "$SOURCE_RPC_URL" --broadcast

# Then Creditcoin, with SOURCE_EMITTER set from the previous step.
forge script script/Deploy.s.sol:Deploy --root . \
  --rpc-url "$CREDITCOIN_RPC_URL" --broadcast
```

The script prints every address as a `NEXT_PUBLIC_*` line — paste straight into `web/.env.local`.

Regenerate frontend ABIs after any Solidity change:

```bash
node script/export-abi.mjs
```

### 2. Database (optional)

Run `supabase/schema.sql` in the Supabase SQL editor. The app runs on-chain-only without it —
trade titles degrade to `Trade #n`, nothing else changes.

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

## Demo script

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

Switching from demo to proving: set `NEXT_PUBLIC_ATTESTATION_MODE=usc`, pin the QueryBuilder
offsets, then call `setAttestationAdapter(uscAdapter)` and `setRequireProofBacked(true)`. No
redeploy, no trade-state migration.

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
