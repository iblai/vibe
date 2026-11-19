# Wiring the modules into `src-tauri/src/lib.rs`

Cowork sits on top of Code mode's Rust. Its modules call into
`opencode_acp` (`iblai_data_dir`, `augmented_path`,
`close_cowork_sessions`), `opencode_installer` (`is_sandboxed`) and the
host's `emit_on_main`, and Code's `opencode_acp` already calls into
Cowork's. So wire
[`/iblai-vibe-os-agent-code-mode`](../../iblai-vibe-os-agent-code-mode/SKILL.md)
first, exactly as its `references/lib-rs-wiring.md` says (the Code pill
itself is optional: the Rust only has to be there). Then the steps below.
This wiring passes `cargo check` on the `/iblai-vibe-ops-build` template
for macOS, iOS and Android.

## 1. Replace the two stubs, add one module

Copy the three files from [`assets/tauri/src-tauri/src/`](../assets/tauri/src-tauri/src/)
into `src-tauri/src/`. `cua_driver_mcp.rs` and `cua_driver_installer.rs`
overwrite the stubs Code mode had you create; their declarations stay as
they are. Add the third:

```rust
// ---- Cowork (/iblai-vibe-os-agent-cowork) ----
// The on-device model for the webview's Cowork loop.
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
mod local_llm_openai;
```

Both driver files carry `#![cfg(any(target_os = "windows", target_os =
"macos", target_os = "linux"))]` themselves, so they compile to nothing on
a phone.

There is nothing to add for the four macOS setup commands
(`request_cowork_permission`, `open_privacy_settings`, `relaunch_app`,
`bring_app_to_front`): they live in `cua_driver_mcp.rs`, not in `lib.rs`.
`bring_app_to_front` looks for the window labelled `main`, which is the
template's.

## 2. On-device models

`local_llm_openai.rs` reaches into `model_manager` for
`OLLAMA_API_URL`, `start_ollama_server`, `wait_for_ollama_ready`,
`sized_local_model` (`SizedModel { name, .. }` with `too_small_for`),
`keep_sized_models_loaded` and `LOCAL_COWORK_MIN_CONTEXT_TOKENS` (8,192).
Code mode's `model_manager.rs` stub already has all of them; with it, a
Cowork turn on the device's own model answers "On-device models are not
available in this app." and Cowork on the platform's model is unaffected.

## 3. Plugin

```rust
// Cowork: the Accessibility and Screen Recording checks (macOS only).
#[cfg(target_os = "macos")]
let builder = builder.plugin(tauri_plugin_macos_permissions::init());
```

Put it with the other plugins, before `.invoke_handler`. The SDK calls the
plugin's own commands (`plugin:macos-permissions|check_*` and
`request_*`), and `cua_driver_mcp.rs` calls its Rust functions directly.

## 4. Commands

Add to the **desktop** `generate_handler!` only (none of these exist on a
phone):

```rust
cua_driver_installer::install_cua_driver,
cua_driver_installer::check_cua_driver_status,
cua_driver_mcp::cua_driver_support,
cua_driver_mcp::cua_driver_start,
cua_driver_mcp::cua_driver_send,
cua_driver_mcp::cua_driver_stop,
cua_driver_mcp::request_cowork_permission,
cua_driver_mcp::open_privacy_settings,
cua_driver_mcp::relaunch_app,
cua_driver_mcp::bring_app_to_front,
local_llm_openai::local_llm_openai_stream,
local_llm_openai::local_llm_openai_stream_cancel,
```

## 5. Setup and exit hooks

None. The driver is installed the first time Cowork is switched on (the
SDK pill calls `install_cua_driver`), not at launch. Neither driver process
is detached: both stay plain children of the app on purpose, so they keep
its Accessibility and Screen Recording grants. The Code sessions' daemon
also runs with `--parent-liveness-stdio`, which ends it when the app's
pipe closes. The OS adds no exit hook for either.

## 6. `build.rs`

No change. The one `include_str!` in these files is in
`cua_driver_mcp.rs`'s tests.
