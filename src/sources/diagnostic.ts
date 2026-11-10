import { open } from "node:fs/promises";
import type { Config } from "../config";
import { buildDiagnostic, type Diagnostic, type DiagnosticCommand } from "../core/diagnostic";
import { credentialPath, readConfig } from "./source-config";

export type DiagnosticIo = { readConfig: (path: string) => Promise<unknown> };

/** Rejects forbidden paths (shared rule) before any content read; the error never includes file content. */
export function assertAllowedPath(path: string): void {
  if (credentialPath(path)) throw new Error("Invalid configuration path");
}

export async function collectDiagnostic(
  config: Config,
  options: { version: string; command: DiagnosticCommand },
  io: DiagnosticIo = { readConfig },
): Promise<Diagnostic> {
  for (const path of [config.configFile, config.localSourceConfigFile, config.analyticsConfigFile, config.statsFile])
    if (path) assertAllowedPath(path);
  // Only the sources file is opened; other configured paths are reported as set/unset.
  const rawSources = config.configFile ? await io.readConfig(config.configFile) : undefined;
  return buildDiagnostic(config, { ...options, rawSources });
}

/** Local file only; never overwrites an existing file. */
export async function writeDiagnostic(path: string, text: string): Promise<void> {
  assertAllowedPath(path);
  const file = await open(path, "wx", 0o600);
  try {
    await file.writeFile(text);
  } finally {
    await file.close();
  }
}
