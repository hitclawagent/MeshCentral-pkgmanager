# MeshCentral Package Manager (pkgmanager)

Plugin per [MeshCentral](https://github.com/Ylianst/MeshCentral): **installazione remota di pacchetti** su agenti Windows, Linux e macOS, catalog-driven, con installazioni **airgap** (i dispositivi non toccano mai internet: scaricano gli artefatti dal server MeshCentral via LAN).

Versione attuale: **2.0.0** — compatibilità: MeshCentral **1.3.1**

## Installazione dal Plugin Manager di MeshCentral

**My Server → Plugins → Add/Install**, incolla questo URL (il formato è lo stesso dei plugin ufficiali: l'URL del `config.json`):

```
https://raw.githubusercontent.com/hitclawagent/MeshCentral-pkgmanager/main/config.json
```

MeshCentral scarica il config, legge `downloadUrl` e installa il plugin (`pkgmanager.js`). Al termine riavvia il server (o attendi il prompt di riavvio).

> **⚠️ Server senza accesso a GitHub (airgap / firewall)**
> Se il tuo server MeshCentral non riesce a raggiungere `raw.githubusercontent.com`, l'installazione fallisce con un errore sul config.json. In quel caso:
>
> ```bash
> # Sulla macchina del server MeshCentral
> mkdir -p /tmp/pkginstall && cd /tmp/pkginstall
> curl -sLO https://raw.githubusercontent.com/hitclawagent/MeshCentral-pkgmanager/main/config.json
> curl -sLO https://raw.githubusercontent.com/hitclawagent/MeshCentral-pkgmanager/main/pkgmanager-code-latest.zip
> python3 -m http.server 8077 &
> ```
> e incolla nel Plugin Manager: `http://127.0.0.1:8077/config.json`
>
> Nota: anche il controllo aggiornamenti del Plugin Manager fa fetch del `configUrl` su GitHub, quindi su un server senza accesso outbound mostrerà errori: è atteso, non è un bug del plugin.

## Installazione manuale (airgap totale)

Scarica `pkgmanager-code-latest.zip` (o l'asset della release), copialo sul server e:

- estrai `pkgmanager.js` e `config.json` in `<meshcentral>/plugins/pkgmanager/`
- riavvia MeshCentral

## Cosa fa

- **Catalogo pacchetti** gestito dagli admin (per-OS: Windows cmd / PowerShell, Linux/macOS shell) con comando di installazione **e disinstallazione obbligatori**, generati in automatico dai preset per `.deb`, `.rpm`, `.apk`, `.msi`, `.exe`, `.pkg`, `.app`, `.sh`
- **Installa/Elimina pacchetti** con multi-selezione: checkbox sui target (con filtro OS), batch install/delete in un unico dialog risultati
- **Airgap**: gli artefatti si caricano sul server (store lato server), il dispositivo scarica da **questo** server via LAN con verifica **SHA-384** prima dell'installazione (placeholder `{{url}}` / `{{sha384}}` nei comandi)
- **Gestione aggiornamenti OS**: versioni per-OS + comandi di version-check, matrice "installate vs disponibili" e aggiornamento in un click dei pacchetti superati
- **Creazione pacchetti**: wizard guidato con upload artefatti dal browser, controllo ID live, merge multi-OS
- Le installazioni viaggiano sul canale `runcommands` con check dei diritti di MeshCentral: l'output torna nel dialog risultati standard
- Il filtro artefatti live in My Files: il store è navigabile dalla cartella "Pacchetti (pkgmanager)" in My Files degli admin

## Menu

Il plugin aggiunge tre voci alla barra grigia superiore (stile tab core):

- **Installazione pacchetti** — tutti gli utenti
- **Gestione pacchetti** — solo full site admin
- **Creazione pacchetti** — solo full site admin
- e un **tab "Aggiorna plugin"** con i pulsanti di aggiornamento e la versione corrente

## Struttura repo

```
pkgmanager.js              # codice completo del plugin (server + client)
config.json                # manifest plugin (configUrl/downloadUrl per il Plugin Manager)
pkgmanager-code-latest.zip # pacchetto d'installazione (js + config), filename stabile
tools/meshos-downloader/   # sorgente Go del downloader per-OS
tools/meshos-fetch.js      # fetch/verify lato server degli artefatti
```

## Release

Gli asset versionati sono nelle [Release](https://github.com/hitclawagent/MeshCentral-pkgmanager/releases):

- `pkgmanager-code-X.Y.Z.zip` — solo codice plugin (per il Plugin Manager)
- `pkgmanager-full-X.Y.Z.zip` — plugin + binari downloader per-OS (airgap completo)

## Licenza

Uso interno/di laboratorio. Basato sull'API plugin di MeshCentral 1.3.1.
