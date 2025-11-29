use std::process::{Command, Stdio};
use std::env;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Emitter};
use tauri::menu::{Menu, MenuItem, Submenu, PredefinedMenuItem};

// Track running install processes for cancellation
static NEXT_INSTALL_ID: AtomicU32 = AtomicU32::new(1);
lazy_static::lazy_static! {
    static ref RUNNING_INSTALLS: Mutex<HashMap<u32, Arc<AtomicBool>>> = Mutex::new(HashMap::new());
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
    let home = env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let temp_dir = env::temp_dir();

    // Try to copy mermaid config file to home directory if it exists in the bundle
    // This ensures mermaid-filter uses proper configuration for SVG rendering with text
    let app_dir = env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|p| p.to_path_buf()));

    if let Some(app_dir) = app_dir {
        // Try multiple possible locations for the config file
        let possible_paths = vec![
            app_dir.join(".mermaid-config.json"),
            app_dir.parent()
                .and_then(|p| p.parent())
                .map(|p| p.join(".mermaid-config.json"))
                .unwrap_or_default(),
        ];

        for config_path in possible_paths {
            if config_path.exists() {
                let home_config = Path::new(&home).join(".mermaid-config.json");
                let _ = fs::copy(&config_path, &home_config);
                break;
            }
        }
    }

    // Detect output format from command to optimize mermaid rendering
    // For PDF output: use PDF format (best quality, scalable, embeds perfectly)
    // For HTML/EPUB: use SVG format (scalable, lightweight)
    let mermaid_format = if command.contains("-t pdf") || command.contains("-t=pdf") {
        "pdf"  // PDF format embeds perfectly in PDF output with full quality
    } else {
        "svg"  // SVG is best for HTML/EPUB (scalable, lightweight)
    };

    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", &command])
            .env("MERMAID_FILTER_FORMAT", mermaid_format)
            .env("MERMAID_FILTER_BACKGROUND", "transparent")
            .output()
    } else {
        Command::new("sh")
            .args(["-c", &command])
            .env("PATH", &extended_path)
            // Set working directory to home to avoid read-only filesystem issues
            .current_dir(&home)
            // Redirect mermaid-filter error log to temp directory
            .env("MERMAID_FILTER_ERR", temp_dir.join("mermaid-filter.err"))
            // Configure mermaid-filter format based on output type
            .env("MERMAID_FILTER_FORMAT", mermaid_format)
            .env("MERMAID_FILTER_BACKGROUND", "transparent")
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

// Run a command with streaming output to the frontend
#[tauri::command]
async fn run_command_with_output(app: AppHandle, command: String, operation: String) -> Result<String, String> {
    let extended_path = get_extended_path();
    let install_id = NEXT_INSTALL_ID.fetch_add(1, Ordering::SeqCst);
    let cancelled = Arc::new(AtomicBool::new(false));

    // Store cancel flag
    {
        let mut installs = RUNNING_INSTALLS.lock().unwrap();
        installs.insert(install_id, cancelled.clone());
    }

    // Emit start event
    let _ = app.emit("command-output", serde_json::json!({
        "type": "start",
        "id": install_id,
        "operation": operation,
        "command": command
    }));

    let app_clone = app.clone();
    let cancelled_clone = cancelled.clone();
    let operation_clone = operation.clone();

    let result = tokio::task::spawn_blocking(move || {
        let mut child = if cfg!(target_os = "windows") {
            Command::new("cmd")
                .args(["/C", &command])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
        } else {
            Command::new("sh")
                .args(["-c", &command])
                .env("PATH", &extended_path)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
        }.map_err(|e| format!("Failed to start: {}", e))?;

        // Read stdout in a separate thread
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let app_stdout = app_clone.clone();
        let app_stderr = app_clone.clone();

        let stdout_handle = std::thread::spawn(move || {
            if let Some(stdout) = stdout {
                let reader = BufReader::new(stdout);
                for line in reader.lines().map_while(Result::ok) {
                    let _ = app_stdout.emit("command-output", serde_json::json!({
                        "type": "stdout",
                        "line": line
                    }));
                }
            }
        });

        let stderr_handle = std::thread::spawn(move || {
            if let Some(stderr) = stderr {
                let reader = BufReader::new(stderr);
                for line in reader.lines().map_while(Result::ok) {
                    let _ = app_stderr.emit("command-output", serde_json::json!({
                        "type": "stderr",
                        "line": line
                    }));
                }
            }
        });

        // Wait for process
        let status = child.wait().map_err(|e| format!("Wait failed: {}", e))?;

        // Wait for output threads
        let _ = stdout_handle.join();
        let _ = stderr_handle.join();

        // Check if cancelled
        if cancelled_clone.load(Ordering::SeqCst) {
            return Err("Operation cancelled".to_string());
        }

        if status.success() {
            Ok(format!("{} completed successfully", operation_clone))
        } else {
            Err(format!("{} failed with exit code: {:?}", operation_clone, status.code()))
        }
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;

    // Clean up
    {
        let mut installs = RUNNING_INSTALLS.lock().unwrap();
        installs.remove(&install_id);
    }

    // Emit end event
    let _ = app.emit("command-output", serde_json::json!({
        "type": "end",
        "id": install_id,
        "success": result.is_ok(),
        "message": result.as_ref().map(|s| s.as_str()).unwrap_or_else(|e| e.as_str())
    }));

    result
}

#[tauri::command]
fn cancel_all_installs() -> Result<String, String> {
    let installs = RUNNING_INSTALLS.lock().map_err(|e| e.to_string())?;
    let count = installs.len();

    for (_, cancelled) in installs.iter() {
        cancelled.store(true, Ordering::SeqCst);
    }

    Ok(format!("Cancelling {} operation(s)", count))
}

// Get the uninstall command for a dependency
fn get_uninstall_command(name: &str) -> Option<&'static str> {
    match name {
        "tectonic" => Some("brew uninstall tectonic 2>&1 || cargo uninstall tectonic 2>&1"),
        "texlive" => Some("brew uninstall --cask basictex 2>&1 || brew uninstall --cask mactex 2>&1"),
        "mermaid-filter" => Some("npm uninstall -g mermaid-filter 2>&1"),
        "pandoc-crossref" => Some("brew uninstall pandoc-crossref 2>&1"),
        "pandoc" => Some("brew uninstall pandoc 2>&1"),
        _ => None,
    }
}

// Get the install command for a dependency
fn get_install_command(name: &str, method: &str) -> Option<String> {
    match (name, method) {
        ("tectonic", "brew") => Some("brew install tectonic 2>&1".to_string()),
        ("tectonic", "cargo") => Some("cargo install tectonic 2>&1".to_string()),
        ("texlive", "brew") => Some("brew install --cask basictex 2>&1".to_string()),
        ("texlive", "apt") => Some("sudo apt install texlive-latex-base texlive-fonts-recommended texlive-latex-extra 2>&1".to_string()),
        ("mermaid-filter", "npm") => Some("npm install -g mermaid-filter 2>&1".to_string()),
        ("pandoc-crossref", "brew") => Some("brew install pandoc-crossref 2>&1".to_string()),
        ("pandoc", "brew") => Some("brew install pandoc 2>&1".to_string()),
        _ => None,
    }
}

#[tauri::command]
async fn install_dependency(app: AppHandle, name: String, method: String) -> Result<String, String> {
    let command = get_install_command(&name, &method)
        .ok_or_else(|| format!("Unknown install method {} for {}", method, name))?;

    run_command_with_output(app, command, format!("Installing {}", name)).await
}

#[tauri::command]
async fn uninstall_dependency(app: AppHandle, name: String) -> Result<String, String> {
    let command = get_uninstall_command(&name)
        .ok_or_else(|| format!("Unknown dependency: {}", name))?
        .to_string();

    run_command_with_output(app, command, format!("Uninstalling {}", name)).await
}

#[tauri::command]
async fn reinstall_dependency(app: AppHandle, name: String, method: String) -> Result<String, String> {
    // First uninstall
    let uninstall_cmd = get_uninstall_command(&name)
        .ok_or_else(|| format!("Unknown dependency: {}", name))?
        .to_string();

    let _ = run_command_with_output(app.clone(), uninstall_cmd, format!("Uninstalling {}", name)).await;

    // Then install
    let install_cmd = get_install_command(&name, &method)
        .ok_or_else(|| format!("Unknown install method {} for {}", method, name))?;

    run_command_with_output(app, install_cmd, format!("Reinstalling {}", name)).await
}

#[tauri::command]
fn file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[tauri::command]
fn write_dark_mode_header() -> Result<String, String> {
    use std::io::Write;

    let temp_dir = env::temp_dir();
    let header_path = temp_dir.join("pandoc-dark-mode.tex");

    let header_content = r#"\usepackage{pagecolor}
\usepackage{xcolor}
\definecolor{darkbg}{HTML}{1e1e2e}
\definecolor{lighttext}{HTML}{cdd6f4}
\pagecolor{darkbg}
\color{lighttext}
"#;

    let mut file = std::fs::File::create(&header_path)
        .map_err(|e| format!("Failed to create header file: {}", e))?;

    file.write_all(header_content.as_bytes())
        .map_err(|e| format!("Failed to write header file: {}", e))?;

    Ok(header_path.to_string_lossy().to_string())
}

// Write a header file to fix Unicode box-drawing characters for monospace fonts
#[tauri::command]
fn write_unicode_header() -> Result<String, String> {
    use std::io::Write;

    let temp_dir = env::temp_dir();
    let header_path = temp_dir.join("pandoc-unicode-fix.tex");

    // Use fontspec to set fallback fonts for missing Unicode characters
    // Menlo on macOS has good Unicode coverage including box-drawing chars
    let header_content = r#"\usepackage{fontspec}
\directlua{
  luaotfload.add_fallback("monofallback", {
    "Menlo:mode=harf;",
    "DejaVu Sans Mono:mode=harf;",
    "Apple Symbols:mode=harf;",
  })
}
\setmonofont{Noto Mono}[RawFeature={fallback=monofallback}]
"#;

    let mut file = std::fs::File::create(&header_path)
        .map_err(|e| format!("Failed to create header file: {}", e))?;

    file.write_all(header_content.as_bytes())
        .map_err(|e| format!("Failed to write header file: {}", e))?;

    Ok(header_path.to_string_lossy().to_string())
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
            // Create custom menu
            let about_item = MenuItem::with_id(app, "about", "About Pandoc GUI", true, None::<&str>)?;
            let quit_item = PredefinedMenuItem::quit(app, Some("Quit"))?;
            let separator = PredefinedMenuItem::separator(app)?;

            let app_menu = Submenu::with_items(
                app,
                "Pandoc GUI",
                true,
                &[&about_item, &separator, &quit_item],
            )?;

            let edit_menu = Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, Some("Undo"))?,
                    &PredefinedMenuItem::redo(app, Some("Redo"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, Some("Cut"))?,
                    &PredefinedMenuItem::copy(app, Some("Copy"))?,
                    &PredefinedMenuItem::paste(app, Some("Paste"))?,
                    &PredefinedMenuItem::select_all(app, Some("Select All"))?,
                ],
            )?;

            let menu = Menu::with_items(app, &[&app_menu, &edit_menu])?;
            app.set_menu(menu)?;

            // Handle menu events
            app.on_menu_event(|app_handle, event| {
                if event.id().as_ref() == "about" {
                    // Emit event to frontend to show About modal
                    let _ = app_handle.emit("show-about", ());
                }
            });

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![run_pandoc, open_file, check_command, list_system_fonts, file_exists, write_dark_mode_header, write_unicode_header, install_dependency, cancel_all_installs, uninstall_dependency, reinstall_dependency, run_command_with_output])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
