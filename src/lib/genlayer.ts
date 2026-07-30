import { createAccount, createClient, generatePrivateKey } from "genlayer-js";
import { localnet, studionet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";
import type { Address } from "viem";
import type { CalldataEncodable } from "genlayer-js/types";

export const CHAIN_NAME = process.env.NEXT_PUBLIC_GENLAYER_CHAIN ?? "studionet";

const CHAINS = {
  studionet,
  localnet,
  testnetAsimov,
  testnetBradbury,
} as const;

export const chain = CHAINS[CHAIN_NAME as keyof typeof CHAINS] ?? studionet;
export const contractAddress = (process.env.NEXT_PUBLIC_RECALLSCOUT_ADDRESS ??
  "0x9434722c6E747E31e4e5BdFbcc458aF6b2DA8360") as Address;
export const explorerBase = process.env.NEXT_PUBLIC_GENLAYER_EXPLORER ?? "https://explorer-studio.genlayer.com";
export const rpcEndpoint = process.env.NEXT_PUBLIC_GENLAYER_RPC_ENDPOINT ?? "/api/genlayer-rpc";

export function makeReadClient() {
  return createClient({ chain, endpoint: rpcEndpoint, account: createAccount() });
}

export function makeGeneratedWallet() {
  const privateKey = generatePrivateKey();
  return { privateKey, account: createAccount(privateKey) };
}

export function makeLocalWriteClient(privateKey: `0x${string}`) {
  return createClient({ chain, endpoint: rpcEndpoint, account: createAccount(privateKey) });
}

type InjectedProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export function makeInjectedWriteClient(address: Address, provider: InjectedProvider) {
  return createClient({ chain, endpoint: rpcEndpoint, account: address, provider });
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
  active_attempt_id: string;
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
