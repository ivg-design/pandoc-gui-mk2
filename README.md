# Pandoc GUI

A modern, cross-platform graphical user interface for [Pandoc](https://pandoc.org/), the universal document converter. Built with Tauri v2, TailwindCSS v4, and DaisyUI v5.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20|%20Windows%20|%20Linux-lightgrey.svg)
![Tauri](https://img.shields.io/badge/Tauri-v2-blue.svg)

## Features

### Document Conversion
- **Multiple Output Formats**: PDF, DOCX, HTML, EPUB, ODT, LaTeX, PPTX, Markdown, RST, Plain Text
- **Multiple Input Formats**: Markdown, RST, LaTeX, DOCX, HTML, Org-mode, EPUB, ODT, RTF, JSON, YAML
- **Real-time Command Preview**: See the exact pandoc command being generated
- **One-click Conversion**: Convert and optionally open the result automatically

### PDF Engine Support
- **Tectonic**: Zero-config PDF engine that auto-downloads LaTeX packages
- **LuaLaTeX**: Best Unicode and OpenType font support
- **XeLaTeX**: Good Unicode support with system fonts
- **pdfLaTeX**: Classic, fastest engine for ASCII documents

### Layout Options
- **Paper Sizes**: A4, Letter, A5, Legal
- **Orientation**: Portrait or Landscape
- **Margins**: Uniform or individual (top, bottom, left, right) with in/cm/mm units
- **Font Size**: 6-72pt with 0.5pt precision
- **Line Height**: Single, 1.15, 1.5, Double spacing

### Typography
- **Main Font Selection**: 40+ common fonts (Arial, Times New Roman, Helvetica, etc.)
- **Monospace Font Selection**: 20+ coding fonts (Fira Code, JetBrains Mono, etc.)
- **Code Highlighting**: 11 themes including Dracula, Nord, Monokai, Gruvbox
- **Code Block Options**: Line numbers, custom background colors, live preview

### Document Structure
- **Title Page**: Generate a separate title page with centered title/author/date
- **Table of Contents**: Auto-generated TOC with configurable depth (1-6 levels)
- **List of Figures**: Auto-generated figure index
- **List of Tables**: Auto-generated table index
- **Section Numbering**: Automatic hierarchical numbering (1. Intro, 1.1 Background...)
- **Document Classes**: Article, Report, Book, Memoir, KOMA-Script Article
- **Top-Level Divisions**: Parts, Chapters, or Sections

### Metadata & Content
- **Dynamic Tokens**: Drag-and-drop colored token pills for dynamic content
  - `{today}` - Current date (formatted)
  - `{year}` - Current year
  - `{file}` - Input filename (without extension)
  - `{user}` - Current username
  - `{title}`, `{author}`, `{date}` - Document metadata
  - `{page}` - Page number
- **Visual Token Insertion**: Tokens appear as colored pills in input fields
- **Custom Headers/Footers**: Left, center, right positions with token support
- **Page Number Formats**: "Page N", "Page N of X", "N of X", or just "N"
- **Page Number Styles**: Arabic (1, 2, 3), Roman (i, ii, iii), or uppercase Roman (I, II, III)

### Advanced Features
- **Dark Mode Output**: Generate PDFs/HTML/EPUB with dark background for screen reading
- **Mermaid Diagrams**: Auto-detection with SVG/PNG output options
- **pandoc-crossref**: Cross-reference support (@fig:name, @eq:name)
- **Citeproc**: Bibliography and citation support ([@key])
- **Colored Links**: Customizable link color for PDFs
- **Extra Arguments**: Pass any additional pandoc flags

### User Experience
- **Preset System**: Save, load, update, and delete conversion presets
- **Multiple Themes**: Dim (default), Dark, Nord, Dracula, Sunset, Light
- **Smart Dependency Management**:
  - Automatic dependency detection on startup
  - Features automatically disabled when required tools are missing
  - One-click install buttons for Homebrew, apt, npm, and cargo
  - BasicTeX installation (~100MB) instead of full MacTeX (~4GB)
  - Cancel button during long installations
  - Reinstall and Uninstall buttons for optional dependencies
  - Helpful tooltips explaining why features are disabled
- **Automatic Update Checker**: Check for new versions from About modal with direct download to ~/Downloads and "Show in Finder"
- **Contextual Tooltips**: Left-side tooltips open right, right-side open left (no clipping)
- **Tab-based Interface**: Organized into Layout, Fonts, Document, Content, Advanced, Command
- **FAB Menu**: Accordion-style floating action button (one submenu at a time)

## Installation

### Pre-built Binaries

Download the latest release for your platform:

| Platform | Architecture | Download |
|----------|--------------|----------|
| macOS | Apple Silicon (M1/M2/M3) | `Pandoc.GUI_x.x.x_aarch64.dmg` |
| macOS | Intel | `Pandoc.GUI_x.x.x_x64.dmg` |
| Windows | x64 | `Pandoc.GUI_x.x.x_x64-setup.exe` |
| Linux | x64 | `pandoc-gui_x.x.x_amd64.deb` / `.AppImage` |

### Building from Source

#### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (1.77+)
- [Pandoc](https://pandoc.org/installing.html)

#### Build Steps

```bash
# Clone the repository
git clone https://github.com/ivg/pandoc-gui-mk2.git
cd pandoc-gui-mk2

# Install dependencies
npm install

# Development mode
npm run tauri:dev

# Production build
npm run tauri:build
```

## Dependencies

### Required
| Tool | Purpose | Installation |
|------|---------|--------------|
| **Pandoc** | Document conversion engine | `brew install pandoc` / [pandoc.org](https://pandoc.org/installing.html) |

### Optional (PDF Generation)
| Tool | Purpose | Installation |
|------|---------|--------------|
| **Tectonic** | Zero-config PDF engine | `brew install tectonic` / `cargo install tectonic` |
| **LuaLaTeX** | Best Unicode support | `brew install --cask mactex` |
| **XeLaTeX** | System fonts support | `brew install --cask mactex` |
| **pdfLaTeX** | Classic LaTeX | `brew install --cask mactex` |

### Optional (Filters)
| Tool | Purpose | Installation |
|------|---------|--------------|
| **mermaid-filter** | Diagram rendering | `npm install -g mermaid-filter` |
| **pandoc-crossref** | Cross-references | `brew install pandoc-crossref` |

## Usage

### Basic Workflow

1. **Open a document**: Click "Open" to select your input file
2. **Choose output format**: Select from the dropdown (PDF, DOCX, HTML, etc.)
3. **Configure options**: Use the tabs to set layout, fonts, and other options
4. **Convert**: Click "Convert Document" to generate the output

### Using Tokens

Tokens are dynamic placeholders that get replaced during conversion:

1. Go to the **Content** tab
2. Expand the **Tokens** section
3. Drag a token badge onto any text field (Title, Author, Date, Headers, Footers)

### Saving Presets

1. Configure your desired settings
2. Click the menu button (⋮) at the bottom right
3. Select **Presets** → **Save New**
4. Enter a name for your preset

### Managing Dependencies

1. Click the menu button (⋮)
2. Select **Check Dependencies**
3. The app shows status of all dependencies:
   - **Green checkmark**: Installed with version info
   - **Red X**: Not installed, with install buttons
4. For missing tools:
   - Click the appropriate install button (Homebrew, apt, npm, cargo)
   - A spinner shows while installing; click "Cancel Install" to abort
   - After installation, the list refreshes automatically
5. To uninstall optional dependencies:
   - Click the "Uninstall" button next to any installed optional tool
   - Pandoc (required) cannot be uninstalled from the app

**Note**: Features requiring missing dependencies are automatically disabled with a tooltip explaining what needs to be installed.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + O` | Open file |
| `Cmd/Ctrl + Enter` | Convert document |
| `Cmd/Ctrl + C` | Copy command (when in Command tab) |

## Architecture

```
pandoc-gui-mk2/
├── src/
│   ├── main.js          # Application logic
│   └── style.css        # TailwindCSS + DaisyUI styles
├── src-tauri/
│   ├── src/
│   │   └── lib.rs       # Tauri backend commands
│   ├── Cargo.toml       # Rust dependencies
│   └── tauri.conf.json  # Tauri configuration
├── index.html           # Main UI
└── package.json         # Node.js dependencies
```

## Tech Stack

- **Frontend**: Vanilla JavaScript, TailwindCSS v4, DaisyUI v5
- **Backend**: Tauri v2, Rust
- **Build**: Vite v7
- **Styling**: Custom dark themes (Dim, Nord, Dracula, Sunset)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes using conventional commits:
   - `feat:` for new features (triggers minor version bump)
   - `fix:` for bug fixes (triggers patch version bump)
   - `feat!:` or `BREAKING CHANGE:` for breaking changes (triggers major version bump)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Release Process

Releases are automated via GitHub Actions. To trigger a release, add a release flag to your commit message:

```bash
# Patch release (bug fixes) - e.g., 2.0.0 → 2.0.1
git commit -m "fix: description --patch"

# Minor release (new features) - e.g., 2.0.0 → 2.1.0
git commit -m "feat: description --minor"

# Major release (breaking changes) - e.g., 2.0.0 → 3.0.0
git commit -m "feat!: description --major"
```

The version will be automatically bumped in:
- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

Builds are created for:
- macOS (Apple Silicon + Intel)
- Windows (x64)
- Linux (x64 .deb + .AppImage)

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Pandoc](https://pandoc.org/) - The universal document converter by John MacFarlane
- [Tauri](https://tauri.app/) - Build smaller, faster, and more secure desktop applications
- [DaisyUI](https://daisyui.com/) - Tailwind CSS component library
- [TailwindCSS](https://tailwindcss.com/) - Utility-first CSS framework
