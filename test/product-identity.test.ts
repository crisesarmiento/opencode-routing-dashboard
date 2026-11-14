import { expect, test } from "bun:test";

const systemd = (name: string) => Bun.file(new URL(`../contrib/systemd/${name}`, import.meta.url));

test("browser title is the product name Route", async () => {
  const html = await Bun.file(new URL("../web/index.html", import.meta.url)).text();
  expect(html).toContain("<title>Route</title>");
  expect(html).not.toContain("OpenCode Routing Dashboard");
  expect(html).not.toContain("UseRoute");
});

test("systemd units call the useroute bin", async () => {
  const service = systemd("useroute.service");
  const snapshot = systemd("useroute-snapshot.service");
  const timer = systemd("useroute-snapshot.timer");
  expect(await service.exists()).toBe(true);
  expect(await snapshot.exists()).toBe(true);
  expect(await timer.exists()).toBe(true);
  expect(await service.text()).toContain("ExecStart=/usr/bin/env useroute serve");
  expect(await service.text()).toContain("Description=Route");
  expect(await snapshot.text()).toContain("ExecStart=/usr/bin/env useroute snapshot");
  expect(await timer.text()).toContain("Description=Capture a Route snapshot weekly");
  for (const old of [
    "opencode-routing-dashboard.service",
    "opencode-routing-dashboard-snapshot.service",
    "opencode-routing-dashboard-snapshot.timer",
  ])
    expect(await systemd(old).exists()).toBe(false);
  const migration = await Bun.file(new URL("../contrib/systemd/README.md", import.meta.url)).text();
  expect(migration).toContain("systemctl --user disable --now opencode-routing-dashboard.service");
  expect(migration).toContain("systemctl --user disable --now opencode-routing-dashboard-snapshot.timer");
  expect(migration).toContain("systemctl --user enable --now useroute.service");
  expect(migration).toContain("systemctl --user enable --now useroute-snapshot.timer");
  expect(migration).not.toContain("UseRoute");
});
