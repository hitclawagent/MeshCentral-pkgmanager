# MeshCentral Package Manager (pkgmanager)

A [MeshCentral](https://github.com/Ylianst/MeshCentral) plugin for **remote package installation** on Windows, Linux and macOS agents. Catalog-driven, with **airgap installs** (devices never touch the internet: artifacts are downloaded from the MeshCentral server itself over the LAN).

Current version: **2.0.2** — requires MeshCentral **1.3.1**

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
