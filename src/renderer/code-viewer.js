/**
 * Code Viewer — read-only source file viewer with line highlighting.
 */

const filePathEl = document.getElementById('file-path');
const fileInfoEl = document.getElementById('file-info');
const codeContent = document.getElementById('code-content');
const codeContainer = document.getElementById('code-container');

// Receive file data from main process
window.codeViewerAPI.onFileData((data) => {
    filePathEl.textContent = data.filePath;
    fileInfoEl.textContent = `${data.totalLines} lines`;
    renderCode(data.content, data.highlightLine);
});

function renderCode(content, highlightLine) {
    const lines = content.split('\n');
    const padWidth = String(lines.length).length;
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const div = document.createElement('div');
        div.className = 'cv-line';
        if (lineNum === highlightLine) {
            div.className += ' cv-highlight';
            div.id = 'highlight-line';
        }

        const numSpan = document.createElement('span');
        numSpan.className = 'cv-linenum';
        numSpan.textContent = String(lineNum).padStart(padWidth);

        const textSpan = document.createElement('span');
        textSpan.className = 'cv-text';
        textSpan.innerHTML = highlightSyntax(escapeHtml(lines[i]));

        div.appendChild(numSpan);
        div.appendChild(textSpan);
        fragment.appendChild(div);
    }

    codeContent.innerHTML = '';
    codeContent.appendChild(fragment);

    // Scroll to highlighted line
    if (highlightLine) {
        requestAnimationFrame(() => {
            const target = document.getElementById('highlight-line');
            if (target) {
                target.scrollIntoView({ block: 'center' });
            }
        });
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

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
