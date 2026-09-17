# Wiring the modules into `src-tauri/src/lib.rs`

The shipped `.rs` files are self-contained except for three things the
host crate must provide: the module declarations with the right `cfg`
gates, an `emit_on_main` helper, and (for the on-device model path) the
local-LLM modules. Everything below merges into the `lib.rs` that
[`/iblai-vibe-ops-build`](../../../ship/iblai-vibe-ops-build/SKILL.md)
generated.

## 1. Module declarations

Code spawns a downloaded binary, so its modules are desktop-only. The phone
client is compiled everywhere (its tests run on the host) but registered
only on mobile.

```rust
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
```

`opencode_build_prompt.txt` sits beside the modules — `opencode_acp.rs`
pulls it in with `include_str!`, so keep the filename.

## 2. `emit_on_main` (required by `remote_code_client.rs`)

On mobile, `AppHandle::emit` from a worker thread can deadlock against the
main thread's webview mutex (the watchdog then kills the app after 10 s).
Every background emit on mobile goes through this:

```rust
use tauri::{AppHandle, Emitter, Manager};

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
decisions reach the `tauri ios dev` log stream. Register it (and add
`allow-log-fe` to the capability):

```rust
#[tauri::command]
async fn log_fe(s: Option<String>) -> Result<(), String> {
    if let Some(val) = s {
        println!("[frontend] {val}");
    }
    Ok(())
}
```

## 4. Local-LLM coupling (on-device models)

`opencode_acp.rs` lets the user run Code against an **on-device** model
(`ollama/<id>` or `foundry/<id>`) and reaches for:

```rust
crate::model_manager::OLLAMA_API_URL          // &str, e.g. "http://localhost:11434"
crate::model_manager::start_ollama_server()   // -> Result<(), String>
crate::model_manager::wait_for_ollama_ready(secs: u64).await   // -> bool
crate::foundry_manager::get_foundry_service_endpoint()          // -> Option<String>
crate::foundry_manager::check_foundry_status().await            // -> Result<FoundryStatus, String>
// FoundryStatus { models: Vec<FoundryModel { id, foundry_id, .. }>, .. }
```

These come from the local-LLM implementation
([`/iblai-vibe-local-llm`](../../iblai-vibe-local-llm/SKILL.md)). If your
app has no on-device models, add these **stubs** so the crate compiles and
`check_code_local_model` reports "not running" — cloud Code (the default)
never touches them:

```rust
// src-tauri/src/model_manager.rs
pub const OLLAMA_API_URL: &str = "http://localhost:11434";
pub fn start_ollama_server() -> Result<(), String> {
    Err("On-device models are not available in this app.".into())
}
pub async fn wait_for_ollama_ready(_timeout_secs: u64) -> bool { false }

// src-tauri/src/foundry_manager.rs
#[derive(Clone, serde::Serialize)]
pub struct FoundryModel { pub id: String, pub foundry_id: String }
#[derive(Clone, serde::Serialize)]
pub struct FoundryStatus { pub models: Vec<FoundryModel> }
pub fn get_foundry_service_endpoint() -> Option<String> { None }
pub async fn check_foundry_status() -> Result<FoundryStatus, String> {
    Err("Foundry Local is not available in this app.".into())
}
```

Declare both with the same desktop `cfg` gate as `opencode_acp`.

## 5. Plugins

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())      // open the workspace folder
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_os::init())         // the SDK's isTauriDesktop() reads platform()
    .plugin(tauri_plugin_dialog::init())     // "Select Workspace" folder picker
    // mobile only: the phone scans the desktop's pairing QR
    #[cfg(any(target_os = "ios", target_os = "android"))]
    .plugin(tauri_plugin_barcode_scanner::init())
```

(Apply the `#[cfg]` by building the `Builder` in a `let` and chaining the
mobile plugin under a cfg block, as the OS does.)

## 6. Setup hooks

```rust
.setup(|app| {
    // ---- Mobile: pairing + per-chat session map storage ----
    #[cfg(any(target_os = "ios", target_os = "android"))]
    {
        if let Ok(dir) = app.path().app_data_dir() {
            remote_code_client::init(dir);
        }
    }

    // ---- Desktop: keep opencode + the vibe skills current ----
    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        // A pin bump would otherwise never reach a machine that already has
        // a runnable copy.
        let h = app.handle().clone();
        tauri::async_runtime::spawn(async move {
            opencode_installer::ensure_opencode_current(h).await;
        });
        // Vibe skills track the latest GitHub release with no freshness
        // window — resolve-and-sync on every launch so a fresh machine has
        // them before Code is ever enabled.
        let h = app.handle().clone();
        tauri::async_runtime::spawn(async move {
            let _ = opencode_installer::ensure_vibe_skills(h).await;
        });
    }
    Ok(())
})
```

## 7. Commands

Desktop `generate_handler!` — add alongside your existing commands:

```rust
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
opencode_acp::set_opencode_skills,
opencode_acp::begin_opencode_skills_sync,
opencode_installer::install_opencode,
opencode_installer::ensure_vibe_skills,
opencode_installer::check_opencode_status,
opencode_acp::check_code_local_model,
opencode_acp::set_opencode_learner,
opencode_acp::ensure_opencode_platform_key,
remote_code::remote_code_status,
remote_code::remote_code_enable,
remote_code::remote_code_disable,
remote_code::remote_code_pairing_qr,
```

Mobile `generate_handler!` (a separate `#[cfg(any(ios, android))]` builder,
as the OS does — the desktop modules do not exist on mobile):

```rust
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
remote_code_client::get_opencode_workspace,
remote_code_client::set_opencode_workspace,
remote_code_client::new_opencode_workspace,
remote_code_client::remote_code_list_workspaces,
```

## 8. Exit hook (desktop)

The phone-access server must die with the app — an orphan holding a dead
password poisons opencode's machine-global coordination for every later
one. Replace the template's `.run(tauri::generate_context!()).expect(…)`
with:

```rust
.build(tauri::generate_context!())
.expect("error while building tauri app")
.run(|_app, _event| {
    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    if let tauri::RunEvent::Exit = _event {
        remote_code::shutdown_sync();
    }
});
```

## 9. `build.rs`

No change needed for Code itself. (`opencode_build_prompt.txt` is compiled
in via `include_str!`, which Cargo tracks on its own.)
