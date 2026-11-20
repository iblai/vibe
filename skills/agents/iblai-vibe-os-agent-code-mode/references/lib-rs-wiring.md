# Wiring the modules into `src-tauri/src/lib.rs`

The shipped `.rs` files are self-contained except for what the host crate
must provide: the module declarations with the right `cfg` gates, an
`emit_on_main` helper, `log_fe`, and five modules the Code files reach into
— the Cowork driver (`cua_driver_mcp`, `cua_driver_installer`), the
on-device models (`model_manager`, `foundry_manager`) and error reporting
(`telemetry`). §4 has stubs for all five. Everything below merges into the
`lib.rs` that
[`/iblai-vibe-ops-build`](../../../ship/iblai-vibe-ops-build/SKILL.md)
generated; this exact wiring passes `cargo check` on that template for
macOS, iOS and Android.

## 1. Module declarations

Code spawns downloaded binaries, so its modules are desktop-only. The phone
client is compiled everywhere (its tests run on the host) but registered
only on mobile.

```rust
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
mod code_agent_installer;
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
mod code_agent_models;
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
mod opencode_acp;
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
mod opencode_installer;
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
mod opencode_proxy;
// Remote Code host — desktop only, like everything opencode: it spawns the
// managed binary in `serve` mode for mobile clients to connect to.
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
mod remote_code;
// Phone-side Code: the opencode_* commands as proxies to a paired desktop's
// opencode server. Compiled everywhere so its tests run on the host; the
// commands are registered only on mobile.
#[allow(dead_code)]
mod remote_code_client;
// What the Code modules reach for elsewhere in the app. Stubs (§4) until you
// add Cowork (/iblai-vibe-os-agent-cowork) or on-device models.
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
#[allow(dead_code)]
mod cua_driver_installer;
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
#[allow(dead_code)]
mod cua_driver_mcp;
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
#[allow(dead_code)]
mod foundry_manager;
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
#[allow(dead_code)]
mod model_manager;
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
#[allow(dead_code)]
mod telemetry;
```

`opencode_build_prompt.txt` sits beside the modules — `opencode_acp.rs`
pulls it in with `include_str!`, so keep the filename.

## 2. `emit_on_main` (used by `opencode_acp.rs` and `remote_code_client.rs`)

On mobile, `AppHandle::emit` from a worker thread can deadlock against the
main thread's webview mutex (the watchdog then kills the app after 10 s).
Every background emit goes through this, which also keeps a turn's events
in order:

```rust
use tauri::{AppHandle, Emitter};

/// Emit from the main thread — a worker calling `emit` while the main
/// thread is inside IPC or a window event hangs both on mobile.
pub(crate) fn emit_on_main<S>(app: &AppHandle, event: &str, payload: S)
where
    S: serde::Serialize + Clone + Send + 'static,
{
    let handle = app.clone();
    let name = event.to_string();
    if let Err(err) = app.run_on_main_thread(move || {
        let _ = handle.emit(&name, payload);
    }) {
        eprintln!("[emit_on_main] could not schedule '{event}' on main thread: {err}");
    }
}
```

## 3. `log_fe` (the SDK's `logToHost`)

`opencode-client.ts` fire-and-forgets `invoke("log_fe", { s })` so chat-path
decisions reach the `tauri dev` log stream. Register it (`allow-log-fe` is
in the `code-mode` set):

```rust
#[tauri::command]
async fn log_fe(s: Option<String>) -> Result<(), String> {
    if let Some(val) = s {
        println!("[frontend] {val}");
    }
    Ok(())
}
```

## 4. Stubs for what you have not added

Create each file in `src-tauri/src/` unless your app already has the real
module. They compile and keep cloud Code working: a Cowork turn, an
on-device turn and `check_code_local_model` report "not available".

**Cowork.** `opencode_acp.rs` gives a Code turn sent with `cowork: true`
the screen tools, and `code_agent_installer.rs` verifies its downloads with
two helpers from the Cowork installer. When you add
[`/iblai-vibe-os-agent-cowork`](../../iblai-vibe-os-agent-cowork/SKILL.md),
its two real files replace these.

```rust
// src-tauri/src/cua_driver_mcp.rs
//! Stub: Code without Cowork. Replace with /iblai-vibe-os-agent-cowork's
//! `cua_driver_mcp.rs`. Every Cowork path reports "not supported", so a Code
//! turn sent with `cowork: true` fails before anything is spawned.

use std::path::{Path, PathBuf};

pub(crate) const LOCAL_TOOLS: &[&str] = &[
    "click",
    "get_window_state",
    "hotkey",
    "launch_app",
    "list_apps",
    "list_windows",
    "page",
    "press_key",
    "scroll",
    "set_value",
    "type_text",
];

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct DriverSupport {
    pub supported: bool,
    pub reason: Option<String>,
}

pub struct SessionEnv;

pub fn current_session_env() -> SessionEnv {
    SessionEnv
}

pub fn session_support(_env: &SessionEnv) -> DriverSupport {
    DriverSupport {
        supported: false,
        reason: Some("unsupported_os".to_string()),
    }
}

pub(crate) fn resolved_driver_path() -> Option<PathBuf> {
    None
}

pub(crate) fn proxy_argv(_socket: &Path) -> Vec<String> {
    Vec::new()
}

pub(crate) fn ensure_driver_daemon(
    _driver: &Path,
    _host_bundle_id: &str,
) -> Result<PathBuf, String> {
    Err("Cowork isn't available in this app.".to_string())
}

pub(crate) fn agent_socket(daemon: &Path, _local: bool) -> PathBuf {
    daemon.to_path_buf()
}

pub(crate) fn driver_daemon_alive() -> bool {
    false
}

pub(crate) fn stop_driver() {}
```

```rust
// src-tauri/src/cua_driver_installer.rs
//! Stub: Code without Cowork. Replace with /iblai-vibe-os-agent-cowork's
//! `cua_driver_installer.rs`. Code's agent installer verifies its downloads
//! with these two helpers, so they are the real ones.

/// The SHA-256 for `asset` in a release's checksum list (`<sha256>  <file>` rows).
pub(crate) fn expected_sha256(checksums: &str, asset: &str) -> Option<String> {
    checksums.lines().find_map(|line| {
        let mut parts = line.split_whitespace();
        let sum = parts.next()?;
        let name = parts.next()?;
        (name == asset && sum.len() == 64).then(|| sum.to_ascii_lowercase())
    })
}

pub(crate) fn sha256_hex(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    hex::encode(Sha256::digest(bytes))
}
```

Without Cowork, also turn the SDK chat's Cowork pill off —
`config.features.cowork = false` on `<Chat>` — or it offers to install a
driver the app cannot run.

**On-device models.** `opencode_acp.rs` lets the user run Code against an
on-device model (`ollama/<id>` or `foundry/<id>`), sizes the Ollama model to
a 32,768-token window first (`sized_local_model`; a Code turn needs at least
16,384), and keeps it loaded for 15 minutes after a turn. These come from
the local-LLM implementation
([`/iblai-vibe-local-llm`](../../iblai-vibe-local-llm/SKILL.md)); its
`model_manager` must provide all of the names below. Without on-device
models:

```rust
// src-tauri/src/model_manager.rs
//! Stub: no on-device models. Replace with your /iblai-vibe-local-llm
//! implementation; cloud Code never calls these.

pub const OLLAMA_API_URL: &str = "http://localhost:11434";
pub const LOCAL_CODE_MIN_CONTEXT_TOKENS: u32 = 16_384;
pub const LOCAL_COWORK_MIN_CONTEXT_TOKENS: u32 = 8_192;

pub fn start_ollama_server() -> Result<(), String> {
    Err("On-device models are not available in this app.".into())
}

pub async fn wait_for_ollama_ready(_timeout_secs: u64) -> bool {
    false
}

/// The model name to send to Ollama and the context window it loads with.
pub struct SizedModel {
    pub name: String,
    pub context: u32,
}

impl SizedModel {
    /// Why a turn that needs `min` tokens can't run on this model.
    pub fn too_small_for(&self, _min: u32) -> Option<String> {
        None
    }
}

pub async fn sized_local_model(model: &str) -> SizedModel {
    SizedModel {
        name: model.to_string(),
        context: 4_096,
    }
}

pub fn keep_sized_models_loaded() {}
```

```rust
// src-tauri/src/foundry_manager.rs
//! Stub: no Foundry Local. Replace with your /iblai-vibe-local-llm
//! implementation; cloud Code never calls these.

#[derive(Clone, serde::Serialize)]
pub struct FoundryModel {
    pub id: String,
    pub foundry_id: String,
}

#[derive(Clone, serde::Serialize)]
pub struct FoundryStatus {
    pub models: Vec<FoundryModel>,
}

pub fn get_foundry_service_endpoint() -> Option<String> {
    None
}

pub async fn check_foundry_status() -> Result<FoundryStatus, String> {
    Err("Foundry Local is not available in this app.".into())
}
```

**Error reporting.** The OS sends these to Sentry:

```rust
// src-tauri/src/telemetry.rs
//! Stub: error reporting to stderr. The OS app sends these to Sentry; point
//! them at your own reporter if you have one.

use std::fmt::Display;

pub fn report(context: &str, err: impl Display) {
    eprintln!("{context}: {err}");
}

pub fn report_warning(context: &str, err: impl Display) {
    eprintln!("{context}: {err}");
}

pub fn set_tenant(_tenant: &str) {}
```

## 5. Plugins

The template already registers `deep-link`, `opener` and `os`. Code adds
the folder picker, and on phones the QR scanner:

```rust
let builder = tauri::Builder::default()
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_opener::init())   // "Open in Finder"
    .plugin(tauri_plugin_os::init())
    // Code: the "Select Workspace" folder picker.
    .plugin(tauri_plugin_dialog::init());
// Code: the phone scans the desktop's pairing QR.
#[cfg(any(target_os = "ios", target_os = "android"))]
let builder = builder.plugin(tauri_plugin_barcode_scanner::init());
```

`tauri-plugin-shell` is not needed for Code.

## 6. Setup hooks

At the top of the template's `.setup(|app| { … })`:

```rust
// ---- Mobile: Code pairing + per-chat session map storage ----
#[cfg(any(target_os = "ios", target_os = "android"))]
{
    if let Ok(dir) = app.path().app_data_dir() {
        remote_code_client::init(dir);
        // A turn the last run left mid-flight (force-quit, killed)
        // is stopped on the desktop.
        tauri::async_runtime::spawn(remote_code_client::abort_abandoned_turns());
    }
}

// ---- Desktop: keep opencode, the code agents and the vibe skills current ----
#[cfg(not(any(target_os = "ios", target_os = "android")))]
{
    // A pin bump would otherwise never reach a machine that
    // already has a runnable copy.
    let h = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        opencode_installer::ensure_opencode_current(h).await;
    });
    // Codex and Claude Code (a pinned Node plus the pinned ACP
    // adapters) install themselves in the background on every
    // launch; the Code popover shows them loading, never a
    // download the user has to start.
    let h = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        code_agent_installer::ensure_agents_current(h).await;
    });
    // Vibe skills track the latest GitHub release: resolve and
    // sync on every launch.
    let h = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = opencode_installer::ensure_vibe_skills(h).await {
            telemetry::report("[vibe] skills sync failed at startup", e);
        }
    });
}
```

## 7. Commands

The template's single `.invoke_handler(…)` becomes two, one per platform
family, because the desktop modules do not exist on mobile:

```rust
#[cfg(not(any(target_os = "ios", target_os = "android")))]
let builder = builder.invoke_handler(tauri::generate_handler![
    open_external_url,
    allow_in_app_purchase,
    get_locked_tenant,
    log_fe,
    opencode_acp::opencode_chat_stream,
    opencode_acp::opencode_stop,
    opencode_acp::opencode_permission_respond,
    opencode_acp::opencode_close,
    opencode_acp::get_opencode_workspace,
    opencode_acp::set_opencode_workspace,
    opencode_acp::new_opencode_workspace,
    opencode_acp::get_opencode_permission_mode,
    opencode_acp::set_opencode_permission_mode,
    opencode_acp::seed_opencode_permission_mode,
    opencode_acp::set_opencode_skills,
    opencode_acp::begin_opencode_skills_sync,
    opencode_acp::check_code_local_model,
    opencode_acp::set_opencode_learner,
    opencode_acp::ensure_opencode_platform_key,
    opencode_installer::install_opencode,
    opencode_installer::ensure_vibe_skills,
    opencode_installer::check_opencode_status,
    code_agent_installer::check_code_agent_status,
    code_agent_installer::install_code_agent,
    code_agent_models::list_code_agent_models,
    code_agent_models::set_code_agent_model,
    remote_code::remote_code_status,
    remote_code::remote_code_enable,
    remote_code::remote_code_disable,
    remote_code::remote_code_pairing_qr,
]);

#[cfg(any(target_os = "ios", target_os = "android"))]
let builder = builder.invoke_handler(tauri::generate_handler![
    open_external_url,
    allow_in_app_purchase,
    get_locked_tenant,
    log_fe,
    remote_code_client::remote_code_set_host,
    remote_code_client::remote_code_get_host,
    remote_code_client::remote_code_clear_host,
    remote_code_client::opencode_chat_stream,
    remote_code_client::opencode_stop,
    remote_code_client::opencode_close,
    remote_code_client::opencode_permission_respond,
    remote_code_client::get_opencode_permission_mode,
    remote_code_client::set_opencode_permission_mode,
    remote_code_client::seed_opencode_permission_mode,
    remote_code_client::get_opencode_workspace,
    remote_code_client::set_opencode_workspace,
    remote_code_client::new_opencode_workspace,
    remote_code_client::remote_code_list_workspaces,
]);
```

The OS's phone build also registers `local_network::local_network_status`
and `local_network::open_app_settings` (iOS Local Network access, not
shipped here); the button only reaches them on a phone, where the OS hides
the pill for now.

## 8. Exit and resume hooks

The phone-access server must die with the app — an orphan holding a dead
password poisons opencode's machine-global coordination for every later
one. A phone coming back to the foreground has lost its sockets, so a
streaming turn reconnects at once. Replace the template's
`.run(tauri::generate_context!()).expect(…)` with:

```rust
builder
    .setup(|app| { /* … */ Ok(()) })
    .build(tauri::generate_context!())
    .expect("error while building tauri app")
    .run(|_app, _event| {
        #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
        if let tauri::RunEvent::Exit = _event {
            remote_code::shutdown_sync();
        }
        #[cfg(any(target_os = "ios", target_os = "android"))]
        if let tauri::RunEvent::WindowEvent {
            event: tauri::WindowEvent::Resumed,
            ..
        } = _event
        {
            remote_code_client::app_resumed();
        }
    });
```

## 9. `build.rs`

No change needed for Code itself. (`opencode_build_prompt.txt` is compiled
in via `include_str!`, which Cargo tracks on its own.)
