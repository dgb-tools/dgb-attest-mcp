# dgb-attest-mcp

**Timestamped commitments on DigiByte.** Record the SHA-256 hash of any content in
a DigiByte transaction — a tamper-evident, timestamped commitment that these exact
bytes existed no later than the block that included it. Check it later with nothing
but the chain.

An [MCP](https://modelcontextprotocol.io) server, so an AI agent can commit a hash of
its own outputs (or check someone else's) as naturally as it reads a file.

> As AI floods the world with generated content, "did these bytes exist before that
> date, and have they changed since?" stops being abstract. This is the simplest
> useful answer: a hash recorded in a public, decentralized chain.

## What a commitment establishes — and what it doesn't

- **Establishes:** these exact bytes existed no later than the block that included
  the transaction (block time is an inclusion bound, not a clock), and whether a copy
  you hold now matches them. Change one character and the hashes no longer match.
- **Does not establish:** *who* created the content, that it is *true*, or that it
  was the only version.
- **For "who,"** pair it with [dgb-digiid-mcp](https://github.com/dgb-tools/dgb-digiid-mcp):
  commit the content, then sign the commitment's txid with your Digi-ID key. That
  binds a key to the commitment; it does not establish legal identity or authorship.

This README says *commitment* and *timestamped*, not *proof*, *verified* or
*notarized*, on purpose: a hash in a block bounds when bytes existed. Nothing here
vouches for what they mean.

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

**Exercised on testnet:** committed a document, checked the exact text (`attested:
true`), and a one-character edit flipped it to `attested: false` with "the
content is NOT what was attested." Large files use the precomputed-hash path —
hash a 4 GB model locally, attest the digest.

## Quantum-resistant by construction

The commitment itself is a **SHA-256 hash**, and hash commitments are the part
of cryptography that quantum computing barely touches. Shor's algorithm breaks
the elliptic-curve signatures that secure wallets; against a hash, the best
known quantum attack (Grover's) merely halves the security margin — leaving
~128 bits, still far beyond reach. A commitment written today stays checkable
straight through the post-quantum transition: **the commitment outlives the
cryptography that signed the transaction.**

The honest asymmetry: the *signature* layer — the key that paid the transaction
fee, and the Digi-ID identity if you attached one — is classical ECC, the layer
the industry is now migrating to post-quantum algorithms. Your commitments never
need that migration. They were never signature-based to begin with.

## Tools

| Tool | What it does |
|------|--------------|
| `attest` | Hash `content` (or take a precomputed `sha256`) and write it on-chain. Returns the txid. Costs a small fee. |
| `verify` | Given a txid + content/hash, confirm the chain holds the matching hash, with block timestamp and confirmations. Free. |
| `decode_attestation` | Inspect any tx: if it carries a `DGAT` attestation, return the hash and timestamp. For reading attestations you didn't make. |

## Safety

- **Testnet by default.** Attesting spends a fee, so the server refuses to run
  against mainnet unless you set `ATTEST_ALLOW_MAINNET=true`. (Mainnet *is* the
  real use — public commitments that stay in the chain's history — so that opt-in
  is deliberate.)
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

- [dgb-digiid-mcp](https://github.com/dgb-tools/dgb-digiid-mcp) — identity: bind a Digi-ID key to a commitment.
- [dgb-chain-mcp](https://github.com/dgb-tools/dgb-chain-mcp) — read the chain.
- [dgb-digidollar-mcp](https://github.com/dgb-tools/dgb-digidollar-mcp) — pay in DigiDollar.

Independent community project. Not affiliated with the DigiByte Foundation. MIT licensed.
