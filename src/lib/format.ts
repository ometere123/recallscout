export function shortAddress(value?: string) {
  if (!value) return "Not connected";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function formatGen(value: string | bigint) {
  const raw = typeof value === "bigint" ? value : BigInt(value || "0");
  const whole = raw / 10n ** 18n;
  const fraction = (raw % 10n ** 18n).toString().padStart(18, "0").slice(0, 4);
  return `${whole}.${fraction} GEN`;
}

export function parseGen(value: string) {
  const [whole, fraction = ""] = value.trim().split(".");
  const cleanWhole = whole === "" ? "0" : whole;
  const cleanFraction = fraction.padEnd(18, "0").slice(0, 18);
  return BigInt(cleanWhole) * 10n ** 18n + BigInt(cleanFraction || "0");
}

export function formatUtc(value?: string) {
  if (!value) return "Not set";
  const normalized = value.endsWith("Z") ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZoneName: "short",
  }).format(date);
}

export function sha256Placeholder() {
  return `sha256:${"0".repeat(64)}`;
}

export function toDeadlineLocalInput(date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function localInputToUtc(value: string) {
  if (!value) return "";
  return `${value}:00Z`;
}
