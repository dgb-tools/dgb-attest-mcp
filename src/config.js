// Configuration for the DigiByte attestation MCP server.
//
// Attesting writes a tiny OP_RETURN transaction, so it spends a transaction fee
// (a fraction of a DGB). Verification is read-only and free.

function req(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export const config = {
  rpcUrl: req("DGB_RPC_URL", "http://127.0.0.1:14026"),
  rpcUser: req("DGB_RPC_USER"),
  rpcPassword: req("DGB_RPC_PASSWORD"),
  // Wallet that pays the (tiny) attestation fees.
  walletName: req("DGB_WALLET", "mcp-sandbox"),
  rpcTimeoutMs: Number(req("DGB_RPC_TIMEOUT_MS", "20000")),

  // Attesting costs only a fee, but it still spends from a wallet — so testnet
  // by default. Set ATTEST_ALLOW_MAINNET=true to notarize on mainnet for real
  // (that's the actual long-term use: permanent public attestations).
  allowMainnet: req("ATTEST_ALLOW_MAINNET", "false") === "true",

  // Cap on attestations per 24h — an agent shouldn't be able to spam the chain
  // (or drain the wallet in fees) in a loop.
  maxDaily: Number(req("ATTEST_MAX_DAILY", "50")),
};
