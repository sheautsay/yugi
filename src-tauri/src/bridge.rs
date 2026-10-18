//! Lifecycle of the local ChatGPT service (the `ygo-bridge` sidecar, a standalone Node executable).
//!
//! * Started on demand by `bridge_start` (when the user opens ChatGPT features), reused while it runs, and started
//!   again if it has ended.
//! * Gets a fresh random secret on every start, through its stdin only; the frontend receives the same secret to
//!   put on its requests. Nothing is written to disk or logged.
//! * Cannot be left behind: it runs inside a Windows job object that kills it when this process ends for any
//!   reason (also a crash or "End task"), it is stopped on every normal exit, and the sidecar ends by itself when
//!   its stdin closes.

use std::io::{BufRead, BufReader, Read, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const READY_PREFIX: &str = "YGO_BRIDGE_READY ";
/// A cold start of a fresh, unsigned executable can take several seconds while Windows scans it.
const START_TIMEOUT: Duration = Duration::from_secs(40);
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Clone, Serialize)]
pub struct BridgeSession {
    pub port: u16,
    pub token: String,
}

struct Running {
    child: Child,
    /// Kept open on purpose: closing it tells the sidecar its host is gone.
    stdin: Option<ChildStdin>,
    session: BridgeSession,
}

/// How long a normal stop lets the sidecar finish by itself (it first saves a token refresh that is in flight:
/// OpenAI has already rotated the refresh token once it answers) before it is killed.
const GRACEFUL_STOP: Duration = Duration::from_secs(8);

#[derive(Default)]
pub struct BridgeState {
    running: Mutex<Option<Running>>,
    #[cfg(windows)]
    job: Mutex<Option<job::Job>>,
}

impl BridgeState {
    /// Ends the sidecar if one is running: closes its stdin (it then finishes and exits by itself), and kills it only if
    /// it is still running after [`GRACEFUL_STOP`]. Safe to call any number of times.
    pub fn stop(&self) {
        let taken = self.running.lock().ok().and_then(|mut guard| guard.take());
        if let Some(mut running) = taken {
            drop(running.stdin.take());
            let deadline = Instant::now() + GRACEFUL_STOP;
            while Instant::now() < deadline {
                match running.child.try_wait() {
                    Ok(Some(_)) => return,
                    Ok(None) => std::thread::sleep(Duration::from_millis(50)),
                    Err(_) => break,
                }
            }
            let _ = running.child.kill();
            let _ = running.child.wait();
        }
    }
}

#[derive(Deserialize)]
struct Ready {
    port: u16,
}

enum Event {
    Ready(u16),
    Ended(String),
}

fn sidecar_path() -> Result<std::path::PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| format!("找不到程式位置：{e}"))?;
    let dir = exe.parent().ok_or("找不到程式資料夾")?;
    let path = dir.join("ygo-bridge.exe");
    if path.is_file() {
        Ok(path)
    } else {
        Err(format!("找不到本機 ChatGPT 服務檔案：{}", path.display()))
    }
}

fn new_secret() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).map_err(|e| format!("無法產生授權祕密：{e}"))?;
    Ok(bytes.iter().map(|b| format!("{b:02x}")).collect())
}

fn start_blocking(app: &AppHandle) -> Result<BridgeSession, String> {
    let state = app.state::<BridgeState>();
    let mut guard = state.running.lock().map_err(|_| "內部狀態錯誤")?;

    if let Some(running) = guard.as_mut() {
        match running.child.try_wait() {
            Ok(None) => return Ok(running.session.clone()),
            _ => {
                *guard = None; // it ended: start a new one below
            }
        }
    }

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("找不到資料資料夾：{e}"))?
        .join("chatgpt");
    let token = new_secret()?;

    let mut command = Command::new(sidecar_path()?);
    command
        .arg("--desktop")
        .env("YGO_CHATGPT_DIR", &data_dir)
        .env_remove("YGO_CHATGPT_BRIDGE_PORT")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    let mut child = command.spawn().map_err(|e| format!("無法啟動本機 ChatGPT 服務：{e}"))?;

    #[cfg(windows)]
    {
        // Best effort: if the job cannot be created the sidecar still ends with its stdin and on normal exit.
        if let Ok(mut job) = state.job.lock() {
            if job.is_none() {
                *job = job::Job::new();
            }
            if let Some(job) = job.as_ref() {
                job.assign(&child);
            }
        }
    }

    let mut stdin = child.stdin.take().ok_or("無法連接服務的輸入")?;
    stdin
        .write_all(format!("{token}\n").as_bytes())
        .and_then(|_| stdin.flush())
        .map_err(|e| format!("無法交付授權祕密：{e}"))?;

    let stdout = child.stdout.take().ok_or("無法讀取服務的輸出")?;
    let stderr = child.stderr.take().ok_or("無法讀取服務的錯誤輸出")?;
    let errors = Arc::new(Mutex::new(String::new()));
    {
        let errors = errors.clone();
        std::thread::spawn(move || {
            // Keep draining so the sidecar never blocks on a full pipe; remember only the first lines for a failed start.
            let mut text = String::new();
            let mut reader = BufReader::new(stderr);
            let _ = reader.by_ref().take(4096).read_to_string(&mut text);
            if let Ok(mut slot) = errors.lock() {
                *slot = text;
            }
            let _ = std::io::copy(&mut reader, &mut std::io::sink());
        });
    }
    let (tx, rx) = mpsc::channel::<Event>();
    {
        let errors = errors.clone();
        std::thread::spawn(move || {
            let mut reported = false;
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if !reported {
                    if let Some(json) = line.strip_prefix(READY_PREFIX) {
                        if let Ok(ready) = serde_json::from_str::<Ready>(json) {
                            reported = true;
                            let _ = tx.send(Event::Ready(ready.port));
                        }
                    }
                }
            }
            if !reported {
                std::thread::sleep(Duration::from_millis(150)); // let the stderr reader finish
                let detail = errors.lock().map(|e| e.trim().to_string()).unwrap_or_default();
                let _ = tx.send(Event::Ended(detail));
            }
        });
    }

    match rx.recv_timeout(START_TIMEOUT) {
        Ok(Event::Ready(port)) if port > 0 => {
            let session = BridgeSession { port, token };
            *guard = Some(Running { child, stdin: Some(stdin), session: session.clone() });
            Ok(session)
        }
        Ok(Event::Ready(_)) => {
            let _ = child.kill();
            let _ = child.wait();
            Err("本機 ChatGPT 服務回報了不正確的埠號".into())
        }
        Ok(Event::Ended(detail)) => {
            let _ = child.wait();
            Err(if detail.is_empty() { "本機 ChatGPT 服務啟動後立即結束".into() } else { format!("本機 ChatGPT 服務無法啟動：{detail}") })
        }
        Err(_) => {
            let _ = child.kill();
            let _ = child.wait();
            Err("本機 ChatGPT 服務啟動逾時".into())
        }
    }
}

/// Returns the running service's port and secret, starting it first when needed.
#[tauri::command]
pub async fn bridge_start(app: AppHandle) -> Result<BridgeSession, String> {
    tauri::async_runtime::spawn_blocking(move || start_blocking(&app))
        .await
        .map_err(|e| format!("內部錯誤：{e}"))?
}

#[tauri::command]
pub fn bridge_stop(app: AppHandle) {
    app.state::<BridgeState>().stop();
}

#[cfg(windows)]
mod job {
    use std::os::windows::io::AsRawHandle;
    use std::process::Child;

    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation, SetInformationJobObject,
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    /// A job object that kills every process in it when its last handle closes — which Windows does when this
    /// process ends, however it ends.
    pub struct Job(isize);

    // The handle is only used behind a Mutex.
    unsafe impl Send for Job {}

    impl Job {
        pub fn new() -> Option<Job> {
            unsafe {
                let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
                if handle.is_null() {
                    return None;
                }
                let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                let ok = SetInformationJobObject(
                    handle,
                    JobObjectExtendedLimitInformation,
                    &info as *const _ as *const _,
                    std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                );
                if ok == 0 {
                    CloseHandle(handle);
                    return None;
                }
                Some(Job(handle as isize))
            }
        }

        pub fn assign(&self, child: &Child) -> bool {
            unsafe { AssignProcessToJobObject(self.0 as HANDLE, child.as_raw_handle() as HANDLE) != 0 }
        }
    }

    impl Drop for Job {
        fn drop(&mut self) {
            unsafe {
                CloseHandle(self.0 as HANDLE);
            }
        }
    }
}
