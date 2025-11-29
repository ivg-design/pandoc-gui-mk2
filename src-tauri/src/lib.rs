use std::process::Command;
use std::env;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use std::collections::HashMap;

// Track running install processes for cancellation
static NEXT_INSTALL_ID: AtomicU32 = AtomicU32::new(1);
lazy_static::lazy_static! {
    static ref RUNNING_INSTALLS: Mutex<HashMap<u32, std::process::Child>> = Mutex::new(HashMap::new());
}

// Get extended PATH including common installation directories
fn get_extended_path() -> String {
    let current_path = env::var("PATH").unwrap_or_default();
    let home = env::var("HOME").unwrap_or_default();

    if cfg!(target_os = "macos") {
        // macOS common paths for Homebrew, MacPorts, TeX, npm global, etc.
        let mut extra_paths = vec![
            "/usr/local/bin".to_string(),
            "/opt/homebrew/bin".to_string(),
            "/opt/local/bin".to_string(),
            "/Library/TeX/texbin".to_string(),
            "/usr/texbin".to_string(),
            format!("{}/bin", home),
            format!("{}/.local/bin", home),
            format!("{}/.cargo/bin", home),
            // npm global paths
            format!("{}/.npm-global/bin", home),
            format!("{}/node_modules/.bin", home),
            "/usr/local/lib/node_modules/.bin".to_string(),
        ];

        // Find nvm node versions dynamically
        let nvm_dir = format!("{}/.nvm/versions/node", home);
        if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
            for entry in entries.flatten() {
                let bin_path = entry.path().join("bin");
                if bin_path.exists() {
                    extra_paths.push(bin_path.to_string_lossy().to_string());
                }
            }
        }

        format!("{}:{}", extra_paths.join(":"), current_path)
    } else if cfg!(target_os = "linux") {
        let extra_paths = vec![
            "/usr/local/bin".to_string(),
            format!("{}/bin", home),
            format!("{}/.local/bin", home),
            format!("{}/.cargo/bin", home),
            "/usr/local/texlive/2024/bin/x86_64-linux".to_string(),
            "/usr/local/texlive/2023/bin/x86_64-linux".to_string(),
            // npm global paths
            format!("{}/.npm-global/bin", home),
            "/usr/local/lib/node_modules/.bin".to_string(),
        ];
        format!("{}:{}", extra_paths.join(":"), current_path)
    } else {
        current_path
    }
}

#[tauri::command]
fn check_command(command: String) -> Result<String, String> {
    let extended_path = get_extended_path();

    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", &command])
            .output()
    } else {
        Command::new("sh")
            .args(["-c", &command])
            .env("PATH", &extended_path)
            .output()
    };

    match output {
        Ok(output) => {
            if output.status.success() {
                Ok(String::from_utf8_lossy(&output.stdout).to_string())
            } else {
                Err(format!("Command failed: {}", String::from_utf8_lossy(&output.stderr)))
            }
        }
        Err(e) => Err(format!("Failed to execute: {}", e)),
    }
}

#[tauri::command]
fn run_pandoc(command: String) -> Result<String, String> {
    let extended_path = get_extended_path();

    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", &command])
            .output()
    } else {
        Command::new("sh")
            .args(["-c", &command])
            .env("PATH", &extended_path)
            .output()
    };

    match output {
        Ok(output) => {
            if output.status.success() {
                Ok(String::from_utf8_lossy(&output.stdout).to_string())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let stdout = String::from_utf8_lossy(&output.stdout);
                Err(format!("{}\n{}", stderr, stdout))
            }
        }
        Err(e) => Err(format!("Failed to execute pandoc: {}", e)),
    }
}

#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| format!("Failed to open file: {}", e))
}

// Start installation and return an ID for cancellation
#[tauri::command]
async fn install_dependency(command: String) -> Result<String, String> {
    let extended_path = get_extended_path();
    let install_id = NEXT_INSTALL_ID.fetch_add(1, Ordering::SeqCst);

    tokio::task::spawn_blocking(move || {
        let child_result = if cfg!(target_os = "windows") {
            Command::new("cmd")
                .args(["/C", &command])
                .spawn()
        } else {
            Command::new("sh")
                .args(["-c", &command])
                .env("PATH", &extended_path)
                .spawn()
        };

        match child_result {
            Ok(mut child) => {
                // Store the child process for potential cancellation
                {
                    let mut installs = RUNNING_INSTALLS.lock().unwrap();
                    installs.insert(install_id, child);
                }

                // Wait for completion (this will block until done or killed)
                let child_ref = {
                    let mut installs = RUNNING_INSTALLS.lock().unwrap();
                    installs.remove(&install_id)
                };

                if let Some(mut child) = child_ref {
                    match child.wait() {
                        Ok(status) => {
                            if status.success() {
                                Ok("Installation completed successfully".to_string())
                            } else {
                                Err(format!("Installation failed with exit code: {:?}", status.code()))
                            }
                        }
                        Err(e) => Err(format!("Failed to wait for process: {}", e)),
                    }
                } else {
                    Err("Installation was cancelled".to_string())
                }
            }
            Err(e) => Err(format!("Failed to start installation: {}", e)),
        }
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
fn cancel_all_installs() -> Result<String, String> {
    let mut installs = RUNNING_INSTALLS.lock().map_err(|e| e.to_string())?;
    let count = installs.len();

    for (_, mut child) in installs.drain() {
        let _ = child.kill();
    }

    Ok(format!("Cancelled {} installation(s)", count))
}

#[tauri::command]
fn uninstall_dependency(name: String) -> Result<String, String> {
    let extended_path = get_extended_path();

    // Determine uninstall command based on package manager / dependency name
    let uninstall_cmd = match name.as_str() {
        "tectonic" => "brew uninstall tectonic || cargo uninstall tectonic",
        "mermaid-filter" => "npm uninstall -g mermaid-filter",
        "pandoc-crossref" => "brew uninstall pandoc-crossref",
        "pandoc" => "brew uninstall pandoc",
        _ => return Err(format!("Unknown dependency: {}", name)),
    };

    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", uninstall_cmd])
            .output()
    } else {
        Command::new("sh")
            .args(["-c", uninstall_cmd])
            .env("PATH", &extended_path)
            .output()
    };

    match output {
        Ok(output) => {
            if output.status.success() {
                Ok(format!("{} uninstalled successfully", name))
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(format!("Uninstall failed: {}", stderr))
            }
        }
        Err(e) => Err(format!("Failed to execute uninstall: {}", e)),
    }
}

#[tauri::command]
fn file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[tauri::command]
fn list_system_fonts() -> Result<Vec<String>, String> {
    use std::collections::HashSet;

    // Platform-specific font listing
    let output = if cfg!(target_os = "macos") {
        // macOS: Try fc-list first, fall back to atsutil
        Command::new("fc-list")
            .args([":", "family"])
            .output()
            .or_else(|_| {
                // Fallback: use atsutil on macOS (always available)
                Command::new("sh")
                    .args(["-c", "atsutil fonts -list | grep -v '^$' | sort -u"])
                    .output()
            })
    } else if cfg!(target_os = "linux") {
        // Linux: fc-list is standard on most distros
        Command::new("fc-list")
            .args([":", "family"])
            .output()
    } else if cfg!(target_os = "windows") {
        // Windows: Use PowerShell with proper assembly loading
        Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Add-Type -AssemblyName System.Drawing; (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }"
            ])
            .output()
    } else {
        return Err("Unsupported platform".to_string());
    };

    match output {
        Ok(output) => {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout);
                let mut fonts: HashSet<String> = HashSet::new();

                for line in text.lines() {
                    // fc-list may have multiple families separated by commas
                    for part in line.split(',') {
                        let font = part.trim().to_string();
                        // Filter out empty lines, hidden fonts (starting with .), and system prefixes
                        if !font.is_empty()
                            && !font.starts_with('.')
                            && !font.starts_with('#')
                            && font.len() > 1
                        {
                            fonts.insert(font);
                        }
                    }
                }

                let mut result: Vec<String> = fonts.into_iter().collect();
                result.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
                Ok(result)
            } else {
                // Return empty list instead of error - font selection is optional
                Ok(vec![])
            }
        }
        Err(_) => {
            // Return empty list if command fails
            Ok(vec![])
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![run_pandoc, open_file, check_command, list_system_fonts, file_exists, install_dependency, cancel_all_installs, uninstall_dependency])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
