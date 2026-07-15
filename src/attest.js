// The attestation core: write a sha256 into an OP_RETURN output, read it back.
//
// On-chain format (36 bytes inside one OP_RETURN output):
//   'DGAT' (4 bytes, ascii tag)  +  sha256 digest (32 bytes)
//
// Well under the 80-byte OP_RETURN relay policy. The tag makes attestations
// findable/decodable without guessing.
//
// What an attestation proves — and what it doesn't:
//   PROVES: this exact content existed at (or before) the block's timestamp,
//           and hasn't changed since (any edit changes the hash).
//   DOES NOT PROVE: who created the content, or that the content is true.
//   For "who", pair with Digi-ID: attest, then sign the txid with your identity.

import { createHash } from "node:crypto";

export const TAG = "DGAT";
const TAG_HEX = Buffer.from(TAG, "ascii").toString("hex"); // 44474154

export const sha256hex = (content) =>
  createHash("sha256").update(content).digest("hex");

export function isSha256Hex(s) {
  return typeof s === "string" && /^[0-9a-fA-F]{64}$/.test(s);
}

// Build, fund, sign, and broadcast the attestation transaction.
export async function writeAttestation({ rpc, digestHex }) {
  const data = TAG_HEX + digestHex.toLowerCase();
  const raw = await rpc.node("createrawtransaction", [[], [{ data }]]);
  const funded = await rpc.wallet("fundrawtransaction", [raw]);
  const signed = await rpc.wallet("signrawtransactionwithwallet", [funded.hex]);
  if (!signed.complete) throw new Error("Wallet could not fully sign the attestation transaction.");
  const txid = await rpc.node("sendrawtransaction", [signed.hex]);
  return { txid, feePaid: funded.fee };
}

// Extract the DGAT digest from a transaction, if present.
export function extractAttestation(tx) {
  for (const vout of tx.vout ?? []) {
    const spk = vout.scriptPubKey ?? {};
    if (spk.type !== "nulldata" || typeof spk.hex !== "string") continue;
    // scriptPubKey: 6a (OP_RETURN) + one pushdata byte (0x24 = 36) + payload.
    // Tolerate OP_PUSHDATA1 (4c) as some builders emit it for >75-byte pushes.
    let payload = spk.hex.slice(2);
    if (payload.startsWith("4c")) payload = payload.slice(4);
    else payload = payload.slice(2);
    if (payload.slice(0, 8).toLowerCase() !== TAG_HEX) continue;
    const digest = payload.slice(8, 8 + 64).toLowerCase();
    if (digest.length === 64) return digest;
  }
  return null;
}

// Verify content (or a precomputed digest) against an attestation txid.
export async function verifyAttestation({ rpc, txid, digestHex }) {
  const tx = await rpc.node("getrawtransaction", [txid, true]);
  const onChain = extractAttestation(tx);
  if (!onChain) {
    return { attested: false, reason: "Transaction contains no DGAT attestation output." };
  }
  const matches = onChain === digestHex.toLowerCase();

  let blockTime = null;
  if (tx.blockhash) {
    blockTime = tx.blocktime ?? (await rpc.node("getblock", [tx.blockhash])).time;
  }

  return {
    attested: matches,
    reason: matches ? null : "Hash mismatch — the content is NOT what was attested (it differs or was altered).",
    onChainDigest: onChain,
    providedDigest: digestHex.toLowerCase(),
    confirmations: tx.confirmations ?? 0,
    blockTime,
    blockTimeIso: blockTime ? new Date(blockTime * 1000).toISOString() : null,
  };
}
