const fs = require('fs');
const path = require('path');

const RESOURCE_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif',
    '.mp3', '.ogg', '.wav', '.m4a',
    '.json', '.plist', '.atlas', '.xml',
    '.ttf', '.otf', '.woff',
    '.vsh', '.fsh', '.frag', '.vert',
    '.ExportJson'
]);

const COCOS_STUDIO_JSON_MARKERS = ['Content', 'Version', 'ObjectData'];

function getFileType(ext) {
    ext = ext.toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'].includes(ext)) return 'image';
    if (['.mp3', '.ogg', '.wav', '.m4a'].includes(ext)) return 'audio';
    if (ext === '.plist') return 'plist';
    if (ext === '.atlas') return 'atlas';
    if (['.ttf', '.otf', '.woff'].includes(ext)) return 'font';
    if (['.vsh', '.fsh', '.frag', '.vert'].includes(ext)) return 'shader';
    if (ext === '.json') return 'json';
    if (ext === '.xml' || ext === '.ExportJson') return 'xml';
    return 'file';
}

/**
 * Check if a JSON file is a Cocos Studio layout (not a trackable resource).
 * Cocos Studio JSONs typically have { Content: { Content: { ObjectData: ... } }, Version: "..." }
 */
function isCocosStudioJson(filePath) {
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        // Quick check before full parse — look for markers in first 500 chars
        const head = raw.substring(0, 500);
        if (!head.includes('"Content"') && !head.includes('"Version"')) return false;

        const data = JSON.parse(raw);
        if (data.Content && data.Content.Content && data.Content.Content.ObjectData) return true;
        if (data.Version && data.Type === 'Scene') return true;
        return false;
    } catch {
        return false;
    }
}

/**
 * Recursively scan the res/ directory and collect all resource files.
 * Returns { resources: Map<relativePath, {type, size, absPath}>, cocosJsonFiles: string[] }
 */
function scanResources(resDir, onProgress) {
    const resources = new Map();
    const cocosJsonFiles = [];
    let count = 0;

    function walk(dir) {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                walk(fullPath);
                continue;
            }

            if (!entry.isFile()) continue;

            const ext = path.extname(entry.name);
            if (!RESOURCE_EXTENSIONS.has(ext.toLowerCase())) {
                // Still track files without known extensions (config files, etc.)
                const relPath = path.relative(path.dirname(resDir), fullPath).replace(/\\/g, '/');
                resources.set(relPath, {
                    type: 'file',
                    size: getFileSizeSafe(fullPath),
                    absPath: fullPath
                });
                count++;
                if (onProgress) onProgress({ phase: 'scan', count, file: relPath });
                continue;
            }

            const relPath = path.relative(path.dirname(resDir), fullPath).replace(/\\/g, '/');

            // Check if JSON is a Cocos Studio layout
            if (ext.toLowerCase() === '.json') {
                if (isCocosStudioJson(fullPath)) {
                    cocosJsonFiles.push(fullPath);
                    // Still add it as a resource — it's a file in res/
                    resources.set(relPath, {
                        type: 'cocos-json',
                        size: getFileSizeSafe(fullPath),
                        absPath: fullPath
                    });
                    count++;
                    if (onProgress) onProgress({ phase: 'scan', count, file: relPath });
                    continue;
                }
            }

            resources.set(relPath, {
                type: getFileType(ext),
                size: getFileSizeSafe(fullPath),
                absPath: fullPath
            });
            count++;
            if (onProgress) onProgress({ phase: 'scan', count, file: relPath });
        }
    }

    walk(resDir);
    return { resources, cocosJsonFiles };
}

function getFileSizeSafe(filePath) {
    try {
        return fs.statSync(filePath).size;
    } catch {
        return 0;
    }
}

/**
 * Collect all JS files in src/ directory
 */
function collectJsFiles(srcDir) {
    const files = [];
    function walk(dir) {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.js') {
                files.push(fullPath);
            }
        }
    }
    walk(srcDir);
    return files;
}

module.exports = { scanResources, collectJsFiles, isCocosStudioJson, getFileType };
