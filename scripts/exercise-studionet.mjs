import crypto from "node:crypto";
import { createAccount, createClient, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const address = process.env.NEXT_PUBLIC_RECALLSCOUT_ADDRESS ?? "0xeb93Bc26cd7fB3abf112a30509B1247c1B2b8b2c";
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

async function wait(hash, label, status = TransactionStatus.ACCEPTED) {
  console.log(`${label}: ${hash}`);
  const receipt = await readClient.waitForTransactionReceipt({ hash, status, interval: 5000, retries: 120 });
  console.log(`${label} status: ${receipt.status_name ?? receipt.status}`);
  return receipt;
}

async function write(client, label, functionName, args, value = 0n) {
  const hash = await client.writeContract({ address, functionName, args, value });
  await wait(hash, label);
  return hash;
}

async function count() {
  return Number(await readClient.readContract({ address, functionName: "get_watch_count", args: [] }));
}

async function latestId() {
  const current = await count();
  return await readClient.readContract({ address, functionName: "get_watch_id", args: [current - 1] });
}

async function readWatch(id) {
  return await readClient.readContract({ address, functionName: "get_watch", args: [id], jsonSafeReturn: true });
}

async function create(label, title, criteria, deadline = "2026-08-30T12:00:00Z") {
  await write(sponsor, label, "create_watch", [
    title,
    "Consumer product safety",
    criteria,
    "CPSC recalls",
    deadline,
  ], oneGen);
  return latestId();
}

console.log(`Contract: ${address}`);
console.log(`Sponsor: ${sponsorAccount.address}`);
console.log(`Scout: ${scoutAccount.address}`);
console.log(`Reviewer: ${reviewerAccount.address}`);

const txs = [];

const accepted = await create(
  "create sponsor-accepted watch",
  "CPSC dresser recall scout check",
  "A scout should submit public evidence related to a CPSC furniture recall."
);
txs.push(["create sponsor-accepted watch", accepted]);
txs.push(["submit sponsor-accepted report", await write(scout, "submit sponsor-accepted report", "submit_report", [
  accepted,
  "https://www.cpsc.gov/Recalls",
  hashFor("CPSC recalls page as sponsor accepted evidence"),
  "https://www.cpsc.gov/Recalls",
  "CPSC",
  "https://www.cpsc.gov/Data",
], bond)]);
txs.push(["sponsor accept", await write(sponsor, "sponsor accept", "sponsor_accept", [accepted])]);
console.log("accepted watch:", JSON.stringify(await readWatch(accepted), null, 2));

const canceled = await create(
  "create expired open watch",
  "Expired unreported recall watch",
  "This watch intentionally has a past deadline so cancellation can be exercised.",
  "2026-07-01T12:00:00Z"
);
txs.push(["create expired open watch", canceled]);
txs.push(["cancel expired open watch", await write(sponsor, "cancel expired open watch", "cancel_open_watch", [canceled])]);
console.log("canceled watch:", JSON.stringify(await readWatch(canceled), null, 2));

const consensus = await create(
  "create consensus recall watch",
  "Official recall page match",
  "The product evidence and official recall source should both describe product recalls or safety warnings from CPSC."
);
txs.push(["create consensus recall watch", consensus]);
txs.push(["submit consensus report", await write(scout, "submit consensus report", "submit_report", [
  consensus,
  "https://www.cpsc.gov/Recalls",
  hashFor("CPSC recalls page submitted for RecallScout consensus"),
  "https://www.cpsc.gov/Data",
  "CPSC",
  "https://www.cpsc.gov/Recalls",
], bond)]);
txs.push(["verify consensus report", await write(reviewer, "verify consensus report", "verify_report", [consensus])]);
console.log("consensus watch:", JSON.stringify(await readWatch(consensus), null, 2));

console.log("transactions:");
for (const [label, hashOrId] of txs) {
  console.log(`- ${label}: ${hashOrId}`);
}
