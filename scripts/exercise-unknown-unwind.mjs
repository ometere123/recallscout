import crypto from "node:crypto";
import { createAccount, createClient, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const address = process.env.NEXT_PUBLIC_RECALLSCOUT_ADDRESS ?? "0xf2efDB37BEDC1018a1A80083aF14Dd4114A526cb";
const sponsorAccount = createAccount(generatePrivateKey());
const scoutAccount = createAccount(generatePrivateKey());
const reviewerAccount = createAccount(generatePrivateKey());
const sponsor = createClient({ chain: studionet, account: sponsorAccount });
const scout = createClient({ chain: studionet, account: scoutAccount });
const reviewer = createClient({ chain: studionet, account: reviewerAccount });
const readClient = createClient({ chain: studionet, account: createAccount() });

const oneGen = 10n ** 18n;
const bond = 1n;

function hashFor(label) {
  return `sha256:${crypto.createHash("sha256").update(label).digest("hex")}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function wait(hash, label) {
  console.log(`${label}: ${hash}`);
  const receipt = await readClient.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, interval: 5000, retries: 120 });
  console.log(`${label} status: ${receipt.status_name ?? receipt.status}`);
}

async function write(client, label, functionName, args, value = 0n) {
  const hash = await client.writeContract({ address, functionName, args, value });
  await wait(hash, label);
  return hash;
}

async function latestId() {
  const count = Number(await readClient.readContract({ address, functionName: "get_watch_count", args: [] }));
  return await readClient.readContract({ address, functionName: "get_watch_id", args: [count - 1] });
}

async function readWatch(id) {
  return await readClient.readContract({ address, functionName: "get_watch", args: [id], jsonSafeReturn: true });
}

async function submit(id, round) {
  return write(scout, `submit unknown report ${round}`, "submit_report", [
    id,
    "https://www.cpsc.gov/Recalls",
    hashFor(`ambiguous CPSC index report ${round}`),
    "https://www.cpsc.gov/Data",
    "CPSC",
    "",
  ], bond);
}

console.log(`Contract: ${address}`);
console.log(`Sponsor: ${sponsorAccount.address}`);
console.log(`Scout: ${scoutAccount.address}`);
console.log(`Reviewer: ${reviewerAccount.address}`);

await write(sponsor, "create unknown unwind watch", "create_watch", [
  "Ambiguous recall index unwind",
  "Consumer product safety",
  "This watch intentionally submits broad index pages, not a specific recalled product, so consensus should remain UNKNOWN.",
  "CPSC recalls",
  "2026-08-30T12:00:00Z",
], oneGen);
const id = await latestId();

await submit(id, 1);
await write(reviewer, "verify unknown report 1", "verify_report", [id]);
console.log("after first unknown:", JSON.stringify(await readWatch(id), null, 2));

console.log("waiting 310 seconds for contract review cooldown...");
await sleep(310000);

await submit(id, 2);
await write(reviewer, "verify unknown report 2", "verify_report", [id]);
console.log("after second unknown:", JSON.stringify(await readWatch(id), null, 2));

console.log("waiting 310 seconds before bounded unwind...");
await sleep(310000);

await write(sponsor, "unwind unknown", "unwind_unknown", [id]);
console.log("after unwind:", JSON.stringify(await readWatch(id), null, 2));
