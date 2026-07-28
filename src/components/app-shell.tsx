"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clipboard,
  ExternalLink,
  FileSearch,
  History,
  KeyRound,
  Loader2,
  PackageSearch,
  Plus,
  RefreshCw,
  ShieldCheck,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { TransactionStatus, type Hash } from "genlayer-js/types";
import {
  contractAddress,
  explorerBase,
  makeGeneratedWallet,
  makeInjectedWriteClient,
  makeLocalWriteClient,
  makeReadClient,
  type Address,
  type WatchRecord,
} from "@/lib/genlayer";
import {
  acknowledgeBrowserWallet,
  clearPrivateKey,
  hasAcknowledgedBrowserWallet,
  loadPrivateKey,
  loadTransactions,
  savePrivateKey,
  sortWatches,
  updateTx,
  upsertTx,
  type TrackedTx,
} from "@/lib/storage";
import { formatGen, formatUtc, localInputToUtc, parseGen, sha256Placeholder, shortAddress, toDeadlineLocalInput } from "@/lib/format";

type View = "overview" | "watches" | "sponsor" | "scout" | "review" | "history" | "watch" | "profile";

type Props = {
  view: View;
  watchId?: string;
  profileAddress?: string;
};

type WalletState = {
  ready: boolean;
  mode: "none" | "browser" | "injected";
  address?: Address;
  privateKey?: `0x${string}`;
  menuOpen: boolean;
  needsAck: boolean;
  importValue: string;
};

const zeroAddress = "0x0000000000000000000000000000000000000000";

const nav = [
  ["Overview", "/"],
  ["Watches", "/watches"],
  ["Sponsor", "/sponsor"],
  ["Scout Desk", "/scout"],
  ["Review", "/review"],
  ["History", "/history"],
] as const;

export function AppShell({ view, watchId, profileAddress }: Props) {
  const [wallet, setWallet] = useState<WalletState>({ ready: false, mode: "none", menuOpen: false, needsAck: false, importValue: "" });
  const [watches, setWatches] = useState<WatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [txs, setTxs] = useState<TrackedTx[]>([]);
  const [busy, setBusy] = useState("");

  const activeWatch = useMemo(() => watches.find((item) => item.watch_id.toLowerCase() === (watchId ?? "").toLowerCase()), [watches, watchId]);
  const activeAddress = wallet.address?.toLowerCase();

  const myWatches = useMemo(() => {
    if (!activeAddress) return [];
    return watches.filter((watch) => watch.sponsor.toLowerCase() === activeAddress || watch.scout.toLowerCase() === activeAddress);
  }, [activeAddress, watches]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (contractAddress === zeroAddress) {
        setWatches([]);
        setError("Contract address is not configured yet. Deploy the contract, then set NEXT_PUBLIC_RECALLSCOUT_ADDRESS.");
        return;
      }
      const client = makeReadClient();
      const count = BigInt(String(await client.readContract({ address: contractAddress, functionName: "get_watch_count", args: [] })));
      const page = (await client.readContract({
        address: contractAddress,
        functionName: "get_watch_page",
        args: [0n, count > 20n ? 20n : count],
      })) as WatchRecord[];
      setWatches(sortWatches(page ?? []));
    } catch (err) {
      setError(readableError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    window.setTimeout(() => {
      const stored = loadPrivateKey();
      if (stored) {
        const client = makeLocalWriteClient(stored);
        setWallet({ ready: true, mode: "browser", address: client.account?.address as Address, privateKey: stored, menuOpen: false, needsAck: false, importValue: "" });
      } else {
        setWallet((current) => ({ ...current, ready: true, needsAck: !hasAcknowledgedBrowserWallet() }));
      }
      setTxs(loadTransactions());
      void refresh();
    }, 0);
  }, [refresh]);

  async function getWriteClient() {
    if (!wallet.address) throw new Error("EXPECTED: connect a wallet before writing.");
    if (wallet.mode === "browser" && wallet.privateKey) return makeLocalWriteClient(wallet.privateKey);
    if (wallet.mode === "injected") return makeInjectedWriteClient(wallet.address);
    throw new Error("EXPECTED: wallet is not ready.");
  }

  async function trackWrite(label: string, target: string | undefined, write: () => Promise<Hash>) {
    setBusy(label);
    setError("");
    try {
      const hash = await write();
      const tx: TrackedTx = { hash, label, target, submittedAt: new Date().toISOString(), desired: "ACCEPTED", status: "PENDING" };
      upsertTx(tx);
      setTxs(loadTransactions());
      const client = makeReadClient();
      await client.waitForTransactionReceipt({ hash: hash as Hash, status: TransactionStatus.ACCEPTED, interval: 5000, retries: 90 });
      updateTx(hash, { status: "ACCEPTED" });
      setTxs(loadTransactions());
      void refresh();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy("");
    }
  }

  function useBrowserWallet() {
    acknowledgeBrowserWallet();
    const { privateKey, account } = makeGeneratedWallet();
    savePrivateKey(privateKey);
    setWallet({ ready: true, mode: "browser", address: account.address as Address, privateKey, menuOpen: false, needsAck: false, importValue: "" });
  }

  async function useInjectedWallet() {
    const ethereum = typeof window !== "undefined" ? window.ethereum : undefined;
    if (!ethereum) {
      setError("No injected wallet was detected in this browser.");
      return;
    }
    const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as Address[];
    const address = accounts[0];
    if (!address) {
      setError("The injected wallet did not return an account.");
      return;
    }
    setWallet({ ready: true, mode: "injected", address, menuOpen: false, needsAck: false, importValue: "" });
  }

  function importBrowserWallet() {
    const value = wallet.importValue.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
      setError("Paste a private key as 0x plus 64 hex characters.");
      return;
    }
    savePrivateKey(value as `0x${string}`);
    const client = makeLocalWriteClient(value as `0x${string}`);
    setWallet({ ready: true, mode: "browser", address: client.account?.address as Address, privateKey: value as `0x${string}`, menuOpen: false, needsAck: false, importValue: "" });
  }

  function disconnectWallet() {
    if (wallet.mode === "browser") clearPrivateKey();
    setWallet({ ready: true, mode: "none", menuOpen: false, needsAck: false, importValue: "" });
  }

  function exportWallet() {
    if (!wallet.privateKey) return;
    void navigator.clipboard.writeText(wallet.privateKey);
  }

  const common = { watches, loading, error, busy, wallet, activeAddress, refresh, getWriteClient, trackWrite };

  return (
    <div className="min-h-screen bg-[#fbfaf7] text-[#171512]">
      <header className="border-b border-[#ded8cd] bg-[#fffefd]">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-4">
          <Link href="/" className="flex items-center gap-2 text-xl font-black">
            <PackageSearch size={24} />
            RecallScout
          </Link>
          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {nav.map(([label, href]) => (
              <Link key={href} href={href} className={`rounded-md px-3 py-2 font-bold ${isActive(view, href) ? "bg-[#d7fff2] text-[#075f58]" : "text-[#5f574b] hover:bg-[#f0ece4]"}`}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="relative ml-auto">
            <button className="button-primary" onClick={() => setWallet((current) => ({ ...current, menuOpen: !current.menuOpen }))}>
              {wallet.address ? <Check size={18} /> : <Wallet size={18} />}
              {wallet.address ? shortAddress(wallet.address) : "Connect wallet"}
              <ChevronDown size={16} />
            </button>
            {wallet.menuOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-80 border border-[#ded8cd] bg-white p-3 shadow-lg">
                <p className="label">{wallet.mode === "browser" ? "Browser wallet" : wallet.mode === "injected" ? "Injected wallet" : "No wallet"}</p>
                <p className="mt-1 break-all font-mono text-sm">{wallet.address ?? "Connect to create, report, and verify watches."}</p>
                <div className="mt-3 grid gap-2">
                  <button className="button-secondary" onClick={useInjectedWallet}>
                    <ShieldCheck size={16} /> Use injected
                  </button>
                  <button className="button-secondary" onClick={useBrowserWallet}>
                    <KeyRound size={16} /> Use browser wallet
                  </button>
                  {wallet.privateKey ? (
                    <button className="button-secondary" onClick={exportWallet}>
                      <Clipboard size={16} /> Copy private key
                    </button>
                  ) : null}
                  <div className="flex gap-2">
                    <input className="field" value={wallet.importValue} placeholder="Import private key" onChange={(event) => setWallet((current) => ({ ...current, importValue: event.target.value }))} />
                    <button className="button-secondary" onClick={importBrowserWallet} aria-label="Import browser wallet">
                      <Upload size={16} />
                    </button>
                  </div>
                  {wallet.address ? (
                    <button className="button-secondary" onClick={disconnectWallet}>
                      <X size={16} /> Disconnect
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {wallet.needsAck ? (
        <section className="border-b border-amber-300 bg-amber-50 px-4 py-3">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-amber-950">
              Browser wallets are stored only in this browser. Clearing site data destroys the key. Use export if you need to keep it.
            </p>
            <button className="button-secondary" onClick={useBrowserWallet}>Create browser wallet</button>
          </div>
        </section>
      ) : null}

      <main className="mx-auto max-w-7xl px-4 py-8">
        <PendingTransactions txs={txs} />
        {error ? <ErrorBox message={error} /> : null}
        {view === "overview" ? <Overview {...common} /> : null}
        {view === "watches" ? <WatchesView {...common} /> : null}
        {view === "sponsor" ? <SponsorView {...common} /> : null}
        {view === "scout" ? <ScoutView {...common} /> : null}
        {view === "review" ? <ReviewView {...common} /> : null}
        {view === "history" ? <HistoryView watches={myWatches} loading={loading} refresh={refresh} /> : null}
        {view === "watch" ? <WatchDetail watch={activeWatch} {...common} /> : null}
        {view === "profile" ? <ProfileView address={profileAddress} watches={watches} /> : null}
      </main>
    </div>
  );
}

function isActive(view: View, href: string) {
  return (href === "/" && view === "overview") || href.includes(view);
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mb-4 flex items-start gap-3 border border-red-200 bg-red-50 p-4 text-red-950" role="alert">
      <AlertTriangle size={20} />
      <p>{message}</p>
    </div>
  );
}

function PendingTransactions({ txs }: { txs: TrackedTx[] }) {
  if (!txs.length) return null;
  return (
    <section className="panel mb-6 p-5">
      <h2 className="text-xl font-black">Transactions</h2>
      <div className="mt-3 grid gap-2">
        {txs.slice(0, 4).map((tx) => (
          <div key={tx.hash} className="flex items-center justify-between border border-[#eee7dc] p-3">
            <div>
              <p className="font-bold">{tx.label}</p>
              <p className="text-sm text-[#766d61]">{tx.status} · {formatUtc(tx.submittedAt)}</p>
            </div>
            <a className="button-secondary" href={`${explorerBase}/tx/${tx.hash}`} target="_blank" rel="noreferrer" aria-label="Open transaction">
              <ExternalLink size={16} />
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

function Overview({ watches, loading }: ShellBits) {
  const open = watches.filter((w) => w.status === "OPEN").length;
  const reported = watches.filter((w) => w.status === "REPORTED").length;
  const matched = watches.filter((w) => w.status === "MATCHED").length;
  return (
    <div className="grid gap-6">
      <section className="panel grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="label text-[#0f766e]">Public recall bounties</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-black leading-tight">Find dangerous recalled products before someone buys them.</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#4f473c]">
            Sponsors fund product safety watches. Scouts submit public product evidence and official recall sources. GenLayer validators fetch the pages and decide whether the product matches the recall.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="button-primary" href="/sponsor"><Plus size={18} /> Fund a watch</Link>
            <Link className="button-secondary" href="/scout"><FileSearch size={18} /> Submit evidence</Link>
          </div>
        </div>
        <div className="grid gap-3">
          <Metric label="Open bounties" value={loading ? "..." : String(open)} />
          <Metric label="Awaiting consensus" value={loading ? "..." : String(reported)} />
          <Metric label="Verified matches" value={loading ? "..." : String(matched)} />
        </div>
      </section>
      <WatchesList watches={watches.slice(0, 5)} loading={loading} empty="No recall watches yet. Fund the first one." />
    </div>
  );
}

type ShellBits = {
  watches: WatchRecord[];
  loading: boolean;
  error: string;
  busy: string;
  wallet: WalletState;
  activeAddress?: string;
  refresh: () => Promise<void>;
  getWriteClient: () => Promise<ReturnType<typeof makeReadClient>>;
  trackWrite: (label: string, target: string | undefined, write: () => Promise<Hash>) => Promise<void>;
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#eee7dc] bg-[#faf7f0] p-4">
      <p className="label">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function WatchesView({ watches, loading, refresh }: ShellBits) {
  return (
    <section className="panel p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="label">Public board</p>
          <h1 className="mt-2 text-4xl font-black">Recall watches</h1>
        </div>
        <button className="button-secondary" onClick={refresh}><RefreshCw size={16} /> Refresh</button>
      </div>
      <WatchesList watches={watches} loading={loading} empty="No watches have been created on this contract." />
    </section>
  );
}

function SponsorView({ busy, getWriteClient, trackWrite }: ShellBits) {
  const [form, setForm] = useState({
    title: "Romorgniz 12-drawer dresser recall",
    category: "Furniture / child safety",
    criteria: "Pay a scout who submits a live product listing that appears to match the official CPSC recall by brand, model, product line, or hazard description.",
    source: "CPSC recalls",
    deadline: toDeadlineLocalInput(),
    bounty: "1",
  });
  async function submit() {
    await trackWrite("Create recall watch", undefined, async () => {
      const client = await getWriteClient();
      return client.writeContract({
        address: contractAddress,
        functionName: "create_watch",
        args: [form.title, form.category, form.criteria, form.source, localInputToUtc(form.deadline)],
        value: parseGen(form.bounty),
      });
    });
  }
  return (
    <section className="panel p-6">
      <p className="label">Sponsor</p>
      <h1 className="mt-2 text-4xl font-black">Fund a recall watch</h1>
      <div className="mt-6 grid gap-4">
        <Input label="Title" value={form.title} onChange={(title) => setForm({ ...form, title })} />
        <Input label="Category" value={form.category} onChange={(category) => setForm({ ...form, category })} />
        <Textarea label="Match criteria" value={form.criteria} onChange={(criteria) => setForm({ ...form, criteria })} />
        <Input label="Official source hint" value={form.source} onChange={(source) => setForm({ ...form, source })} />
        <Input label="Deadline UTC" type="datetime-local" value={form.deadline} onChange={(deadline) => setForm({ ...form, deadline })} />
        <Input label="Bounty in GEN" value={form.bounty} onChange={(bounty) => setForm({ ...form, bounty })} />
        <button className="button-primary w-fit" onClick={submit} disabled={Boolean(busy)}>{busy ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />} Create funded watch</button>
      </div>
    </section>
  );
}

function ScoutView(props: ShellBits) {
  const open = props.watches.filter((w) => w.status === "OPEN" || w.status === "UNKNOWN");
  return (
    <section className="panel p-6">
      <p className="label">Scout desk</p>
      <h1 className="mt-2 text-4xl font-black">Submit recall evidence</h1>
      <WatchesList watches={open} loading={props.loading} empty="No open watches are ready for scouts." action={(watch) => <SubmitBox watch={watch} {...props} />} />
    </section>
  );
}

function SubmitBox({ watch, busy, getWriteClient, trackWrite }: ShellBits & { watch: WatchRecord }) {
  const [form, setForm] = useState({ productUrl: "https://www.amazon.com/", productHash: sha256Placeholder(), recallUrl: "https://www.cpsc.gov/Recalls", sourceName: "CPSC", corroboratingUrl: "" });
  async function submit() {
    await trackWrite("Submit recall report", watch.watch_id, async () => {
      const client = await getWriteClient();
      return client.writeContract({
        address: contractAddress,
        functionName: "submit_report",
        args: [watch.watch_id, form.productUrl, form.productHash, form.recallUrl, form.sourceName, form.corroboratingUrl],
        value: 1n,
      });
    });
  }
  return (
    <div className="mt-4 grid gap-3 border-t border-[#eee7dc] pt-4">
      <Input label="Product evidence URL" value={form.productUrl} onChange={(productUrl) => setForm({ ...form, productUrl })} />
      <Input label="Committed evidence hash" value={form.productHash} onChange={(productHash) => setForm({ ...form, productHash })} />
      <Input label="Official recall URL" value={form.recallUrl} onChange={(recallUrl) => setForm({ ...form, recallUrl })} />
      <Input label="Source name" value={form.sourceName} onChange={(sourceName) => setForm({ ...form, sourceName })} />
      <Input label="Corroborating URL" value={form.corroboratingUrl} onChange={(corroboratingUrl) => setForm({ ...form, corroboratingUrl })} />
      <button className="button-primary w-fit" disabled={Boolean(busy)} onClick={submit}>{busy ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />} Submit with bond</button>
    </div>
  );
}

function ReviewView(props: ShellBits) {
  const ready = props.watches.filter((w) => w.status === "REPORTED");
  const unknown = props.watches.filter((w) => w.status === "UNKNOWN");
  return (
    <section className="panel p-6">
      <p className="label">Permissionless review</p>
      <h1 className="mt-2 text-4xl font-black">Consensus queue</h1>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Metric label="Ready" value={String(ready.length)} />
        <Metric label="Unknown" value={String(unknown.length)} />
        <Metric label="Consensus round" value="1 fetch round" />
      </div>
      <WatchesList watches={[...ready, ...unknown]} loading={props.loading} empty="No submitted reports are waiting." action={(watch) => <ReviewActions watch={watch} {...props} />} />
    </section>
  );
}

function ReviewActions({ watch, busy, getWriteClient, trackWrite, activeAddress }: ShellBits & { watch: WatchRecord }) {
  const isSponsor = activeAddress && watch.sponsor.toLowerCase() === activeAddress;
  async function verify() {
    await trackWrite("Verify recall report", watch.watch_id, async () => {
      const client = await getWriteClient();
      return client.writeContract({ address: contractAddress, functionName: "verify_report", args: [watch.watch_id], value: 0n });
    });
  }
  async function accept() {
    await trackWrite("Sponsor accept", watch.watch_id, async () => {
      const client = await getWriteClient();
      return client.writeContract({ address: contractAddress, functionName: "sponsor_accept", args: [watch.watch_id], value: 0n });
    });
  }
  async function unwind() {
    await trackWrite("Unwind unknown", watch.watch_id, async () => {
      const client = await getWriteClient();
      return client.writeContract({ address: contractAddress, functionName: "unwind_unknown", args: [watch.watch_id], value: 0n });
    });
  }
  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-[#eee7dc] pt-4">
      <button className="button-primary" onClick={verify} disabled={Boolean(busy) || watch.status !== "REPORTED"}><ShieldCheck size={16} /> Verify</button>
      {isSponsor ? <button className="button-secondary" onClick={accept} disabled={Boolean(busy)}><Check size={16} /> Accept</button> : null}
      {isSponsor && watch.status === "UNKNOWN" ? <button className="button-secondary" onClick={unwind} disabled={Boolean(busy)}><History size={16} /> Unwind</button> : null}
    </div>
  );
}

function HistoryView({ watches, loading, refresh }: { watches: WatchRecord[]; loading: boolean; refresh: () => Promise<void> }) {
  return (
    <section className="panel p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black">Your watch history</h1>
        <button className="button-secondary" onClick={refresh}><RefreshCw size={16} /> Refresh</button>
      </div>
      <WatchesList watches={watches} loading={loading} empty="Connect the wallet used as sponsor or scout to see your history." />
    </section>
  );
}

function WatchDetail({ watch, loading, ...props }: ShellBits & { watch?: WatchRecord }) {
  if (loading) return <Skeleton />;
  if (!watch) return <section className="panel p-6"><h1 className="text-3xl font-black">Watch not found</h1></section>;
  return (
    <section className="panel p-6">
      <p className="label">{watch.watch_id}</p>
      <h1 className="mt-2 text-4xl font-black">{watch.title}</h1>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Metric label="Status" value={watch.status} />
        <Metric label="Bounty" value={formatGen(watch.bounty)} />
        <Metric label="Attempts" value={watch.attempts} />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Info label="Sponsor" value={watch.sponsor} href={`/profile/${watch.sponsor}`} />
        <Info label="Scout" value={watch.scout === zeroAddress ? "No scout yet" : watch.scout} href={watch.scout === zeroAddress ? undefined : `/profile/${watch.scout}`} />
        <Info label="Created" value={formatUtc(watch.created_at)} />
        <Info label="Deadline" value={formatUtc(watch.deadline_at)} />
        <Info label="Product URL" value={watch.product_url || "Not submitted"} external={watch.product_url} />
        <Info label="Recall URL" value={watch.recall_url || "Not submitted"} external={watch.recall_url} />
      </div>
      <div className="mt-6 border-t border-[#eee7dc] pt-5">
        <p className="label">Consensus reasoning</p>
        <p className="mt-2 text-lg">{watch.reason || "No consensus decision yet."}</p>
      </div>
      <ReviewActions watch={watch} loading={loading} {...props} />
    </section>
  );
}

function ProfileView({ address, watches }: { address?: string; watches: WatchRecord[] }) {
  const lower = address?.toLowerCase();
  const scoped = lower ? watches.filter((w) => w.sponsor.toLowerCase() === lower || w.scout.toLowerCase() === lower) : [];
  return (
    <section className="panel p-6">
      <p className="label">Profile</p>
      <h1 className="mt-2 break-all text-3xl font-black">{address}</h1>
      <WatchesList watches={scoped} loading={false} empty="No watches found for this address in the loaded page." />
    </section>
  );
}

function WatchesList({ watches, loading, empty, action }: { watches: WatchRecord[]; loading: boolean; empty: string; action?: (watch: WatchRecord) => React.ReactNode }) {
  if (loading) return <Skeleton />;
  if (!watches.length) return <div className="mt-6 border border-dashed border-[#d2cabd] p-6 text-[#5f574b]">{empty}</div>;
  return (
    <div className="mt-6 grid gap-3">
      {watches.map((watch) => (
        <article key={watch.watch_id} className="border border-[#eee7dc] bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <Link className="text-xl font-black hover:underline" href={`/watch/${watch.watch_id}`}>{watch.title}</Link>
              <p className="mt-1 text-[#5f574b]">{watch.watch_id} · {watch.category} · {formatGen(watch.bounty)}</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f574b]">{watch.criteria}</p>
            </div>
            <StatusBadge status={watch.status} />
          </div>
          {action ? action(watch) : null}
        </article>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "MATCHED" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : status === "UNKNOWN" ? "border-amber-200 bg-amber-50 text-amber-900" : status === "REJECTED" ? "border-red-200 bg-red-50 text-red-800" : "border-[#d2cabd] bg-[#faf7f0] text-[#4f473c]";
  return <span className={`inline-flex w-fit rounded-md border px-3 py-2 text-sm font-black ${tone}`}>{status}</span>;
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label><span className="label">{label}</span><input className="field mt-1" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="label">{label}</span><textarea className="field mt-1 min-h-32" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Info({ label, value, href, external }: { label: string; value: string; href?: string; external?: string }) {
  const body = <p className="mt-1 break-all font-mono text-sm">{value}</p>;
  return (
    <div className="border border-[#eee7dc] p-4">
      <p className="label">{label}</p>
      {href ? <Link className="text-[#0f766e] hover:underline" href={href}>{body}</Link> : external ? <a className="text-[#0f766e] hover:underline" href={external} target="_blank" rel="noreferrer">{body}</a> : body}
    </div>
  );
}

function Skeleton() {
  return <div className="mt-6 grid gap-3"><div className="h-24 animate-pulse bg-[#eee7dc]" /><div className="h-24 animate-pulse bg-[#eee7dc]" /></div>;
}

function readableError(err: unknown) {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("[EXPECTED]") || raw.includes("EXPECTED:")) return raw.replace("[EXPECTED]", "").replace("EXPECTED:", "").trim();
  if (raw.includes("[TRANSIENT]")) return "The external source was temporarily unavailable. Retry after a short wait.";
  if (raw.includes("[LLM_ERROR]")) return "The model returned unusable output. Retry the consensus transaction.";
  return raw;
}

declare global {
  interface Window {
    ethereum?: {
      request(args: { method: string; params?: unknown[] }): Promise<unknown>;
    };
  }
}
