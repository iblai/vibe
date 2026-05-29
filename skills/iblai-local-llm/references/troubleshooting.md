# Troubleshooting

Common failure modes for a local-LLM implementation following this
contract. Listed in roughly the order a fresh install hits them.

## `Command 'install_ollama' not found`

Your Rust commands aren't registered. Verify:

```rust
// src-tauri/src/lib.rs
.invoke_handler(tauri::generate_handler![
    install_ollama,        // ← every name from TAURI_COMMANDS goes here
    check_ollama_status,
    check_disk_space_for_model,
    download_phi3_model,
    cancel_model_download,
    check_network_status,
    get_os_type,
    ollama_chat,
    ollama_chat_stream,
])
```

Rebuild after editing — Tauri's command registry is baked at compile
time.

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

- Use a smaller model: `ollama pull phi3:mini-128k_npu` (1.8 GB) or
  `qwen2.5:0.5b` (1 GB). Update the default in your
  `download_phi3_model` accordingly.
- Tell the Ollama daemon to evict idle models faster:
  `OLLAMA_KEEP_ALIVE=30s` before launching.

## Tauri build fails with `feature std::os::windows::process not found`

You're cross-compiling Windows code on a non-Windows host without
target features. Either build on Windows itself or add the right
target with `rustup target add x86_64-pc-windows-msvc` and run
`cargo build --target x86_64-pc-windows-msvc`.

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
