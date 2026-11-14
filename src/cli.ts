#!/usr/bin/env bun
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config";
import { DIAGNOSTIC_COMMANDS, type DiagnosticCommand, formatDiagnostic } from "./core/diagnostic";
import { formatReport, parseReportRange } from "./core/reports";
import { startApp } from "./server";
import { startAgent } from "./server/agent";
import { assertAllowedPath, collectDiagnostic, writeDiagnostic } from "./sources/diagnostic";

export const VERSION = "0.2.0";
export const PRODUCT_NAME = "Route";
export const TAGLINE = "honest model routing observability";
export const BIN_NAME = "useroute";
export const LEGACY_BIN_NAME = "opencode-routing-dashboard";
export const BIN_ALIAS_NOTE = `${LEGACY_BIN_NAME} is a deprecated alias for ${BIN_NAME} and will be removed in the next release.`;
export type BinName = typeof BIN_NAME | typeof LEGACY_BIN_NAME;

/** Basename only. A checkout path that contains the old name must not count as the alias. */
export function binNameFromArgv(argv1: string): BinName {
  return basename(argv1) === LEGACY_BIN_NAME ? LEGACY_BIN_NAME : BIN_NAME;
}

export function deprecationNotice(bin: string): string | null {
  return bin === LEGACY_BIN_NAME ? BIN_ALIAS_NOTE : null;
}

const USAGE_FLAGS =
  "[serve|snapshot|agent|export|diagnose] [--output PATH] [--for-command serve|agent] [--state-dir PATH] [--observe-path PATH] [--route-path PATH] [--permissions-path PATH] [--port PORT] [--stats-interval SECONDS] [--snapshot-dir PATH] [--stats-command COMMAND] [--stats-file PATH] [--stats-enabled true|false] [--max-records N] [--demo true|false] [--config PATH] [--local-source-config PATH] [--bind IP] [--token-env NAME] [--redact-prompts true|false]";

export function usageText(): string {
  return [
    `${PRODUCT_NAME} — ${TAGLINE}`,
    `Usage: ${BIN_NAME} ${USAGE_FLAGS}`,
    "  serve     Start the dashboard (default)",
    "  agent     Export local sources (redacts known observe/route prompt fields when enabled)",
    "  snapshot  Capture one weekly snapshot and exit",
    "  export    Print report (--from DATE --to DATE --format md|csv)",
    "  diagnose  Preview an allowlisted configuration diagnostic on stdout (--output PATH also writes a new local file; nothing is uploaded)",
    BIN_ALIAS_NOTE,
  ].join("\n");
}

export async function main(bin: BinName): Promise<void> {
  const notice = deprecationNotice(bin);
  if (notice) console.error(notice);
  try {
    const args = process.argv.slice(2);
    const command =
      args[0] === "serve" ||
      args[0] === "snapshot" ||
      args[0] === "agent" ||
      args[0] === "export" ||
      args[0] === "diagnose"
        ? args.shift()
        : "serve";
    const reportOptions: Record<string, string> = {};
    if (command === "export") {
      for (let i = 0; i < args.length; ) {
        const match = /^--(from|to|format)(?:=(.*))?$/.exec(args[i]!);
        if (!match) {
          i++;
          continue;
        }
        const name = match[1]!;
        if (name in reportOptions) throw new Error(`Duplicate --${name}`);
        const value = match[2] ?? args[i + 1];
        if (!value || value.startsWith("--")) throw new Error(`Missing value: --${name}`);
        reportOptions[name] = value;
        args.splice(i, match[2] === undefined ? 2 : 1);
      }
    }
    const diagnoseOptions: Record<string, string> = {};
    if (command === "diagnose") {
      for (let i = 0; i < args.length; ) {
        const match = /^--(output|for-command)(?:=(.*))?$/.exec(args[i]!);
        if (!match) {
          i++;
          continue;
        }
        const name = match[1]!;
        if (name in diagnoseOptions) throw new Error(`Duplicate --${name}`);
        const value = match[2] ?? args[i + 1];
        if (!value || value.startsWith("--")) throw new Error(`Missing value: --${name}`);
        diagnoseOptions[name] = value;
        args.splice(i, match[2] === undefined ? 2 : 1);
      }
    }
    const config = loadConfig(process.env, args);
    if (config.help) console.log(usageText());
    else if (command === "diagnose") {
      const target = diagnoseOptions["for-command"] ?? "serve";
      if (!DIAGNOSTIC_COMMANDS.includes(target as DiagnosticCommand))
        throw new Error("--for-command must be serve or agent");
      const output = diagnoseOptions.output;
      if (output) assertAllowedPath(output);
      const text = formatDiagnostic(
        await collectDiagnostic(config, { version: VERSION, command: target as DiagnosticCommand }),
      );
      if (output) await writeDiagnostic(output, text);
      process.stdout.write(text);
      if (output) console.error("Diagnostic written to the requested local file. Nothing was uploaded.");
    } else if (command === "export") {
      const { from, to, format } = reportOptions;
      if (!from || !to || (format !== "md" && format !== "csv"))
        throw new Error("Export requires --from, --to and --format md|csv");
      const range = parseReportRange(from, to);
      const { collectReport } = await import("./sources/export");
      process.stdout.write(formatReport(await collectReport(config, range), format));
    } else if (command === "snapshot") {
      const { snapshotOnce } = await import("./sources/snapshots");
      const result = await snapshotOnce(config);
      console.log(`${result.created ? "Created" : "Already exists"}: ${result.path}`);
    } else {
      if (command === "agent" && config.configFile) throw new Error("Agent cannot use a config file");
      const token = config.tokenEnv ? process.env[config.tokenEnv] : undefined;
      if (command === "agent" && config.tokenEnv && !token) throw new Error("Token environment variable is missing");
      const app =
        command === "agent"
          ? await startAgent(config, { bind: config.bind, token, redactPrompts: config.redactPrompts })
          : await startApp(config, { staticDir: fileURLToPath(new URL("../dist/", import.meta.url)) });
      console.log(`${bin} ${VERSION}: ${app.url}`);
      let stopping = false;
      const stop = async () => {
        if (stopping) return;
        stopping = true;
        await app.stop();
      };
      process.on("SIGINT", stop);
      process.on("SIGTERM", stop);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (import.meta.main) await main(binNameFromArgv(process.argv[1] ?? ""));
