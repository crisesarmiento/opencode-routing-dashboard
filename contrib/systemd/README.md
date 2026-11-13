# systemd user units

These examples run **Route**. The command is `useroute`. The npm package name `route` already belongs to an unrelated library, so this package cannot use it. `useroute.dev` is the planned domain and is not registered. Nothing here installs or enables a service.

Copy the units, adjust `PATH` and any optional `ORD_*` settings, then enable the ones you want. Both services need Bun and `useroute` on their service `PATH`.

## New install

```sh
mkdir -p ~/.config/systemd/user
cp contrib/systemd/useroute.service contrib/systemd/useroute-snapshot.service contrib/systemd/useroute-snapshot.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now useroute.service
systemctl --user enable --now useroute-snapshot.timer
```

The timer starts `useroute-snapshot.service` (`OnCalendar=weekly`, `Persistent=true`). macOS can run `useroute` directly; these units are Linux-only.

## Migrate an existing install

Stop and disable the old units, remove their files, then enable the new ones. `opencode-routing-dashboard` still runs as a deprecated command alias for this release. The new units call `useroute`.

```sh
systemctl --user disable --now opencode-routing-dashboard.service
systemctl --user disable --now opencode-routing-dashboard-snapshot.timer
systemctl --user disable --now opencode-routing-dashboard-snapshot.service
rm -f ~/.config/systemd/user/opencode-routing-dashboard.service \
  ~/.config/systemd/user/opencode-routing-dashboard-snapshot.service \
  ~/.config/systemd/user/opencode-routing-dashboard-snapshot.timer
mkdir -p ~/.config/systemd/user
cp contrib/systemd/useroute.service contrib/systemd/useroute-snapshot.service contrib/systemd/useroute-snapshot.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now useroute.service
systemctl --user enable --now useroute-snapshot.timer
```

`disable --now` exits non-zero when that old unit was never installed. Continue with the new units. The snapshot service may only have been started by its timer; disabling it is still safe.
