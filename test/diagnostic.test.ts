import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadConfig } from "../src/config";
import { ALLOWED_FIELDS, buildDiagnostic, formatDiagnostic, isDiagnosticSchema } from "../src/core/diagnostic";
import { collectDiagnostic } from "../src/sources/diagnostic";

// Synthetic values only: no real credentials, prompts or forbidden files.
const PROMPT = "SYNTHETIC-PROMPT-do-not-leak";
const TOKEN = "SYNTHETIC-TOKEN-VALUE-do-not-leak";
const BODY = "SYNTHETIC-FILE-BODY-do-not-leak";
const cli = resolve(import.meta.dir, "../src/cli.ts");
const dir = await mkdtemp(join(tmpdir(), "ord-diagnose-"));
afterAll(() => rm(dir, { recursive: true, force: true }));

const sources = [
  {
    id: "box-a",
    label: "Box A",
    endpoint: "http://10.0.0.5:4777",
    tokenEnv: "ORD_SYNTH_TOKEN",
    client: "Orca",
    directoryRules: [{ prefix: "/work", client: "Orca" }],
    prompt: PROMPT,
  },
];

async function run(env: Record<string, string>, ...args: string[]) {
  const child = Bun.spawn([process.execPath, cli, ...args], {
    cwd: dir,
    env: { PATH: process.env.PATH, HOME: dir, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, code };
}

describe("configuration diagnostic", () => {
  test("lists only allowlisted fields and names every omission", () => {
    const config = loadConfig({}, [
      "--port",
      "5000",
      "--token-env",
      "ORD_SYNTH_TOKEN",
      "--stats-file",
      "/x/stats.json",
    ]);
    const d = buildDiagnostic(config, { version: "9.9.9", command: "serve", rawSources: sources });
    expect(Object.keys(d.included).sort()).toEqual([...ALLOWED_FIELDS].sort());
    expect(d.included.port).toBe(5000);
    expect(d.included["token-env"]).toBe("ORD_SYNTH_TOKEN");
    expect(d.included.sources).toEqual([{ id: "box-a", label: "Box A", "token-env": "ORD_SYNTH_TOKEN" }]);
    expect(d.included["path-policy"]).toMatchObject({ "stats-file": "set", "config-file": "unset" });
    const omitted = d.omitted.map((o) => o.field);
    for (const name of [
      "stateDir",
      "sourcePaths",
      "snapshotDir",
      "statsCommand",
      "sources[].endpoint",
      "sources[].client",
    ])
      expect(omitted).toContain(name);
    expect(omitted).toContain("sources[].directoryRules");
    expect(omitted).toContain("sources[].<unrecognized>");
    expect(d.omitted.every((o) => o.reason.length > 0)).toBe(true);
    const text = formatDiagnostic(d);
    for (const hidden of [PROMPT, "10.0.0.5", "/x/stats.json", "/work", dir]) expect(text).not.toContain(hidden);
    expect(d.schema).toBe("route.config-diagnostic/1");
    expect(text).toContain('"schema": "route.config-diagnostic/1"');
    expect(text).not.toContain("opencode-routing-dashboard.config-diagnostic/1");
  });

  test("accepts the previous diagnostic schema id for one release", () => {
    expect(isDiagnosticSchema("route.config-diagnostic/1")).toBe(true);
    expect(isDiagnosticSchema("opencode-routing-dashboard.config-diagnostic/1")).toBe(true);
    expect(isDiagnosticSchema("useroute.config-diagnostic/1")).toBe(false);
    expect(isDiagnosticSchema("route.config-diagnostic/2")).toBe(false);
  });

  test("an unrecognized config key is omitted by name, not sanitized", () => {
    const config = { ...loadConfig({}, []), futureSecretish: "x" } as ReturnType<typeof loadConfig>;
    const d = buildDiagnostic(config, { version: "1", command: "agent" });
    expect(d.omitted).toContainEqual({ field: "futureSecretish", reason: "not in the allowlist" });
    expect(JSON.stringify(d.included)).not.toContain("futureSecretish");
  });

  test.each(["auth.json", ".env", ".env.local", ".ssh/config", "service.json"])(
    "%s is rejected before any content read",
    async (name) => {
      const reads: string[] = [];
      const io = {
        readConfig: async (path: string) => {
          reads.push(path);
          return BODY;
        },
      };
      const config = loadConfig({}, ["--config", join(dir, name)]);
      const error = await collectDiagnostic(config, { version: "1", command: "serve" }, io).catch((e) => e);
      expect(reads).toEqual([]);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Invalid configuration path");
      expect(error.message).not.toContain(BODY);
    },
  );

  test("CLI previews on stdout, writes a new file and never prints prompts or token values", async () => {
    const file = join(dir, "sources.json");
    const out = join(dir, "diag.json");
    await writeFile(file, JSON.stringify(sources));
    const env = { ORD_SYNTH_TOKEN: TOKEN };
    const result = await run(env, "diagnose", "--config", file, "--output", out);
    expect(result.code).toBe(0);
    const artifact = await readFile(out, "utf8");
    expect(artifact).toBe(result.stdout);
    for (const text of [result.stdout, result.stderr, artifact]) {
      expect(text).not.toContain(PROMPT);
      expect(text).not.toContain(TOKEN);
    }
    expect(JSON.parse(artifact).included.sources[0]["token-env"]).toBe("ORD_SYNTH_TOKEN");
    const again = await run(env, "diagnose", "--config", file, "--output", out);
    expect(again.code).toBe(1);
  });

  test("CLI rejects forbidden config and output paths without leaking content", async () => {
    for (const args of [
      ["--config", join(dir, "auth.json")],
      ["--config", join(dir, ".ssh", "config")],
      ["--output", join(dir, ".env")],
    ]) {
      const result = await run({ ORD_SYNTH_TOKEN: TOKEN }, "diagnose", ...args);
      expect(result.code).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Invalid configuration path");
      expect(result.stderr + result.stdout).not.toContain(TOKEN);
    }
  });
});
