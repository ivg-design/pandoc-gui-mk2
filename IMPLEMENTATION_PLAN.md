# Pandoc GUI v2 - Complete Implementation Plan & Project History

## PROJECT OVERVIEW

**Goal**: Build a modern web-based Tauri desktop application for Pandoc document conversion with a comprehensive UI for all pandoc options.

**Current Status**: Basic functional web UI complete with collapsible sections. Ready for major UI redesign to tab-based layout.

**Tech Stack**:
- Frontend: HTML, CSS (Tailwind v4 + DaisyUI), JavaScript (vanilla)
- Build: Vite
- Theming: Tailwind CSS v4 with DaisyUI
- Future: Tauri for desktop packaging

**Repository**: https://github.com/ivg-design/pandoc-gui-mk2

---

## PROJECT HISTORY & CONTEXT

### Phase 1: Initial Request & Setup (Context Start)
User rejected a 77MB .NET Avalonia executable as "COMPLETE GARBAGE" and requested building a modern Tauri-based web application instead.

**Initial Requirements**:
- Install Tauri CLI and create new GitHub repo "pandoc-gui-mk2"
- Build modern web UI frontend FIRST using DaisyUI
- Single-column compact layout with collapsible sections
- File browser buttons for input/output (no dropzone)
- Dark/light mode output selection
- System font dropdowns with all available fonts
- Manual font size input (6-72pt)
- Margin unit selection (in/cm/mm) with uniform/individual toggle
- Header/footer options with token system
- Metadata tokens ({today}, {year}, {file}, {user})
- Code block background color picker with live preview
- All document structure options
- Preset system to save/load/delete custom settings
- Mermaid auto-detection with SVG/PNG option
- 13+ code highlighting themes with live preview
- Info tooltips explaining each option
- Test web frontend before Tauri packaging

### Phase 2: Initial Project Setup
- Created ~/github/pandoc-gui-mk2 directory with git init
- Copied and optimized icon.png (420KB)
- npm init with vite, tailwindcss, postcss, autoprefixer, daisyui
- Created initial config files:
  - `vite.config.js`: Development server on port 3000
  - `tailwind.config.js`: DaisyUI plugin, dark theme default
  - `postcss.config.js`: Tailwind v4 with autoprefixer
- Created `src/style.css` with Tailwind directives and custom utilities
- Initial git commit and push

### Phase 3: Compact Single-Column UI Implementation
**Major Features Added**:
- System font detection using canvas measurement (later simplified)
- ~60 common fonts (Windows/macOS/Linux) + ~22 monospace fonts
- Code preview with theme colors
- Metadata token replacement ({today}, {year}, {file}, {user})
- Header/footer token system
- Preset save/load/delete functionality with localStorage
- All document structure options with tooltips
- PDF Engine selection (5 engines, Tectonic default for emoji support)
- Page layout controls (paper size, orientation, margins)
- Header/Footer & Page Numbers with token reference
- Typography section (fonts, font size, line height)
- Code Highlighting section with live preview
- Advanced Options (mermaid, document class, filters, extra args)

**Key JavaScript Functions** (`src/main.js` - 750+ lines):
```javascript
// Theme management
initTheme()
toggleTheme()

// Dependency checking
checkDependencies() // Runs on startup, checks for pandoc/tectonic

// Font management
loadSystemFonts() // Populates font dropdowns

// File handling
handleFileSelect(file) // Sets input/output paths, detects mermaid

// Margin handling
setupMargins() // Uniform vs individual toggle

// Code preview
setupCodePreview()
updateCodePreview()

// Pandoc command building
buildPandocCommand() // Constructs full command with all options

// Preset management
setupPresets() // Save/load/delete with localStorage

// Token replacement
replaceMetadataTokens(str) // {today}, {year}, {file}, {user}
replaceHeaderTokens(str) // {title}, {author}, {date}, {page}, etc.

// Conversion
setupConversion() // Handles Tauri invoke or web mode copy
```

### Phase 4: Document Structure Enhancements
**Added**:
- Title Page option with tooltip
- TOC with depth slider + "Start on new page" option
- List of Figures/Tables options
- Number Sections toggle
- Top-level division selector (Chapter/Section/Part)
- Comprehensive tooltips for all options

**Tooltips Use**: `tooltip-end` positioning to prevent clipping by collapse container

### Phase 5: Bug Fixes & Improvements

#### Issue 1: Font Detection Unreliable
- **Problem**: Canvas-based font detection didn't work reliably
- **Solution**: Simplified to list all common fonts - pandoc uses system fonts
- **Result**: Users select fonts, pandoc resolves availability

#### Issue 2: Output Files Not Being Created
- **Problem**: Files were being written to current working directory instead of specified Desktop location
- **Root Cause**: Using relative paths instead of absolute paths
- **Solution**:
  - Extract absolute path from file.path property
  - Expand ~ to home directory
  - Pass full paths to pandoc
- **Result**: Files now consistently created in specified location

#### Issue 3: Zsh Escaping Error with Color Values
- **Problem**: `linkcolor=[HTML]{0066cc}` caused "zsh: no matches found" error
- **Root Cause**: `[HTML]` interpreted as glob pattern
- **Solution**: Quote entire color value: `-V 'linkcolor=[HTML]{0066cc}'`
- **Result**: Colors work correctly in zsh

#### Issue 4: Deprecated Pandoc Flag
- **Problem**: `--highlight-style` deprecated in newer pandoc
- **Solution**: Changed to `--syntax-highlighting`
- **Result**: No more deprecation warnings

#### Issue 5: LaTeX Overfull Hbox Warnings
- **Problem**: Many "Overfull \hbox" warnings from tectonic
- **Root Cause**: Document content contains very long code/URLs that exceed line width
- **Solution**: Add `\usepackage{microtype}` to all PDF header-includes
- **Note**: Warnings are informational, not errors - PDFs still created and usable
- **Result**: Fewer warnings, but some remain due to document content

#### Issue 6: All Tooltips Being Clipped
- **Problem**: Tooltips in Document Structure section were hidden
- **Root Cause**: `collapse-content` had `overflow: hidden`
- **Solution**:
  - Change collapse-content to `overflow: visible`
  - Add `z-index: 50` to tooltips
  - Use `tooltip-end` positioning
- **Result**: All tooltips now display fully without clipping

#### Issue 7: TOC Page Break Affecting All Sections
- **Problem**: `-V toc-own-page=true` forced EVERY section to start on new page
- **Solution**: Replace with LaTeX `clearpage` command after TOC only
- **Code**:
```javascript
args.push('-V header-includes="\\\\let\\\\oldtableofcontents\\\\tableofcontents\\\\renewcommand{\\\\tableofcontents}{\\\\oldtableofcontents\\\\clearpage}"');
```
- **Result**: Only TOC creates page break, content flows naturally

### Phase 6: Recent Commits (Latest State)
1. **"Use --syntax-highlighting and add dependency checker"**
   - Replaced deprecated --highlight-style
   - Added dependency checker for pandoc/tectonic on startup

2. **"Fix fonts list and zsh escaping"**
   - Simplified font loading
   - Fixed [HTML] color quoting

3. **"Add tooltips to all Document Structure options"**
   - Comprehensive tooltip explanations
   - Changed positioning from tooltip-top

4. **"Fix absolute paths, LaTeX overfull hbox warnings, and tooltips"**
   - Use absolute file paths
   - Add microtype package
   - Changed Title Page tooltip positioning

5. **"Fix TOC page break and all document structure tooltips"**
   - Fixed TOC page break logic
   - Changed all tooltips from tooltip-top to tooltip-right

6. **"Fix all tooltips clipping issue"**
   - Changed tooltips to tooltip-end
   - Added CSS overflow: visible and z-index: 50

---

## CURRENT STRUCTURE

### File Organization
```
pandoc-gui-mk2/
├── index.html          (580 lines, tab-based will be ~400 lines restructured)
├── src/
│   ├── main.js         (750+ lines, all application logic)
│   └── style.css       (90+ lines, custom styles + utilities)
├── vite.config.js      (dev server on :3000)
├── tailwind.config.js  (DaisyUI plugin, dark theme)
├── postcss.config.js   (Tailwind v4)
├── package.json        (dependencies: vite, tailwindcss, daisyui, etc.)
├── icon.png            (420KB)
└── IMPLEMENTATION_PLAN.md (this file)
```

### Current HTML Structure (Collapsible Sections)
```
navbar (logo, title, theme toggle)
├─ File I/O Card
├─ Presets Card
├─ PDF Engine (collapsible)
├─ Document Structure (collapsible)
├─ Page Layout (collapsible)
├─ Header/Footer & Page Numbers (collapsible)
├─ Typography (collapsible)
├─ Code Highlighting (collapsible)
├─ Document Structure Advanced (collapsible)
├─ Metadata (collapsible)
├─ Advanced Options (collapsible)
└─ Convert Section
    ├─ Convert Button
    ├─ Progress Bar
    ├─ Status Text
    └─ Command Preview (collapsible)
```

### Current main.js Key State Variables
```javascript
let inputFilePath = null;        // Full path to input markdown
let inputFileName = null;        // Just the filename
let inputFileContent = null;     // File content (for mermaid detection)
```

### Current DaisyUI Components Already Used
- `navbar`, `card`, `button`, `input`, `select`, `checkbox`, `label`
- `form-control`, `collapse` (will be replaced by tabs)
- `tooltip` with `tooltip-end` positioning
- `btn` variants (primary, outline, error, ghost, circle, sm, etc.)
- Custom scrollbar styling via CSS

---

## NEXT PHASE: TAB-BASED LAYOUT REDESIGN

### NEW LAYOUT STRUCTURE

```
┌─────────────────────────────────────────┐
│ NAVBAR: Logo | Title | Theme Toggle     │
├─────────────────────────────────────────┤
│                                         │
│  FILE I/O CARD (Always visible)         │
│  ├─ Input file selector                 │
│  ├─ Output path                         │
│  ├─ Format selection                    │
│  └─ Output style (light/dark/auto)      │
│                                         │
│  PRESETS CARD (Always visible)          │
│  ├─ Preset dropdown                     │
│  └─ Load/Save/Delete buttons            │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ TABS (Major Groups)             │    │
│  ├─────────────────────────────────┤    │
│  │[Layout]│[Typography]│[Document] │    │
│  │[Content]│[Advanced]│[Preview]   │    │
│  ├─────────────────────────────────┤    │
│  │                                 │    │
│  │ TAB CONTENT (Organized Fields)  │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  CONVERT BUTTON (Large, Primary)        │
│  ├─ Progress bar (hidden until convert) │
│  ├─ Status message                      │
│  └─ Toast notifications                 │
│                                         │
└─────────────────────────────────────────┘
```

### TAB ORGANIZATION (6 Major Tabs)

**Tab 1: LAYOUT**
- Paper size (dropdown)
- Orientation (portrait/landscape toggle)
- Margins:
  - Unit selection (in/cm/mm)
  - Uniform vs Individual toggle
  - Margin inputs (top, bottom, left, right)
- Page numbering:
  - Format selection (None/Page N/N of X/etc.)
  - Position (bottom-center/bottom-right/top-right)
  - Style dropdown
- Line height slider
- Font size number input

**Tab 2: TYPOGRAPHY**
- Main font dropdown
- Monospace font dropdown
- Code highlighting theme dropdown
- Code preview with colors
- Line height display (linked to Layout tab)
- Font size display (linked to Layout tab)

**Tab 3: DOCUMENT**
- Title page checkbox with tooltip
- Table of contents checkbox + depth slider + new page toggle
- List of Figures checkbox with tooltip
- List of Tables checkbox with tooltip
- Number Sections checkbox with tooltip
- Top-level division selector with tooltip
- All options with explanatory tooltips using tooltip-end

**Tab 4: CONTENT**
- Header/Footer grid (3x3 for left/center/right)
  - Header left, center, right inputs
  - Footer left, center, right inputs
- Token reference box (collapsible)
- Metadata section:
  - Title input
  - Author input
  - Date input
- All with token support explanations

**Tab 5: ADVANCED**
- PDF Engine dropdown (only shown when format = pdf)
- Document class dropdown
- Mermaid format toggle (SVG/PNG)
- Filters:
  - Pandoc-crossref checkbox
  - Citeproc checkbox
- Extra arguments textarea
- Colored links:
  - Toggle switch
  - Color picker (input type="color")
- Link color and URL color pickers

**Tab 6: PREVIEW**
- Command preview (full pandoc command)
- Copy to clipboard button
- Collapsible for details

### DaisyUI COMPONENTS REQUIRED

**Layout Components**:
- `navbar`: Header with app title and theme toggle
- `card`: Main sections and containers
- `tabs`: Tab navigation system
- `divider`: Section separators within tabs

**Form Components**:
- `input`: Text inputs, number inputs, color pickers
- `select`: Dropdowns (fonts, formats, themes, etc.)
- `checkbox`: Toggle options
- `toggle`: Binary switches
- `range`: Sliders (depth, line height)
- `textarea`: Multi-line text (headers, footers, extra args)
- `label`: Form labels
- `form-control`: Form structure wrapper
- `file-input`: File selection (daisyui file input)

**Display Components**:
- `badge`: Small labels
- `tooltip`: Info icons with descriptions
- `alert`: Status/error messages
- `loading`: Loading spinner during conversion
- `kbd`: Keyboard reference (optional)

**Action Components**:
- `button`: All action buttons
- `btn`: Button styles (primary, outline, sm, lg, circle, ghost, error)

**Feedback Components**:
- `toast`: Toast notifications for success/error
- `progress`: Conversion progress bar

### THEME CONFIGURATION

**Colors** (dim theme - provided by user):
```
Base: oklch(30.857% 0.023 264.149)    // Very dark blue-purple
Base-200: oklch(28.036% 0.019 264.182)
Base-300: oklch(26.346% 0.018 262.177)
Primary: oklch(86.133% 0.141 139.549)  // Cyan/Green
Secondary: oklch(73.375% 0.165 35.353) // Orange
Accent: oklch(74.229% 0.133 311.379)   // Magenta
Neutral: oklch(24.731% 0.02 264.094)   // Dark gray
Info: oklch(86.078% 0.142 206.182)     // Light blue
Success: oklch(86.171% 0.142 166.534)  // Green
Warning: oklch(86.163% 0.142 94.818)   // Yellow
Error: oklch(82.418% 0.099 33.756)     // Red
```

**Tailwind Config Addition**:
```javascript
theme: {
  extend: {
    colors: {
      'dim': {
        '100': 'oklch(30.857% 0.023 264.149)',
        '200': 'oklch(28.036% 0.019 264.182)',
        '300': 'oklch(26.346% 0.018 262.177)',
        'content': 'oklch(82.901% 0.031 222.959)',
      }
    }
  }
},
daisyui: {
  themes: [{
    dim: {
      'primary': 'oklch(86.133% 0.141 139.549)',
      'secondary': 'oklch(73.375% 0.165 35.353)',
      'accent': 'oklch(74.229% 0.133 311.379)',
      'neutral': 'oklch(24.731% 0.02 264.094)',
      'base-100': 'oklch(30.857% 0.023 264.149)',
      'base-200': 'oklch(28.036% 0.019 264.182)',
      'base-300': 'oklch(26.346% 0.018 262.177)',
      'base-content': 'oklch(82.901% 0.031 222.959)',
      'info': 'oklch(86.078% 0.142 206.182)',
      'success': 'oklch(86.171% 0.142 166.534)',
      'warning': 'oklch(86.163% 0.142 94.818)',
      'error': 'oklch(82.418% 0.099 33.756)',
    }
  }]
}
```

---

## IMPLEMENTATION CHECKLIST

### Step 1: Update Theme & Config
- [ ] Update `tailwind.config.js` with dim theme colors
- [ ] Update `postcss.config.js` if needed
- [ ] Test theme colors in browser

### Step 2: Rewrite HTML Structure
- [ ] Rewrite `index.html` with tab-based layout
  - [ ] Navbar with logo, title, theme toggle
  - [ ] File I/O card (input, output, format, style)
  - [ ] Presets card (dropdown, buttons)
  - [ ] Tabs component with 6 tabs
  - [ ] Tab content for each section
  - [ ] Convert button and status area
- [ ] Ensure ALL components use only DaisyUI elements
- [ ] Add proper IDs to form elements (keep same IDs for JS compatibility)
- [ ] Add tooltip hints to all major options

### Step 3: Update Styles
- [ ] Update `src/style.css`:
  - [ ] Tab styling (if needed beyond DaisyUI defaults)
  - [ ] Custom scrollbar (keep existing)
  - [ ] Code preview styling
  - [ ] Command preview styling
  - [ ] Tooltip styling (keep tooltip-end)
  - [ ] Collapse/accordion tweaks removal
  - [ ] Form spacing adjustments

### Step 4: Verify JavaScript Compatibility
- [ ] Test `src/main.js` with new HTML structure
- [ ] All event listeners still work with new IDs
- [ ] Form element selectors still valid
- [ ] File handling still works
- [ ] Preset system still works
- [ ] Command preview still updates
- [ ] All tabs accessible and functional
- [ ] Theme toggle still works
- [ ] Tooltips appear correctly

### Step 5: Testing
- [ ] File selection and path display
- [ ] Preset save/load/delete
- [ ] Format selection changes UI appropriately
- [ ] All form inputs update command preview
- [ ] Token replacement works
- [ ] Code preview updates with theme changes
- [ ] Theme toggle (light/dark) works
- [ ] Tooltips display without clipping
- [ ] All tabs accessible and scrollable
- [ ] Mobile responsiveness (if applicable)
- [ ] Browser console has no errors

### Step 6: Commit & Push
- [ ] Create meaningful commit message
- [ ] Push to GitHub
- [ ] Verify live on GitHub

---

## IMPORTANT NOTES FOR CONTINUATION

### Preserved Functionality (DO NOT BREAK)
- All `buildPandocCommand()` logic remains the same
- All form field IDs remain the same (for JS selectors)
- All token replacement functions unchanged
- All preset system unchanged
- All theme switching unchanged
- All file handling unchanged
- Dependency checker still runs on init
- All event listeners still work with new DOM

### Only Changing
- HTML structure (single-column → tabs layout)
- Visual organization (collapse → tabs)
- CSS styling (custom → pure DaisyUI)
- Component architecture (no functionality change)

### Key JavaScript IDs That MUST Be Preserved
```
Input/Output:
- inputFile, inputPath, outputPath, outputFormat, outputTheme, browseInput

PDF Options:
- pdfEngine, documentClass

Document Structure:
- titlePage, toc, tocDepth, tocNewPage, lof, lot, numberSections, topLevelDiv

Margins:
- marginUnit, uniformMargins, marginAll, marginTop, marginBottom, marginLeft, marginRight

Typography:
- mainFont, monoFont, fontSize, lineHeight

Code:
- highlightTheme, codePreview, codeLinenumbers, codeBackground, codeBackgroundColor

Headers/Footers:
- headerLeft, headerCenter, headerRight, footerLeft, footerCenter, footerRight
- pageNumberFormat, pageNumberPosition, pageNumberStyle

Metadata:
- metadataTitle, metadataAuthor, metadataDate

Advanced:
- mermaidFormat, extraArgs, colorLinks, linkColor, urlColor
- enableCrossref, enableCiteproc

Presets:
- presetSelect, loadPreset, savePreset, deletePreset

Convert:
- convertBtn, progressBar, statusText, commandPreview
```

### Command Building Logic (DO NOT CHANGE)
The `buildPandocCommand()` function works correctly. The new layout just reorganizes the UI for better user experience. All logic remains identical.

### Development Notes
- Dev server running on `localhost:3000`
- Vite hot module replacement enabled
- CSS changes require server restart
- JavaScript changes auto-reload
- Git tracking all changes

---

## DELIVERABLES

After implementation, the application will have:

1. **Modern Tab-Based UI**: 6 organized tabs for different option categories
2. **Clean Main Screen**: Only essential controls + presets + convert button visible
3. **Professional Design**: All DaisyUI components, consistent theming
4. **Dark Theme**: Custom "dim" theme colors throughout
5. **Accessible Layout**: Tooltips, organized sections, clear hierarchy
6. **Full Functionality**: All pandoc options still available, nothing removed
7. **Better UX**: No scrolling through long collapsible sections, cleaner interface

---

## CONTEXT FOR NEXT SESSION

If context is cleared, this plan provides complete project history and all necessary information to continue:

1. **What was done**: 6 phases of development from initial setup to bug fixes
2. **Current state**: Functional web UI with collapsible sections
3. **What's next**: Redesign to tab-based layout with DaisyUI components
4. **How to continue**: Follow the implementation checklist step by step
5. **Key constraints**: Preserve all JavaScript functionality, only change layout
6. **File locations**: All relevant files and line numbers documented
7. **Testing**: Comprehensive checklist ensures nothing breaks

---

**Last Updated**: [Current Date]
**Status**: Ready for Tab-Based Layout Redesign Implementation
**Next Action**: Begin Step 1 - Update Theme & Config
