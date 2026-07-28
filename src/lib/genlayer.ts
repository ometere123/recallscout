import { createAccount, createClient, generatePrivateKey } from "genlayer-js";
import { localnet, studionet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";
import type { Address } from "viem";
import type { CalldataEncodable, Network } from "genlayer-js/types";

export const CHAIN_NAME = process.env.NEXT_PUBLIC_GENLAYER_CHAIN ?? "studionet";

const CHAINS = {
  studionet,
  localnet,
  testnetAsimov,
  testnetBradbury,
} as const;

export const chain = CHAINS[CHAIN_NAME as keyof typeof CHAINS] ?? studionet;
export const contractAddress = (process.env.NEXT_PUBLIC_RECALLSCOUT_ADDRESS ??
  "0xeb93Bc26cd7fB3abf112a30509B1247c1B2b8b2c") as Address;
export const explorerBase = process.env.NEXT_PUBLIC_GENLAYER_EXPLORER ?? "https://explorer-studio.genlayer.com";

export function makeReadClient() {
  return createClient({ chain, account: createAccount() });
}

export function makeGeneratedWallet() {
  const privateKey = generatePrivateKey();
  return { privateKey, account: createAccount(privateKey) };
}

export function makeLocalWriteClient(privateKey: `0x${string}`) {
  return createClient({ chain, account: createAccount(privateKey) });
}

export async function makeInjectedWriteClient(address: Address) {
  const client = createClient({ chain, account: address });
  await client.connect(CHAIN_NAME as Network);
  return client;
}

export type WatchStatus = "OPEN" | "REPORTED" | "MATCHED" | "REJECTED" | "UNKNOWN" | "CANCELED" | "UNWOUND";

export type WatchRecord = {
  watch_id: string;
  sponsor: string;
  scout: string;
  title: string;
  category: string;
  criteria: string;
  source_hint: string;
  bounty: string;
  scout_bond: string;
  status: WatchStatus;
  product_url: string;
  product_hash: string;
  recall_url: string;
  source_name: string;
  corroborating_url: string;
  created_at: string;
  deadline_at: string;
  reported_at: string;
  decided_at: string;
  last_review_at: string;
  attempts: string;
  decision: string;
  confidence_band: string;
  reason: string;
  released_to: string;
};

export type ProfileRecord = {
  address: string;
  sponsored: string;
  reported: string;
  matched: string;
  rejected: string;
  unknown: string;
  recovered: string;
};

export const requiredContractFunctions = [
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
] as const;

export type { Address, CalldataEncodable };
