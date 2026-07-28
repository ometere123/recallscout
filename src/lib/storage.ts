"use client";

import type { WatchRecord } from "./genlayer";

const WALLET_KEY = "recallscout.browserWallet.v1";
const ACK_KEY = "recallscout.browserWalletAck.v1";
const TX_KEY = "recallscout.transactions.v1";

export type TrackedTx = {
  hash: string;
  label: string;
  target?: string;
  submittedAt: string;
  desired: "ACCEPTED" | "FINALIZED";
  status: string;
};

export function loadPrivateKey() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(WALLET_KEY) as `0x${string}` | null;
}

export function savePrivateKey(value: `0x${string}`) {
  window.localStorage.setItem(WALLET_KEY, value);
}

export function clearPrivateKey() {
  window.localStorage.removeItem(WALLET_KEY);
}

export function hasAcknowledgedBrowserWallet() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ACK_KEY) === "yes";
}

export function acknowledgeBrowserWallet() {
  window.localStorage.setItem(ACK_KEY, "yes");
}

export function loadTransactions(): TrackedTx[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(TX_KEY) ?? "[]") as TrackedTx[];
  } catch {
    return [];
  }
}

export function saveTransactions(txs: TrackedTx[]) {
  window.localStorage.setItem(TX_KEY, JSON.stringify(txs.slice(0, 20)));
}

export function upsertTx(tx: TrackedTx) {
  const existing = loadTransactions().filter((item) => item.hash !== tx.hash);
  saveTransactions([tx, ...existing]);
}

export function updateTx(hash: string, patch: Partial<TrackedTx>) {
  saveTransactions(loadTransactions().map((tx) => (tx.hash === hash ? { ...tx, ...patch } : tx)));
}

export function sortWatches(records: WatchRecord[]) {
  return [...records].sort((a, b) => Number(b.watch_id.replace("RS-", "")) - Number(a.watch_id.replace("RS-", "")));
}
