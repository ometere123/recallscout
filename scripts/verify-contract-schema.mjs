import { createAccount, createClient } from "genlayer-js";
import { studionet, localnet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";

const chainName = process.env.NEXT_PUBLIC_GENLAYER_CHAIN ?? "studionet";
const chains = { studionet, localnet, testnetAsimov, testnetBradbury };
const chain = chains[chainName] ?? studionet;
const address = process.env.NEXT_PUBLIC_RECALLSCOUT_ADDRESS ?? "0xeb93Bc26cd7fB3abf112a30509B1247c1B2b8b2c";

const required = [
  "get_watch_count",
  "get_watch_id",
  "get_watch",
  "get_watch_page",
  "get_party_watch_count",
  "get_party_watch_page",
  "get_profile",
  "create_watch",
  "submit_report",
  "verify_report",
  "sponsor_accept",
  "cancel_open_watch",
  "unwind_unknown",
];

if (!address || address === "0x0000000000000000000000000000000000000000") {
  console.error("NEXT_PUBLIC_RECALLSCOUT_ADDRESS is required.");
  process.exit(1);
}

const client = createClient({ chain, account: createAccount() });
const schema = await client.getContractSchema(address);
const rawMethods = schema.methods ?? {};
const methods = Array.isArray(rawMethods)
  ? new Set(rawMethods.map((method) => method.name))
  : new Set(Object.keys(rawMethods));
const missing = required.filter((name) => !methods.has(name));

if (missing.length) {
  console.error(`Missing contract methods: ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`Schema OK for ${address}. Verified ${required.length} frontend call sites.`);
