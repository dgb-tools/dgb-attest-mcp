# dgb-attest-mcp

**On-chain attestation for the AI era.** Hash any content onto the DigiByte
blockchain — a permanent, timestamped, tamper-evident proof that it existed, in
exactly that form, at that moment. Verify it anytime, with nothing but the chain.

An [MCP](https://modelcontextprotocol.io) server, so an AI agent can notarize its
own outputs (or check someone else's) as naturally as it reads a file.

> As AI floods the world with generated content, "can you prove where this came
> from, and that it hasn't been altered?" stops being abstract. This is the
> simplest useful answer: a hash on a public, decentralized, immutable ledger.

## What it proves — and what it doesn't

- **Proves:** this exact content existed at or before the block's timestamp, and
  has not changed since. Change one character and the hash — and the proof — no
  longer match.
- **Does not prove:** *who* created it, or that the content is *true*.
- **For "who,"** pair it with [dgb-digiid-mcp](https://github.com/dgb-tools/dgb-digiid-mcp):
  attest the content, then sign the attestation txid with your Digi-ID identity.
  Now you have *what*, *when*, and *who* — all on-chain, no central authority.

## How it works

Only a **sha256 hash** ever goes on-chain — never your content. The hash is
written into a single `OP_RETURN` output (36 bytes: a `DGAT` tag + the digest),
which is cheap, standard, and prunable. Your document, model, or dataset stays
entirely on your machine.

```
attest("my report")  ──sha256──▶  OP_RETURN(DGAT + hash)  ──▶  txid
                                                                  │
later: verify(txid, "my report")  ──▶  same hash? attested ✓  + block timestamp
       verify(txid, "my rep0rt")  ──▶  mismatch → NOT attested ✗
```

**Proven on testnet:** attested a document, verified the exact text (`attested:
true`), and a one-character edit flipped it to `attested: false` with "the
content is NOT what was attested." Large files use the precomputed-hash path —
hash a 4 GB model locally, attest the digest.

## Tools

| Tool | What it does |
|------|--------------|
| `attest` | Hash `content` (or take a precomputed `sha256`) and write it on-chain. Returns the txid. Costs a small fee. |
| `verify` | Given a txid + content/hash, confirm the chain holds the matching hash, with block timestamp and confirmations. Free. |
| `decode_attestation` | Inspect any tx: if it carries a `DGAT` attestation, return the hash and timestamp. For reading attestations you didn't make. |

## Safety

- **Testnet by default.** Attesting spends a fee, so the server refuses to run
  against mainnet unless you set `ATTEST_ALLOW_MAINNET=true`. (Mainnet *is* the
  real use — permanent public attestations — so that opt-in is deliberate.)
- **Daily cap** (`ATTEST_MAX_DAILY`, default 50) so an agent can't spam the chain
  or burn through fees in a loop.
- **Your content never leaves your machine** — only its hash.

## Setup

Needs a DigiByte node with a small balance to pay attestation fees.

```bash
npm install
cp .env.example .env    # RPC creds + fee wallet
```

Add to your MCP client (`npx dgb-attest-mcp`), env: `DGB_RPC_URL`, `DGB_RPC_USER`,
`DGB_RPC_PASSWORD`, `DGB_WALLET`.

## Related

- [dgb-digiid-mcp](https://github.com/dgb-tools/dgb-digiid-mcp) — identity: prove *who* attested.
- [dgb-chain-mcp](https://github.com/dgb-tools/dgb-chain-mcp) — read the chain.
- [dgb-digidollar-mcp](https://github.com/dgb-tools/dgb-digidollar-mcp) — pay in DigiDollar.

Independent community project. Not affiliated with the DigiByte Foundation. MIT licensed.
