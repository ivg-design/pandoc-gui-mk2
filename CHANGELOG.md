# Changelog

All notable changes to Pandoc GUI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Smart Dependency Management**:
  - Automatic dependency detection on app startup (silent check)
  - Features auto-disable when required dependencies are missing
  - Tooltips on disabled features explain what needs to be installed
  - PDF engine dropdown shows "(not installed)" for unavailable engines
  - Auto-selects first available PDF engine on startup
  - Mermaid options disabled when mermaid-filter missing
  - pandoc-crossref checkbox disabled when filter missing
- **Async Installation System**:
  - Non-blocking dependency installation (UI stays responsive)
  - Cancel button appears during installation to abort long-running installs
  - Progress spinner shows installation is in progress
  - Toast notifications for install start, success, and failure
  - Uses native Tauri dialog for confirmation (not browser confirm)
- **Uninstall Support**:
  - Uninstall button for each installed optional dependency
  - Reinstall button for quick reinstallation
  - Native confirmation dialog before uninstalling
  - Pandoc (required) cannot be uninstalled from the app
- **TeX Live as Installable Dependency**:
  - BasicTeX (~100MB) instead of full MacTeX (~4GB)
  - Consolidated lualatex/xelatex/pdflatex into single "texlive" dependency
  - Install via Homebrew (macOS) or apt (Linux)
- **Dark Mode Output**:
  - New "Dark Mode" checkbox in Document tab
  - Generates PDF with dark background (#1e1e2e) and light text (#cdd6f4)
  - HTML/EPUB: Injects dark CSS stylesheet
  - Good for screen reading and eye strain reduction
- **Colored Token Pills**:
  - Tokens now display as colored pills in input fields (not plain text)
  - Different colors for different token types (primary, secondary, accent, etc.)
  - Pills can be removed by clicking the X button
  - Drag-and-drop works in Tauri app (fixed WebView interception)
- **FAB Menu Redesign**:
  - Accordion-style submenus that expand inline
  - Only one submenu can be open at a time
  - Smooth animations for open/close
- **Page Number Format Options**:
  - "Page N" - Standard format
  - "Page N of X" - Full format with total pages (NEW)
  - "N of X" - Compact format with total pages
  - "N only" - Just the number
- **Document Class Tooltips**:
  - Detailed tooltips for each document class explaining features and limitations
  - Article: No chapters, TOC without new page option
  - Report: Has chapters, full TOC support, separate title page
  - Book: Two-sided, chapters on odd pages, front/back matter
  - Memoir: Flexible, all features, highly customizable
  - KOMA Article: European typography, better spacing
- Extended PATH support for finding tools in:
  - Homebrew paths (`/usr/local/bin`, `/opt/homebrew/bin`)
  - nvm Node.js versions (`~/.nvm/versions/node/*/bin`)
  - Cargo binaries (`~/.cargo/bin`)
  - TeX Live paths

### Fixed
- **Tauri Drag-Drop**: Set `dragDropEnabled: false` in Tauri config to allow JavaScript to handle drag-drop instead of native WebView interception
- **mermaid-filter Detection**: Changed from `--version` flag (which errors) to `which mermaid-filter`
- **Uninstall Confirmation**: Now uses native Tauri dialog that properly blocks until user responds
- **Tooltip Positioning**: Left-side tooltips open right, right-side tooltips open left (prevents window clipping)
- **PDF Engine Dropdown Layout**: Fixed layout shift when opening dropdown
- FAB preset dropdown now shows multiple presets (taller, not wider)
- Token drag/drop now works reliably on all input fields including headers/footers
- Duplicate token insertion no longer corrupts existing pills
- PATH issues with pandoc and other tools in Tauri environment

### Changed
- **Default Document Class**: Changed from Article to Report (better for research/documentation)
- **Page Format Label**: Renamed "Page Format" to "Page Number Format" for clarity
- Tokens section now expanded by default in Content tab
- Removed custom floating tooltip system in favor of DaisyUI tooltips
- Header/footer fields converted from text inputs to contenteditable divs for rich token display
- Install buttons now show spinner with "Cancel Install" option
- Dependency checker refreshes after install/uninstall operations
- FAB accordion only allows one section open at a time

## [2.0.0] - 2025-11-27

### Added
- Complete UI redesign with tab-based interface
- Custom dark themes: Dim, Nord, Dracula, Sunset
- Preset system for saving and loading conversion settings
- Token system for dynamic content: {today}, {year}, {file}, {user}, {title}, {author}, {date}, {page}
- Drag-and-drop token insertion into text fields
- Title page option with separate formatting
- Table of Contents with configurable depth (1-6 levels) and "new page after" option
- List of Figures and List of Tables support
- Section numbering toggle
- Document class selection: Article, Report, Book, Memoir, KOMA-Script Article
- Top-level division setting: Parts, Chapters, Sections
- PDF engine selection with tooltips: Tectonic, LuaLaTeX, XeLaTeX, pdfLaTeX
- Code highlighting themes: Dracula, Nord, Monokai, Gruvbox, Solarized, and more
- Live code preview with syntax highlighting
- Custom code block background colors
- Line numbers toggle for code blocks
- Header and footer customization (left/center/right positions)
- Page number format options: "Page N", "N of X", "N only"
- Page number styles: Arabic, Roman lowercase, Roman uppercase
- Page number position: Bottom center, bottom right, top right
- Mermaid diagram detection and SVG/PNG format selection
- pandoc-crossref filter support
- Citeproc bibliography support
- Colored links with custom color picker
- Extra pandoc arguments field
- "Open when done" toggle to auto-open converted files
- Dependency checker modal with version detection
- Theme switcher in FAB menu
- Copy command button
- Command preview tab showing full pandoc command

### Changed
- Migrated from simple layout to organized tab interface
- Paper size, orientation, font size, line height now in Layout tab
- Margins support uniform or individual settings with in/cm/mm units
- Font selection moved to Fonts tab with ~40 common fonts
- Monospace font selection with ~20 coding fonts
- Document structure options now in Document tab with grid layout
- Standalone option only shown for HTML/LaTeX (always enabled for PDF)
- Output format dropdown includes: PDF, DOCX, HTML, EPUB, ODT, LaTeX, PPTX, MD, RST, TXT

### Fixed
- Tooltip clipping in collapsed sections
- ZSH escaping issues with [HTML] color values
- LaTeX overfull hbox warnings with geometry settings
- Absolute path handling for Tauri file dialogs
- Font list no longer attempts unavailable font detection

## [1.0.0] - 2025-11-27

### Added
- Initial release with modern DaisyUI interface
- Basic Pandoc command building
- File input via Tauri dialog or web file picker
- Output format selection
- Basic layout options: paper size, margins, font size
- Syntax highlighting theme selection
- PDF engine selection
- Tauri v2 backend with shell command execution
- Cross-platform support (macOS, Windows, Linux)

---

## Version History Summary

| Version | Date | Description |
|---------|------|-------------|
| 2.0.0 | 2025-11-27 | Major UI redesign, tabs, presets, tokens, themes |
| 1.0.0 | 2025-11-27 | Initial release |

[Unreleased]: https://github.com/ivg/pandoc-gui-mk2/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/ivg/pandoc-gui-mk2/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/ivg/pandoc-gui-mk2/releases/tag/v1.0.0
