# Changelog

All notable changes to Pandoc GUI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Dependency checker with install buttons for Homebrew, apt, npm, cargo
- Extended PATH support for finding pandoc in common installation directories
- Improved token drag-and-drop with visual feedback

### Fixed
- FAB preset dropdown now shows multiple presets (taller, not wider)
- Token drag/drop now works reliably on all input fields
- PATH issues with pandoc and other tools in Tauri environment

### Changed
- Tokens section now expanded by default in Content tab
- Removed custom floating tooltip system in favor of DaisyUI tooltips

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
