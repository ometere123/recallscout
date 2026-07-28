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
const demoRecallUrl = "https://www.cpsc.gov/Recalls/2026/12-Drawer-Fabric-Dressers-Recalled-Due-to-Risk-of-Serious-Injury-or-Death-from-Tip-Over-and-Entrapment-Hazards-Violate-Mandatory-Standard-for-Clothing-Storage-Units-Sold-on-Amazon-by-Romorgniz";

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
  "Romorgniz 12-drawer fabric dresser recall",
  "Verify that the submitted evidence identifies Romorgniz 12-Drawer Fabric Dressers covered by an official CPSC recall for tip-over and entrapment hazards."
);
txs.push(["create sponsor-accepted watch", accepted]);
txs.push(["submit sponsor-accepted report", await write(scout, "submit sponsor-accepted report", "submit_report", [
  accepted,
  demoRecallUrl,
  hashFor("Romorgniz CPSC recall page as sponsor accepted evidence"),
  demoRecallUrl,
  "CPSC",
  "",
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
  "Romorgniz 12-drawer fabric dresser recall",
  "Verify that the submitted evidence identifies Romorgniz 12-Drawer Fabric Dressers covered by an official CPSC recall for tip-over and entrapment hazards."
);
txs.push(["create consensus recall watch", consensus]);
txs.push(["submit consensus report", await write(scout, "submit consensus report", "submit_report", [
  consensus,
  demoRecallUrl,
  hashFor("Romorgniz CPSC recall page submitted for RecallScout consensus"),
  demoRecallUrl,
  "CPSC",
  "",
], bond)]);
txs.push(["verify consensus report", await write(reviewer, "verify consensus report", "verify_report", [consensus])]);
console.log("consensus watch:", JSON.stringify(await readWatch(consensus), null, 2));

console.log("transactions:");
for (const [label, hashOrId] of txs) {
  console.log(`- ${label}: ${hashOrId}`);
}
