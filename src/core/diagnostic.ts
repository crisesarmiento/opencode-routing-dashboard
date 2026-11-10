import type { Config } from "../config";

/** Explicit allowlist: only these top-level fields can ever appear in the artifact. */
export const ALLOWED_FIELDS = [
  "version",
  "command",
  "bind",
  "port",
  "demo",
  "redact-prompts",
  "stats-enabled",
  "stats-interval",
  "max-records",
  "sources",
  "token-env",
  "path-policy",
] as const;
export type AllowedField = (typeof ALLOWED_FIELDS)[number];
export const DIAGNOSTIC_COMMANDS = ["serve", "agent"] as const;
export type DiagnosticCommand = (typeof DIAGNOSTIC_COMMANDS)[number];
export type PathState = "set" | "unset";
export type DiagnosticSource = { id: string; label: string; "token-env"?: string };
export type Omission = { field: string; reason: string };
export type Diagnostic = {
  schema: "opencode-routing-dashboard.config-diagnostic/1";
  included: {
    version: string;
    command: DiagnosticCommand;
    bind: string;
    port: number;
    demo: boolean;
    "redact-prompts": boolean;
    "stats-enabled": boolean;
    "stats-interval": number;
    "max-records": number;
    sources: DiagnosticSource[];
    "token-env": string | null;
    "path-policy": Record<string, PathState>;
  };
  omitted: Omission[];
  notice: string;
};

const HOME_PATH = "path may contain a home directory or username; only set/unset is reported";
const POLICY_PATHS: Record<string, string> = {
  configFile: "config-file",
  localSourceConfigFile: "local-source-config-file",
  analyticsConfigFile: "analytics-config-file",
  statsFile: "stats-file",
};
const CONFIG_OMISSIONS: Record<string, string> = {
  help: "not a setting",
  stateDir: HOME_PATH,
  sourcePaths: HOME_PATH,
  snapshotDir: HOME_PATH,
  statsCommand: "free-form string, not in the allowlist",
  ...Object.fromEntries(Object.keys(POLICY_PATHS).map((key) => [key, HOME_PATH])),
};
const SOURCE_OMISSIONS: Record<string, string> = {
  endpoint: "may identify a private host; not in the allowlist",
  client: "not in the allowlist",
  directoryRules: "contain local directory paths; not in the allowlist",
};
export const NOTICE =
  "Allowlisted fields only. Omitted fields are listed by name, never sanitized. Strings inside allowed fields (such as source labels) are included as written and are not scanned for secrets.";

/** Raw sources come from a parsed JSON file; only validated allowlisted values are copied. */
export function selectSources(raw: unknown): { sources: DiagnosticSource[]; omitted: Omission[] } {
  if (!Array.isArray(raw) || raw.length > 16) throw new Error("Invalid source configuration");
  const names = new Set<string>();
  let unknown = 0;
  const sources = raw.map((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid source configuration");
    const v = item as Record<string, unknown>;
    if (
      typeof v.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(v.id) ||
      typeof v.label !== "string" ||
      !v.label.trim() ||
      v.label.length > 256 ||
      (v.tokenEnv !== undefined && (typeof v.tokenEnv !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(v.tokenEnv)))
    )
      throw new Error("Invalid source configuration");
    for (const key of Object.keys(v)) {
      if (key in SOURCE_OMISSIONS) names.add(key);
      else if (!["id", "label", "tokenEnv"].includes(key)) unknown++;
    }
    return { id: v.id, label: v.label, ...(v.tokenEnv !== undefined && { "token-env": v.tokenEnv }) };
  });
  const omitted: Omission[] = [...names]
    .sort()
    .map((key) => ({ field: `sources[].${key}`, reason: SOURCE_OMISSIONS[key]! }));
  if (unknown)
    omitted.push({
      field: "sources[].<unrecognized>",
      reason: `${unknown} unrecognized field(s); not in the allowlist`,
    });
  return { sources, omitted };
}

export function buildDiagnostic(
  config: Config,
  options: { version: string; command: DiagnosticCommand; rawSources?: unknown },
): Diagnostic {
  const selected = options.rawSources === undefined ? { sources: [], omitted: [] } : selectSources(options.rawSources);
  const pathPolicy: Record<string, PathState> = {};
  for (const [key, name] of Object.entries(POLICY_PATHS))
    pathPolicy[name] = (config as Record<string, unknown>)[key] ? "set" : "unset";
  const omitted: Omission[] = Object.keys(config)
    .filter((key) => key in CONFIG_OMISSIONS || !isIncluded(key))
    .sort()
    .map((key) => ({ field: key, reason: CONFIG_OMISSIONS[key] ?? "not in the allowlist" }));
  return {
    schema: "opencode-routing-dashboard.config-diagnostic/1",
    included: {
      version: options.version,
      command: options.command,
      bind: config.bind,
      port: config.port,
      demo: config.demo,
      "redact-prompts": config.redactPrompts,
      "stats-enabled": config.statsEnabled,
      "stats-interval": config.statsInterval,
      "max-records": config.maxRecords,
      sources: selected.sources,
      "token-env": config.tokenEnv ?? null,
      "path-policy": pathPolicy,
    },
    omitted: [...omitted, ...selected.omitted],
    notice: NOTICE,
  };
}
const INCLUDED_CONFIG_KEYS = [
  "bind",
  "port",
  "demo",
  "redactPrompts",
  "statsEnabled",
  "statsInterval",
  "maxRecords",
  "tokenEnv",
];
const isIncluded = (key: string) => INCLUDED_CONFIG_KEYS.includes(key);

export function formatDiagnostic(diagnostic: Diagnostic): string {
  return `${JSON.stringify(diagnostic, null, 2)}\n`;
}
