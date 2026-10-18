mod bridge;
mod capture;

use tauri::{Manager, RunEvent};

/// Brings the main window back to the front, e.g. after the ChatGPT sign-in finished in the system browser.
#[tauri::command]
fn focus_main_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// "Save as" for exports and backups: the user picks the file in the Windows dialog and only that file is written.
/// Done here so the page needs no file-system permission outside the automatic-backup folder.
#[tauri::command]
async fn save_text_file(app: tauri::AppHandle, default_name: String, text: String) -> Result<bool, String> {
    use tauri_plugin_dialog::DialogExt;
    // The dialog runs on the UI thread, owned by the main window (modal to it); the answer comes back through a channel.
    let (tx, rx) = std::sync::mpsc::channel();
    let mut dialog = app.dialog().file().set_file_name(&default_name).add_filter("JSON", &["json"]);
    // Start in the user's Documents folder (as Windows reports it), never in the program's working directory.
    if let Ok(documents) = app.path().document_dir() {
        dialog = dialog.set_directory(documents);
    }
    if let Some(window) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&window);
    }
    dialog.save_file(move |picked| {
        let _ = tx.send(picked);
    });
    let picked = tauri::async_runtime::spawn_blocking(move || rx.recv().ok().flatten())
        .await
        .map_err(|e| format!("內部錯誤：{e}"))?;
    let Some(picked) = picked else { return Ok(false) };
    let path = picked.into_path().map_err(|e| format!("無法使用所選的位置：{e}"))?;
    std::fs::write(&path, text).map_err(|e| format!("無法寫入檔案：{e}"))?;
    Ok(true)
}

pub fn run() {
    let app = tauri::Builder::default()
        // A second launch brings the existing window forward instead of starting another app
        // (two apps would each start their own ChatGPT service on the same credentials folder).
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().with_handler(capture::on_shortcut).build())
        .manage(bridge::BridgeState::default())
        .manage(capture::CaptureState::default())
        .invoke_handler(tauri::generate_handler![
            bridge::bridge_start,
            bridge::bridge_stop,
            focus_main_window,
            save_text_file,
            capture::capture_game_window,
            capture::set_capture_shortcut
        ])
        .build(tauri::generate_context!())
        .expect("error while building the application");

    app.run(|handle, event| {
        // The sidecar ends with the app on every normal exit path; if the app is killed instead, the
        // Windows job object (see bridge.rs) and the sidecar's own stdin watchdog end it.
        if let RunEvent::Exit | RunEvent::ExitRequested { .. } = event {
            if let Some(state) = handle.try_state::<bridge::BridgeState>() {
                state.stop();
            }
        }
    });
}
