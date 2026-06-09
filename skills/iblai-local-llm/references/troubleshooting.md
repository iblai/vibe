# Troubleshooting

Common failure modes for a local-LLM implementation following this
contract. Listed in roughly the order a fresh install hits them.

## `Command 'install_ollama' not found`

Your Rust commands aren't registered. Verify:

```rust
// src-tauri/src/lib.rs
.invoke_handler(tauri::generate_handler![
    install_ollama,        // ← every name from TAURI_COMMANDS goes here
    stop_ollama,
    check_ollama_status,
    check_disk_space_for_model,
    get_system_memory,
    download_model,
    cancel_model_download,
    check_network_status,
    get_os_type,
    ollama_chat,
    ollama_chat_stream,
])
```

Rebuild after editing — Tauri's command registry is baked at compile
time.

## A command never runs — no `println!` / no error, just silence

A command that's correctly registered can still *never fire*. Two
distinct causes, both of which look identical from the terminal (the
backend `println!` you added simply never prints):

**1 — a front-end guard returns before the `invoke`.** If the click
handler does a catalog lookup or capacity check *before* calling the
command, an early `return` skips it. This bit `get_system_memory`: the
handler returned on "unknown model" before ever reading memory, so the
probe never ran. Fix — **invoke the backend command first, unconditionally**,
then branch on the result:

```ts
const handleDownload = async (modelId: string) => {
  // hit the backend FIRST so the call always happens
  let mem: SystemMemory | null = null;
  try { mem = await invoke<SystemMemory>(TAURI_COMMANDS.GET_SYSTEM_MEMORY); }
  catch { mem = systemMemory ?? null; }   // fall back to the value read on mount

  const model = CATALOG.find((m) => m.id === modelId);
  if (!model) { startDownloadNow(modelId); return; }   // guard AFTER the invoke
  if (modelExceedsCapacity(model, mem)) { setPendingModel(model); return; }
  startDownloadNow(modelId);
};
```

**2 — registered in only one of the two handler blocks.** Tauri v2 apps
have two entry points — `main.rs` (desktop binary) and `lib.rs` (mobile
`cdylib`), and `lib.rs` often carries **two** `generate_handler!` blocks
(`#[cfg(not(any(ios, android)))]` desktop + `#[cfg(any(ios, android))]`
mobile). A command added to `main.rs` but missing from the `lib.rs`
desktop block (or vice-versa) is absent in whichever binary you actually
launched. Add every new command to **all** `generate_handler!` blocks
and confirm which entry point `tauri dev` builds.

Verify the call even reaches Rust by tailing the `tauri dev` terminal,
or from the webview devtools:
`await window.__TAURI_INTERNALS__.invoke('get_system_memory')`.

## `useLocalLLM` reports `isAvailable: false` in a Tauri dev build

The hook detects Tauri via `__TAURI_INTERNALS__` on `window`. If you
get `false`:

1. Confirm `app.withGlobalTauri: true` in
   `src-tauri/tauri.conf.json`.
2. Check that you're running through `iblai builds dev` (or
   `cargo tauri dev`), not `pnpm dev` in a normal browser tab.
3. Open devtools on the Tauri window and run
   `Object.keys(window).filter(k => k.startsWith('__TAURI'))` — at
   least one of `__TAURI_INTERNALS__`, `__TAURI__` must appear.

## Download stalls at 0 % forever

Usually a network reach problem on the Ollama daemon's first model
pull (not the front-end → Rust hop).

- Run `ollama pull phi3:mini` manually in a terminal — if it stalls
  there too, it's network / DNS.
- Check whether the daemon is actually running:
  `curl http://127.0.0.1:11434/api/tags`. If that hangs, the daemon
  isn't up; the `install_ollama` command failed silently.
- macOS Gatekeeper sometimes quarantines the freshly-downloaded
  `Ollama.app` — run
  `xattr -dr com.apple.quarantine /Applications/Ollama.app`.

## "Insufficient disk space" with plenty of free space

`check_disk_space_for_model` typically inspects `~/.ollama` (or the
user home if that doesn't exist yet). When the user home and
`/Applications` live on different volumes (a multi-disk Mac, or
`/home` mounted on a separate partition on Linux), the check reads
the wrong volume.

Workaround: bump the threshold in your implementation, or override
the path it inspects.

## Foundry path silently never activates on Windows

You haven't registered the Foundry commands — see
[`foundry-status.md`](foundry-status.md). Symptom is the hook always
falls back to Ollama on a Copilot+ PC because `check_foundry_status`
rejects.

## `ollama_chat_stream` emits `error` events but the UI doesn't show anything

The SDK keys events by `generation_id`. If two chat turns fire
concurrently, listeners can race. Confirm:

- You're passing a fresh `generation_id` (e.g.
  `crypto.randomUUID()`) per send.
- The SDK's `<Chat>` is mounted exactly once on the route. A second
  mount creates a second listener that swallows events from the
  first.

## Models eat all my RAM

Phi-3 Mini needs ~4 GB resident. On 8 GB machines you'll see swap
and sluggish UI. Either:

- **Warn before the download.** Call `get_system_memory` and compare the
  catalog size against `max(ram_total, vram_total)`; gate oversized
  pulls behind a confirm dialog (see SKILL.md "Field notes"). Remember
  `vram_total` is `0` on integrated/Apple-unified GPUs, so always fall
  back to `ram_total` — never threshold on VRAM alone.
- Offer a smaller model: `qwen2.5:0.5b` (~1 GB) or `llama3.2` (~2 GB).
  Because `download_model` takes the tag as an argument, this is just a
  different catalog entry — no Rust change.
- Tell the Ollama daemon to evict idle models faster:
  `OLLAMA_KEEP_ALIVE=30s` before launching.

## Tauri build fails with `feature std::os::windows::process not found`

You're cross-compiling Windows code on a non-Windows host without
target features. Either build on Windows itself or add the right
target with `rustup target add x86_64-pc-windows-msvc` and run
`cargo build --target x86_64-pc-windows-msvc`.

## `install_ollama` does nothing / fails silently on Linux

The official `install.sh` installs to `/usr/local/bin/ollama` and sets
up an `ollama` systemd service + user — all via `sudo`. When a non-root
Tauri app spawns `sh -c "curl -fsSL https://ollama.com/install.sh | sh"`
there's no TTY for `sudo` to prompt on, so the privileged steps fail and
the model never appears.

- Install Ollama once yourself (`curl … | sh` in a terminal with sudo,
  or your package manager) — then `check_ollama_status` finds it and the
  home-dir-only `download_model` works without root.
- Or make `install_ollama` rootless: download the static `ollama` binary
  into `~/.local/bin` and run `ollama serve` from there.
- Or detect-and-guide: if not installed, show instructions instead of
  auto-running the privileged script.

## Tauri build can't find `../out`, or `next build` errors on `generateStaticParams`

The Tauri shell defaults to a static export (`frontendDist: "../out"`),
but a server-rendered app with dynamic routes can't be exported:

```
Error: Page "/x/[id]/[[...slug]]" is missing "generateStaticParams()"
so it cannot be used with "output: export" config.
```

Don't try to convert every route. Keep `output: 'standalone'` and point
Tauri **dev** at the running Next server with `beforeDevCommand:
"pnpm dev"` + `devUrl: "http://localhost:3000"` (see SKILL.md "Field
notes"). For production, host the frontend and point `frontendDist` at
that URL.

## `cargo` build panics in `libdbus-sys` / `webkit2gtk-sys` (not your code)

A failure like `libdbus-sys … build.rs panicked` or a `pkg-config` "No
package 'dbus-1' found" is a **missing system library**, not a bug in
your Rust. These GUI/system-binding crates are tauri dependencies and
compile *before* your crate, so they mask your own errors. Install the
dev libs (Linux: `libdbus-1-dev`, `libwebkit2gtk-4.1-dev`,
`libsoup-3.0-dev`, …) and re-run; only then does `cargo check` reach
`src-tauri/src/` and report real issues in your commands.

## Cleanup

To wipe local state for a fresh start:

```bash
# Front-end persistence
localStorage.removeItem("model_download_state");
localStorage.removeItem("model_download_prompt_dismissed");
localStorage.removeItem("selected_foundry_model");

# Ollama models + daemon
ollama rm phi3:mini
killall ollama          # macOS / Linux
```
