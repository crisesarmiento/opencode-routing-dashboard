import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const cli = resolve(import.meta.dir, "../src/cli.ts");
const fixture = resolve(import.meta.dir, "../fixtures/stats.json");
const dir = await mkdtemp(join(tmpdir(), "ord-cli-"));
afterAll(() => rm(dir, { recursive: true, force: true }));

async function run(...args: string[]) {
  const child = Bun.spawn([process.execPath, cli, ...args], {
    cwd: dir,
    env: { PATH: process.env.PATH, HOME: dir },
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

describe("CLI", () => {
  test("help documents commands from another cwd", async () => {
    const result = await run("--help");
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("snapshot");
    expect(result.stdout).toContain("serve");
    expect(result.stdout).toContain("Route — honest model routing observability");
    expect(result.stdout).toContain("Usage: useroute ");
    expect(result.stdout).toContain(
      "opencode-routing-dashboard is a deprecated alias for useroute and will be removed in the next release.",
    );
    expect(result.stdout).not.toContain("UseRoute");
    expect(result.stderr).toBe("");
  });

  test("deprecated command alias warns and still documents useroute", async () => {
    const legacy = resolve(import.meta.dir, "../src/legacy-bin.ts");
    const child = Bun.spawn([process.execPath, legacy, "--help"], {
      cwd: dir,
      env: { PATH: process.env.PATH, HOME: dir },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(code).toBe(0);
    expect(stdout).toContain("Usage: useroute ");
    expect(stdout).not.toContain("UseRoute");
    expect(stderr).toContain(
      "opencode-routing-dashboard is a deprecated alias for useroute and will be removed in the next release.",
    );
  });

  test("the old command name is recognized from the argv basename only", async () => {
    const { binNameFromArgv, deprecationNotice } = await import("../src/cli");
    expect(binNameFromArgv("/usr/local/bin/opencode-routing-dashboard")).toBe("opencode-routing-dashboard");
    expect(binNameFromArgv("/usr/local/bin/useroute")).toBe("useroute");
    expect(binNameFromArgv("/work/opencode-routing-dashboard/src/cli.ts")).toBe("useroute");
    expect(deprecationNotice("useroute")).toBeNull();
  });

  test("rejects invalid flags", async () => {
    const result = await run("snapshot", "--not-a-flag");
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Unknown option: --not-a-flag");
  });

  test("CLI and package versions match the requested 0.2.0", async () => {
    const { VERSION } = await import("../src/cli");
    const pkg = await Bun.file(new URL("../package.json", import.meta.url)).json();
    expect(VERSION).toBe("0.2.0");
    expect(pkg.version).toBe(VERSION);
    expect(pkg.name).toBe("useroute");
    expect(pkg.bin.useroute).toBe("src/cli.ts");
    // Separate entry so the alias can warn. A symlink to cli.ts is realpathed and would not.
    expect(pkg.bin["opencode-routing-dashboard"]).toBe("src/legacy-bin.ts");
    expect(pkg.description).toBe("Route — honest model routing observability");
  });

  test("captures a snapshot and exits without starting HTTP", async () => {
    const snapshots = join(dir, "snapshots");
    const result = await run("snapshot", "--state-dir", dir, "--snapshot-dir", snapshots, "--stats-file", fixture);
    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain("http://");
    expect((await readdir(snapshots)).length).toBeGreaterThan(0);
  });
});
