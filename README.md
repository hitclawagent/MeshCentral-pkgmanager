# MeshCentral Package Manager (pkgmanager)

A [MeshCentral](https://github.com/Ylianst/MeshCentral) plugin for **remote package installation** on Windows, Linux and macOS agents. Catalog-driven, with **airgap installs** (devices never touch the internet: artifacts are downloaded from the MeshCentral server itself over the LAN).

Current version: **2.1.4** — requires MeshCentral **1.3.1**

> **2.1.4**: pure-JS Debian version comparator (`verDebCmp`) — the plan no longer depends on dpkg being installed on the MeshCentral server. The old string fallback compared "4.10" < "4.9" and caused phantom updates + reinstall loops (xxd case). Validated against dpkg on critical cases and 141 real versions (tools/test-vercmp.js, in CI).
>
> **2.1.3**: ghost-package fix — the Linux inventory now reads ONLY actually-installed packages (`dpkg-query ${db:Status-Abbrev}` filtered to `ii/hi` states): removed-but-not-purged packages no longer appear as "updates available" (they made the plan reinstall them; classic loop with xxd/vim). Plan header shows the scan timestamp as staleness hint.
>
> **2.1.2**: plan transparency — each package in the OS-update plan shows the REASON (plain update vs NEW dependency pulled in by an updated package); the count can legitimately exceed `apt upgrade` (which doesn't count new dependencies). The scan also detects inconsistent dpkg state (`dpkg --audit`) and warns on machines with unsatisfied dependencies (e.g. after an interrupted upgrade) — those machines need `apt --fix-broken install` or a plan install.
>
> **2.1.1**: the store listing now includes the LEGACY `os-updates` folder (downloads made before v2.0.7 had no codename suffix) — those files were invisible in "Gestione aggiornamenti OS".
>
> **2.1.0**: "Gestione aggiornamenti OS" completed — the store packages downloaded by «Scarica i mancanti» (or copied for airgap) are now LISTED per release (`os-updates-<codename>`) with per-file **delete**; OS filter available in this view too; «Ricarica store» button; the imported airgap bundles section is unchanged.
>
> **2.0.9**: per-group machine selection (checkbox list per OS group, default all; install only on the picked machines — offline ones are excluded and reported) and the compiled downloader export button is back in the OS view (airgap flow).
>
> **2.0.8**: OS-updates view redesigned — no more opaque bundle packages: after a scan the view shows a **per-OS dropdown** (one group per distro release), the **package list** with installed (min) vs candidate version and **server status** (✓ available / ✗ missing), a download button for the missing files only, and direct install from the plan (single dpkg with all debs) on the group's machines. The plan is computed server-side (`osplan`) and auto-refreshes after scan and after download. osfetch no longer creates catalog bundles; the airgap manifest import path (bundles) is unchanged.
>
> **2.0.7**: OS-update bundles rework — «Scarica aggiornamenti» now creates **ONE bundle PER DISTRO RELEASE** (`os-updates-<codename>`, named e.g. "Aggiornamenti OS — Ubuntu 26.04 (resolute)"); packages are deduped per NAME keeping the MAX version (machines at different levels converge to the same newest state); install runs ONE `dpkg -i` with all debs (dpkg handles ordering); bundle contents are visible per OS with an expandable file list (admin page + OS view); catalog writes are serialized (multiple bundles saved concurrently no longer lose each other). No more prompts.
>
> **2.0.6**: scan info fixes — Windows version column now shows the REAL release from the registry (DisplayVersion, e.g. "25H2 (10.0.26300)"; the old column showed the Windows API version "10.0.x" even on Windows 11) and Linux os-release values are quote-stripped (VERSION_ID arrives quoted, e.g. "26.04"; the codename is used verbatim in the vendor repo URLs).
>
> **2.0.5**: scan fix — pkgOsScan crashed silently since v2.0.2 (pkgD2Pending called before the node list existed, plus a dead reference to the fork-only d2runPending): the "Scansiona macchine" button did nothing on official MeshCentral. Regression covered by tools/test-client.js (end-to-end client simulation, also run in CI).
>
> **2.0.4**: crash-proof guard — at every server startup the plugin forces its local config.json (and the DB record) to the canonical self-referencing URLs and verifies the REMOTE config.json is self-referencing, logging a loud error if a bad release ever breaks the invariant again (the invariant violation is what crash-looped Node 24 when opening the plugins screen).
>
> **2.0.3**: update-source repoint — `updateSrcUrl` (self-update check) and `binariesUrl` (downloader binaries auto-install) now point at this repo (they still referenced the archived fork branch, so the update check always said the plugin was current).
>
> **2.0.2**: self-contained runcommands reply plumbing — the OS-update scanner and installs no longer depend on the `d2run*` patch of the forked UI. On an official MeshCentral the scan previously stayed "waiting" forever (nothing collected the replies); the plugin now wraps `meshserver.onMessage` once and collects its own replies (`window.pkgmanagerD2`). On the forked UI both mechanisms coexist.
>
> **2.0.1**: OS classification fix — machines are classified by agent type (`node.agent.id`) before the `os_title` text fallback, so Windows machines without populated OS info are no longer mistaken for Linux.

> **2.0.1**: OS classification fix — machines are classified by agent type (`node.agent.id`) before the `os_title` text fallback, so Windows machines without populated OS info are no longer mistaken for Linux.

## Install from the MeshCentral Plugin Manager

**My Server → Plugins → Add/Install**, paste this URL (same format as the official plugins: the URL of the raw `config.json`):

```
https://raw.githubusercontent.com/hitclawagent/MeshCentral-pkgmanager/main/config.json
```

MeshCentral fetches the config, reads `downloadUrl` and installs the plugin (`pkgmanager.js`). Restart the server afterwards (or accept the restart prompt).

> **⚠️ Servers without GitHub access (airgap / firewall)**
> If your MeshCentral server cannot reach `raw.githubusercontent.com`, installation fails with an error about the config.json. In that case:
>
> ```bash
> # On the MeshCentral server machine
> mkdir -p /tmp/pkginstall && cd /tmp/pkginstall
> curl -sLO https://raw.githubusercontent.com/hitclawagent/MeshCentral-pkgmanager/main/config.json
> curl -sLO https://raw.githubusercontent.com/hitclawagent/MeshCentral-pkgmanager/main/pkgmanager-code-latest.zip
> python3 -m http.server 8077 &
> ```
> then paste this into the Plugin Manager: `http://127.0.0.1:8077/config.json`
>
> Note: the Plugin Manager update check also fetches the `configUrl` from GitHub, so on a server without outbound access it will report errors too — expected, not a plugin bug.

## Manual install (full airgap)

Download `pkgmanager-code-latest.zip` (or a release asset), copy it to the server, then:

- extract `pkgmanager.js` and `config.json` into `<meshcentral>/plugins/pkgmanager/`
- restart MeshCentral

## What it does

- **Package catalog** managed by admins (per-OS: Windows cmd / PowerShell, Linux/macOS shell) with mandatory install **and uninstall** commands, auto-generated from presets for `.deb`, `.rpm`, `.apk`, `.msi`, `.exe`, `.pkg`, `.app`, `.sh`
- **Install/Delete packages** with multi-select: target checkboxes (with OS filter), batch install/delete in a single results dialog
- **Airgap**: artifacts are uploaded to the server (server-side store); devices download from **this** server over the LAN and verify **SHA-384** before installing (`{{url}}` / `{{sha384}}` placeholders in commands)
- **OS update management**: per-OS versions + version-check commands, an "installed vs available" matrix, and one-click update of outdated packages
- **Package builder**: guided wizard with browser artifact upload, live ID check, multi-OS merge
- Installs ride MeshCentral's rights-checked `runcommands` channel: output returns in the standard results dialog
- The artifact store is browsable from the "Pacchetti (pkgmanager)" folder in My Files for admins

## Menu

The plugin adds three tabs to the top gray bar (core-style):

- **Installazione pacchetti** — all users
- **Gestione pacchetti** — full site admins only
- **Creazione pacchetti** — full site admins only
- plus an **"Aggiorna plugin"** tab with the update buttons and the current version

## Repository layout

```
pkgmanager.js              # full plugin code (server + client)
config.json                # plugin manifest (configUrl/downloadUrl for the Plugin Manager)
pkgmanager-code-latest.zip # install package (js + config), stable filename
tools/meshos-downloader/   # Go source of the per-OS downloader
tools/meshos-fetch.js      # server-side artifact fetch/verify
```

## Releases

Versioned assets are available in [Releases](https://github.com/hitclawagent/MeshCentral-pkgmanager/releases):

- `pkgmanager-code-X.Y.Z.zip` — plugin code only (for the Plugin Manager)
- `pkgmanager-full-X.Y.Z.zip` — plugin + per-OS downloader binaries (full airgap)

## License

Internal/lab use. Built on the MeshCentral 1.3.1 plugin API.
