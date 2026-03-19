const fs = require('fs');
const path = require('path');

/**
 * Extracts resource references from Cocos Studio JSON layout files.
 * These files have structure: { Content: { Content: { ObjectData: {...}, UsedResources: [...] } } }
 * 
 * Resource paths in FileData.Path are relative to the JSON file's parent directory.
 */

const FILE_DATA_KEYS = [
    'FileData', 'NormalFileData', 'PressedFileData', 'DisabledFileData',
    'ImageFileData', 'FontResource', 'BackGroundImageData'
];

/**
 * Parse a single Cocos Studio JSON file and return all resource references.
 * @param {string} jsonFilePath - Absolute path to the JSON file
 * @param {string} projectRoot - Project root containing res/ and src/
 * @returns {Array<{resourcePath: string, source: string, line: number, snippet: string, type: string}>}
 */
function parseJsonUI(jsonFilePath, projectRoot) {
    const references = [];
    let data;

    try {
        const raw = fs.readFileSync(jsonFilePath, 'utf-8');
        data = JSON.parse(raw);
    } catch {
        return references;
    }

    const jsonDir = path.dirname(jsonFilePath);
    const jsonRelPath = path.relative(projectRoot, jsonFilePath).replace(/\\/g, '/');

    // Extract from ObjectData tree (recursive traversal)
    const content = data.Content && data.Content.Content;
    if (content && content.ObjectData) {
        traverseObjectData(content.ObjectData, jsonDir, projectRoot, jsonRelPath, references);
    }

    // Extract from UsedResources array
    if (content && Array.isArray(content.UsedResources)) {
        for (const entry of content.UsedResources) {
            const resPath = typeof entry === 'string' ? entry : (entry && entry.Path);
            if (!resPath || resPath === 'Default/ImageFile.png') continue;

            const resolved = resolveRelativePath(resPath, jsonDir, projectRoot);
            if (resolved) {
                references.push({
                    resourcePath: resolved,
                    source: jsonRelPath,
                    line: 0,
                    snippet: `UsedResources: "${resPath}"`,
                    type: 'json'
                });
            }
        }
    }

    return references;
}

/**
 * Recursively traverse ObjectData tree to find FileData references.
 */
function traverseObjectData(node, jsonDir, projectRoot, jsonRelPath, references) {
    if (!node || typeof node !== 'object') return;

    // Check all FileData-like keys
    for (const key of FILE_DATA_KEYS) {
        const fileData = node[key];
        if (fileData && typeof fileData === 'object') {
            extractFileData(fileData, key, jsonDir, projectRoot, jsonRelPath, references);
        }
    }

    // Recurse into Children
    if (Array.isArray(node.Children)) {
        for (const child of node.Children) {
            traverseObjectData(child, jsonDir, projectRoot, jsonRelPath, references);
        }
    }
}

/**
 * Extract resource path from a FileData-like object.
 */
function extractFileData(fileData, keyName, jsonDir, projectRoot, jsonRelPath, references) {
    const filePath = fileData.Path;
    const plist = fileData.Plist;
    const type = fileData.Type;

    // Skip default/empty paths
    if (!filePath && !plist) return;
    if (type === 'Default') return;

    // Handle the main Path reference
    if (filePath && filePath !== 'Default/ImageFile.png' &&
        filePath !== 'Default/Button_Normal.png' &&
        filePath !== 'Default/Button_Press.png' &&
        filePath !== 'Default/Button_Disable.png') {

        const resolved = resolveRelativePath(filePath, jsonDir, projectRoot);
        if (resolved) {
            references.push({
                resourcePath: resolved,
                source: jsonRelPath,
                line: 0,
                snippet: `${keyName}.Path: "${filePath}"`,
                type: 'json'
            });
        }
    }

    // Handle Plist reference
    if (plist && plist.trim() !== '') {
        const resolvedPlist = resolveRelativePath(plist, jsonDir, projectRoot);
        if (resolvedPlist) {
            references.push({
                resourcePath: resolvedPlist,
                source: jsonRelPath,
                line: 0,
                snippet: `${keyName}.Plist: "${plist}"`,
                type: 'json'
            });
        }
    }
}

/**
 * Resolve a relative path from a JSON file's directory to a full res/... path.
 * JSON files reference resources relative to their own directory.
 */
function resolveRelativePath(relativePath, jsonDir, projectRoot) {
    if (!relativePath) return null;

    // Build absolute path from JSON file's directory
    const absPath = path.resolve(jsonDir, relativePath);
    // Convert to project-relative path (should start with res/...)
    const relToProject = path.relative(projectRoot, absPath).replace(/\\/g, '/');

    // Must be under res/
    if (relToProject.startsWith('res/')) {
        return relToProject;
    }
    return null;
}

module.exports = { parseJsonUI };
