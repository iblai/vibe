# Foundry Local — Windows NPU path

Microsoft Foundry Local is the on-device runtime that targets Windows
Copilot+ PCs and other NPU-equipped Windows machines. It's faster than
Ollama on those devices because it uses the on-chip NPU, not the CPU.

This skill defines the **contract** for adding a Foundry backend to
your vibe app. The hook + Tauri command set listed below is the
shape the SDK consumes; the implementation is up to you.

## Commands the hook calls

Use the names from `assets/nextjs/types/tauri.ts` (`TAURI_COMMANDS`) —
they are canonical and use the `*_foundry_local_*` form
(`check_foundry_local_status`, `start_foundry_local_service`,
`load_foundry_local_model`, `set_selected_foundry_model`). The shorter
names sketched below are illustrative of the *contract surface*, not the
exact strings to invoke:

```
check_foundry_status            -> { is_windows, is_supported, is_available,
                                     has_models, models: FoundryModel[],
                                     endpoint: string | null }
install_foundry                 -> string         (status message)
download_foundry_model_cmd      -> ()             (takes { modelId: string })
load_foundry_model              -> ()             (takes { modelId: string })
save_selected_foundry_model     -> ()             (takes { modelId: string })
get_selected_foundry_model      -> string | null
get_recommended_foundry_models  -> FoundryModel[]
```

## Detection order in the hook

1. `invoke('check_foundry_status')`.
   - If it rejects ("command not found"), fall through to Ollama.
   - If it resolves with `is_supported: false`, fall through to
     Ollama.
   - If `is_supported: true && has_models: true`, prefer Foundry —
     load the saved model (or first available) via
     `load_foundry_model` and report `state: 'completed'`.
2. If `is_supported && !has_models`, surface the "Install Foundry"
   CTA; on confirm, call `install_foundry` then
   `download_foundry_model_cmd`.

The hook code path is forward-compatible: if you register Foundry
commands later, no front-end change is needed.

## Default model

Suggested default for the install flow: `qwen2.5-0.5b` (~1 GB). Edit
the `installFoundry` callback in your hook to change.

## Implementation notes

- Foundry Local exposes a local REST endpoint (`endpoint` field in
  `FoundryStatus`); chat goes over HTTP to that endpoint instead of
  shelling out.
- Model storage lives under `%USERPROFILE%\.foundry\models`.
- Use `save_selected_foundry_model` / `get_selected_foundry_model`
  for persistence; backing the value with a simple JSON file in the
  app's data dir is the usual pattern.
- On non-Windows machines `check_foundry_status` should return
  `{ is_supported: false }` quickly so the Ollama fallback path
  isn't delayed.
