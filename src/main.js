// Pandoc GUI v2 - Main Application Logic

// State
let inputFilePath = null;
let inputFileName = null;
let inputFileContent = null;
let outputDirPath = null;
let isTauri = false;

// Dependency availability state
const installedDeps = {
  pandoc: false,
  tectonic: false,
  texlive: false,  // Consolidated: includes pdflatex, xelatex, lualatex
  'mermaid-filter': false,
  'pandoc-crossref': false
};

// Track active event listener to prevent leaks
let activeDepListener = null;

// Detect Tauri environment
async function detectTauri() {
  try {
    // In Tauri v2, we check if the core module is available
    const { invoke } = await import('@tauri-apps/api/core');
    isTauri = true;
    console.log('Running in Tauri mode');
    return true;
  } catch (e) {
    isTauri = false;
    console.log('Running in web mode');
    return false;
  }
}

// Font detection - populated from system fonts via queryLocalFonts() API
let systemFonts = [];
let monoFonts = [];

// Code theme colors
const themeColors = {
  'pygments': { bg: '#f8f8f8', kw: '#008000', fn: '#0000ff', st: '#ba2121', cm: '#408080' },
  'kate': { bg: '#ffffff', kw: '#1f1c1b', fn: '#644a9b', st: '#bf0303', cm: '#898887' },
  'tango': { bg: '#f8f8f8', kw: '#204a87', fn: '#000000', st: '#4e9a06', cm: '#8f5902' },
  'breezedark': { bg: '#232629', kw: '#cfcfc2', fn: '#8e44ad', st: '#f44f4f', cm: '#7a7c7d' },
  'zenburn': { bg: '#3f3f3f', kw: '#f0dfaf', fn: '#efef8f', st: '#cc9393', cm: '#7f9f7f' },
  'nord': { bg: '#2e3440', kw: '#81a1c1', fn: '#88c0d0', st: '#a3be8c', cm: '#616e88' },
  'dracula': { bg: '#282a36', kw: '#ff79c6', fn: '#50fa7b', st: '#f1fa8c', cm: '#6272a4' },
  'monokai': { bg: '#272822', kw: '#f92672', fn: '#a6e22e', st: '#e6db74', cm: '#75715e' },
  'gruvbox-dark': { bg: '#282828', kw: '#fb4934', fn: '#b8bb26', st: '#fabd2f', cm: '#928374' },
  'solarized-dark': { bg: '#002b36', kw: '#859900', fn: '#268bd2', st: '#2aa198', cm: '#586e75' },
};

// DOM helper
const $ = id => document.getElementById(id);

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('appTheme') || 'dim';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Theme menu click handlers
  document.querySelectorAll('[data-set-theme]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const theme = btn.getAttribute('data-set-theme');
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('appTheme', theme);
      // Close dropdown by removing focus
      if (document.activeElement) {
        document.activeElement.blur();
      }
    });
  });
}

// System Fonts - uses Local Font Access API to get actual installed fonts
async function loadSystemFonts() {
  const mainFontSelect = $('mainFont');
  const monoFontSelect = $('monoFont');

  // Known monospace font family patterns
  const monoPatterns = [
    /mono/i, /courier/i, /consolas/i, /menlo/i, /monaco/i,
    /fira\s*code/i, /jetbrains/i, /source\s*code/i, /inconsolata/i,
    /hack/i, /cascadia/i, /iosevka/i, /sf\s*mono/i, /dejavu.*mono/i,
    /liberation.*mono/i, /ubuntu.*mono/i, /roboto.*mono/i, /ibm.*plex.*mono/i,
    /pt\s*mono/i, /droid.*mono/i, /anonymous/i, /terminus/i
  ];

  const isMono = (fontFamily) => monoPatterns.some(p => p.test(fontFamily));

  try {
    // Try Local Font Access API (Chrome 103+, requires permission)
    if ('queryLocalFonts' in window) {
      const fonts = await window.queryLocalFonts();
      const fontFamilies = new Set();
      const monoFamilies = new Set();

      for (const font of fonts) {
        const family = font.family;
        if (!fontFamilies.has(family)) {
          fontFamilies.add(family);
          if (isMono(family)) {
            monoFamilies.add(family);
          }
        }
      }

      systemFonts = [...fontFamilies].sort((a, b) => a.localeCompare(b));
      monoFonts = [...monoFamilies].sort((a, b) => a.localeCompare(b));

      console.log(`Loaded ${systemFonts.length} system fonts, ${monoFonts.length} monospace`);
    } else {
      throw new Error('queryLocalFonts not available');
    }
  } catch (e) {
    console.log('Local Font Access API not available, using Tauri backend');
    // Try Tauri backend to list fonts
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const fonts = await invoke('list_system_fonts');
        if (fonts && fonts.length > 0) {
          systemFonts = fonts.sort((a, b) => a.localeCompare(b));
          monoFonts = fonts.filter(f => isMono(f)).sort((a, b) => a.localeCompare(b));
          console.log(`Loaded ${systemFonts.length} fonts via Tauri`);
        }
      } catch (tauriErr) {
        console.log('Tauri font listing not available:', tauriErr);
      }
    }
  }

  // Populate dropdowns
  systemFonts.forEach(font => {
    const opt = document.createElement('option');
    opt.value = font;
    opt.textContent = font;
    opt.style.fontFamily = font;
    mainFontSelect.appendChild(opt);
  });

  monoFonts.forEach(font => {
    const opt = document.createElement('option');
    opt.value = font;
    opt.textContent = font;
    opt.style.fontFamily = font;
    monoFontSelect.appendChild(opt);
  });

  // If no fonts loaded, show a message
  if (systemFonts.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '(Grant font permission or use Tauri app)';
    opt.disabled = true;
    mainFontSelect.appendChild(opt);
  }
}

// File Handling
async function setupFileHandling() {
  const browseInputBtn = $('browseInput');
  const inputFileEl = $('inputFile');
  const browseOutputBtn = $('browseOutput');

  browseInputBtn.addEventListener('click', async () => {
    if (isTauri) {
      // Use Tauri dialog for file selection
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
          multiple: false,
          filters: [{
            name: 'Documents',
            extensions: ['md', 'markdown', 'rst', 'tex', 'latex', 'docx', 'doc', 'html', 'htm', 'org', 'txt', 'adoc', 'asciidoc', 'epub', 'odt', 'rtf', 'json', 'yaml', 'yml']
          }]
        });
        if (selected) {
          await handleTauriFileSelect(selected);
        }
      } catch (err) {
        console.error('Dialog error:', err);
        showToast('Failed to open file dialog: ' + err, 'error');
      }
    } else {
      inputFileEl.click();
    }
  });

  inputFileEl.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
      await handleFileSelect(e.target.files[0]);
    }
  });

  browseOutputBtn.addEventListener('click', async () => {
    if (isTauri) {
      // Use Tauri dialog for folder selection
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
          directory: true,
          multiple: false
        });
        if (selected) {
          outputDirPath = selected.endsWith('/') ? selected : selected + '/';
          updateOutputDisplay();
          updateCommandPreview();
        }
      } catch (err) {
        console.error('Dialog error:', err);
        showToast('Failed to open folder dialog: ' + err, 'error');
      }
    } else {
      showToast('Output directory can only be changed in desktop app', 'info');
    }
  });

  $('outputName').addEventListener('input', () => {
    updateOutputDisplay();
    updateCommandPreview();
  });
  $('outputFormat').addEventListener('change', () => {
    handleFormatChange();
    updateOutputDisplay();
    updateCommandPreview();
  });
}

// Handle file selection in Tauri
async function handleTauriFileSelect(filePath) {
  inputFilePath = filePath;
  inputFileName = filePath.split('/').pop();

  // Update input path display
  $('inputPath').textContent = filePath;

  // Set output directory from input file path
  const lastSlash = filePath.lastIndexOf('/');
  if (lastSlash > 0) {
    outputDirPath = filePath.substring(0, lastSlash + 1);
  } else {
    outputDirPath = './';
  }

  // Set output filename (without extension)
  const baseName = inputFileName.replace(/\.[^/.]+$/, '');
  $('outputName').value = baseName;

  // Read file content for mermaid detection using Tauri fs
  try {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    inputFileContent = await readTextFile(filePath);
    detectMermaid(inputFileContent);
  } catch (e) {
    console.error('Failed to read file:', e);
    inputFileContent = null;
  }

  // Enable convert button
  $('convertBtn').disabled = false;
  updateOutputDisplay();
  updateCommandPreview();
}

// Update output display with actual path
function updateOutputDisplay() {
  const outName = $('outputName').value || 'output';
  const ext = getExtensionForFormat($('outputFormat').value);
  const dir = outputDirPath || '';

  if (dir) {
    $('outputDir').textContent = dir + outName + '.' + ext;
  } else {
    $('outputDir').textContent = 'Output: Select input file first';
  }
}

async function handleFileSelect(file) {
  inputFileName = file.name;
  // In web mode we only get the filename
  inputFilePath = file.name;

  // Update input path display (in web mode just show filename)
  $('inputPath').textContent = file.name;

  // In web mode, output dir is same folder (relative)
  outputDirPath = '';

  // Set output filename (without extension)
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  $('outputName').value = baseName;

  // Read file content for mermaid detection
  try {
    inputFileContent = await file.text();
    detectMermaid(inputFileContent);
  } catch (e) {
    inputFileContent = null;
  }

  // Enable convert button
  $('convertBtn').disabled = false;
  updateOutputDisplay();
  updateCommandPreview();
}

function detectMermaid(content) {
  const hasMermaid = /```mermaid/i.test(content);
  $('mermaidDetected').classList.toggle('hidden', !hasMermaid);
}

// Format change handling
function handleFormatChange() {
  const format = $('outputFormat').value;
  const isPdf = format === 'pdf';
  const needsStandalone = ['html', 'latex'].includes(format);

  // Show/hide PDF engine section
  $('pdfEngineSection').classList.toggle('hidden', !isPdf);

  // Show/hide standalone option
  $('standaloneLabel').classList.toggle('hidden', !needsStandalone);
}

// Margin handling
function setupMargins() {
  const uniformCheckbox = $('uniformMargins');

  uniformCheckbox.addEventListener('change', () => {
    const uniform = uniformCheckbox.checked;
    $('uniformMarginInput').classList.toggle('hidden', !uniform);
    $('individualMargins').classList.toggle('hidden', uniform);
    updateCommandPreview();
  });

  $('marginAll').addEventListener('input', () => {
    const val = $('marginAll').value;
    $('marginTop').value = val;
    $('marginBottom').value = val;
    $('marginLeft').value = val;
    $('marginRight').value = val;
    updateCommandPreview();
  });

  // Individual margin inputs
  ['marginTop', 'marginBottom', 'marginLeft', 'marginRight'].forEach(id => {
    $(id).addEventListener('input', updateCommandPreview);
  });
}

// Code Preview
function updateCodePreview() {
  const theme = $('highlightTheme').value;
  const colors = themeColors[theme] || themeColors['breezedark'];
  const preview = $('codePreview');
  const useBg = $('codeBlockBg').checked;
  const bgColor = useBg ? ($('codeBlockBgColor').value || colors.bg) : 'transparent';

  preview.style.backgroundColor = bgColor;
  preview.querySelectorAll('.kw').forEach(el => el.style.color = colors.kw);
  preview.querySelectorAll('.fn').forEach(el => el.style.color = colors.fn);
  preview.querySelectorAll('.st').forEach(el => el.style.color = colors.st);
  preview.querySelectorAll('.cm').forEach(el => el.style.color = colors.cm);

  // Set text color based on theme brightness
  const isLightTheme = ['pygments', 'kate', 'tango'].includes(theme);
  preview.style.color = isLightTheme ? '#333' : '#ddd';

  // Update color picker if user hasn't customized it
  if (!$('codeBlockBgColor').dataset.userSet) {
    $('codeBlockBgColor').value = colors.bg;
  }
}

function setupCodePreview() {
  $('highlightTheme').addEventListener('change', () => {
    // Reset user customization flag when theme changes
    $('codeBlockBgColor').dataset.userSet = '';
    updateCodePreview();
    updateCommandPreview();
  });

  $('codeBlockBg').addEventListener('change', updateCodePreview);

  $('codeBlockBgColor').addEventListener('input', () => {
    $('codeBlockBgColor').dataset.userSet = 'true';
    updateCodePreview();
  });

  updateCodePreview();
}

// TOC Toggle
function setupTocHandling() {
  $('toc').addEventListener('change', () => {
    $('tocOptions').classList.toggle('hidden', !$('toc').checked);
    updateCommandPreview();
  });

  $('tocDepth').addEventListener('input', () => {
    $('tocDepthValue').textContent = $('tocDepth').value;
    updateCommandPreview();
  });
}

// Token drag and drop - with click as primary interaction
let lastFocusedTokenField = null;

// Token color mapping based on badge classes
const tokenColors = {
  '{today}': 'primary',
  '{year}': 'primary',
  '{file}': 'secondary',
  '{user}': 'secondary',
  '{title}': 'accent',
  '{author}': 'accent',
  '{date}': 'accent',
  '{page}': 'info',
  '{pages}': 'info',
  '{section}': 'warning',
  '{chapter}': 'warning'
};

// Create a colored token pill element
function createTokenPill(tokenValue) {
  const color = tokenColors[tokenValue] || 'primary';
  const pill = document.createElement('span');
  pill.className = `token-pill token-${color}`;
  pill.dataset.token = tokenValue;
  pill.innerHTML = `${tokenValue}<span class="remove-token" title="Remove">×</span>`;
  pill.contentEditable = 'false';

  // Handle remove click
  pill.querySelector('.remove-token').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    pill.remove();
    updateCommandPreview();
  });

  return pill;
}

// Insert token pill at cursor position in contenteditable
function insertTokenPill(field, tokenValue) {
  const pill = createTokenPill(tokenValue);

  // Get current selection
  const selection = window.getSelection();

  if (field.contains(selection.anchorNode) || field === selection.anchorNode) {
    // Insert at cursor
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(pill);

    // Move cursor after pill
    range.setStartAfter(pill);
    range.setEndAfter(pill);
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    // No cursor in field, append at end
    field.appendChild(pill);
  }

  field.focus();
  updateCommandPreview();
}

// Insert token text into regular input (for header/footer fields)
function insertTokenText(input, tokenValue) {
  const pos = input.selectionStart ?? input.value.length;
  input.value = input.value.slice(0, pos) + tokenValue + input.value.slice(pos);
  input.focus();
  const newPos = pos + tokenValue.length;
  input.setSelectionRange(newPos, newPos);
  updateCommandPreview();
}

// Get text content from a token field (converts pills to token strings)
function getTokenFieldValue(field) {
  if (!field) return '';

  // If it's a regular input, just return the value
  if (field.tagName === 'INPUT') {
    return field.value;
  }

  // For contenteditable, traverse children and build string
  let result = '';
  field.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList.contains('token-pill')) {
        result += node.dataset.token;
      } else {
        result += node.textContent;
      }
    }
  });
  return result.trim();
}

// Set content of a token field, converting token strings to colored pills
function setTokenFieldValue(field, value) {
  if (!field) return;

  // Clear current content
  field.innerHTML = '';

  if (!value) return;

  // Parse value and create pills for tokens
  const tokenRegex = /(\{[^}]+\})/g;
  const parts = value.split(tokenRegex);

  parts.forEach(part => {
    if (part.match(tokenRegex)) {
      // It's a token - create a pill
      const pill = createTokenPill(part);
      field.appendChild(pill);
    } else if (part) {
      // Regular text
      field.appendChild(document.createTextNode(part));
    }
  });
}

function setupTokenDrag() {
  const tokenList = $('tokenList');
  if (!tokenList) {
    console.error('tokenList element not found');
    return;
  }

  // Token fields (contenteditable) - get colored pills
  const tokenFieldIds = [
    'docTitle', 'docAuthor', 'docDate',
    'headerLeft', 'headerCenter', 'headerRight',
    'footerLeft', 'footerCenter', 'footerRight'
  ];

  // Regular text inputs - get plain text tokens
  const textInputIds = ['outputName', 'extraArgs'];

  const allTargetIds = [...tokenFieldIds, ...textInputIds];

  // Track last focused field
  allTargetIds.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('focus', () => {
      lastFocusedTokenField = el;
    });
  });

  // Get all tokens
  const tokens = tokenList.querySelectorAll('[data-token]');

  // Click handler for tokens - insert into last focused field
  tokens.forEach(token => {
    token.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const tokenValue = token.dataset.token;
      let target = lastFocusedTokenField;
      if (!target || !allTargetIds.includes(target.id)) {
        target = $('docTitle');
      }
      if (target) {
        if (tokenFieldIds.includes(target.id)) {
          insertTokenPill(target, tokenValue);
        } else {
          insertTokenText(target, tokenValue);
        }
        showToast(`Inserted ${tokenValue}`, 'success');
      }
    });

    // Setup drag - native HTML5 drag and drop
    token.setAttribute('draggable', 'true');

    token.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', token.dataset.token);
      e.dataTransfer.effectAllowed = 'copy';
      token.classList.add('dragging');

      // Create a custom drag image
      const dragImage = token.cloneNode(true);
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      dragImage.style.transform = 'scale(1.2)';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, dragImage.offsetWidth / 2, dragImage.offsetHeight / 2);
      setTimeout(() => dragImage.remove(), 0);
    });

    token.addEventListener('dragend', () => {
      token.classList.remove('dragging');
    });
  });

  // Setup drop targets for contenteditable fields (colored pills)
  tokenFieldIds.forEach(id => {
    const field = $(id);
    if (!field) {
      console.error('Token field not found:', id);
      return;
    }
    console.log('Setting up drop target for:', id);

    // Use capture phase to intercept before contenteditable's default behavior
    field.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.dataTransfer.dropEffect = 'copy';
      field.classList.add('drop-active');
    }, true);

    field.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      field.classList.add('drop-active');
    }, true);

    field.addEventListener('dragleave', (e) => {
      if (!field.contains(e.relatedTarget)) {
        field.classList.remove('drop-active');
      }
    }, true);

    field.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      field.classList.remove('drop-active');

      const tokenValue = e.dataTransfer.getData('text/plain');

      if (tokenValue && tokenValue.startsWith('{') && tokenValue.endsWith('}')) {
        // Create colored pill
        const pill = createTokenPill(tokenValue);

        // Use requestAnimationFrame to run after browser's default behavior
        requestAnimationFrame(() => {
          // Find and remove any plain text nodes containing the token
          // BUT only text nodes that are direct children of field, not inside pills
          const nodesToFix = [];
          field.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.includes(tokenValue)) {
              nodesToFix.push(node);
            }
          });
          nodesToFix.forEach(textNode => {
            textNode.textContent = textNode.textContent.split(tokenValue).join('');
            // Remove empty text nodes
            if (!textNode.textContent.trim()) {
              textNode.remove();
            }
          });

          // Append pill
          field.appendChild(pill);

          field.focus();
          updateCommandPreview();
          showToast(`Inserted ${tokenValue}`, 'success');
        });
      }
    }, true); // Capture phase
  });

  // Setup drop targets for regular text inputs
  textInputIds.forEach(id => {
    const input = $(id);
    if (!input) return;

    input.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      input.classList.add('drop-active');
    });

    input.addEventListener('dragenter', (e) => {
      e.preventDefault();
      input.classList.add('drop-active');
    });

    input.addEventListener('dragleave', () => {
      input.classList.remove('drop-active');
    });

    input.addEventListener('drop', (e) => {
      e.preventDefault();
      input.classList.remove('drop-active');

      const tokenValue = e.dataTransfer.getData('text/plain');
      if (tokenValue && tokenValue.startsWith('{') && tokenValue.endsWith('}')) {
        insertTokenText(input, tokenValue);
        showToast(`Inserted ${tokenValue}`, 'success');
      }
    });
  });
}

// Replace metadata tokens with actual values
function replaceMetadataTokens(str) {
  if (!str) return str;
  const now = new Date();
  const today = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const year = now.getFullYear().toString();
  const baseName = inputFileName ? inputFileName.replace(/\.[^/.]+$/, '') : 'document';

  return str
    .replace(/\{today\}/g, today)
    .replace(/\{year\}/g, year)
    .replace(/\{file\}/g, baseName)
    .replace(/\{user\}/g, 'User');
}

// Build Pandoc Command
function buildPandocCommand() {
  const args = ['pandoc'];

  // Input file
  const input = inputFilePath || 'input.md';
  args.push(`"${input}"`);

  // Output format
  const format = $('outputFormat').value;
  args.push(`-t ${format}`);

  // Output file
  const outName = $('outputName').value || 'output';
  const ext = getExtensionForFormat(format);
  const dir = outputDirPath || './';
  const finalOutput = dir + outName + '.' + ext;
  args.push(`-o "${finalOutput}"`);

  // Standalone flag
  const isPdf = format === 'pdf';
  if (isPdf || ($('standalone') && $('standalone').checked)) {
    args.push('-s');
  }

  // PDF-specific options
  if (isPdf) {
    args.push(`--pdf-engine=${$('pdfEngine').value}`);
    args.push(`-V documentclass=${$('documentClass').value}`);
    args.push(`-V papersize=${$('paperSize').value}`);

    if ($('orientation').value === 'landscape') {
      args.push('-V geometry:landscape');
    }

    // Margins
    const unit = $('marginUnit').value;
    const margins = [];
    if ($('uniformMargins').checked) {
      const m = $('marginAll').value;
      margins.push(`margin=${m}${unit}`);
    } else {
      if ($('marginTop').value) margins.push(`top=${$('marginTop').value}${unit}`);
      if ($('marginBottom').value) margins.push(`bottom=${$('marginBottom').value}${unit}`);
      if ($('marginLeft').value) margins.push(`left=${$('marginLeft').value}${unit}`);
      if ($('marginRight').value) margins.push(`right=${$('marginRight').value}${unit}`);
    }
    if (margins.length > 0) {
      args.push(`-V geometry:${margins.join(',')}`);
    }

    // Title page (KOMA-Script or custom)
    if ($('titlePage').checked) {
      // Use titlepages package for article class or titlepage for others
      args.push('-V titlepage=true');
      args.push('-V titlepage-rule-height=0');
    }

    // Link colors - dark mode overrides custom colors
    const isDarkMode = $('darkMode') && $('darkMode').checked;
    if (isDarkMode) {
      // Set link colors for dark mode (cyan works well on dark background)
      args.push('-V colorlinks=true');
      args.push('-V linkcolor=cyan');
      args.push('-V urlcolor=cyan');
      args.push('-V filecolor=cyan');
      args.push('-V citecolor=cyan');
      // Mark that dark mode is enabled (placeholder for header path)
      // This will be replaced during conversion with actual -H flag
      args.push('--DARK-MODE-PLACEHOLDER--');
    } else if ($('colorLinks').checked) {
      // Custom link colors (only if not in dark mode)
      args.push('-V colorlinks=true');
      const color = $('linkColor').value.replace('#', '');
      args.push(`-V 'linkcolor=[HTML]{${color}}'`);
      args.push(`-V 'urlcolor=[HTML]{${color}}'`);
    }

    // Headers and Footers - only add if user specifies custom content
    const headerLeft = replaceHeaderFooterTokens(getTokenFieldValue($('headerLeft')));
    const headerCenter = replaceHeaderFooterTokens(getTokenFieldValue($('headerCenter')));
    const headerRight = replaceHeaderFooterTokens(getTokenFieldValue($('headerRight')));
    const footerLeft = replaceHeaderFooterTokens(getTokenFieldValue($('footerLeft')));
    const footerCenter = replaceHeaderFooterTokens(getTokenFieldValue($('footerCenter')));
    const footerRight = replaceHeaderFooterTokens(getTokenFieldValue($('footerRight')));

    // Page numbering options
    const pageFormat = $('pageNumberFormat').value;
    const pagePosition = $('pageNumberPosition').value;
    const pageStyle = $('pageNumberStyle').value;

    // Build page number string based on format
    let pageNumStr = '';
    if (pageFormat === 'page') {
      pageNumStr = 'Page \\thepage';
    } else if (pageFormat === 'page-of-x') {
      pageNumStr = 'Page \\thepage\\ of \\pageref{LastPage}';
    } else if (pageFormat === 'n-of-x') {
      pageNumStr = '\\thepage\\ of \\pageref{LastPage}';
    } else {
      pageNumStr = '\\thepage';
    }

    // Determine position for fancyhdr
    let pageNumPosition = 'C'; // center
    let pageNumHeader = false;
    if (pagePosition === 'bottom-center') {
      pageNumPosition = 'C';
    } else if (pagePosition === 'bottom-right') {
      pageNumPosition = 'R';
    } else if (pagePosition === 'top-right') {
      pageNumPosition = 'R';
      pageNumHeader = true;
    }

    const hasCustomHeadersFooters = headerLeft || headerCenter || headerRight || footerLeft || footerCenter || footerRight;

    // Always add fancyhdr for page numbering control
    args.push('-V header-includes="\\usepackage{fancyhdr}"');
    args.push('-V header-includes="\\usepackage{lastpage}"');
    args.push('-V header-includes="\\pagestyle{fancy}"');
    args.push('-V header-includes="\\fancyhf{}"');

    // Page style (arabic, roman, Roman)
    if (pageStyle === 'roman') {
      args.push('-V header-includes="\\pagenumbering{roman}"');
    } else if (pageStyle === 'Roman') {
      args.push('-V header-includes="\\pagenumbering{Roman}"');
    }

    // Add custom headers/footers if specified
    if (headerLeft) args.push(`-V header-includes="\\fancyhead[L]{${headerLeft}}"`);
    if (headerCenter) args.push(`-V header-includes="\\fancyhead[C]{${headerCenter}}"`);
    if (headerRight) args.push(`-V header-includes="\\fancyhead[R]{${headerRight}}"`);
    if (footerLeft) args.push(`-V header-includes="\\fancyfoot[L]{${footerLeft}}"`);
    if (footerCenter) args.push(`-V header-includes="\\fancyfoot[C]{${footerCenter}}"`);
    if (footerRight) args.push(`-V header-includes="\\fancyfoot[R]{${footerRight}}"`);

    // Add page number if no custom footer at that position
    if (!hasCustomHeadersFooters) {
      if (pageNumHeader) {
        args.push(`-V header-includes="\\fancyhead[${pageNumPosition}]{${pageNumStr}}"`);
      } else {
        args.push(`-V header-includes="\\fancyfoot[${pageNumPosition}]{${pageNumStr}}"`);
      }
    }
  }

  // Typography
  if ($('mainFont').value) {
    args.push(`-V mainfont="${$('mainFont').value}"`);
  }
  if ($('monoFont').value) {
    args.push(`-V monofont="${$('monoFont').value}"`);
  }
  const fontSize = $('fontSize').value;
  if (fontSize && fontSize !== '12') {
    args.push(`-V fontsize=${fontSize}pt`);
  }
  if ($('lineHeight').value !== '1.5') {
    args.push(`-V linestretch=${$('lineHeight').value}`);
  }

  // Code highlighting (using --syntax-highlighting, replaces deprecated --highlight-style)
  const highlightTheme = $('highlightTheme').value;
  if (highlightTheme && highlightTheme !== 'none') {
    args.push(`--syntax-highlighting=${highlightTheme}`);
  }

  // TOC
  if ($('toc').checked) {
    args.push('--toc');
    args.push(`--toc-depth=${$('tocDepth').value}`);
    // Page break after TOC
    if ($('tocNewPage').checked) {
      args.push('-V toc-own-page=true');
    }
  }

  // List of Figures / Tables
  if ($('lof') && $('lof').checked) args.push('-V lof=true');
  if ($('lot') && $('lot').checked) args.push('-V lot=true');

  // Top-level division
  const topLevelDiv = $('topLevelDiv');
  if (topLevelDiv && topLevelDiv.value !== 'default') {
    args.push(`--top-level-division=${topLevelDiv.value}`);
  }

  // Number sections
  if ($('numberSections').checked) {
    args.push('-N');
  }

  // Metadata with token replacement (use getTokenFieldValue for contenteditable)
  const title = replaceMetadataTokens(getTokenFieldValue($('docTitle')));
  const author = replaceMetadataTokens(getTokenFieldValue($('docAuthor')));
  const date = replaceMetadataTokens(getTokenFieldValue($('docDate')));

  if (title) args.push(`-M title="${title}"`);
  if (author) args.push(`-M author="${author}"`);
  if (date) args.push(`-M date="${date}"`);

  // Mermaid filter
  const hasMermaid = !$('mermaidDetected').classList.contains('hidden');
  if (hasMermaid) {
    const mermaidFormat = document.querySelector('input[name="mermaidFormat"]:checked').value;
    args.push('-F mermaid-filter');
    if (mermaidFormat === 'svg') {
      args.push('-M mermaid-format=svg');
    }
  }

  // Dark mode for HTML/EPUB
  const isHtmlLike = ['html', 'epub'].includes(format);
  if (isHtmlLike && $('darkMode') && $('darkMode').checked) {
    args.push('--css=data:text/css,body{background-color:%231e1e2e;color:%23cdd6f4}a{color:%2389b4fa}pre,code{background-color:%23313244}');
  }

  // Other filters
  if ($('filterCrossref').checked) args.push('-F pandoc-crossref');
  if ($('filterCiteproc').checked) args.push('--citeproc');

  // Extra arguments
  const extraArgs = $('extraArgs').value.trim();
  if (extraArgs) {
    args.push(extraArgs);
  }

  return args.join(' \\\n  ');
}

// Replace header/footer tokens with LaTeX commands
function replaceHeaderFooterTokens(str) {
  if (!str) return '';
  return str
    .replace(/\{page\}/g, '\\thepage')
    .replace(/\{pages\}/g, '\\pageref{LastPage}')
    .replace(/\{section\}/g, '\\leftmark')
    .replace(/\{chapter\}/g, '\\rightmark')
    .replace(/\{title\}/g, replaceMetadataTokens('{title}'))
    .replace(/\{author\}/g, replaceMetadataTokens('{author}'))
    .replace(/\{date\}/g, replaceMetadataTokens('{date}'))
    .replace(/\{today\}/g, replaceMetadataTokens('{today}'))
    .replace(/\{year\}/g, replaceMetadataTokens('{year}'))
    .replace(/\{file\}/g, replaceMetadataTokens('{file}'))
    .replace(/\{user\}/g, replaceMetadataTokens('{user}'));
}

function getExtensionForFormat(format) {
  const extensions = {
    pdf: 'pdf', docx: 'docx', odt: 'odt', html: 'html',
    epub: 'epub', latex: 'tex', pptx: 'pptx',
    markdown: 'md', rst: 'rst', plain: 'txt',
  };
  return extensions[format] || format;
}

function updateCommandPreview() {
  $('commandPreview').textContent = buildPandocCommand();
}

// Copy Command
function setupCopyCommand() {
  $('copyCmd').addEventListener('click', async () => {
    const cmd = $('commandPreview').textContent;
    // Convert multi-line command to single line
    const singleLineCmd = cmd.replace(/\\\n\s+/g, ' ');
    try {
      await navigator.clipboard.writeText(singleLineCmd);
      showToast('Command copied to clipboard!', 'success');
    } catch (err) {
      showToast('Failed to copy command', 'error');
    }
  });
}

// Toast Notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `alert alert-${type} shadow-lg`;
  toast.innerHTML = `<span>${message}</span>`;
  $('toastContainer').appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// Conversion
function setupConversion() {
  $('convertBtn').addEventListener('click', async () => {
    if (!inputFilePath) {
      showToast('Please select an input file first', 'warning');
      return;
    }

    const outName = $('outputName').value || 'output';
    const ext = getExtensionForFormat($('outputFormat').value);
    const finalPath = (outputDirPath || './') + outName + '.' + ext;

    // Check if file exists and confirm overwrite
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const exists = await invoke('file_exists', { path: finalPath });
        if (exists) {
          if (!confirm(`File "${outName}.${ext}" already exists. Overwrite?`)) {
            return;
          }
        }
      } catch (e) {
        console.log('Could not check file existence:', e);
      }
    }

    $('statusArea').classList.remove('hidden');
    $('statusText').textContent = 'Converting...';
    $('progressBar').removeAttribute('value'); // Indeterminate
    $('convertBtn').disabled = true;

    try {
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core');
        let command = buildPandocCommand().replace(/\\\n\s+/g, ' ');

        // Handle dark mode header file for PDF
        if (command.includes('--DARK-MODE-PLACEHOLDER--')) {
          console.log('Dark mode detected, writing header file...');
          const headerPath = await invoke('write_dark_mode_header');
          console.log('Dark mode header written to:', headerPath);
          const beforeReplace = command;
          command = command.replace('--DARK-MODE-PLACEHOLDER--', `-H "${headerPath}"`);
          if (beforeReplace === command) {
            console.warn('WARNING: Placeholder replacement had no effect');
          }
        }

        // Safety check: ensure no placeholder made it through
        if (command.includes('--DARK-MODE-PLACEHOLDER--')) {
          throw new Error('Dark mode header placeholder was not properly replaced. Please try disabling dark mode or contact support.');
        }

        await invoke('run_pandoc', { command });

        $('statusText').textContent = 'Conversion complete!';
        $('progressBar').value = 100;
        showToast('Document converted successfully!', 'success');

        // Open file if checkbox is checked
        if ($('openOnComplete').checked) {
          await invoke('open_file', { path: finalPath });
        }
      } else {
        // Web mode - can't actually run pandoc
        setTimeout(() => {
          $('statusText').textContent = 'Copy the command to run in your terminal';
          $('progressBar').value = 100;
          showToast('In web mode, copy the command and run it in your terminal', 'info');
        }, 500);
      }
    } catch (err) {
      $('statusText').textContent = `Error: ${err}`;
      showToast('Conversion failed: ' + err, 'error');
    } finally {
      $('convertBtn').disabled = !inputFilePath;
    }
  });
}

// Setup all input listeners for command preview updates
function setupInputListeners() {
  const excludeIds = ['inputFile', 'presetSelect', 'tokensCollapse', 'inputPath', 'outputDir'];

  document.querySelectorAll('input, select').forEach(input => {
    if (!excludeIds.includes(input.id) && input.type !== 'file') {
      input.addEventListener('change', updateCommandPreview);
      if (input.type !== 'checkbox' && input.type !== 'radio') {
        input.addEventListener('input', updateCommandPreview);
      }
    }
  });
}

// Preset Management
const PRESET_STORAGE_KEY = 'pandoc-gui-presets';

function getPresets() {
  try {
    return JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function savePresetsToStorage(presets) {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
}

function getSettingsIds() {
  return [
    'outputFormat', 'pdfEngine', 'titlePage', 'toc', 'lof', 'lot',
    'numberSections', 'standalone', 'darkMode', 'tocDepth', 'tocNewPage', 'topLevelDiv',
    'paperSize', 'orientation', 'marginUnit', 'uniformMargins', 'marginAll',
    'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
    'headerLeft', 'headerCenter', 'headerRight', 'footerLeft', 'footerCenter', 'footerRight',
    'pageNumberFormat', 'pageNumberStyle', 'pageNumberPosition',
    'mainFont', 'monoFont', 'fontSize', 'lineHeight',
    'highlightTheme', 'lineNumbers', 'codeBlockBg', 'codeBlockBgColor',
    'docTitle', 'docAuthor', 'docDate', 'documentClass',
    'filterCrossref', 'filterCiteproc', 'extraArgs', 'colorLinks', 'linkColor', 'openOnComplete'
  ];
}

// Contenteditable fields that need special handling
const contenteditableIds = [
  'docTitle', 'docAuthor', 'docDate',
  'headerLeft', 'headerCenter', 'headerRight',
  'footerLeft', 'footerCenter', 'footerRight'
];

function getCurrentSettings() {
  const settings = {};
  getSettingsIds().forEach(id => {
    const el = $(id);
    if (el) {
      if (el.type === 'checkbox') {
        settings[id] = el.checked;
      } else if (contenteditableIds.includes(id)) {
        // For contenteditable, get the text value
        settings[id] = getTokenFieldValue(el);
      } else {
        settings[id] = el.value;
      }
    }
  });
  // Also save mermaid format radio
  const mermaidRadio = document.querySelector('input[name="mermaidFormat"]:checked');
  if (mermaidRadio) settings.mermaidFormat = mermaidRadio.value;
  return settings;
}

function applySettings(settings) {
  getSettingsIds().forEach(id => {
    const el = $(id);
    if (el && settings[id] !== undefined) {
      if (el.type === 'checkbox') {
        el.checked = settings[id];
      } else if (contenteditableIds.includes(id)) {
        // For contenteditable, set textContent and recreate pills for tokens
        setTokenFieldValue(el, settings[id]);
      } else {
        el.value = settings[id];
      }
    }
  });
  // Restore mermaid format
  if (settings.mermaidFormat) {
    const radio = document.querySelector(`input[name="mermaidFormat"][value="${settings.mermaidFormat}"]`);
    if (radio) radio.checked = true;
  }
  // Trigger UI updates
  $('uniformMargins').dispatchEvent(new Event('change'));
  $('toc').dispatchEvent(new Event('change'));
  handleFormatChange();
  updateCodePreview();
  updateCommandPreview();
}

function updatePresetDropdown() {
  const select = $('presetSelect');
  const presets = getPresets();
  // Clear existing options except first
  while (select.options.length > 1) {
    select.remove(1);
  }
  // Add presets
  Object.keys(presets).sort().forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
}

function setupPresets() {
  updatePresetDropdown();

  $('savePreset').addEventListener('click', () => {
    // Show the modal
    $('presetNameInput').value = '';
    $('presetModal').showModal();
    $('presetNameInput').focus();
  });

  // Handle preset save confirmation from modal
  $('presetSaveConfirm').addEventListener('click', () => {
    const name = $('presetNameInput').value.trim();
    if (!name) {
      showToast('Please enter a preset name', 'warning');
      return;
    }
    const presets = getPresets();
    presets[name] = getCurrentSettings();
    savePresetsToStorage(presets);
    updatePresetDropdown();
    $('presetSelect').value = name;
    $('presetModal').close();
    showToast(`Preset "${name}" saved`, 'success');
  });

  // Allow Enter key in preset name input
  $('presetNameInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('presetSaveConfirm').click();
    }
  });

  $('loadPreset').addEventListener('click', () => {
    const name = $('presetSelect').value;
    if (!name) {
      showToast('Please select a preset first', 'warning');
      return;
    }
    const presets = getPresets();
    if (presets[name]) {
      applySettings(presets[name]);
      showToast(`Preset "${name}" loaded`, 'success');
    }
  });

  $('updatePreset').addEventListener('click', () => {
    const name = $('presetSelect').value;
    if (!name) {
      showToast('Please select a preset first', 'warning');
      return;
    }
    const presets = getPresets();
    presets[name] = getCurrentSettings();
    savePresetsToStorage(presets);
    showToast(`Preset "${name}" updated`, 'success');
  });

  $('deletePreset').addEventListener('click', () => {
    const name = $('presetSelect').value;
    if (!name) {
      showToast('Please select a preset first', 'warning');
      return;
    }
    if (!confirm(`Are you sure you want to delete the preset "${name}"?`)) return;
    const presets = getPresets();
    delete presets[name];
    savePresetsToStorage(presets);
    updatePresetDropdown();
    showToast(`Preset "${name}" deleted`, 'info');
  });

  // Double-click to load
  $('presetSelect').addEventListener('dblclick', () => {
    if ($('presetSelect').value) {
      $('loadPreset').click();
    }
  });
}

// FAB Menu
function setupFabMenu() {
  // Check dependencies
  $('fabCheckDeps')?.addEventListener('click', async (e) => {
    e.preventDefault();
    document.activeElement?.blur();
    await checkDependencies();
  });

  // Reset to defaults
  $('fabResetDefaults')?.addEventListener('click', (e) => {
    e.preventDefault();
    resetToDefaults();
    document.activeElement?.blur();
    showToast('Settings reset to defaults', 'info');
  });

  // Copy command from FAB
  $('fabCopyCmd')?.addEventListener('click', (e) => {
    e.preventDefault();
    const cmd = $('commandPreview').textContent;
    const singleLineCmd = cmd.replace(/\\\n\s+/g, ' ');
    navigator.clipboard.writeText(singleLineCmd).then(() => {
      showToast('Command copied to clipboard!', 'success');
    }).catch(() => {
      showToast('Failed to copy command', 'error');
    });
    document.activeElement?.blur();
  });

  // About dialog
  $('fabAbout')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.activeElement?.blur();
    $('aboutModal')?.showModal();
  });
}

// Dependency checker with install commands
const depInstallInfo = {
  'pandoc': {
    brew: 'brew install pandoc',
    apt: 'sudo apt install pandoc',
    url: 'https://pandoc.org/installing.html'
  },
  'tectonic': {
    brew: 'brew install tectonic',
    cargo: 'cargo install tectonic',
    url: 'https://tectonic-typesetting.github.io/'
  },
  'texlive': {
    brew: 'brew install --cask basictex',
    apt: 'sudo apt install texlive-latex-base texlive-fonts-recommended texlive-latex-extra',
    url: 'https://www.tug.org/texlive/',
    note: 'BasicTeX (~100MB). Use tlmgr to install additional packages if needed.'
  },
  'mermaid-filter': {
    npm: 'npm install -g mermaid-filter',
    url: 'https://github.com/raghur/mermaid-filter'
  },
  'pandoc-crossref': {
    brew: 'brew install pandoc-crossref',
    url: 'https://github.com/lierdakil/pandoc-crossref'
  }
};

async function checkDependencies() {
  const modal = $('depsModal');
  const results = $('depsResults');

  // Show modal with loading state
  results.innerHTML = `
    <div class="flex items-center justify-center py-4">
      <span class="loading loading-spinner loading-md"></span>
      <span class="ml-2">Checking dependencies...</span>
    </div>
  `;
  modal.showModal();

  const deps = [
    { name: 'pandoc', cmd: 'pandoc --version', required: true, desc: 'Document converter (required)' },
    { name: 'tectonic', cmd: 'tectonic --version', required: false, desc: 'PDF engine - auto-downloads packages (recommended)' },
    { name: 'texlive', cmd: 'pdflatex --version', required: false, desc: 'TeX Live - includes pdflatex, xelatex, lualatex' },
    { name: 'mermaid-filter', cmd: 'which mermaid-filter', required: false, desc: 'Mermaid diagram support' },
    { name: 'pandoc-crossref', cmd: 'pandoc-crossref --version', required: false, desc: 'Cross-reference filter' },
  ];

  const checkResults = [];

  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');

    for (const dep of deps) {
      try {
        const result = await invoke('check_command', { command: dep.cmd });
        const version = extractVersion(result, dep.name);
        checkResults.push({ ...dep, installed: true, version });
        installedDeps[dep.name] = true;
      } catch (err) {
        checkResults.push({ ...dep, installed: false, version: null });
        installedDeps[dep.name] = false;
      }
    }
  } else {
    // Web mode - assume all installed (can't check)
    checkResults.push(...deps.map(d => ({ ...d, installed: null, version: 'Cannot check in web mode' })));
    Object.keys(installedDeps).forEach(k => installedDeps[k] = true);
  }

  // Update UI based on installed deps
  updateFeatureAvailability();

  // Render results
  results.innerHTML = checkResults.map(dep => {
    const statusIcon = dep.installed === null
      ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
      : dep.installed
        ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ${dep.required ? 'text-error' : 'text-base-content/50'}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;

    const statusClass = dep.installed === null ? 'opacity-70' : (dep.installed ? '' : (dep.required ? 'text-error' : 'opacity-60'));

    // Build action buttons based on installation status
    let actionButtons = '';
    if (dep.installed === false && depInstallInfo[dep.name]) {
      // Install buttons for missing deps
      const info = depInstallInfo[dep.name];
      const buttons = [];

      if (info.brew) {
        buttons.push(`<button class="btn btn-xs btn-primary install-dep-btn" data-method="brew" data-dep="${dep.name}" title="Install via Homebrew">Homebrew</button>`);
      }
      if (info.apt) {
        buttons.push(`<button class="btn btn-xs btn-secondary install-dep-btn" data-method="apt" data-dep="${dep.name}" title="Install via apt">apt</button>`);
      }
      if (info.npm) {
        buttons.push(`<button class="btn btn-xs btn-accent install-dep-btn" data-method="npm" data-dep="${dep.name}" title="Install via npm">npm</button>`);
      }
      if (info.cargo) {
        buttons.push(`<button class="btn btn-xs btn-info install-dep-btn" data-method="cargo" data-dep="${dep.name}" title="Install via cargo">cargo</button>`);
      }
      if (info.url) {
        buttons.push(`<a href="${info.url}" target="_blank" class="btn btn-xs btn-ghost">Docs</a>`);
      }
      // Show note for texlive (special case - no auto-install)
      if (info.note) {
        actionButtons = `<div class="flex flex-col gap-1 mt-1">
          <span class="text-xs text-base-content/60">${info.note}</span>
          <div class="flex gap-1">${buttons.join('')}</div>
        </div>`;
      } else if (buttons.length > 0) {
        actionButtons = `<div class="flex gap-1 mt-1 flex-wrap">${buttons.join('')}</div>`;
      }
    } else if (dep.installed === true && dep.name !== 'pandoc') {
      // Reinstall and Uninstall buttons for installed optional deps
      const info = depInstallInfo[dep.name];
      const defaultMethod = info?.brew ? 'brew' : (info?.npm ? 'npm' : (info?.cargo ? 'cargo' : 'brew'));
      actionButtons = `<div class="flex gap-1 mt-1">
        <button class="btn btn-xs btn-ghost reinstall-dep-btn" data-dep="${dep.name}" data-method="${defaultMethod}" title="Reinstall ${dep.name}">Reinstall</button>
        <button class="btn btn-xs btn-ghost text-error uninstall-dep-btn" data-dep="${dep.name}" title="Uninstall ${dep.name}">Uninstall</button>
      </div>`;
    }

    return `
      <div class="flex items-start gap-3 p-2 rounded-lg bg-base-200 ${statusClass}" data-dep-row="${dep.name}">
        <div class="mt-0.5">${statusIcon}</div>
        <div class="flex-1">
          <div class="font-medium">${dep.name} ${dep.required ? '<span class="badge badge-xs badge-error">required</span>' : '<span class="badge badge-xs badge-ghost">optional</span>'}</div>
          <div class="text-xs text-base-content/70">${dep.desc}</div>
          ${dep.version ? `<div class="text-xs font-mono text-base-content/50">${dep.version}</div>` : ''}
          ${actionButtons}
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers for install buttons
  results.querySelectorAll('.install-dep-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const method = btn.dataset.method;
      const depName = btn.dataset.dep;

      if (isTauri) {
        await runDepOperation('install_dependency', { name: depName, method }, `Installing ${depName}`);
      } else {
        // Web mode - show info
        showToast(`Run: brew install ${depName} (or npm/cargo equivalent)`, 'info');
      }
    });
  });

  // Add click handlers for reinstall buttons
  results.querySelectorAll('.reinstall-dep-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const method = btn.dataset.method;
      const depName = btn.dataset.dep;

      if (isTauri) {
        // Use Tauri's dialog API for proper async confirmation
        const { ask } = await import('@tauri-apps/plugin-dialog');
        const confirmed = await ask(`Reinstall ${depName}? This will uninstall and reinstall the package.`, {
          title: 'Confirm Reinstall',
          kind: 'warning'
        });

        if (!confirmed) {
          return;
        }

        await runDepOperation('reinstall_dependency', { name: depName, method }, `Reinstalling ${depName}`);
      }
    });
  });

  // Add click handlers for uninstall buttons
  results.querySelectorAll('.uninstall-dep-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const depName = btn.dataset.dep;

      if (isTauri) {
        // Use Tauri's dialog API for proper async confirmation
        const { ask } = await import('@tauri-apps/plugin-dialog');
        const confirmed = await ask(`Are you sure you want to uninstall ${depName}?`, {
          title: 'Confirm Uninstall',
          kind: 'warning'
        });

        if (!confirmed) {
          return;
        }

        await runDepOperation('uninstall_dependency', { name: depName }, `Uninstalling ${depName}`);
      }
    });
  });
}

// Run a dependency operation with progress modal
async function runDepOperation(command, params, title) {
  const progressModal = $('progressModal');
  const progressTitle = $('progressTitle');
  const progressCommand = $('progressCommand');
  const progressOutput = $('progressOutput');
  const cancelBtn = $('progressCancelBtn');
  const closeBtn = $('progressCloseBtn');

  // Clean up any previous listener
  if (activeDepListener) {
    activeDepListener();
    activeDepListener = null;
  }

  // Reset modal
  progressTitle.textContent = title;
  progressCommand.textContent = '';
  progressOutput.textContent = 'Starting...\n';
  cancelBtn.classList.remove('hidden');
  closeBtn.classList.add('hidden');

  // Show modal FIRST before setting up listeners
  progressModal.showModal();

  // Setup event listener for output
  const { listen } = await import('@tauri-apps/api/event');
  const { invoke } = await import('@tauri-apps/api/core');

  activeDepListener = await listen('command-output', (event) => {
    const data = event.payload;

    if (data.type === 'start') {
      progressCommand.textContent = data.command;
      progressOutput.textContent = `> ${data.command}\n\n`;
    } else if (data.type === 'stdout' || data.type === 'stderr') {
      progressOutput.textContent += data.line + '\n';
      // Auto-scroll to bottom
      progressOutput.scrollTop = progressOutput.scrollHeight;
    } else if (data.type === 'end') {
      if (data.success) {
        progressOutput.textContent += `\n✓ ${data.message}\n`;
      } else {
        progressOutput.textContent += `\n✗ ${data.message}\n`;
      }
      // Show close button, hide cancel
      cancelBtn.classList.add('hidden');
      closeBtn.classList.remove('hidden');
    }
  });

  // Cancel button handler
  const handleCancel = async () => {
    try {
      await invoke('cancel_all_installs');
      progressOutput.textContent += '\n⚠ Operation cancelled\n';
      cancelBtn.classList.add('hidden');
      closeBtn.classList.remove('hidden');
    } catch (e) {
      progressOutput.textContent += `\nFailed to cancel: ${e}\n`;
    }
  };

  cancelBtn.onclick = handleCancel;

  // Close button handler
  closeBtn.onclick = () => {
    progressModal.close();
    if (activeDepListener) {
      activeDepListener();
      activeDepListener = null;
    }
    // Refresh dependency list
    checkDependencies();
  };

  // Run the command
  try {
    await invoke(command, params);
  } catch (e) {
    progressOutput.textContent += `\n✗ Error: ${e}\n`;
    cancelBtn.classList.add('hidden');
    closeBtn.classList.remove('hidden');
  }
}

// Extract version from command output
function extractVersion(output, name) {
  const lines = output.split('\n');
  // Try to find a line with version number
  for (const line of lines) {
    if (line.toLowerCase().includes('version') || line.match(/\d+\.\d+/)) {
      return line.trim().substring(0, 60);
    }
  }
  return lines[0]?.trim().substring(0, 60) || 'Installed';
}

// Update UI features based on installed dependencies
function updateFeatureAvailability() {
  const hasPdfEngine = installedDeps.tectonic || installedDeps.texlive;
  const hasMermaid = installedDeps['mermaid-filter'];
  const hasCrossref = installedDeps['pandoc-crossref'];

  // PDF engine section
  const pdfSection = $('pdfEngineSection');
  const pdfDropdown = pdfSection?.querySelector('.dropdown');
  if (pdfDropdown) {
    if (!hasPdfEngine) {
      pdfDropdown.classList.add('opacity-50', 'pointer-events-none');
      pdfDropdown.setAttribute('title', 'No PDF engine installed. Check Dependencies to install one.');
    } else {
      pdfDropdown.classList.remove('opacity-50', 'pointer-events-none');
      pdfDropdown.removeAttribute('title');

      // Disable individual PDF engine options that aren't installed
      const menuItems = pdfSection.querySelectorAll('ul li');
      menuItems.forEach(li => {
        const engineName = li.dataset.engine;
        if (!engineName) return;

        // Map engine names to installed deps
        let isInstalled = false;
        if (engineName === 'tectonic') {
          isInstalled = installedDeps.tectonic;
        } else if (['lualatex', 'xelatex', 'pdflatex'].includes(engineName)) {
          isInstalled = installedDeps.texlive;
        }

        if (!isInstalled) {
          li.classList.add('opacity-40');
          li.querySelector('a')?.classList.add('pointer-events-none');
          const label = li.querySelector('span');
          if (label && !label.dataset.originalText) {
            label.dataset.originalText = label.textContent;
            label.textContent += ' (not installed)';
          }
        } else {
          li.classList.remove('opacity-40');
          li.querySelector('a')?.classList.remove('pointer-events-none');
          const label = li.querySelector('span');
          if (label?.dataset.originalText) {
            label.textContent = label.dataset.originalText;
            delete label.dataset.originalText;
          }
        }
      });

      // Auto-select first available engine if current selection isn't installed
      const currentEngine = $('pdfEngine')?.value;
      const currentEngineInstalled =
        (currentEngine === 'tectonic' && installedDeps.tectonic) ||
        (['lualatex', 'xelatex', 'pdflatex'].includes(currentEngine) && installedDeps.texlive);

      if (!currentEngineInstalled) {
        // Find first available engine
        let firstAvailable = null;
        if (installedDeps.tectonic) firstAvailable = 'tectonic';
        else if (installedDeps.texlive) firstAvailable = 'pdflatex';

        if (firstAvailable) {
          const pdfEngineHidden = $('pdfEngine');
          const pdfEngineLabel = $('pdfEngineLabel');
          if (pdfEngineHidden && pdfEngineLabel) {
            pdfEngineHidden.value = firstAvailable;
            pdfEngineLabel.textContent = firstAvailable === 'tectonic' ? 'Tectonic' : 'pdfLaTeX';
          }
        }
      }
    }
  }

  // Mermaid section
  const mermaidRadios = document.querySelectorAll('input[name="mermaidFormat"]');
  const mermaidSection = mermaidRadios[0]?.closest('.flex.items-center');
  if (mermaidSection) {
    if (!hasMermaid) {
      mermaidSection.classList.add('opacity-50');
      mermaidRadios.forEach(r => r.disabled = true);
      mermaidSection.setAttribute('title', 'mermaid-filter not installed. Check Dependencies to install.');
    } else {
      mermaidSection.classList.remove('opacity-50');
      mermaidRadios.forEach(r => r.disabled = false);
      mermaidSection.removeAttribute('title');
    }
  }

  // Crossref checkbox
  const crossrefCheckbox = $('filterCrossref');
  const crossrefLabel = crossrefCheckbox?.closest('label');
  if (crossrefLabel) {
    if (!hasCrossref) {
      crossrefLabel.classList.add('opacity-50');
      crossrefCheckbox.disabled = true;
      crossrefCheckbox.checked = false;
      crossrefLabel.setAttribute('title', 'pandoc-crossref not installed. Check Dependencies to install.');
    } else {
      crossrefLabel.classList.remove('opacity-50');
      crossrefCheckbox.disabled = false;
      crossrefLabel.removeAttribute('title');
    }
  }
}

// Silently check dependencies on startup (no modal)
async function checkDependenciesSilent() {
  if (!isTauri) {
    // Web mode - assume all installed
    Object.keys(installedDeps).forEach(k => installedDeps[k] = true);
    return;
  }

  const deps = [
    { name: 'pandoc', cmd: 'pandoc --version' },
    { name: 'tectonic', cmd: 'tectonic --version' },
    { name: 'texlive', cmd: 'pdflatex --version' },  // Check for TeX Live via pdflatex
    { name: 'mermaid-filter', cmd: 'which mermaid-filter' },
    { name: 'pandoc-crossref', cmd: 'pandoc-crossref --version' },
  ];

  try {
    const { invoke } = await import('@tauri-apps/api/core');

    for (const dep of deps) {
      try {
        await invoke('check_command', { command: dep.cmd });
        installedDeps[dep.name] = true;
      } catch {
        installedDeps[dep.name] = false;
      }
    }
  } catch (e) {
    console.error('Failed to check dependencies:', e);
  }

  updateFeatureAvailability();
}

// Reset to defaults
function resetToDefaults() {
  // Layout
  $('paperSize').value = 'a4';
  $('orientation').value = 'portrait';
  $('fontSize').value = '12';
  $('lineHeight').value = '1.5';
  $('uniformMargins').checked = true;
  $('marginUnit').value = 'in';
  $('marginAll').value = '1';
  $('marginTop').value = '1';
  $('marginBottom').value = '1';
  $('marginLeft').value = '1';
  $('marginRight').value = '1';
  $('pdfEngine').value = 'tectonic';

  // Fonts
  $('mainFont').value = '';
  $('monoFont').value = '';
  $('highlightTheme').value = 'breezedark';
  $('lineNumbers').checked = false;
  $('codeBlockBg').checked = true;
  $('codeBlockBgColor').value = '#282a36';

  // Document
  $('titlePage').checked = false;
  $('toc').checked = false;
  $('numberSections').checked = false;
  $('lof').checked = false;
  $('lot').checked = false;
  $('standalone').checked = true;
  $('tocDepth').value = '3';
  $('tocNewPage').checked = false;
  $('documentClass').value = 'report';
  $('documentClassLabel').textContent = 'Report';
  $('topLevelDiv').value = 'default';
  if ($('darkMode')) $('darkMode').checked = false;

  // Content (use innerHTML for contenteditable fields)
  $('docTitle').innerHTML = '';
  $('docAuthor').innerHTML = '';
  $('docDate').innerHTML = '';
  $('headerLeft').innerHTML = '';
  $('headerCenter').innerHTML = '';
  $('headerRight').innerHTML = '';
  $('footerLeft').innerHTML = '';
  $('footerCenter').innerHTML = '';
  $('footerRight').innerHTML = '';
  $('pageNumberFormat').value = 'page';
  $('pageNumberPosition').value = 'bottom-center';
  $('pageNumberStyle').value = 'arabic';

  // Advanced
  $('filterCrossref').checked = false;
  $('filterCiteproc').checked = false;
  $('colorLinks').checked = true;
  $('linkColor').value = '#0066cc';
  $('extraArgs').value = '';
  $('openOnComplete').checked = true;

  // Trigger UI updates
  $('uniformMargins').dispatchEvent(new Event('change'));
  $('toc').dispatchEvent(new Event('change'));
  handleFormatChange();
  updateCodePreview();
  updateCommandPreview();
}

// PDF Engine custom dropdown
function setupPdfEngineDropdown() {
  const options = document.querySelectorAll('.pdf-engine-option');
  const label = $('pdfEngineLabel');
  const hiddenInput = $('pdfEngine');

  options.forEach(option => {
    option.addEventListener('click', (e) => {
      // Check if click was on the info-tip icon - if so, don't select
      if (e.target.closest('.info-tip')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const value = option.dataset.value;
      const text = option.querySelector('span:first-child').textContent;
      label.textContent = text;
      hiddenInput.value = value;
      updateCommandPreview();

      // Close dropdown
      document.activeElement?.blur();
    });
  });
}

// Setup custom FAB menu with accordion submenus
function setupFabMenu2() {
  const fabContainer = $('fabContainer');
  const fabToggle = $('fabToggle');
  const fabMenu = $('fabMenu');
  if (!fabContainer || !fabToggle || !fabMenu) return;

  const closeMenu = () => {
    fabContainer.classList.remove('open');
    fabMenu.querySelectorAll('.fab-accordion').forEach(acc => {
      acc.classList.remove('open');
    });
  };

  // Toggle main menu on button click
  fabToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (fabContainer.classList.contains('open')) {
      closeMenu();
    } else {
      fabContainer.classList.add('open');
    }
  });

  // Close menu when clicking outside (but not on select dropdown options)
  document.addEventListener('click', (e) => {
    // Don't close if clicking inside the fab container
    if (fabContainer.contains(e.target)) {
      return;
    }
    closeMenu();
  });

  // Prevent clicks inside the menu from bubbling up
  fabMenu.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Setup accordion triggers - only one open at a time
  const accordions = fabMenu.querySelectorAll('.fab-accordion');
  accordions.forEach(accordion => {
    const trigger = accordion.querySelector('.fab-accordion-trigger');
    if (!trigger) return;

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = accordion.classList.contains('open');
      // Close all other accordions first
      accordions.forEach(acc => acc.classList.remove('open'));
      // Toggle this one (if it was closed, open it)
      if (!isOpen) {
        accordion.classList.add('open');
      }
    });
  });

  // Close menu after clicking certain action items
  const closeActions = ['fabCheckDeps', 'fabResetDefaults', 'fabCopyCmd', 'fabAbout'];
  closeActions.forEach(id => {
    const el = $(id);
    if (el) {
      el.addEventListener('click', () => {
        setTimeout(closeMenu, 100);
      });
    }
  });

  // Theme items should close menu
  fabMenu.querySelectorAll('[data-set-theme]').forEach(link => {
    link.addEventListener('click', () => {
      setTimeout(closeMenu, 100);
    });
  });
}

// Initialize everything
async function init() {
  // Detect Tauri first
  await detectTauri();

  initTheme();
  await loadSystemFonts();
  setupFileHandling();
  setupMargins();
  setupCodePreview();
  setupTocHandling();
  setupTokenDrag();
  setupCopyCommand();
  setupConversion();
  setupInputListeners();
  setupPresets();
  setupFabMenu();
  setupPdfEngineDropdown();
  setupFabMenu2();

  // Listen for menu About event from Tauri
  if (isTauri) {
    const { listen } = await import('@tauri-apps/api/event');
    listen('show-about', () => {
      $('aboutModal')?.showModal();
    });
  }

  // Check dependencies silently to enable/disable features
  checkDependenciesSilent();

  // Initial format change to set up visibility
  handleFormatChange();

  // Initial command preview
  updateCommandPreview();
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
