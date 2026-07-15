// Minimal DigiByte Core JSON-RPC client (node + wallet endpoints).

import { config } from "./config.js";

let idCounter = 0;

async function call(endpoint, method, params) {
  const auth = Buffer.from(`${config.rpcUser}:${config.rpcPassword}`).toString("base64");
  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({ jsonrpc: "1.0", id: `attest-${++idCounter}`, method, params }),
      signal: AbortSignal.timeout(config.rpcTimeoutMs),
    });
  } catch (e) {
    throw new Error(`Cannot reach the DigiByte node at ${endpoint}: ${e.message}`);
  }
  const parsed = JSON.parse(await res.text());
  if (parsed.error) throw new Error(`RPC ${method}: ${parsed.error.message} (code ${parsed.error.code})`);
  return parsed.result;
}

export const rpc = {
  node: (method, params = []) => call(config.rpcUrl, method, params),
  wallet: (method, params = []) =>
    call(`${config.rpcUrl}/wallet/${encodeURIComponent(config.walletName)}`, method, params),
};
