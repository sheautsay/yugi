// Hides the console window in release builds on Windows (DK3: no console window).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ygo_combo_assistant_lib::run()
}
