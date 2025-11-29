// Pandoc GUI v2 - Main Application Logic

// State
let inputFilePath = null;
let inputFileName = null;
let inputFileContent = null;
let outputDirPath = null;
let isTauri = false;

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
let lastFocusedTokenInput = null;

function setupTokenDrag() {
  const tokenList = $('tokenList');
  if (!tokenList) {
    console.error('tokenList element not found');
    return;
  }

  // Get all text inputs that can accept tokens
  const dropTargetIds = [
    'docTitle', 'docAuthor', 'docDate',
    'headerLeft', 'headerCenter', 'headerRight',
    'footerLeft', 'footerCenter', 'footerRight',
    'outputName', 'extraArgs'
  ];

  // Track last focused input for token insertion
  dropTargetIds.forEach(id => {
    const input = $(id);
    if (!input) return;

    input.addEventListener('focus', () => {
      lastFocusedTokenInput = input;
      highlightTokensInInput(input);
    });

    input.addEventListener('input', () => {
      highlightTokensInInput(input);
    });
  });

  // Primary: Click on token to insert into last focused input
  const tokens = tokenList.querySelectorAll('[data-token]');
  console.log(`Setting up ${tokens.length} tokens for drag/drop`);

  tokens.forEach(token => {
    // Click handler - primary way to insert tokens
    token.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const tokenValue = token.dataset.token;

      // Find target input: last focused, or first available
      let targetInput = lastFocusedTokenInput;
      if (!targetInput || !dropTargetIds.includes(targetInput.id)) {
        targetInput = $('docTitle'); // Default to title field
      }

      if (targetInput) {
        const pos = targetInput.selectionStart ?? targetInput.value.length;
        targetInput.value = targetInput.value.slice(0, pos) + tokenValue + targetInput.value.slice(pos);
        targetInput.focus();
        const newPos = pos + tokenValue.length;
        targetInput.setSelectionRange(newPos, newPos);
        highlightTokensInInput(targetInput);
        updateCommandPreview();
        showToast(`Inserted ${tokenValue}`, 'success');
      }
    });

    // Also support drag and drop
    token.setAttribute('draggable', 'true');

    token.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', token.dataset.token);
      e.dataTransfer.effectAllowed = 'copy';
      token.style.opacity = '0.5';
    });

    token.addEventListener('dragend', () => {
      token.style.opacity = '1';
    });
  });

  // Setup drop targets for drag and drop
  dropTargetIds.forEach(id => {
    const input = $(id);
    if (!input) return;

    input.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      input.classList.add('ring', 'ring-primary', 'ring-2');
    });

    input.addEventListener('dragleave', () => {
      input.classList.remove('ring', 'ring-primary', 'ring-2');
    });

    input.addEventListener('drop', (e) => {
      e.preventDefault();
      input.classList.remove('ring', 'ring-primary', 'ring-2');

      const tokenValue = e.dataTransfer.getData('text/plain');
      if (tokenValue && tokenValue.startsWith('{') && tokenValue.endsWith('}')) {
        const pos = input.selectionStart ?? input.value.length;
        input.value = input.value.slice(0, pos) + tokenValue + input.value.slice(pos);
        input.focus();
        const newPos = pos + tokenValue.length;
        input.setSelectionRange(newPos, newPos);
        highlightTokensInInput(input);
        updateCommandPreview();
        showToast(`Inserted ${tokenValue}`, 'success');
      }
    });
  });
}

// Highlight tokens in input with visual indicator
function highlightTokensInInput(input) {
  const hasTokens = /\{[^}]+\}/.test(input.value);
  input.classList.toggle('has-tokens', hasTokens);
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

    // Link colors
    if ($('colorLinks').checked) {
      args.push('-V colorlinks=true');
      const color = $('linkColor').value.replace('#', '');
      args.push(`-V 'linkcolor=[HTML]{${color}}'`);
      args.push(`-V 'urlcolor=[HTML]{${color}}'`);
    }

    // Headers and Footers using fancyhdr
    const headerLeft = replaceHeaderFooterTokens($('headerLeft').value);
    const headerCenter = replaceHeaderFooterTokens($('headerCenter').value);
    const headerRight = replaceHeaderFooterTokens($('headerRight').value);
    const footerLeft = replaceHeaderFooterTokens($('footerLeft').value);
    const footerCenter = replaceHeaderFooterTokens($('footerCenter').value);
    const footerRight = replaceHeaderFooterTokens($('footerRight').value);

    const hasHeaders = headerLeft || headerCenter || headerRight;
    const hasFooters = footerLeft || footerCenter || footerRight;

    if (hasHeaders || hasFooters) {
      // Enable fancyhdr
      args.push('-V pagestyle=fancy');

      // Build header-includes for fancyhdr
      let headerIncludes = '\\usepackage{fancyhdr}\\pagestyle{fancy}';
      headerIncludes += '\\fancyhf{}'; // Clear defaults

      if (headerLeft) headerIncludes += `\\fancyhead[L]{${headerLeft}}`;
      if (headerCenter) headerIncludes += `\\fancyhead[C]{${headerCenter}}`;
      if (headerRight) headerIncludes += `\\fancyhead[R]{${headerRight}}`;
      if (footerLeft) headerIncludes += `\\fancyfoot[L]{${footerLeft}}`;
      if (footerCenter) headerIncludes += `\\fancyfoot[C]{${footerCenter}}`;
      if (footerRight) headerIncludes += `\\fancyfoot[R]{${footerRight}}`;

      args.push(`-V header-includes="${headerIncludes}"`);
    } else {
      // Default page numbering based on settings
      const pageFormat = $('pageNumberFormat').value;
      const pagePosition = $('pageNumberPosition').value;
      const pageStyle = $('pageNumberStyle').value;

      let pageCmd = '';
      if (pageStyle === 'roman') {
        pageCmd += '\\pagenumbering{roman}';
      } else if (pageStyle === 'Roman') {
        pageCmd += '\\pagenumbering{Roman}';
      }

      if (pageFormat === 'page-of') {
        // Use lastpage package for "N of X" format
        pageCmd += '\\usepackage{lastpage}\\usepackage{fancyhdr}\\pagestyle{fancy}\\fancyhf{}';
        if (pagePosition === 'bottom-center') {
          pageCmd += '\\fancyfoot[C]{\\thepage\\ of \\pageref{LastPage}}';
        } else if (pagePosition === 'bottom-right') {
          pageCmd += '\\fancyfoot[R]{\\thepage\\ of \\pageref{LastPage}}';
        } else {
          pageCmd += '\\fancyhead[R]{\\thepage\\ of \\pageref{LastPage}}';
        }
      } else if (pageFormat === 'page') {
        pageCmd += '\\usepackage{fancyhdr}\\pagestyle{fancy}\\fancyhf{}';
        if (pagePosition === 'bottom-center') {
          pageCmd += '\\fancyfoot[C]{Page \\thepage}';
        } else if (pagePosition === 'bottom-right') {
          pageCmd += '\\fancyfoot[R]{Page \\thepage}';
        } else {
          pageCmd += '\\fancyhead[R]{Page \\thepage}';
        }
      }

      if (pageCmd) {
        args.push(`-V header-includes="${pageCmd}"`);
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

  // Code highlighting (use modern --syntax-highlighting instead of deprecated --highlight-style)
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

  // Metadata with token replacement
  const title = replaceMetadataTokens($('docTitle').value);
  const author = replaceMetadataTokens($('docAuthor').value);
  const date = replaceMetadataTokens($('docDate').value);

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

    $('statusArea').classList.remove('hidden');
    $('statusText').textContent = 'Converting...';
    $('progressBar').removeAttribute('value'); // Indeterminate
    $('convertBtn').disabled = true;

    try {
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core');
        const command = buildPandocCommand().replace(/\\\n\s+/g, ' ');
        await invoke('run_pandoc', { command });

        $('statusText').textContent = 'Conversion complete!';
        $('progressBar').value = 100;
        showToast('Document converted successfully!', 'success');

        // Open file if checkbox is checked
        if ($('openOnComplete').checked) {
          const outName = $('outputName').value || 'output';
          const ext = getExtensionForFormat($('outputFormat').value);
          const finalPath = (outputDirPath || './') + outName + '.' + ext;
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
      settings[id] = el.type === 'checkbox' ? el.checked : el.value;
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
  'lualatex': {
    brew: 'brew install --cask mactex',
    apt: 'sudo apt install texlive-full',
    url: 'https://www.tug.org/texlive/'
  },
  'xelatex': {
    brew: 'brew install --cask mactex',
    apt: 'sudo apt install texlive-xetex',
    url: 'https://www.tug.org/texlive/'
  },
  'pdflatex': {
    brew: 'brew install --cask mactex',
    apt: 'sudo apt install texlive',
    url: 'https://www.tug.org/texlive/'
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
    { name: 'tectonic', cmd: 'tectonic --version', required: false, desc: 'PDF engine - auto-downloads packages' },
    { name: 'lualatex', cmd: 'lualatex --version', required: false, desc: 'PDF engine - best Unicode support' },
    { name: 'xelatex', cmd: 'xelatex --version', required: false, desc: 'PDF engine - uses system fonts' },
    { name: 'pdflatex', cmd: 'pdflatex --version', required: false, desc: 'PDF engine - fastest, limited Unicode' },
    { name: 'mermaid-filter', cmd: 'mermaid-filter --version', required: false, desc: 'Mermaid diagram support' },
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
      } catch (err) {
        checkResults.push({ ...dep, installed: false, version: null });
      }
    }
  } else {
    // Web mode - can't check
    checkResults.push(...deps.map(d => ({ ...d, installed: null, version: 'Cannot check in web mode' })));
  }

  // Render results
  results.innerHTML = checkResults.map(dep => {
    const statusIcon = dep.installed === null
      ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
      : dep.installed
        ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ${dep.required ? 'text-error' : 'text-base-content/50'}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;

    const statusClass = dep.installed === null ? 'opacity-70' : (dep.installed ? '' : (dep.required ? 'text-error' : 'opacity-60'));

    // Build install buttons for missing deps
    let installButtons = '';
    if (dep.installed === false && depInstallInfo[dep.name]) {
      const info = depInstallInfo[dep.name];
      const buttons = [];

      if (info.brew) {
        buttons.push(`<button class="btn btn-xs btn-primary install-dep-btn" data-cmd="${info.brew}" title="${info.brew}">Homebrew</button>`);
      }
      if (info.apt) {
        buttons.push(`<button class="btn btn-xs btn-secondary install-dep-btn" data-cmd="${info.apt}" title="${info.apt}">apt</button>`);
      }
      if (info.npm) {
        buttons.push(`<button class="btn btn-xs btn-accent install-dep-btn" data-cmd="${info.npm}" title="${info.npm}">npm</button>`);
      }
      if (info.cargo) {
        buttons.push(`<button class="btn btn-xs btn-info install-dep-btn" data-cmd="${info.cargo}" title="${info.cargo}">cargo</button>`);
      }
      if (info.url) {
        buttons.push(`<a href="${info.url}" target="_blank" class="btn btn-xs btn-ghost">Docs</a>`);
      }

      if (buttons.length > 0) {
        installButtons = `<div class="flex gap-1 mt-1 flex-wrap">${buttons.join('')}</div>`;
      }
    }

    return `
      <div class="flex items-start gap-3 p-2 rounded-lg bg-base-200 ${statusClass}">
        <div class="mt-0.5">${statusIcon}</div>
        <div class="flex-1">
          <div class="font-medium">${dep.name} ${dep.required ? '<span class="badge badge-xs badge-error">required</span>' : '<span class="badge badge-xs badge-ghost">optional</span>'}</div>
          <div class="text-xs text-base-content/70">${dep.desc}</div>
          ${dep.version ? `<div class="text-xs font-mono text-base-content/50">${dep.version}</div>` : ''}
          ${installButtons}
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers for install buttons
  results.querySelectorAll('.install-dep-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cmd = btn.dataset.cmd;
      try {
        await navigator.clipboard.writeText(cmd);
        showToast(`Command copied: ${cmd}`, 'success');
      } catch (e) {
        showToast('Failed to copy command', 'error');
      }
    });
  });
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
  $('documentClass').value = 'article';
  $('topLevelDiv').value = 'default';

  // Content
  $('docTitle').value = '';
  $('docAuthor').value = '';
  $('docDate').value = '';
  $('headerLeft').value = '';
  $('headerCenter').value = '';
  $('headerRight').value = '';
  $('footerLeft').value = '';
  $('footerCenter').value = '';
  $('footerRight').value = '';
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

// Setup FAB submenu mutual exclusion - only one open at a time
function setupFabSubmenus() {
  const fabDetails = document.querySelectorAll('.dropdown-content details');
  fabDetails.forEach(detail => {
    detail.addEventListener('toggle', () => {
      if (detail.open) {
        // Close other details
        fabDetails.forEach(other => {
          if (other !== detail && other.open) {
            other.open = false;
          }
        });
      }
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
  setupFabSubmenus();

  // Initial format change to set up visibility
  handleFormatChange();

  // Initial command preview
  updateCommandPreview();
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
