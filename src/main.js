// Pandoc GUI v2 - Main Application Logic

// State
let inputFilePath = null;
let inputFileName = null;

// DOM Elements
const elements = {
  themeToggle: document.getElementById('themeToggle'),
  dropZone: document.getElementById('dropZone'),
  inputFile: document.getElementById('inputFile'),
  inputFileInfo: document.getElementById('inputFileInfo'),
  inputFileName: document.getElementById('inputFileName'),
  clearInput: document.getElementById('clearInput'),
  outputFormat: document.getElementById('outputFormat'),
  outputFilename: document.getElementById('outputFilename'),
  convertBtn: document.getElementById('convertBtn'),
  statusArea: document.getElementById('statusArea'),
  progressBar: document.getElementById('progressBar'),
  statusText: document.getElementById('statusText'),
  commandPreview: document.getElementById('commandPreview'),
  copyCmd: document.getElementById('copyCmd'),
  pdfEngineSection: document.getElementById('pdfEngineSection'),
  pdfEngine: document.getElementById('pdfEngine'),
  paperSize: document.getElementById('paperSize'),
  orientation: document.getElementById('orientation'),
  marginTop: document.getElementById('marginTop'),
  marginBottom: document.getElementById('marginBottom'),
  marginLeft: document.getElementById('marginLeft'),
  marginRight: document.getElementById('marginRight'),
  mainFont: document.getElementById('mainFont'),
  fontSize: document.getElementById('fontSize'),
  monoFont: document.getElementById('monoFont'),
  lineHeight: document.getElementById('lineHeight'),
  highlightTheme: document.getElementById('highlightTheme'),
  lineNumbers: document.getElementById('lineNumbers'),
  codeBlockBg: document.getElementById('codeBlockBg'),
  toc: document.getElementById('toc'),
  tocDepthSection: document.getElementById('tocDepthSection'),
  tocDepth: document.getElementById('tocDepth'),
  numberSections: document.getElementById('numberSections'),
  standalone: document.getElementById('standalone'),
  docTitle: document.getElementById('docTitle'),
  docAuthor: document.getElementById('docAuthor'),
  docDate: document.getElementById('docDate'),
  filterMermaid: document.getElementById('filterMermaid'),
  filterCrossref: document.getElementById('filterCrossref'),
  filterCiteproc: document.getElementById('filterCiteproc'),
  customVars: document.getElementById('customVars'),
  extraArgs: document.getElementById('extraArgs'),
  inputFormat: document.getElementById('inputFormat'),
  documentClass: document.getElementById('documentClass'),
  colorLinks: document.getElementById('colorLinks'),
  linkColor: document.getElementById('linkColor'),
  pdfAdvanced: document.getElementById('pdfAdvanced'),
  toastContainer: document.getElementById('toastContainer'),
};

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  elements.themeToggle.checked = savedTheme === 'light';
}

function toggleTheme() {
  const newTheme = elements.themeToggle.checked ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);

  // Sync highlight theme with UI theme
  if (newTheme === 'light' && elements.highlightTheme.value.includes('dark')) {
    elements.highlightTheme.value = 'pygments';
  } else if (newTheme === 'dark' && !elements.highlightTheme.value.includes('dark') &&
             elements.highlightTheme.value !== 'zenburn' && elements.highlightTheme.value !== 'nord') {
    elements.highlightTheme.value = 'breezedark';
  }
  updateCommandPreview();
}

// File Handling
function setupFileHandling() {
  elements.dropZone.addEventListener('click', () => elements.inputFile.click());

  elements.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.dropZone.classList.add('drag-over');
  });

  elements.dropZone.addEventListener('dragleave', () => {
    elements.dropZone.classList.remove('drag-over');
  });

  elements.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  elements.inputFile.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });

  elements.clearInput.addEventListener('click', clearInputFile);
}

function handleFileSelect(file) {
  inputFileName = file.name;
  inputFilePath = file.path || file.name;

  elements.inputFileName.textContent = file.name;
  elements.inputFileInfo.classList.remove('hidden');
  elements.dropZone.classList.add('hidden');

  // Auto-set output filename
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  elements.outputFilename.value = baseName;

  elements.convertBtn.disabled = false;
  updateCommandPreview();
}

function clearInputFile() {
  inputFilePath = null;
  inputFileName = null;
  elements.inputFile.value = '';
  elements.inputFileName.textContent = '';
  elements.inputFileInfo.classList.add('hidden');
  elements.dropZone.classList.remove('hidden');
  elements.convertBtn.disabled = true;
  updateCommandPreview();
}

// Output Format Handling
function setupFormatHandling() {
  elements.outputFormat.addEventListener('change', () => {
    const format = elements.outputFormat.value;
    const isPdf = format === 'pdf' || format === 'beamer';

    elements.pdfEngineSection.style.display = isPdf ? 'block' : 'none';
    elements.pdfAdvanced.style.display = isPdf ? 'block' : 'none';

    updateCommandPreview();
  });
}

// TOC Toggle
function setupTocHandling() {
  elements.toc.addEventListener('change', () => {
    elements.tocDepthSection.classList.toggle('hidden', !elements.toc.checked);
    updateCommandPreview();
  });
}

// Build Pandoc Command
function buildPandocCommand() {
  const args = ['pandoc'];

  // Input file
  const input = inputFileName || 'input.md';
  args.push(`"${input}"`);

  // Input format override
  if (elements.inputFormat.value !== 'auto') {
    args.push(`-f ${elements.inputFormat.value}`);
  }

  // Output format
  const format = elements.outputFormat.value;
  args.push(`-t ${format}`);

  // Output file
  const outputName = elements.outputFilename.value || 'output';
  const ext = getExtensionForFormat(format);
  args.push(`-o "${outputName}.${ext}"`);

  // Standalone
  if (elements.standalone.checked) {
    args.push('-s');
  }

  // PDF Engine
  const isPdf = format === 'pdf' || format === 'beamer';
  if (isPdf) {
    args.push(`--pdf-engine=${elements.pdfEngine.value}`);

    // Document class
    args.push(`-V documentclass=${elements.documentClass.value}`);

    // Page size
    args.push(`-V papersize=${elements.paperSize.value}`);

    // Orientation
    if (elements.orientation.value === 'landscape') {
      args.push('-V geometry:landscape');
    }

    // Margins
    const margins = [];
    if (elements.marginTop.value) margins.push(`top=${elements.marginTop.value}`);
    if (elements.marginBottom.value) margins.push(`bottom=${elements.marginBottom.value}`);
    if (elements.marginLeft.value) margins.push(`left=${elements.marginLeft.value}`);
    if (elements.marginRight.value) margins.push(`right=${elements.marginRight.value}`);
    if (margins.length > 0) {
      args.push(`-V geometry:${margins.join(',')}`);
    }

    // Colored links
    if (elements.colorLinks.checked) {
      args.push('-V colorlinks=true');
      const color = elements.linkColor.value.replace('#', '');
      args.push(`-V linkcolor=[HTML]{${color}}`);
      args.push(`-V urlcolor=[HTML]{${color}}`);
    }
  }

  // Typography
  if (elements.mainFont.value) {
    args.push(`-V mainfont="${elements.mainFont.value}"`);
  }
  if (elements.monoFont.value) {
    args.push(`-V monofont="${elements.monoFont.value}"`);
  }
  if (elements.fontSize.value !== '12pt') {
    args.push(`-V fontsize=${elements.fontSize.value}`);
  }
  if (elements.lineHeight.value !== '1.5') {
    args.push(`-V linestretch=${elements.lineHeight.value}`);
  }

  // Code highlighting
  args.push(`--highlight-style=${elements.highlightTheme.value}`);

  // TOC
  if (elements.toc.checked) {
    args.push('--toc');
    args.push(`--toc-depth=${elements.tocDepth.value}`);
  }

  // Number sections
  if (elements.numberSections.checked) {
    args.push('-N');
  }

  // Metadata
  if (elements.docTitle.value) {
    args.push(`-M title="${elements.docTitle.value}"`);
  }
  if (elements.docAuthor.value) {
    args.push(`-M author="${elements.docAuthor.value}"`);
  }
  if (elements.docDate.value) {
    args.push(`-M date="${elements.docDate.value}"`);
  }

  // Filters
  if (elements.filterMermaid.checked) {
    args.push('-F mermaid-filter');
  }
  if (elements.filterCrossref.checked) {
    args.push('-F pandoc-crossref');
  }
  if (elements.filterCiteproc.checked) {
    args.push('--citeproc');
  }

  // Custom variables
  const customVars = elements.customVars.value.trim();
  if (customVars) {
    customVars.split('\n').forEach(line => {
      const [key, val] = line.split('=');
      if (key && val) {
        args.push(`-V ${key.trim()}=${val.trim()}`);
      }
    });
  }

  // Extra arguments
  if (elements.extraArgs.value.trim()) {
    args.push(elements.extraArgs.value.trim());
  }

  return args.join(' \\\n  ');
}

function getExtensionForFormat(format) {
  const extensions = {
    pdf: 'pdf',
    docx: 'docx',
    odt: 'odt',
    rtf: 'rtf',
    html: 'html',
    html5: 'html',
    pptx: 'pptx',
    beamer: 'pdf',
    revealjs: 'html',
    markdown: 'md',
    gfm: 'md',
    rst: 'rst',
    asciidoc: 'adoc',
    org: 'org',
    latex: 'tex',
    epub: 'epub',
    epub3: 'epub',
    plain: 'txt',
  };
  return extensions[format] || format;
}

function updateCommandPreview() {
  elements.commandPreview.textContent = buildPandocCommand();
}

// Copy Command
function setupCopyCommand() {
  elements.copyCmd.addEventListener('click', async () => {
    const cmd = elements.commandPreview.textContent;
    try {
      await navigator.clipboard.writeText(cmd.replace(/\\\n\s+/g, ' '));
      showToast('Command copied to clipboard', 'success');
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
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Conversion (Tauri integration placeholder)
function setupConversion() {
  elements.convertBtn.addEventListener('click', async () => {
    if (!inputFilePath) {
      showToast('Please select an input file', 'warning');
      return;
    }

    elements.statusArea.classList.remove('hidden');
    elements.progressBar.classList.add('progress-primary');
    elements.statusText.textContent = 'Converting...';
    elements.convertBtn.disabled = true;

    try {
      // Check if running in Tauri
      if (window.__TAURI__) {
        const { invoke } = window.__TAURI__.core;
        const command = buildPandocCommand().replace(/\\\n\s+/g, ' ');
        const result = await invoke('run_pandoc', { command });

        elements.statusText.textContent = 'Conversion complete!';
        elements.progressBar.classList.remove('progress-primary');
        elements.progressBar.classList.add('progress-success');
        showToast('Document converted successfully!', 'success');
      } else {
        // Web demo mode
        setTimeout(() => {
          elements.statusText.textContent = 'Demo mode: Copy the command to run manually';
          elements.progressBar.classList.remove('progress-primary');
          elements.progressBar.classList.add('progress-info');
          showToast('Running in web mode. Copy command to run in terminal.', 'info');
        }, 1000);
      }
    } catch (err) {
      elements.statusText.textContent = `Error: ${err.message || err}`;
      elements.progressBar.classList.remove('progress-primary');
      elements.progressBar.classList.add('progress-error');
      showToast(`Conversion failed: ${err.message || err}`, 'error');
    } finally {
      elements.convertBtn.disabled = false;
    }
  });
}

// Event listeners for all inputs to update preview
function setupInputListeners() {
  const inputs = document.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.addEventListener('change', updateCommandPreview);
    input.addEventListener('input', updateCommandPreview);
  });
}

// Initialize
function init() {
  initTheme();
  setupFileHandling();
  setupFormatHandling();
  setupTocHandling();
  setupCopyCommand();
  setupConversion();
  setupInputListeners();

  elements.themeToggle.addEventListener('change', toggleTheme);

  // Initial command preview
  updateCommandPreview();

  // Show PDF options by default
  elements.pdfEngineSection.style.display = 'block';
  elements.pdfAdvanced.style.display = 'block';
}

// Start app
document.addEventListener('DOMContentLoaded', init);
