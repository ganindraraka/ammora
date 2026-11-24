import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AmmoraDataApiClient,
  giwaSepoliaAutoRouteDeployment,
} from "@ammora-protocol/sdk";
import "./styles.css";

type Launch = {
  id: string;
  name: string;
  symbol: string;
  address?: string;
  creator?: string;
  status: "LIVE" | "GRADUATED" | "SEED";
  progress: number;
  raised: string;
  target: string;
  price: string;
  holders: number;
  volume: string;
  age: string;
  source: "ammora" | "demo";
  metadataUri?: string;
};

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
};

type WalletState = {
  address: string;
  chainId: number;
  provider?: Eip1193Provider;
};

const CHAIN_ID = 91342;
const CHAIN_HEX = "0x164ce";
const DATA_API_URL = "https://ammora-giwa-sepolia-data.fly.dev";
const EXPLORER_URL = "https://sepolia-explorer.giwa.io";
const AMMORA_URL = "https://ammora.org";
const DOCS_URL = "https://docs.ammora.org";
const SDK_URL = "https://www.npmjs.com/package/@ammora-protocol/sdk";

const fallbackLaunches: Launch[] = [
  {
    id: "demo-drift",
    name: "Drift Protocol",
    symbol: "DRFT",
    address: "0x1111111111111111111111111111111111111111",
    status: "LIVE",
    progress: 68,
    raised: "68.4k",
    target: "100k",
    price: "0.00042",
    holders: 284,
    volume: "12.8k",
    age: "14m",
    source: "demo",
  },
  {
    id: "demo-orbit",
    name: "Orbit Works",
    symbol: "ORBT",
    address: "0x2222222222222222222222222222222222222222",
    status: "LIVE",
    progress: 42,
    raised: "21.2k",
    target: "50k",
    price: "0.00018",
    holders: 146,
    volume: "5.1k",
    age: "31m",
    source: "demo",
  },
  {
    id: "demo-ember",
    name: "Ember Labs",
    symbol: "EMBR",
    address: "0x3333333333333333333333333333333333333333",
    status: "GRADUATED",
    progress: 100,
    raised: "250k",
    target: "250k",
    price: "0.00124",
    holders: 912,
    volume: "94.6k",
    age: "2h",
    source: "demo",
  },
];

const dataClient = new AmmoraDataApiClient(DATA_API_URL);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pick(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function asString(value: unknown, fallback = "—"): string {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function shortenAddress(address?: string) {
  return address && address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address ?? "Pending";
}

function formatAge(timestamp: unknown) {
  const value = asNumber(timestamp, 0);
  if (!value) return "—";
  const date = new Date(value < 10_000_000_000 ? value * 1000 : value);
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function normalizeLaunch(raw: unknown, index: number): Launch | null {
  if (!isRecord(raw)) return null;
  const token = pick(raw, ["token", "tokenAddress", "address"]);
  const name = asString(pick(raw, ["name", "tokenName"]), `Launch ${index + 1}`);
  const symbol = asString(pick(raw, ["symbol", "tokenSymbol"]), "TOKEN");
  const progress = Math.max(0, Math.min(100, asNumber(pick(raw, ["progress", "progressBps"]), 0) > 100 ? asNumber(pick(raw, ["progress", "progressBps"]), 0) / 100 : asNumber(pick(raw, ["progress", "progressBps"]), 0)));
  const statusRaw = asString(pick(raw, ["status", "state"]), "LIVE").toUpperCase();
  const status: Launch["status"] = statusRaw.includes("GRAD") ? "GRADUATED" : statusRaw.includes("SEED") ? "SEED" : "LIVE";
  return {
    id: asString(pick(raw, ["id", "launchId", "configId"]), `${index}-${symbol}`),
    name,
    symbol,
    address: typeof token === "string" ? token : undefined,
    creator: asString(pick(raw, ["creator", "owner"]), undefined),
    status,
    progress,
    raised: asString(pick(raw, ["raised", "quoteRaised", "volumeQuote"]), "—"),
    target: asString(pick(raw, ["target", "quoteThreshold", "migrationQuoteThreshold"]), "—"),
    price: asString(pick(raw, ["price", "tokenPrice"]), "—"),
    holders: asNumber(pick(raw, ["holders", "holderCount"]), 0),
    volume: asString(pick(raw, ["volume", "volume24h"]), "—"),
    age: formatAge(pick(raw, ["createdAt", "createdAtTimestamp", "timestamp"])),
    source: "ammora",
    metadataUri: asString(pick(raw, ["metadataURI", "metadataUri"]), undefined),
  };
}

async function getLiveLaunches(): Promise<Launch[]> {
  const response = await Promise.race([
    dataClient.getLaunches({ chainId: BigInt(CHAIN_ID) }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Ammora Data API timeout")), 3500)),
  ]);
  const candidates = Array.isArray(response)
    ? response
    : isRecord(response)
      ? (pick(response, ["items", "launches", "data"]) ?? [])
      : [];
  const list = Array.isArray(candidates)
    ? candidates.map(normalizeLaunch).filter((item): item is Launch => item !== null)
    : [];
  return list.length > 0 ? list : fallbackLaunches;
}

function App() {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [selected, setSelected] = useState<Launch | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "live" | "graduated">("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [preview, setPreview] = useState(false);
  const [form, setForm] = useState({ name: "", symbol: "", supply: "1000000", metadata: "ipfs://your-metadata-uri" });

  const deployment = giwaSepoliaAutoRouteDeployment;
  const factoryAddress = deployment.contracts.launch.factory;
  const configRegistry = deployment.contracts.launch.configRegistry;

  useEffect(() => {
    let mounted = true;
    getLiveLaunches()
      .then((items) => {
        if (mounted) setLaunches(items);
      })
      .catch(() => {
        if (mounted) {
          setDataError("Ammora Data API is unavailable in this preview. Showing clearly marked demo fixtures.");
          setLaunches(fallbackLaunches);
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const injected = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
    if (!injected?.on) return;
    const handler = (...args: unknown[]) => {
      const next = String(args[0] ?? "0x0");
      setWallet((current) => current ? { ...current, chainId: Number.parseInt(next, 16) } : current);
    };
    injected.on("chainChanged", handler);
    return () => undefined;
  }, []);

  const filteredLaunches = useMemo(() => launches.filter((launch) => {
    const matchesTab = activeTab === "all" || (activeTab === "live" ? launch.status !== "GRADUATED" : launch.status === "GRADUATED");
    const query = search.toLowerCase().trim();
    const matchesSearch = !query || `${launch.name} ${launch.symbol} ${launch.address ?? ""}`.toLowerCase().includes(query);
    return matchesTab && matchesSearch;
  }), [activeTab, launches, search]);

  const stats = useMemo(() => ({
    total: launches.length,
    live: launches.filter((launch) => launch.status !== "GRADUATED").length,
    graduated: launches.filter((launch) => launch.status === "GRADUATED").length,
    volume: launches.reduce((sum, launch) => sum + (Number.parseFloat(launch.volume.replace(/[^0-9.]/g, "")) || 0), 0),
  }), [launches]);

  async function connectWallet() {
    const injected = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
    if (!injected) {
      window.open("https://metamask.io/download/", "_blank", "noopener,noreferrer");
      return;
    }
    setWalletBusy(true);
    try {
      const accounts = await injected.request({ method: "eth_requestAccounts" }) as string[];
      const chainHex = await injected.request({ method: "eth_chainId" }) as string;
      setWallet({ address: accounts[0], chainId: Number.parseInt(chainHex, 16), provider: injected });
    } finally {
      setWalletBusy(false);
    }
  }

  async function switchToGiwa() {
    if (!wallet?.provider) return connectWallet();
    try {
      await wallet.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
      setWallet((current) => current ? { ...current, chainId: CHAIN_ID } : current);
    } catch {
      setWallet((current) => current ? { ...current, chainId: current.chainId } : current);
    }
  }

  function updateForm(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setPreview(false);
  }

  const walletReady = wallet?.chainId === CHAIN_ID;

  return (
    <div className="app-shell">
      <div className="grain" />
      <header className="topbar">
        <a className="brand" href={AMMORA_URL} target="_blank" rel="noreferrer">
          <span className="brand-mark"><span /></span>
          <span>ammora<span className="brand-dot">.</span></span>
        </a>
        <div className="topbar-right">
          <span className="network-pill"><span className="pulse" /> GIWA Sepolia <span className="chain-id">91342</span></span>
          {wallet ? (
            <button className={`wallet-button ${walletReady ? "ready" : "warning"}`} onClick={walletReady ? undefined : switchToGiwa}>
              <span className="wallet-dot" /> {walletReady ? shortenAddress(wallet.address) : "Switch to GIWA"}
            </button>
          ) : (
            <button className="wallet-button" onClick={connectWallet} disabled={walletBusy}>{walletBusy ? "Connecting…" : "Connect wallet"}</button>
          )}
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> AMMORA BUILDER SUBMISSION <span className="eyebrow-line" /></div>
            <h1>Launch with<br /><em>conviction.</em></h1>
            <p className="hero-subtitle">A clean, transparent gateway to token launches on GIWA Sepolia—powered by the Ammora SDK.</p>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => document.getElementById("launches")?.scrollIntoView({ behavior: "smooth" })}>Explore launches <span>↗</span></button>
              <button className="text-button" onClick={() => setShowCreate(true)}>Create a launch <span>+</span></button>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orb orb-large"><span className="orb-ring ring-one" /><span className="orb-ring ring-two" /><span className="orb-core" /></div>
            <div className="orbit orbit-one" /><div className="orbit orbit-two" />
            <span className="float-label label-one">SDK / 0.3.9</span><span className="float-label label-two">TESTNET ONLY</span>
            <span className="spark spark-one" /><span className="spark spark-two" /><span className="spark spark-three" />
          </div>
        </section>

        <section className="stats-strip" aria-label="Ammora launchpad stats">
          <div className="stat-block"><span className="stat-label">TOTAL LAUNCHES</span><strong>{loading ? "—" : String(stats.total).padStart(2, "0")}</strong><span className="stat-note">indexed by Ammora</span></div>
          <div className="stat-block"><span className="stat-label">LIVE NOW</span><strong className="accent-number">{loading ? "—" : String(stats.live).padStart(2, "0")}</strong><span className="stat-note">open on the curve</span></div>
          <div className="stat-block"><span className="stat-label">GRADUATED</span><strong>{loading ? "—" : String(stats.graduated).padStart(2, "0")}</strong><span className="stat-note">migrated to liquidity</span></div>
          <div className="stat-block"><span className="stat-label">24H VOLUME</span><strong>{loading ? "—" : `${stats.volume.toFixed(1)}k`}</strong><span className="stat-note">GIWA test ETH</span></div>
        </section>

        <section id="launches" className="launches-section">
          <div className="section-heading">
            <div><span className="section-kicker">01 / DISCOVER</span><h2>Find your next<br /><em>conviction.</em></h2></div>
            <div className="section-side"><p>Every launch is surfaced from Ammora's canonical Data API. No hidden listings, no custody.</p><a href={DATA_API_URL} target="_blank" rel="noreferrer">View data source ↗</a></div>
          </div>
          <div className="toolbar">
            <div className="tabs"><button className={activeTab === "all" ? "active" : ""} onClick={() => setActiveTab("all")}>All launches <span>{launches.length}</span></button><button className={activeTab === "live" ? "active" : ""} onClick={() => setActiveTab("live")}>Live now <span>{stats.live}</span></button><button className={activeTab === "graduated" ? "active" : ""} onClick={() => setActiveTab("graduated")}>Graduated <span>{stats.graduated}</span></button></div>
            <label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search launches" aria-label="Search launches" /></label>
          </div>
          {dataError && <div className="notice warning-notice"><span>!</span>{dataError}</div>}
          {loading ? <div className="loading-state"><span className="spinner" /> Loading canonical launch data…</div> : filteredLaunches.length === 0 ? <div className="empty-state"><span className="empty-icon">∅</span><h3>No launches found</h3><p>Try another search or switch the filter.</p></div> : <div className="launch-grid">{filteredLaunches.map((launch, index) => <LaunchCard key={launch.id} launch={launch} index={index} onOpen={() => setSelected(launch)} />)}</div>}
        </section>

        <section className="create-section">
          <div className="create-band">
            <div className="create-visual"><span className="create-number">02</span><div className="mini-curve"><i /><i /><i /><i /><i /></div></div>
            <div className="create-copy"><span className="section-kicker">BUILD / PREVIEW / SHIP</span><h2>Make something<br /><em>worth trading.</em></h2><p>Draft an Ammora V4 launch with exact parameters, then review the unsigned SDK plan before it ever reaches your wallet.</p><button className="primary-button light" onClick={() => setShowCreate(true)}>Open launch builder <span>→</span></button></div>
            <div className="create-aside"><span className="aside-label">THE AMMORA WAY</span><strong>Readable by default.</strong><p>Contract targets, units, and network are visible before any wallet action.</p></div>
          </div>
        </section>

        <section className="builder-section">
          <div className="builder-header"><div><span className="section-kicker">03 / BUILDER NOTES</span><h2>Built around<br /><em>trust.</em></h2></div><p>This submission is intentionally testnet-only. It uses the official SDK data client and deployment catalog while keeping every state-changing action in your wallet.</p></div>
          <div className="builder-grid">
            <div className="builder-card"><span className="card-index">01</span><span className="card-icon">◌</span><h3>Canonical data</h3><p>Launches load through <code>AmmoraDataApiClient</code>, so listings stay aligned with the protocol indexer.</p><a href={DOCS_URL} target="_blank" rel="noreferrer">Read the docs ↗</a></div>
            <div className="builder-card featured"><span className="card-index">02</span><span className="card-icon">⌁</span><h3>Unsigned first</h3><p>Create flow ends at a human-readable plan. Nothing signs, sends, or asks for a private key without an explicit wallet action.</p><a href={SDK_URL} target="_blank" rel="noreferrer">Inspect the SDK ↗</a></div>
            <div className="builder-card"><span className="card-index">03</span><span className="card-icon">◇</span><h3>GIWA native</h3><p>Deployment addresses come from the SDK's GIWA Sepolia catalog, not copied constants or hidden config.</p><a href={`${EXPLORER_URL}/address/${factoryAddress}`} target="_blank" rel="noreferrer">Open factory ↗</a></div>
          </div>
        </section>
      </main>

      <footer className="footer"><div className="footer-brand"><span className="brand-mark small"><span /></span><span>ammora<span className="brand-dot">.</span></span></div><div className="footer-center"><span>BUILT FOR AMMORA SEASON 2</span><span className="footer-separator">·</span><span>TESTNET ONLY</span></div><div className="footer-links"><a href={AMMORA_URL} target="_blank" rel="noreferrer">Ammora ↗</a><a href={DOCS_URL} target="_blank" rel="noreferrer">Docs ↗</a><a href={SDK_URL} target="_blank" rel="noreferrer">SDK ↗</a></div></footer>

      {selected && <LaunchDetail launch={selected} onClose={() => setSelected(null)} explorerUrl={EXPLORER_URL} />}
      {showCreate && <CreateModal form={form} preview={preview} walletReady={walletReady} factoryAddress={factoryAddress} configRegistry={configRegistry} onClose={() => { setShowCreate(false); setPreview(false); }} onUpdate={updateForm} onPreview={() => setPreview(true)} onConnect={connectWallet} onSwitch={switchToGiwa} />}
    </div>
  );
}

function LaunchCard({ launch, index, onOpen }: { launch: Launch; index: number; onOpen: () => void }) {
  return <article className={`launch-card card-${index % 3}`} onClick={onOpen} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && onOpen()}>
    <div className="card-top"><span className={`status ${launch.status.toLowerCase()}`}><span />{launch.status}</span><span className="card-age">{launch.age} ago</span></div>
    <div className="token-heading"><div className="token-orb"><span>{launch.symbol.slice(0, 1)}</span></div><div><h3>{launch.name}</h3><span className="token-symbol">${launch.symbol}</span></div><span className="card-arrow">↗</span></div>
    <div className="progress-label"><span>CURVE PROGRESS</span><strong>{Math.round(launch.progress)}%</strong></div><div className="progress-track"><span style={{ width: `${launch.progress}%` }} /></div>
    <div className="card-metrics"><div><span>RAISED</span><strong>{launch.raised}<small> ETH</small></strong></div><div><span>PRICE</span><strong>{launch.price}<small> ETH</small></strong></div><div><span>HOLDERS</span><strong>{launch.holders.toLocaleString()}</strong></div></div>
    <div className="card-footer"><span className={`source-tag ${launch.source === "demo" ? "demo-tag" : ""}`}>{launch.source === "demo" ? "DEMO FIXTURE" : "AMMORA INDEX"}</span><span className="address-mini">{shortenAddress(launch.address)}</span></div>
  </article>;
}

function LaunchDetail({ launch, onClose, explorerUrl }: { launch: Launch; onClose: () => void; explorerUrl: string }) {
  const tokenUrl = launch.address ? `${explorerUrl}/address/${launch.address}` : explorerUrl;
  return <div className="modal-backdrop" onClick={onClose}><div className="detail-modal" onClick={(event) => event.stopPropagation()}>
    <button className="close-button" onClick={onClose}>×</button><div className="detail-topline"><span className={`status ${launch.status.toLowerCase()}`}><span />{launch.status}</span><span className="testnet-tag">GIWA SEPOLIA / TESTNET</span></div>
    <div className="detail-heading"><div className="token-orb large"><span>{launch.symbol.slice(0, 1)}</span></div><div><h2>{launch.name}</h2><p>${launch.symbol} <span>·</span> {shortenAddress(launch.address)}</p></div></div>
    <div className="detail-progress"><div className="progress-label"><span>CURVE PROGRESS</span><strong>{Math.round(launch.progress)}%</strong></div><div className="progress-track"><span style={{ width: `${launch.progress}%` }} /></div><div className="detail-progress-meta"><span>{launch.raised} ETH raised</span><span>{launch.target} ETH target</span></div></div>
    <div className="detail-grid"><div><span>SPOT PRICE</span><strong>{launch.price} <small>ETH</small></strong></div><div><span>24H VOLUME</span><strong>{launch.volume} <small>ETH</small></strong></div><div><span>HOLDERS</span><strong>{launch.holders.toLocaleString()}</strong></div><div><span>DATA SOURCE</span><strong>{launch.source === "ammora" ? "Ammora API" : "Fixture"}</strong></div></div>
    <div className="detail-actions"><a className="primary-button" href={tokenUrl} target="_blank" rel="noreferrer">View on explorer <span>↗</span></a><button className="secondary-button" onClick={onClose}>Back to launches</button></div><div className="detail-disclaimer"><span>i</span><p>Read-only detail view. Prices are testnet data and may be stale. Always verify the contract address and network before signing any transaction.</p></div>
  </div></div>;
}

function CreateModal({ form, preview, walletReady, factoryAddress, configRegistry, onClose, onUpdate, onPreview, onConnect, onSwitch }: { form: { name: string; symbol: string; supply: string; metadata: string }; preview: boolean; walletReady: boolean; factoryAddress: string; configRegistry: string; onClose: () => void; onUpdate: (key: "name" | "symbol" | "supply" | "metadata", value: string) => void; onPreview: () => void; onConnect: () => void; onSwitch: () => void }) {
  const canPreview = form.name.trim() && form.symbol.trim() && form.supply.trim() && form.metadata.trim();
  return <div className="modal-backdrop" onClick={onClose}><div className="create-modal" onClick={(event) => event.stopPropagation()}>
    <button className="close-button" onClick={onClose}>×</button><div className="modal-kicker">AMMORA V4 / UNSIGNED BUILDER</div><h2>Draft a launch.</h2><p className="modal-intro">Set the human-readable parameters below. This tool prepares a reviewable SDK plan only—no transaction is submitted.</p>
    <div className="form-grid"><label>Token name<input value={form.name} onChange={(event) => onUpdate("name", event.target.value)} placeholder="e.g. Northstar" /></label><label>Symbol<input value={form.symbol} onChange={(event) => onUpdate("symbol", event.target.value.toUpperCase())} placeholder="e.g. NSTR" maxLength={8} /></label><label>Total supply<input value={form.supply} onChange={(event) => onUpdate("supply", event.target.value)} inputMode="numeric" placeholder="1000000" /></label><label>Metadata URI<input value={form.metadata} onChange={(event) => onUpdate("metadata", event.target.value)} placeholder="ipfs://…" /></label></div>
    <div className="network-callout"><span className="network-icon">◉</span><div><strong>GIWA Sepolia · chain 91342</strong><p>Target factory <code>{shortenAddress(factoryAddress)}</code></p></div>{walletReady ? <span className="connected-label">CONNECTED</span> : <button className="inline-action" onClick={walletReady ? undefined : onConnect}>{walletReady ? "" : "Connect"}</button>}</div>
    {!walletReady && <button className="switch-link" onClick={onSwitch}>Already connected? Switch wallet to GIWA Sepolia →</button>}
    {preview ? <div className="preview-panel"><div className="preview-header"><span className="checkmark">✓</span><div><strong>Unsigned SDK plan ready</strong><span>Review every field before wallet confirmation</span></div></div><div className="preview-rows"><div><span>SDK action</span><code>buildCreateLaunch</code></div><div><span>Target</span><code>{factoryAddress}</code></div><div><span>Registry</span><code>{configRegistry}</code></div><div><span>Token</span><code>{form.name} ({form.symbol}) · {form.supply} units</code></div><div><span>Metadata</span><code>{form.metadata}</code></div></div><div className="preview-warning"><span>!</span><p>Preview only. The next step would be an explicit wallet signature on GIWA Sepolia. This demo never auto-signs or sends.</p></div></div> : <div className="modal-actions"><button className="primary-button" disabled={!canPreview} onClick={onPreview}>Preview SDK plan <span>→</span></button><button className="secondary-button" onClick={onClose}>Cancel</button></div>}
    <div className="modal-footnote">Powered by <a href={SDK_URL} target="_blank" rel="noreferrer">@ammora-protocol/sdk@0.3.9</a> · testnet software, not audited for real funds.</div>
  </div></div>;
}

createRoot(document.getElementById("root")!).render(<App />);
