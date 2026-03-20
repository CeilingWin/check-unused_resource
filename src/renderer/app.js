/**
 * Renderer entry point — orchestrates all UI components.
 */

// ===== State =====
let scanResult = null;      // { resourceList, stats }
let projectPath = null;
let selectedFile = null;
let filterMode = 'all';     // 'all' | 'used' | 'unused'
let searchQuery = '';
let fileTypeFilter = 'all'; // 'all' | 'image' | 'audio' | 'json' | 'plist' | 'font' | 'shader' | 'anim' | 'file'
let removeProgressListener = null;

// ===== DOM refs =====
const folderPickerScreen = document.getElementById('folder-picker');
const mainAppScreen = document.getElementById('main-app');
const btnSelectFolder = document.getElementById('btn-select-folder');
const btnChangeFolder = document.getElementById('btn-change-folder');
const btnRescan = document.getElementById('btn-rescan');
const btnExport = document.getElementById('btn-export');
const btnSettings = document.getElementById('btn-settings');
const projectPathEl = document.getElementById('project-path');
const filterBar = document.getElementById('filter-bar');
const treeContainer = document.getElementById('tree-container');
const previewContent = document.getElementById('preview-content');
const referenceContent = document.getElementById('reference-content');
const statusText = document.getElementById('status-text');
const statusStats = document.getElementById('status-stats');

// ===== Init =====
function init() {
    btnSelectFolder.addEventListener('click', selectFolder);
    btnChangeFolder.addEventListener('click', selectFolder);
    btnRescan.addEventListener('click', rescan);
    btnExport.addEventListener('click', exportReport);
    buildFilterBar();
    setupResizer();
    initSettings();
}

// ===== Folder Selection =====
async function selectFolder() {
    const result = await window.api.selectFolder();
    if (!result.success) {
        if (result.reason === 'invalid') {
            alert(result.message);
        }
        return;
    }
    projectPath = result.path;
    await startScan();
}

async function rescan() {
    if (!projectPath) return;
    await startScan();
}

// ===== Scanning =====
async function startScan() {
    showMainApp();
    projectPathEl.textContent = projectPath;
    statusText.textContent = 'Scanning...';
    statusStats.textContent = '';
    treeContainer.innerHTML = '';
    previewContent.innerHTML = '<div class="empty-state">Scanning project...</div>';
    referenceContent.innerHTML = '<div class="empty-state"></div>';
    selectedFile = null;

    // Show loading overlay
    const overlay = createLoadingOverlay();
    document.body.appendChild(overlay);

    // Listen for progress
    if (removeProgressListener) removeProgressListener();
    removeProgressListener = window.api.onScanProgress((progress) => {
        const loadingText = overlay.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = progress.message || 'Working...';
        }
        const bar = overlay.querySelector('.progress-bar');
        if (bar && progress.total > 0) {
            bar.style.width = Math.round((progress.current / progress.total) * 100) + '%';
        }
    });

    const scanOptions = {
        filenameMatch: document.getElementById('chk-filename-match')?.checked || false
    };
    const result = await window.api.scanProject(projectPath, scanOptions);

    // Remove overlay
    overlay.remove();
    if (removeProgressListener) {
        removeProgressListener();
        removeProgressListener = null;
    }

    if (!result.success) {
        statusText.textContent = 'Scan failed: ' + result.message;
        return;
    }

    scanResult = result.data;
    updateStats();
    renderTree();
    statusText.textContent = 'Scan complete';
}

function createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
        <div class="spinner"></div>
        <div class="loading-text">Scanning...</div>
        <div class="progress-bar-wrap"><div class="progress-bar"></div></div>
    `;
    return overlay;
}

// ===== Filter Bar =====
function buildFilterBar() {
    filterBar.innerHTML = `
        <button class="btn-filter active" data-filter="all">All</button>
        <button class="btn-filter" data-filter="used">✓ Used</button>
        <button class="btn-filter" data-filter="unused">✗ Unused</button>
        <span style="width: 1px; height: 20px; background: var(--border); margin: 0 4px;"></span>
        <select id="type-filter" class="search-input" style="width: 110px; padding: 3px 6px;">
            <option value="all">All Types</option>
            <option value="image">Images</option>
            <option value="audio">Audio</option>
            <option value="json">JSON</option>
            <option value="plist">Plist</option>
            <option value="atlas">Atlas</option>
            <option value="font">Fonts</option>
            <option value="shader">Shaders</option>
            <option value="file">Other</option>
        </select>
        <input type="text" id="search-input" class="search-input" placeholder="Search files...">
    `;

    filterBar.querySelectorAll('.btn-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            filterBar.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterMode = btn.dataset.filter;
            renderTree();
        });
    });

    document.getElementById('type-filter').addEventListener('change', (e) => {
        fileTypeFilter = e.target.value;
        renderTree();
    });

    document.getElementById('search-input').addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderTree();
    });
}

// ===== Stats =====
function updateStats() {
    if (!scanResult) return;
    const s = scanResult.stats;
    statusStats.textContent = `${s.totalResources} total · ${s.usedCount} used · ${s.unusedCount} unused`
        + (s.filenameMatchCount ? ` · ${s.filenameMatchCount} filename-matched` : '');
}

// ===== Tree View =====
function renderTree() {
    if (!scanResult) return;
    treeContainer.innerHTML = '';

    // Build tree structure from flat resource list
    const tree = buildTreeData(scanResult.resourceList);
    const treeEl = renderTreeNode(tree, 0, true);
    treeContainer.appendChild(treeEl);
}

function buildTreeData(resourceList) {
    const root = { name: 'res', children: new Map(), isDir: true, path: 'res' };

    for (const res of resourceList) {
        // Apply filters
        if (!passesFilter(res)) continue;

        const parts = res.path.split('/');
        let current = root;

        for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            const isLast = i === parts.length - 1;

            if (isLast) {
                // File node
                current.children.set(part, {
                    name: part,
                    isDir: false,
                    resource: res,
                    path: res.path
                });
            } else {
                // Directory node
                if (!current.children.has(part)) {
                    current.children.set(part, {
                        name: part,
                        isDir: true,
                        children: new Map(),
                        path: parts.slice(0, i + 1).join('/')
                    });
                }
                current = current.children.get(part);
            }
        }
    }

    return root;
}

function passesFilter(res) {
    // Status filter
    if (filterMode === 'used' && !res.used) return false;
    if (filterMode === 'unused' && res.used) return false;

    // Type filter
    if (fileTypeFilter !== 'all') {
        const resType = res.type === 'cocos-json' ? 'json' : res.type;
        if (resType !== fileTypeFilter) return false;
    }

    // Search
    if (searchQuery && !res.path.toLowerCase().includes(searchQuery)) return false;

    return true;
}

function renderTreeNode(node, depth, isRoot) {
    const container = document.createElement('div');
    container.className = 'tree-node';

    if (node.isDir) {
        // Directory
        const row = document.createElement('div');
        row.className = 'tree-row';
        if (isRoot) row.classList.add('root');

        // Indent
        for (let i = 0; i < depth; i++) {
            const indent = document.createElement('span');
            indent.className = 'tree-indent';
            row.appendChild(indent);
        }

        // Arrow
        const arrow = document.createElement('span');
        arrow.className = 'tree-arrow';
        arrow.textContent = '▶';
        if (isRoot) arrow.classList.add('expanded');
        row.appendChild(arrow);

        // Icon
        const icon = document.createElement('span');
        icon.className = 'tree-icon tree-icon-folder';
        if (isRoot) icon.classList.add('expanded');
        row.appendChild(icon);

        // Name
        const name = document.createElement('span');
        name.className = 'tree-name';
        name.textContent = node.name;
        row.appendChild(name);

        // Summary (used/unused counts)
        const counts = countDirStatus(node);
        if (counts.total > 0) {
            const summary = document.createElement('span');
            summary.className = 'tree-summary';
            summary.textContent = `${counts.unused}/${counts.total}`;
            summary.title = `${counts.unused} unused of ${counts.total}`;
            row.appendChild(summary);
        }

        container.appendChild(row);

        // Children container
        const childrenEl = document.createElement('div');
        childrenEl.className = 'tree-children' + (isRoot ? ' expanded' : '');

        // Sort: directories first, then files, alphabetically
        const sorted = Array.from(node.children.values()).sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        for (const child of sorted) {
            childrenEl.appendChild(renderTreeNode(child, depth + 1, false));
        }
        container.appendChild(childrenEl);

        // Toggle
        row.addEventListener('click', () => {
            const isExpanded = childrenEl.classList.toggle('expanded');
            arrow.classList.toggle('expanded', isExpanded);
            icon.classList.toggle('expanded', isExpanded);
        });

    } else {
        // File
        const row = document.createElement('div');
        row.className = 'tree-row';

        // Indent
        for (let i = 0; i < depth; i++) {
            const indent = document.createElement('span');
            indent.className = 'tree-indent';
            row.appendChild(indent);
        }

        // Arrow placeholder
        const arrow = document.createElement('span');
        arrow.className = 'tree-arrow hidden';
        row.appendChild(arrow);

        // Icon
        const icon = document.createElement('span');
        icon.className = 'tree-icon ' + getIconClass(node.resource.type);
        row.appendChild(icon);

        // Name
        const name = document.createElement('span');
        name.className = 'tree-name';
        name.textContent = node.name;
        row.appendChild(name);

        // Status
        const status = document.createElement('span');
        status.className = 'tree-status ' + (node.resource.used ? 'used' : 'unused');
        status.textContent = node.resource.used ? '✓' : '✗';
        status.title = node.resource.used
            ? `Used (${node.resource.references.length} reference${node.resource.references.length !== 1 ? 's' : ''})`
            : 'Unused';
        row.appendChild(status);

        container.appendChild(row);

        // Click → select
        row.addEventListener('click', () => {
            // Deselect previous
            const prev = treeContainer.querySelector('.tree-row.selected');
            if (prev) prev.classList.remove('selected');
            row.classList.add('selected');
            selectFile(node.resource);
        });
    }

    return container;
}

function countDirStatus(node) {
    let total = 0, unused = 0;
    for (const child of node.children.values()) {
        if (child.isDir) {
            const sub = countDirStatus(child);
            total += sub.total;
            unused += sub.unused;
        } else {
            total++;
            if (!child.resource.used) unused++;
        }
    }
    return { total, unused };
}

function getIconClass(type) {
    const map = {
        'image': 'tree-icon-img',
        'audio': 'tree-icon-audio',
        'json': 'tree-icon-json',
        'cocos-json': 'tree-icon-json',
        'plist': 'tree-icon-plist',
        'atlas': 'tree-icon-atlas',
        'font': 'tree-icon-font',
        'shader': 'tree-icon-shader',
        'xml': 'tree-icon-xml',
        'file': 'tree-icon-file'
    };
    return map[type] || 'tree-icon-file';
}

// ===== File Selection → Preview + References =====
async function selectFile(resource) {
    selectedFile = resource;
    await showPreview(resource);
    showReferences(resource);
}

// ===== Preview =====
async function showPreview(resource) {
    previewContent.innerHTML = '<div class="empty-state">Loading...</div>';

    const result = await window.api.getPreview(resource.absPath);
    if (!result.success) {
        previewContent.innerHTML = `<div class="empty-state">Cannot preview: ${escapeHtml(result.message)}</div>`;
        return;
    }

    if (result.type === 'image') {
        previewContent.innerHTML = `
            <div class="preview-image-wrap">
                <img src="${result.data}" alt="${escapeHtml(result.fileName)}">
                <div class="preview-image-info">${escapeHtml(result.fileName)} · ${formatBytes(result.size)}</div>
            </div>
        `;
    } else if (result.type === 'audio') {
        previewContent.innerHTML = `
            <div class="preview-audio">
                <div>
                    <div style="margin-bottom: 8px; color: var(--text-secondary);">${escapeHtml(result.fileName)} · ${formatBytes(result.size)}</div>
                    <audio controls src="file://${result.data.replace(/\\/g, '/')}"></audio>
                </div>
            </div>
        `;
    } else {
        // Text content
        const maxDisplay = 50000;
        const text = result.data.length > maxDisplay
            ? result.data.substring(0, maxDisplay) + '\n\n... (truncated)'
            : result.data;
        previewContent.innerHTML = `<pre class="preview-text">${escapeHtml(text)}</pre>`;
    }
}

// ===== References =====
function showReferences(resource) {
    if (!resource.references || resource.references.length === 0) {
        referenceContent.innerHTML = `
            <div class="empty-state" style="color: var(--red);">
                ✗ No references found — this resource appears unused
            </div>
        `;
        return;
    }

    let html = '';
    for (const ref of resource.references) {
        const badge = ref.type === 'json' ? 'json' : ref.type === 'plist' ? 'plist'
            : ref.type === 'atlas-texture' ? 'atlas' : ref.type === 'plist-texture' ? 'plist'
            : ref.type === 'filename-match' ? 'fname' : 'js';
        const badgeLabel = ref.type === 'json' ? 'JSON' : ref.type === 'plist' ? 'PLIST'
            : ref.type === 'atlas-texture' ? 'ATLAS' : ref.type === 'plist-texture' ? 'PLIST'
            : ref.type === 'filename-match' ? 'FNAME' : 'JS';

        let codeBlockHtml;
        if (ref.context && ref.context.length > 0) {
            // Multi-line context with line numbers
            const codeLines = ref.context.map(entry => {
                const lineNumStr = entry.lineNum != null
                    ? String(entry.lineNum).padStart(4)
                    : '    ';
                const highlighted = entry.highlight ? ' code-highlight' : '';
                const gap = entry.lineNum == null ? ' code-gap' : '';
                const escapedText = escapeHtml(entry.text);
                const syntaxText = highlightSyntax(escapedText);
                return `<div class="code-line${highlighted}${gap}"><span class="code-linenum">${lineNumStr}</span><span class="code-text">${syntaxText}</span></div>`;
            }).join('');
            codeBlockHtml = codeLines;
        } else {
            // Fallback: single-line snippet
            const escapedSnippet = escapeHtml(ref.snippet);
            const syntaxSnippet = highlightSyntax(escapedSnippet);
            const lineNumStr = ref.line ? String(ref.line).padStart(4) : '    ';
            codeBlockHtml = `<div class="code-line code-highlight"><span class="code-linenum">${lineNumStr}</span><span class="code-text">${syntaxSnippet}</span></div>`;
        }

        html += `
            <div class="ref-item" data-file="${escapeHtml(ref.source)}" data-line="${ref.line || ''}" title="Click to view source file" style="cursor: pointer;">
                <div class="ref-source">
                    <span class="ref-badge ${badge}">${badgeLabel}</span>
                    <span class="ref-file">${escapeHtml(ref.source)}</span>
                    ${ref.line ? `<span class="ref-line">:${ref.line}</span>` : ''}
                    <button class="ref-copy-btn" title="Copy code" onclick="event.stopPropagation(); copyRefCode(this)">⧉</button>
                </div>
                <pre class="ref-code-block" tabindex="0">${codeBlockHtml}</pre>
            </div>
        `;
    }
    referenceContent.innerHTML = html;

    // Add click handlers to open code viewer
    referenceContent.querySelectorAll('.ref-item[data-file]').forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't open viewer if user is selecting text in code block
            const selection = window.getSelection();
            if (selection && selection.toString().length > 0) return;

            const sourceFile = item.getAttribute('data-file');
            const line = parseInt(item.getAttribute('data-line')) || 0;
            if (sourceFile && projectPath) {
                const fullPath = projectPath + '/' + sourceFile;
                window.api.openCodeViewer(fullPath, line);
            }
        });
    });
}

/** Copy the code text from a reference block */
function copyRefCode(btn) {
    const codeBlock = btn.closest('.ref-item').querySelector('.ref-code-block');
    if (!codeBlock) return;
    // Extract just the code text (without line numbers)
    const textParts = codeBlock.querySelectorAll('.code-text');
    const text = Array.from(textParts).map(el => el.textContent).join('\n');
    navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '✓';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = '⧉'; btn.classList.remove('copied'); }, 1500);
    });
}
// Expose to inline onclick
window.copyRefCode = copyRefCode;

/** Lightweight JS syntax highlighter — single-pass tokenizer to avoid corrupting inserted HTML tags */
function highlightSyntax(escapedHtml) {
    const TOKEN_RE = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(var|let|const|function|return|if|else|for|while|new|this|class|extends|import|export|from|true|false|null|undefined|typeof|instanceof)\b|\b(cc|sp|ccs)\b|\b(\d+(?:\.\d+)?)\b/gm;

    return escapedHtml.replace(TOKEN_RE, (match, comment, str, kw, ns, num) => {
        if (comment) return `<span class="syn-cmt">${comment}</span>`;
        if (str) return `<span class="syn-str">${str}</span>`;
        if (kw) return `<span class="syn-kw">${kw}</span>`;
        if (ns) return `<span class="syn-ns">${ns}</span>`;
        if (num) return `<span class="syn-num">${num}</span>`;
        return match;
    });
}

function highlightSnippet(snippet, resourcePath) {
    const fileName = resourcePath.split('/').pop();
    if (fileName) {
        const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return snippet.replace(new RegExp(escaped, 'gi'), '<mark>$&</mark>');
    }
    return snippet;
}

// ===== Screen Management =====
function showMainApp() {
    folderPickerScreen.classList.remove('active');
    mainAppScreen.classList.add('active');
}

// ===== Export =====
function exportReport() {
    if (!scanResult) return;

    const lines = ['Status,Path,Type,Size,References'];
    for (const res of scanResult.resourceList) {
        const status = res.used ? 'USED' : 'UNUSED';
        const refs = res.references.map(r => `${r.source}:${r.line}`).join('; ');
        lines.push(`${status},"${res.path}",${res.type},${res.size},"${refs}"`);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resource-scan-report.csv';
    a.click();
    URL.revokeObjectURL(url);
}

// ===== Panel Resizer =====
function setupResizer() {
    const resizer = document.querySelector('.panel-resizer');
    const panelTree = document.getElementById('panel-tree');

    let startX, startWidth;

    resizer.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        startWidth = panelTree.offsetWidth;
        resizer.classList.add('active');

        const onMove = (e) => {
            const dx = e.clientX - startX;
            const newWidth = Math.max(200, Math.min(800, startWidth + dx));
            panelTree.style.width = newWidth + 'px';
        };
        const onUp = () => {
            resizer.classList.remove('active');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    // Vertical resizer for preview/reference panels
    const resizerH = document.querySelector('.panel-resizer-h');
    const referencePanel = document.getElementById('reference-panel');

    resizerH.addEventListener('mousedown', (e) => {
        const startY = e.clientY;
        const startHeight = referencePanel.offsetHeight;
        resizerH.classList.add('active');

        const onMove = (e) => {
            const dy = startY - e.clientY;
            const newHeight = Math.max(100, Math.min(500, startHeight + dy));
            referencePanel.style.height = newHeight + 'px';
        };
        const onUp = () => {
            resizerH.classList.remove('active');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

// ===== Utils =====
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ===== Settings =====
const SETTINGS_DEFAULTS = { fontSize: 13, codeFontSize: 11, filenameMatch: false };

function initSettings() {
    const popup = document.getElementById('settings-popup');
    const slider = document.getElementById('font-size-slider');
    const sliderDisplay = document.getElementById('font-size-value');
    const codeSlider = document.getElementById('code-font-size-slider');
    const codeSliderDisplay = document.getElementById('code-font-size-value');
    const chkFilenameMatch = document.getElementById('chk-filename-match');

    // Load saved settings
    const saved = {
        fontSize: parseInt(localStorage.getItem('crs-font-size')) || SETTINGS_DEFAULTS.fontSize,
        codeFontSize: parseInt(localStorage.getItem('crs-code-font-size')) || SETTINGS_DEFAULTS.codeFontSize
    };
    chkFilenameMatch.checked = localStorage.getItem('crs-filename-match') === 'true';
    applyFontSize(saved.fontSize, saved.codeFontSize);
    slider.value = saved.fontSize;
    sliderDisplay.textContent = saved.fontSize + 'px';
    codeSlider.value = saved.codeFontSize;
    codeSliderDisplay.textContent = saved.codeFontSize + 'px';

    // Toggle popup
    btnSettings.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.hidden = !popup.hidden;
    });
    document.getElementById('btn-settings-close').addEventListener('click', () => {
        popup.hidden = true;
    });
    document.addEventListener('click', (e) => {
        if (!popup.hidden && !popup.contains(e.target) && e.target !== btnSettings) {
            popup.hidden = true;
        }
    });

    // Font size slider
    slider.addEventListener('input', () => {
        const val = parseInt(slider.value);
        sliderDisplay.textContent = val + 'px';
        applyFontSize(val, parseInt(codeSlider.value));
        localStorage.setItem('crs-font-size', val);
    });
    document.getElementById('font-size-dec').addEventListener('click', () => {
        if (slider.value > slider.min) { slider.value--; slider.dispatchEvent(new Event('input')); }
    });
    document.getElementById('font-size-inc').addEventListener('click', () => {
        if (slider.value < slider.max) { slider.value++; slider.dispatchEvent(new Event('input')); }
    });

    // Code font size slider
    codeSlider.addEventListener('input', () => {
        const val = parseInt(codeSlider.value);
        codeSliderDisplay.textContent = val + 'px';
        applyFontSize(parseInt(slider.value), val);
        localStorage.setItem('crs-code-font-size', val);
    });
    document.getElementById('code-font-size-dec').addEventListener('click', () => {
        if (codeSlider.value > codeSlider.min) { codeSlider.value--; codeSlider.dispatchEvent(new Event('input')); }
    });
    document.getElementById('code-font-size-inc').addEventListener('click', () => {
        if (codeSlider.value < codeSlider.max) { codeSlider.value++; codeSlider.dispatchEvent(new Event('input')); }
    });

    // Filename match checkbox
    chkFilenameMatch.addEventListener('change', () => {
        localStorage.setItem('crs-filename-match', chkFilenameMatch.checked);
    });

    // Reset
    document.getElementById('btn-font-reset').addEventListener('click', () => {
        slider.value = SETTINGS_DEFAULTS.fontSize;
        codeSlider.value = SETTINGS_DEFAULTS.codeFontSize;
        sliderDisplay.textContent = SETTINGS_DEFAULTS.fontSize + 'px';
        codeSliderDisplay.textContent = SETTINGS_DEFAULTS.codeFontSize + 'px';
        applyFontSize(SETTINGS_DEFAULTS.fontSize, SETTINGS_DEFAULTS.codeFontSize);
        localStorage.removeItem('crs-font-size');
        localStorage.removeItem('crs-code-font-size');
        chkFilenameMatch.checked = SETTINGS_DEFAULTS.filenameMatch;
        localStorage.removeItem('crs-filename-match');
    });
}

function applyFontSize(fontSize, codeFontSize) {
    document.documentElement.style.setProperty('--font-size-base', fontSize + 'px');
    document.documentElement.style.setProperty('--code-font-size', codeFontSize + 'px');
}

// ===== Start =====
init();
