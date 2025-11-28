// Pandoc GUI v2 - Main Application Logic

// State
let inputFilePath = null;
let inputFileName = null;
let inputFileContent = null;

// Common fonts that are typically available on most systems
const commonFonts = [
  'Arial', 'Arial Black', 'Book Antiqua', 'Bookman Old Style', 'Century Gothic',
  'Comic Sans MS', 'Courier New', 'Garamond', 'Georgia', 'Helvetica', 'Impact',
  'Lucida Console', 'Lucida Sans Unicode', 'Microsoft Sans Serif', 'Palatino Linotype',
  'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana',
  // macOS
  'American Typewriter', 'Avenir', 'Baskerville', 'Big Caslon', 'Bodoni 72',
  'Chalkboard', 'Charter', 'Cochin', 'Copperplate', 'Didot', 'Futura',
  'Geneva', 'Gill Sans', 'Helvetica Neue', 'Hoefler Text', 'Lucida Grande',
  'Marker Felt', 'Menlo', 'Monaco', 'Optima', 'Papyrus', 'Phosphate',
  'Rockwell', 'San Francisco', 'Skia', 'Snell Roundhand', 'STIXGeneral',
  'Superclarendon', 'Times', 'Zapfino',
  // Linux
  'DejaVu Sans', 'DejaVu Serif', 'Liberation Sans', 'Liberation Serif',
  'Noto Sans', 'Noto Serif', 'Ubuntu', 'Cantarell', 'Droid Sans', 'Droid Serif'
];

const monoFonts = [
  'Courier New', 'Menlo', 'Monaco', 'Consolas', 'SF Mono', 'Fira Code',
  'JetBrains Mono', 'Source Code Pro', 'IBM Plex Mono', 'Inconsolata',
  'Roboto Mono', 'Ubuntu Mono', 'Hack', 'Anonymous Pro', 'Cascadia Code',
  'DejaVu Sans Mono', 'Liberation Mono', 'Droid Sans Mono', 'PT Mono',
  'Noto Sans Mono', 'Input Mono', 'Iosevka', 'Victor Mono'
];

// Code theme colors for preview (kw=keyword, fn=function, st=string, cm=comment)
const themeColors = {
  'pygments': { bg: '#f8f8f8', kw: '#008000', fn: '#0000ff', st: '#ba2121', cm: '#408080' },
  'kate': { bg: '#ffffff', kw: '#1f1c1b', fn: '#644a9b', st: '#bf0303', cm: '#898887' },
  'tango': { bg: '#f8f8f8', kw: '#204a87', fn: '#000000', st: '#4e9a06', cm: '#8f5902' },
  'espresso': { bg: '#2a211c', kw: '#43a8ed', fn: '#ff9d00', st: '#049b0a', cm: '#7c7c7c' },
  'breezedark': { bg: '#232629', kw: '#cfcfc2', fn: '#8e44ad', st: '#f44f4f', cm: '#7a7c7d' },
  'zenburn': { bg: '#3f3f3f', kw: '#f0dfaf', fn: '#efef8f', st: '#cc9393', cm: '#7f9f7f' },
  'nord': { bg: '#2e3440', kw: '#81a1c1', fn: '#88c0d0', st: '#a3be8c', cm: '#616e88' },
  'dracula': { bg: '#282a36', kw: '#ff79c6', fn: '#50fa7b', st: '#f1fa8c', cm: '#6272a4' },
  'monokai': { bg: '#272822', kw: '#f92672', fn: '#a6e22e', st: '#e6db74', cm: '#75715e' },
  'gruvbox-dark': { bg: '#282828', kw: '#fb4934', fn: '#b8bb26', st: '#fabd2f', cm: '#928374' },
  'solarized-dark': { bg: '#002b36', kw: '#859900', fn: '#268bd2', st: '#2aa198', cm: '#586e75' },
};

// DOM Elements
const $ = id => document.getElementById(id);

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  $('themeToggle').checked = savedTheme === 'light';
}

function toggleTheme() {
  const newTheme = $('themeToggle').checked ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateCodePreview();
  updateCommandPreview();
}

// Dependency Checker
async function checkDependencies() {
  const missing = [];

  // Check for pandoc
  if (window.__TAURI__) {
    const { invoke } = window.__TAURI__;
    try {
      await invoke('check_command', { cmd: 'pandoc' });
    } catch (e) {
      missing.push({
        name: 'pandoc',
        install: 'brew install pandoc (macOS) or apt install pandoc (Linux)',
        url: 'https://pandoc.org/installing.html'
      });
    }

    // Check for tectonic (PDF engine)
    try {
      await invoke('check_command', { cmd: 'tectonic' });
    } catch (e) {
      missing.push({
        name: 'tectonic',
        install: 'brew install tectonic (macOS) or cargo install tectonic (Linux)',
        url: 'https://tectonic-typesetting.github.io/en-US/'
      });
    }
  } else {
    // In web mode, show info message about dependencies
    console.info('Dependencies must be installed on the system before using conversion:');
    console.info('- pandoc: https://pandoc.org/installing.html');
    console.info('- tectonic (for PDF): https://tectonic-typesetting.github.io/');
  }

  if (missing.length > 0 && window.__TAURI__) {
    const msg = missing.map(dep =>
      `${dep.name}: ${dep.install}`
    ).join('\n\n');

    showToast(
      `Missing dependencies:\n\n${msg}\n\nVisit the links in console for installation instructions.`,
      'warning'
    );
  }
}

// System Fonts - populate all common fonts (pandoc/LaTeX will use what's available)
function loadSystemFonts() {
  const mainFontSelect = $('mainFont');
  const monoFontSelect = $('monoFont');

  // Just add all fonts - pandoc will use what's installed on the system
  commonFonts.sort().forEach(font => {
    const opt = document.createElement('option');
    opt.value = font;
    opt.textContent = font;
    mainFontSelect.appendChild(opt);
  });

  monoFonts.sort().forEach(font => {
    const opt = document.createElement('option');
    opt.value = font;
    opt.textContent = font;
    monoFontSelect.appendChild(opt);
  });
}

// File Handling
function setupFileHandling() {
  $('browseInput').addEventListener('click', () => $('inputFile').click());

  $('inputFile').addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
      await handleFileSelect(e.target.files[0]);
    }
  });

  $('browseOutput').addEventListener('click', () => {
    // In Tauri, this would open a save dialog
    if (window.__TAURI__) {
      // Tauri save dialog
    }
  });

  $('outputPath').addEventListener('input', updateCommandPreview);
}

async function handleFileSelect(file) {
  inputFileName = file.name;
  inputFilePath = file.path || file.name;

  $('inputPath').value = inputFilePath;

  // Auto-set output path (same location, same name)
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const dir = inputFilePath.substring(0, inputFilePath.lastIndexOf('/') + 1);
  $('outputPath').value = dir + baseName;

  // Read file content for mermaid detection
  try {
    inputFileContent = await file.text();
    detectMermaid(inputFileContent);
  } catch (e) {
    inputFileContent = null;
  }

  $('convertBtn').disabled = false;
  updateCommandPreview();
}

function detectMermaid(content) {
  const hasMermaid = /```mermaid/i.test(content);
  $('mermaidDetected').classList.toggle('hidden', !hasMermaid);
}

// Margin handling
function setupMargins() {
  $('uniformMargins').addEventListener('change', () => {
    const uniform = $('uniformMargins').checked;
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
}

// Code Preview
function updateCodePreview() {
  const theme = $('highlightTheme').value;
  const colors = themeColors[theme] || themeColors['breezedark'];
  const preview = $('codePreview');
  const bgColor = $('codeBlockBg').checked ? ($('codeBlockBgColor').value || colors.bg) : 'transparent';

  preview.style.backgroundColor = bgColor;
  preview.querySelectorAll('.kw').forEach(el => el.style.color = colors.kw);
  preview.querySelectorAll('.fn').forEach(el => el.style.color = colors.fn);
  preview.querySelectorAll('.st').forEach(el => el.style.color = colors.st);
  preview.querySelectorAll('.cm').forEach(el => {
    el.style.color = colors.cm;
    el.style.fontStyle = 'italic';
  });

  const isLightTheme = ['pygments', 'kate', 'tango'].includes(theme);
  preview.style.color = isLightTheme ? '#333' : '#ddd';

  if (!$('codeBlockBgColor').dataset.userSet) {
    $('codeBlockBgColor').value = colors.bg;
  }
}

function setupCodePreview() {
  $('highlightTheme').addEventListener('change', () => {
    $('codeBlockBgColor').dataset.userSet = '';
    updateCodePreview();
    updateCommandPreview();
  });

  $('codeBlockBg').addEventListener('change', () => {
    $('bgColorPicker').classList.toggle('hidden', !$('codeBlockBg').checked);
    updateCodePreview();
  });

  $('codeBlockBgColor').addEventListener('input', () => {
    $('codeBlockBgColor').dataset.userSet = 'true';
    updateCodePreview();
  });

  updateCodePreview();
}

// Output Format Handling
function setupFormatHandling() {
  $('outputFormat').addEventListener('change', () => {
    const format = $('outputFormat').value;
    const isPdf = format === 'pdf';
    const needsStandalone = ['html', 'latex'].includes(format);

    $('pdfEngineSection').classList.toggle('hidden', !isPdf);
    $('docClassSection').classList.toggle('hidden', !isPdf);
    $('standaloneLabel').classList.toggle('hidden', !needsStandalone);

    // Update output path extension
    const outputPath = $('outputPath').value;
    if (outputPath) {
      const basePath = outputPath.replace(/\.[^/.]+$/, '');
      $('outputPath').value = basePath + '.' + getExtensionForFormat(format);
    }

    updateCommandPreview();
  });
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

// Replace metadata tokens
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
    .replace(/\{user\}/g, 'User'); // In Tauri, we'd get the actual username
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
  const outputPath = $('outputPath').value || 'output';
  const ext = getExtensionForFormat(format);
  const finalOutput = outputPath.endsWith('.' + ext) ? outputPath : outputPath + '.' + ext;
  args.push(`-o "${finalOutput}"`);

  // Standalone (only for HTML/LaTeX, always true for PDF)
  const isPdf = format === 'pdf';
  if (isPdf || $('standalone').checked) {
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

    // Title page
    if ($('titlePage').checked) {
      args.push('-V titlepage=true');
    }

    // Header/Footer tokens
    const replaceHeaderTokens = (str) => {
      if (!str) return str;
      return str
        .replace(/\{title\}/g, '\\\\@title')
        .replace(/\{author\}/g, '\\\\@author')
        .replace(/\{date\}/g, '\\\\@date')
        .replace(/\{page\}/g, '\\\\thepage')
        .replace(/\{pages\}/g, '\\\\pageref{LastPage}')
        .replace(/\{chapter\}/g, '\\\\leftmark')
        .replace(/\{section\}/g, '\\\\rightmark')
        .replace(/\{file\}/g, inputFileName || 'document');
    };

    const headerL = replaceHeaderTokens($('headerLeft').value);
    const headerC = replaceHeaderTokens($('headerCenter').value);
    const headerR = replaceHeaderTokens($('headerRight').value);
    const footerL = replaceHeaderTokens($('footerLeft').value);
    const footerC = replaceHeaderTokens($('footerCenter').value);
    const footerR = replaceHeaderTokens($('footerRight').value);

    const hasHeader = headerL || headerC || headerR;
    const hasFooter = footerL || footerC || footerR;
    const needsLastPage = [headerL, headerC, headerR, footerL, footerC, footerR].some(s => s && s.includes('LastPage'));

    if (hasHeader || hasFooter) {
      let includes = '\\\\usepackage{fancyhdr}\\\\pagestyle{fancy}\\\\fancyhf{}';
      if (needsLastPage) includes += '\\\\usepackage{lastpage}';
      args.push(`-V header-includes="${includes}"`);
      if (headerL) args.push(`-V header-includes="\\\\lhead{${headerL}}"`);
      if (headerC) args.push(`-V header-includes="\\\\chead{${headerC}}"`);
      if (headerR) args.push(`-V header-includes="\\\\rhead{${headerR}}"`);
      if (footerL) args.push(`-V header-includes="\\\\lfoot{${footerL}}"`);
      if (footerC) args.push(`-V header-includes="\\\\cfoot{${footerC}}"`);
      if (footerR) args.push(`-V header-includes="\\\\rfoot{${footerR}}"`);
    }

    // Page numbering
    const pagePos = $('pageNumberPosition').value;
    const pageFormat = $('pageNumberFormat').value;
    if (pagePos === 'none') {
      args.push('-V pagestyle=empty');
    } else if (!hasHeader && !hasFooter) {
      let pageNum;
      switch (pageFormat) {
        case 'page-of':
          pageNum = 'Page \\\\thepage\\\\ of \\\\pageref{LastPage}';
          args.push('-V header-includes="\\\\usepackage{lastpage}"');
          break;
        case 'number-of':
          pageNum = '\\\\thepage\\\\ / \\\\pageref{LastPage}';
          args.push('-V header-includes="\\\\usepackage{lastpage}"');
          break;
        case 'number':
          pageNum = '\\\\thepage';
          break;
        default:
          pageNum = 'Page \\\\thepage';
      }

      if (pagePos !== 'bottom-center') {
        args.push('-V header-includes="\\\\usepackage{fancyhdr}\\\\pagestyle{fancy}\\\\fancyhf{}"');
        if (pagePos === 'bottom-right') {
          args.push(`-V header-includes="\\\\rfoot{${pageNum}}"`);
        } else if (pagePos === 'top-right') {
          args.push(`-V header-includes="\\\\rhead{${pageNum}}"`);
        }
      }
    }

    // Link colors
    if ($('colorLinks').checked) {
      args.push('-V colorlinks=true');
      const color = $('linkColor').value.replace('#', '');
      // Quote the [HTML] to prevent zsh glob interpretation
      args.push(`-V 'linkcolor=[HTML]{${color}}'`);
      args.push(`-V 'urlcolor=[HTML]{${color}}'`);
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

  // Code highlighting
  args.push(`--syntax-highlighting=${$('highlightTheme').value}`);

  // TOC
  if ($('toc').checked) {
    args.push('--toc');
    args.push(`--toc-depth=${$('tocDepth').value}`);

    // New page after TOC
    if ($('tocNewPage') && $('tocNewPage').checked && isPdf) {
      args.push('-V toc-own-page=true');
    }
  }

  // List of Figures / Tables
  if ($('lof') && $('lof').checked) {
    args.push('-V lof=true');
  }
  if ($('lot') && $('lot').checked) {
    args.push('-V lot=true');
  }

  // Top-level division
  const topLevelDiv = $('topLevelDiv');
  if (topLevelDiv && topLevelDiv.value !== 'default') {
    args.push(`--top-level-division=${topLevelDiv.value}`);
  }

  // Number sections
  if ($('numberSections').checked) {
    args.push('-N');
  }

  // Metadata with token replacement
  const title = replaceMetadataTokens($('docTitle').value);
  const author = replaceMetadataTokens($('docAuthor').value);
  const date = replaceMetadataTokens($('docDate').value);

  if (title) args.push(`-M title="${title}"`);
  if (author) args.push(`-M author="${author}"`);
  if (date) args.push(`-M date="${date}"`);

  // Mermaid filter (auto-enabled if detected)
  const hasMermaid = !$('mermaidDetected').classList.contains('hidden');
  if (hasMermaid) {
    const mermaidFormat = document.querySelector('input[name="mermaidFormat"]:checked').value;
    args.push('-F mermaid-filter');
    if (mermaidFormat === 'svg') {
      args.push('-M mermaid-format=svg');
    }
  }

  // Other filters
  if ($('filterCrossref').checked) {
    args.push('-F pandoc-crossref');
  }
  if ($('filterCiteproc').checked) {
    args.push('--citeproc');
  }

  // Extra arguments
  if ($('extraArgs').value.trim()) {
    args.push($('extraArgs').value.trim());
  }

  return args.join(' \\\n  ');
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
    try {
      await navigator.clipboard.writeText(cmd.replace(/\\\n\s+/g, ' '));
      showToast('Copied!', 'success');
    } catch (err) {
      showToast('Failed to copy', 'error');
    }
  });
}

// Toast Notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `alert alert-${type} py-2 px-3 text-sm`;
  toast.innerHTML = `<span>${message}</span>`;
  $('toastContainer').appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// Conversion
function setupConversion() {
  $('convertBtn').addEventListener('click', async () => {
    if (!inputFilePath) {
      showToast('Select an input file', 'warning');
      return;
    }

    $('statusArea').classList.remove('hidden');
    $('statusText').textContent = 'Converting...';
    $('convertBtn').disabled = true;

    try {
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.core;
        const command = buildPandocCommand().replace(/\\\n\s+/g, ' ');
        await invoke('run_pandoc', { command });
        $('statusText').textContent = 'Done!';
        showToast('Converted successfully!', 'success');

        // Open on complete
        if ($('openOnComplete').checked) {
          const outputPath = $('outputPath').value;
          const ext = getExtensionForFormat($('outputFormat').value);
          const finalPath = outputPath.endsWith('.' + ext) ? outputPath : outputPath + '.' + ext;
          await invoke('open_file', { path: finalPath });
        }
      } else {
        setTimeout(() => {
          $('statusText').textContent = 'Web mode: copy command to run';
          showToast('Copy command to run in terminal', 'info');
        }, 500);
      }
    } catch (err) {
      $('statusText').textContent = `Error: ${err}`;
      showToast('Conversion failed', 'error');
    } finally {
      $('convertBtn').disabled = !inputFilePath;
    }
  });
}

// Event listeners for all inputs
function setupInputListeners() {
  document.querySelectorAll('input, select').forEach(input => {
    if (!['inputFile', 'themeToggle', 'presetSelect'].includes(input.id)) {
      input.addEventListener('change', updateCommandPreview);
      input.addEventListener('input', updateCommandPreview);
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

function savePresets(presets) {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
}

function getSettingsIds() {
  // All the form elements we want to save/restore
  return [
    'outputFormat', 'outputTheme', 'pdfEngine', 'titlePage', 'toc', 'lof', 'lot',
    'numberSections', 'standalone', 'tocDepth', 'tocNewPage', 'topLevelDiv',
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

function getCurrentSettings() {
  const settings = {};
  getSettingsIds().forEach(id => {
    const el = $(id);
    if (el) {
      if (el.type === 'checkbox') {
        settings[id] = el.checked;
      } else {
        settings[id] = el.value;
      }
    }
  });
  // Also save mermaid format
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
  $('codeBlockBg').dispatchEvent(new Event('change'));
  $('outputFormat').dispatchEvent(new Event('change'));
  updateCodePreview();
  updateCommandPreview();
}

function updatePresetDropdown() {
  const select = $('presetSelect');
  const presets = getPresets();
  // Clear existing options except first
  while (select.options.length > 1) select.remove(1);
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
    const name = prompt('Enter preset name:');
    if (!name) return;
    const presets = getPresets();
    presets[name] = getCurrentSettings();
    savePresets(presets);
    updatePresetDropdown();
    $('presetSelect').value = name;
    showToast(`Preset "${name}" saved`, 'success');
  });

  $('loadPreset').addEventListener('click', () => {
    const name = $('presetSelect').value;
    if (!name) {
      showToast('Select a preset first', 'warning');
      return;
    }
    const presets = getPresets();
    if (presets[name]) {
      applySettings(presets[name]);
      showToast(`Preset "${name}" loaded`, 'success');
    }
  });

  $('deletePreset').addEventListener('click', () => {
    const name = $('presetSelect').value;
    if (!name) {
      showToast('Select a preset first', 'warning');
      return;
    }
    if (!confirm(`Delete preset "${name}"?`)) return;
    const presets = getPresets();
    delete presets[name];
    savePresets(presets);
    updatePresetDropdown();
    showToast(`Preset "${name}" deleted`, 'info');
  });

  // Double-click to load
  $('presetSelect').addEventListener('dblclick', () => {
    $('loadPreset').click();
  });
}

// Initialize
function init() {
  initTheme();
  loadSystemFonts();
  setupFileHandling();
  setupMargins();
  setupCodePreview();
  setupFormatHandling();
  setupTocHandling();
  setupCopyCommand();
  setupConversion();
  setupInputListeners();
  setupPresets();

  $('themeToggle').addEventListener('change', toggleTheme);

  updateCommandPreview();

  // Check dependencies on startup
  checkDependencies();
}

document.addEventListener('DOMContentLoaded', init);
