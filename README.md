# MeshCentral Package Manager (pkgmanager)

A [MeshCentral](https://github.com/Ylianst/MeshCentral) plugin for **remote package installation** on Windows, Linux and macOS agents. Catalog-driven, with **airgap installs** (devices never touch the internet: artifacts are downloaded from the MeshCentral server itself over the LAN).

Current version: **2.2.15** — requires MeshCentral **1.3.1**

> **2.2.15**: WINDOWS INSTALL — «Installa aggiornamenti» on a Windows group now works: for the checked+online machines it fetches the .msu files from the server store (pkgstore.ashx, token-authenticated), verifies SHA384 on the machine, and runs wusa /quiet /norestart (no automatic reboot — exit 3010 reports "RIAVVIO NECESSARIO", 2359302 "già installato"). Per-KB outcome lines land in the d2 results dialog. pkgMsg now scrolls into view.
>
> **2.2.14**: machine selection for installation — checkboxes in «Macchine scansionate» (default UNCHECKED, "tutte/nessuna" links, live counter) drive «Installa aggiornamenti»: only checked and online machines receive the commands. No accidental fleet-wide updates; safe staged rollouts on a small group of machines first.
>
> **2.2.13**: the flex row wrapping Macchine/Pacchetti was never closed — Riassunto and the message div became flex children (the summary showed up on the left). Row closed properly; div-balance check added to the test.
>
> **2.2.12**: exact grid — left column «Macchine scansionate» full height (600px); right column split in two halves: top «Pacchetti rilevati» (300px) and «Avanzamento download» beneath it filling the remaining half; «Riassunto mancanti» underneath everything, full page width.
>
> **2.2.11**: the "Piano aggiornamenti" section is removed — the unified «Pacchetti rilevati» pane and the «Riassunto mancanti» replace it; the OS group selector stays on top and the dpkg-audit warning moved into the summary. Install actions keep working off the plan data.
>
> **2.2.10**: store check for every OS — inStore/sha384 is now computed for Windows groups too (it previously ran only for Linux, so .msu files already in the store were re-downloaded on every «Scarica selezionati»); explicit message when everything selected is already in the store. Layout: Macchine scansionate left (full height), right column = Pacchetti rilevati (310px) with Avanzamento download (240px, scrollable) beneath it.
>
> **2.2.9**: the whole «Aggiornamenti OS» page scrolls (viewport-height wrapper with its own scrollbar), so every section and report stays reachable; sections keep their fixed heights and internal scrolling.
>
> **2.2.8**: «Macchine scansionate» and «Pacchetti rilevati» are side by side again (flex row 1:1.5), as fixed-height sections; the rest of the v2.2.7 stack (Avanzamento download, Piano, Riassunto) is unchanged.
>
> **2.2.7**: the OS view is a stack of fixed-position sections (dropdown selector on top, then Macchine scansionate · Pacchetti rilevati · NEW Avanzamento download · Piano · Riassunto mancanti at the bottom), each with a fixed height and its own internal scroll — content no longer shifts the layout, the page scrolls freely. osfetch reports per-file download progress (bar, done/total, per-file ok/fail lines) to the new section.
>
> **2.2.6**: fixed bottom "Riassunto mancanti" bar in the OS view — per release: machines, missing count, bytes to download, in-store count, selected; totals row; updates on every plan/selection change. All long lists are scrollable now (machines box and plan table capped at 420px like the packages box), so long inventories no longer push the summary out of view.
>
> **2.2.5**: UNIFIED OS PLAN — Windows machines are now first-class: the server queries the Microsoft Update Catalog for each Windows release ("Windows 10 Version 22H2"), lists missing updates (KB not installed on at least one machine of the group) with title, date, size and resolved download URL, and «Scarica selezionati» saves the .msu files in the store exactly like Linux .deb (same checkboxes, same store view os-updates-windows-<release>). «Esporta downloader…» remains only for airgap servers. Install (.msu push + wusa) is the next step, not wired yet.
>
> **2.2.4**: honest empty plan — with only Windows/macOS machines the right pane no longer claims "all machines are up to date" (the plan covers Linux only); it points to «Esporta downloader…» instead. Download button hidden at zero rows.
>
> **2.2.3**: the per-machine "Scansione aggiornamenti OS" table was removed — version OS, inventory count and status are shown in the "Macchine scansionate" rows.
>
> **2.2.2**: fix — the two-pane OS view rendered empty boxes: `pkgOsMachinesRender`/`pkgOsPkgsRender`/`pkgOsPkgsToggle`/`pkgOsPkgsSelAll` were missing from `obj.exports`, so MeshCentral never serialized them to the browser (the new view called them → undefined → swallowed error → empty panes, on any browser).
>
> **2.2.1**: OS updates two-pane view — left: scanned machines (OS/codename, missing count, dpkg ⚠), right: detected packages (unique per release, deduplicated across machines) with per-package checkboxes, select-all (missing only), already-in-store rows shown as ✓ and non-selectable, and a "Scarica selezionati" button under the list that downloads ONLY the checked packages (osfetch accepts a `packages` filter). The old "Scarica i mancanti sul server" top button is removed.
>
> **2.2.0**: dedicated "Download plugin" tab — (1) plugin version + online/file update + server restart, (2) "Binari del downloader" section with the plugin's own compiled-binary state (7 platforms, files, source URL, last error, "Ritenta installazione" that resets the attempt counter), (3) "Binari agente (core MeshCentral)" clearly separated from the plugin binaries, (4) "Log del plugin" — the plugin now keeps its own detailed log: ring buffer of 500 lines in memory + `pkgmanager.log` in datapath (rotated at 1 MB), every server-side action logged, tail visible from the UI. All plugin server `console.log` lines now flow through the logger.
>
> **2.1.12**: cache-buster on the self-update check — raw/Fastly POPs can be out of sync for minutes (the check answered "already updated" against a stale copy); each check now fetches a unique URL so the version is always read fresh.
>
> **2.1.11**: fix downloader binaries — extraction no longer shells out to `unzip` (absent in minimal LXC containers, which made `ensureBinaries` fail silently and the banner stick on "7 piattaforme mancanti"): now pure-Node yauzl (resolved from the server parentpath, since the plugin lives outside node_modules); retries also on extraction errors; the last error is shown in the banner.
>
> **2.1.10**: fix — `pkgAgentBuild` handler used the wrong signature (`(message)` instead of the UI convention `(server, message)`), so the "Binari agente" panel never populated after clicking Aggiorna.
>
> **2.1.9**: "Binari agente" section in the plugin tab — shows the core's `agentDefaults.status()` (agentbuilds.js): per-file state with a real progress bar while downloading (`received`/`size`), core errors, and the on-disk state (`agentbuilds/` verified cache, `agents/` overrides). Answers "are the agent binaries downloaded or still downloading?" — especially on LXC containers without egress, where files stay `Unavailable` and the panel shows why.
>
> **2.1.8**: "Riavvia server" button in the plugin admin view (admin-only server action via the launcher channel, clean restart in 2s) — handy for the one-time transition restart and as a test trigger.
>
> **2.1.7**: auto-restart everywhere — 60s poll inside the plugin (catches screen-installs where the old cached module keeps running, and the airgap file channel), self-update now aligns config.json and defaults to auto-restart ON (`pkgmanagerAutoRestart: false` to opt out), and every restart goes through the launcher channel (clean restart, no "unexpected exit").
>
> **2.1.6**: auto-restart — after installing/updating the plugin from the Plugins screen, the server restarts automatically (~2s later) so the new code is actually loaded. The restart uses the official launcher channel ("Server restart..." on stdout). Disable with `"autoRestartOnUpdate": false` in config.json.
>
> **2.1.5**: fix — the store package list in "Gestione aggiornamenti OS" never rendered (type mismatch between the osstorelist reply and the render: window.pkgmanagerOsStore.store was read from an array).
>
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
