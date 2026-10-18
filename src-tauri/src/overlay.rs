//! B5: the battle mode in its own small window that can stay on top of the game.
//!
//! * Same app origin as the main window, so it shares the IndexedDB data (decks, Combos, settings).
//! * Its position and size are remembered by the window-state plugin (the main window is not affected).
//! * Closing it never affects the main window; closing the main window closes it too.

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::capture::BATTLE_WINDOW;

/// Opens the battle window, or brings it forward when it is already open. Async on purpose: on Windows a webview
/// created from a synchronous command never finishes loading (it would stay on about:blank).
#[tauri::command]
pub async fn open_battle_window(app: AppHandle, on_top: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(BATTLE_WINDOW) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }
    WebviewWindowBuilder::new(&app, BATTLE_WINDOW, WebviewUrl::App("battle".into()))
        .title("YGO Combo 助手｜實戰")
        .inner_size(440.0, 780.0)
        .min_inner_size(420.0, 480.0)
        .always_on_top(on_top)
        .build()
        .map(|_| ())
        .map_err(|e| format!("無法開啟實戰小視窗：{e}"))
}

/// Keeps the battle window above other windows (the game) or not.
#[tauri::command]
pub fn set_battle_on_top(app: AppHandle, on_top: bool) -> Result<(), String> {
    match app.get_webview_window(BATTLE_WINDOW) {
        Some(window) => window.set_always_on_top(on_top).map_err(|e| format!("無法變更置頂：{e}")),
        None => Ok(()),
    }
}

/// Called when the main window is gone: the battle window has no purpose without it.
pub fn close_battle_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(BATTLE_WINDOW) {
        let _ = window.close();
    }
}
