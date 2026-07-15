#!/usr/bin/env node
// DigiByte attestation MCP server — permanent, timestamped proof of existence.
//
// An agent (or its human) hashes content onto the DigiByte chain. Later, anyone
// can verify: same content → same hash → attested at that block time; any
// alteration → mismatch. Proof of existence and integrity, not authorship —
// pair with dgb-digiid-mcp to also prove WHO attested.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { rpc } from "./rpc.js";
import { config } from "./config.js";
import { sha256hex, isSha256Hex, writeAttestation, verifyAttestation, extractAttestation } from "./attest.js";

const server = new McpServer({ name: "dgb-attest-mcp", version: "0.1.0" });
const text = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] });

let chainChecked = false;
async function assertChainAllowed() {
  if (chainChecked) return;
  const info = await rpc.node("getblockchaininfo");
  if (info.chain !== "test" && !config.allowMainnet) {
    throw new Error(
      `REFUSING TO RUN: node reports chain='${info.chain}'. Attesting spends a fee, so this ` +
        `server is testnet-only unless you explicitly set ATTEST_ALLOW_MAINNET=true.`
    );
  }
  chainChecked = true;
}

// Simple daily counter so an agent can't spam attestations in a loop.
const log = [];
function checkDailyCap() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = log.filter((t) => t >= cutoff).length;
  if (recent >= config.maxDaily) {
    throw new Error(`Daily attestation cap reached (${config.maxDaily}/24h). Blocked by policy.`);
  }
}

// --- attest ---------------------------------------------------------------
server.tool(
  "attest",
  "Write a permanent, timestamped attestation of content onto the DigiByte chain. " +
    "Pass either `content` (text — hashed with sha256 here; the content itself never " +
    "goes on-chain or leaves this machine) or `sha256` (a precomputed digest of a " +
    "file). Returns the attestation txid. Costs a tiny transaction fee.",
  {
    content: z.string().optional().describe("Raw text to attest. Hashed locally; only the hash goes on-chain."),
    sha256: z.string().optional().describe("Alternatively: a precomputed sha256 hex digest (64 hex chars)."),
    label: z.string().optional().describe("Optional local note for your records (not written on-chain)."),
  },
  async ({ content, sha256, label }) => {
    await assertChainAllowed();
    checkDailyCap();

    let digest;
    if (content !== undefined && content !== "") digest = sha256hex(content);
    else if (isSha256Hex(sha256)) digest = sha256.toLowerCase();
    else throw new Error("Provide either `content` (non-empty text) or `sha256` (64 hex chars).");

    const { txid, feePaid } = await writeAttestation({ rpc, digestHex: digest });
    log.push(Date.now());

    return text({
      attested: true,
      sha256: digest,
      txid,
      feePaidDgb: Math.abs(feePaid),
      label: label ?? null,
      note: "Keep the txid with the content. Anyone can verify the pair later — no account, no service, just the chain.",
    });
  }
);

// --- verify ---------------------------------------------------------------
server.tool(
  "verify",
  "Verify content against an attestation: given the txid and the content (or its " +
    "sha256), confirm the chain holds the matching hash, and report when it was " +
    "attested and how deeply confirmed it is. Read-only, free.",
  {
    txid: z.string().describe("The attestation transaction id."),
    content: z.string().optional().describe("The content to check (hashed locally)."),
    sha256: z.string().optional().describe("Alternatively: the sha256 digest to check."),
  },
  async ({ txid, content, sha256 }) => {
    let digest;
    if (content !== undefined && content !== "") digest = sha256hex(content);
    else if (isSha256Hex(sha256)) digest = sha256.toLowerCase();
    else throw new Error("Provide either `content` or `sha256` to verify against the chain.");

    const result = await verifyAttestation({ rpc, txid, digestHex: digest });
    return text({ txid, ...result });
  }
);

// --- decode ---------------------------------------------------------------
server.tool(
  "decode_attestation",
  "Inspect any transaction: if it carries a DGAT attestation, return the attested " +
    "sha256 and block timestamp. Useful for reading attestations you didn't create.",
  { txid: z.string().describe("Transaction id to inspect.") },
  async ({ txid }) => {
    const tx = await rpc.node("getrawtransaction", [txid, true]);
    const digest = extractAttestation(tx);
    return text({
      txid,
      hasAttestation: digest !== null,
      sha256: digest,
      confirmations: tx.confirmations ?? 0,
      blockTimeIso: tx.blocktime ? new Date(tx.blocktime * 1000).toISOString() : null,
    });
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("dgb-attest-mcp — on-chain attestation — running on stdio.");
