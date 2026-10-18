//! B4: one picture of the Master Duel window, and the system-wide shortcut that asks for it.
//!
//! * Only on demand: a capture happens when the user presses the shortcut or the button, never on a timer.
//! * Only the game's own window (found by its process name / title), never the whole screen.
//! * Only in memory: the pixels go straight back to the page that asked; nothing is written to disk or logged.
//! * Read only: the game is not touched in any way (no input, no memory access).

use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};

/// Sent to the window that should capture when the shortcut is pressed (see `src/app/desktop/desktop-apis.ts`).
pub const SHORTCUT_EVENT: &str = "game-capture-shortcut";
/// The compact battle window (B5); when it is open it receives the shortcut instead of the main window.
pub const BATTLE_WINDOW: &str = "battle";
/// Matches `MAX_SCREENSHOT_SIDE` in `src/app/core/recognition.ts`.
const MAX_SIDE: u32 = 8192;

/// The shortcut that is registered now, if any.
#[derive(Default)]
pub struct CaptureState {
    shortcut: Mutex<Option<Shortcut>>,
}

/// Whether a window belongs to Master Duel: the process is `masterduel.exe` and/or the window is titled "masterduel".
pub fn is_game_window(app_name: &str, title: &str) -> bool {
    let app = app_name.trim().to_ascii_lowercase();
    let title = title.trim().to_ascii_lowercase();
    app == "masterduel" || app == "masterduel.exe" || title == "masterduel"
}

/// `width`, `height` (little-endian u32) and the RGBA pixels, the layout `parseFrame` reads on the page.
pub fn encode_frame(width: u32, height: u32, rgba: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(8 + rgba.len());
    out.extend_from_slice(&width.to_le_bytes());
    out.extend_from_slice(&height.to_le_bytes());
    out.extend_from_slice(rgba);
    out
}

/// Captures the Master Duel window. Errors are written for the user (shown as they are).
#[tauri::command]
pub async fn capture_game_window() -> Result<tauri::ipc::Response, String> {
    tauri::async_runtime::spawn_blocking(capture_blocking)
        .await
        .map_err(|e| format!("內部錯誤：{e}"))?
        .map(tauri::ipc::Response::new)
}

#[cfg(windows)]
fn capture_blocking() -> Result<Vec<u8>, String> {
    let windows = xcap::Window::all().map_err(|e| format!("無法列出視窗：{e}"))?;
    let mut found = false;
    let mut best: Option<(u64, xcap::Window)> = None;
    for window in windows {
        let app = window.app_name().unwrap_or_default();
        let title = window.title().unwrap_or_default();
        if !is_game_window(&app, &title) {
            continue;
        }
        found = true;
        if window.is_minimized().unwrap_or(false) {
            continue;
        }
        let area = u64::from(window.width().unwrap_or(0)) * u64::from(window.height().unwrap_or(0));
        if area > 0 && best.as_ref().map_or(true, |(a, _)| area > *a) {
            best = Some((area, window));
        }
    }
    let Some((_, window)) = best else {
        return Err(if found {
            "Master Duel 視窗已縮到最小，請先把遊戲視窗還原再截圖。".into()
        } else {
            "找不到 Master Duel 視窗。請確認遊戲已開啟，並使用視窗模式（不要用獨佔全螢幕）。".into()
        });
    };
    let image = window.capture_image().map_err(|e| format!("截取遊戲視窗失敗：{e}"))?;
    let (width, height) = image.dimensions();
    if width == 0 || height == 0 || width > MAX_SIDE || height > MAX_SIDE {
        return Err(format!("遊戲視窗大小 {width}×{height} 無法辨識。"));
    }
    Ok(encode_frame(width, height, image.as_raw()))
}

#[cfg(not(windows))]
fn capture_blocking() -> Result<Vec<u8>, String> {
    Err("只有 Windows 版可以截取遊戲視窗。".into())
}

/// The window that should react to the shortcut: the compact battle window when it is open, otherwise the main window.
fn shortcut_target(app: &AppHandle) -> &'static str {
    if app.get_webview_window(BATTLE_WINDOW).is_some() {
        BATTLE_WINDOW
    } else {
        "main"
    }
}

/// Handler of the global-shortcut plugin: tells the right window to capture. Never steals the focus from the game.
pub fn on_shortcut(app: &AppHandle, _shortcut: &Shortcut, event: ShortcutEvent) {
    if event.state() == ShortcutState::Pressed {
        let _ = app.emit_to(shortcut_target(app), SHORTCUT_EVENT, ());
    }
}

/// Replaces the capture shortcut (`None` or an empty text removes it). A shortcut another program already owns is
/// reported, and the previous one is kept.
#[tauri::command]
pub fn set_capture_shortcut(app: AppHandle, accelerator: Option<String>) -> Result<(), String> {
    let state = app.state::<CaptureState>();
    let mut current = state.shortcut.lock().map_err(|_| "內部錯誤".to_string())?;
    let next = match accelerator.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(text) => Some(text.parse::<Shortcut>().map_err(|e| format!("快捷鍵「{text}」無法使用：{e}"))?),
        None => None,
    };
    if next == *current {
        return Ok(());
    }
    let shortcuts = app.global_shortcut();
    if let Some(new) = next {
        shortcuts
            .register(new)
            .map_err(|e| format!("無法註冊快捷鍵（可能已被其他程式使用）：{e}"))?;
    }
    if let Some(old) = current.take() {
        let _ = shortcuts.unregister(old);
    }
    *current = next;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_master_duel_by_process_or_title() {
        assert!(is_game_window("masterduel.exe", ""));
        assert!(is_game_window("MasterDuel", "something"));
        assert!(is_game_window("", "masterduel"));
        assert!(!is_game_window("chrome.exe", "Master Duel Meta - top decks"));
        assert!(!is_game_window("explorer.exe", "masterduel replays"));
    }

    /// Manual check on Windows: open a window titled "masterduel" filled with pure red, then run
    /// `cargo test -- --ignored captures_a_window_titled_masterduel`.
    #[cfg(windows)]
    #[test]
    #[ignore]
    fn captures_a_window_titled_masterduel() {
        let frame = capture_blocking().expect("capture");
        let width = u32::from_le_bytes(frame[0..4].try_into().unwrap()) as usize;
        let height = u32::from_le_bytes(frame[4..8].try_into().unwrap()) as usize;
        assert!(width > 100 && height > 100);
        let center = 8 + ((height / 2) * width + width / 2) * 4;
        assert_eq!(&frame[center..center + 3], &[255, 0, 0], "the middle of the window is red");
    }

    #[test]
    fn frame_header_is_little_endian_width_then_height() {
        let frame = encode_frame(2, 1, &[1, 2, 3, 4, 5, 6, 7, 8]);
        assert_eq!(&frame[..8], &[2, 0, 0, 0, 1, 0, 0, 0]);
        assert_eq!(frame.len(), 16);
    }
}
