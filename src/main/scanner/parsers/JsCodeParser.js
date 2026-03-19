const fs = require('fs');
const path = require('path');

/**
 * Parse JS source files for resource path references.
 * 
 * Detection patterns:
 * 1. Direct full paths: strings containing "res/..." with resource extensions
 * 2. API calls: loadTexture("path"), cc.Sprite("path"), new sp.SkeletonAnimation(path), etc.
 * 3. Concatenated with ROOT_PATH: BingoConst.ROOT_PATH + "suffix"
 * 4. Index-concatenated: "prefix" + variable + ".ext" → wildcard pattern
 */

const RESOURCE_EXTS = /\.(png|jpg|jpeg|mp3|ogg|wav|json|plist|atlas|ttf|xml|fsh|vsh|frag|vert|ExportJson)$/i;

/**
 * Parse a single JS file and extract all resource references.
 * @param {string} filePath - Absolute path to JS file
 * @param {string} projectRoot - Project root (parent of res/ and src/)
 * @param {Map<string,string>} constMap - Resolved constants map
 * @returns {Array<{resourcePath: string, source: string, line: number, snippet: string, type: string, isPattern: boolean}>}
 */
function parseJsFile(filePath, projectRoot, constMap) {
    const references = [];
    let content;
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    } catch {
        return references;
    }

    const lines = content.split('\n');
    const sourceRel = path.relative(projectRoot, filePath).replace(/\\/g, '/');

    // First pass: collect variable assignments that resolve to resource paths
    // e.g., let pathAnimLastStage = BingoConst.ROOT_PATH + "Anim/last stage";
    const varPathMap = new Map();
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match: let varName = ClassName.PROP + "suffix"
        const assignRegex = /(?:let|var|const)\s+(\w+)\s*=\s*(\w+)\.(\w+)\s*\+\s*["']([^"']+)["']/;
        const m = assignRegex.exec(line);
        if (m) {
            const varName = m[1];
            const className = m[2];
            const propName = m[3];
            const suffix = m[4];
            const key = `${className}.${propName}`;
            const rootPath = constMap.get(key) || constMap.get(propName);
            if (rootPath) {
                varPathMap.set(varName, rootPath + suffix);
            }
        }
        // Match: let varName = this.PROP + "suffix"
        const thisAssignRegex = /(?:let|var|const)\s+(\w+)\s*=\s*this\.(\w+)\s*\+\s*["']([^"']+)["']/;
        const m2 = thisAssignRegex.exec(line);
        if (m2) {
            const varName = m2[1];
            const propName = m2[2];
            let rootPath = constMap.get(propName);
            if (!rootPath) {
                for (const [key, val] of constMap) {
                    if (key.endsWith('.' + propName)) { rootPath = val; break; }
                }
            }
            if (rootPath) {
                varPathMap.set(varName, rootPath + m2[3]);
            }
        }
        // Match: let varName = "res/some/path" (direct string literal, no extension)
        if (!m && !m2) {
            const directAssignRegex = /(?:let|var|const)\s+(\w+)\s*=\s*["'](res\/[^"']+)["']/;
            const m3 = directAssignRegex.exec(line);
            if (m3 && !RESOURCE_EXTS.test(m3[2])) {
                varPathMap.set(m3[1], m3[2]);
            }
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        const trimmed = line.trim();

        // Skip comments
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

        // Pattern 1: Direct string containing "res/" with resource extension
        extractDirectPaths(line, lineNum, sourceRel, references);

        // Pattern 2: ROOT_PATH/constant concatenation
        extractConstPaths(line, lineNum, sourceRel, constMap, references);

        // Pattern 3: String with relative path (used in functions like loadTexture, cc.Sprite, etc.)
        extractRelativeApiPaths(line, lineNum, sourceRel, references);

        // Pattern 4: Variable + extension suffix (e.g., pathVar + ".json")
        extractVarSuffixPaths(line, lineNum, sourceRel, varPathMap, references);
    }

    return references;
}

/**
 * Pattern 4: Detect varName + ".ext" where varName was previously resolved to a base path.
 */
function extractVarSuffixPaths(line, lineNum, source, varPathMap, references) {
    const regex = /(\w+)\s*\+\s*["'](\.\w+)["']/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
        const varName = match[1];
        const ext = match[2];
        const basePath = varPathMap.get(varName);
        if (basePath && RESOURCE_EXTS.test(basePath + ext)) {
            references.push({
                resourcePath: basePath + ext,
                source,
                line: lineNum,
                snippet: line.trim(),
                type: 'js',
                isPattern: false
            });
        }
    }
}

/**
 * Pattern 1: Direct full paths like "res/Lobby/Friend/tabNotifyGift10.png"
 */
function extractDirectPaths(line, lineNum, source, references) {
    const regex = /["'](res\/[^"']+\.(png|jpg|jpeg|mp3|ogg|wav|json|plist|atlas|ttf|xml|fsh|vsh|frag|vert|ExportJson))["']/gi;
    let match;
    while ((match = regex.exec(line)) !== null) {
        references.push({
            resourcePath: match[1],
            source,
            line: lineNum,
            snippet: line.trim(),
            type: 'js',
            isPattern: false
        });
    }
}

/**
 * Pattern 2: Constant concatenation → ROOT_PATH + "subpath"
 * Handles:
 *   BingoConst.ROOT_PATH + "MainGui/gift.png"
 *   BingoConst.ROOT_PATH + "MainGui/gift" + index + ".png"
 *   SomeConst.ROOT_PATH + "Anim/cao" then later path + ".json", path + ".atlas"
 */
function extractConstPaths(line, lineNum, source, constMap, references) {
    // Match patterns like: ConstName.PROP + "suffix"
    const concatRegex = /(\w+)\.(\w+)\s*\+\s*["']([^"']+)["']/g;
    let match;
    while ((match = concatRegex.exec(line)) !== null) {
        const className = match[1];
        const propName = match[2];
        const suffix = match[3];

        // Try to resolve the constant
        const key = `${className}.${propName}`;
        const rootPath = constMap.get(key) || constMap.get(propName);
        if (!rootPath) continue;

        const fullPath = rootPath + suffix;

        // Check if this line also has index concatenation: + variable + ".ext"
        // e.g., ROOT_PATH + "MainGui/gift" + imgIndex + ".png"
        const afterMatch = line.substring(match.index + match[0].length);
        const indexConcatRegex = /^\s*\+\s*\w+\s*\+\s*["'](\.[^"']+)["']/;
        const indexMatch = indexConcatRegex.exec(afterMatch);

        if (indexMatch) {
            // This is an index-concatenated pattern → create wildcard
            const ext = indexMatch[1];
            const pattern = fullPath + '*' + ext;
            references.push({
                resourcePath: pattern,
                source,
                line: lineNum,
                snippet: line.trim(),
                type: 'js',
                isPattern: true
            });
        } else if (RESOURCE_EXTS.test(fullPath)) {
            // Direct concatenation with extension → exact path
            references.push({
                resourcePath: fullPath,
                source,
                line: lineNum,
                snippet: line.trim(),
                type: 'js',
                isPattern: false
            });
        } else {
            // Might be a path prefix stored in a variable (e.g., path = ROOT_PATH + "Anim/cao")
            // Look for subsequent lines using: path + ".json", path + ".atlas", etc.
            // We'll scan the next few lines for this variable usage
            extractVariableSuffixPaths(fullPath, line, lineNum, source, references);
        }
    }

    // Handle: this.ROOT_PATH + "suffix" or this.ROOT_PATH_SOUND + "bg.mp3"
    const thisRegex = /this\.(\w+)\s*\+\s*["']([^"']+)["']/g;
    while ((match = thisRegex.exec(line)) !== null) {
        const propName = match[1];
        const suffix = match[2];

        // Try all possible class prefixes from constMap
        let rootPath = constMap.get(propName);
        if (!rootPath) {
            for (const [key, val] of constMap) {
                if (key.endsWith('.' + propName)) {
                    rootPath = val;
                    break;
                }
            }
        }
        if (!rootPath) continue;

        const fullPath = rootPath + suffix;

        const afterMatch = line.substring(match.index + match[0].length);
        const indexConcatRegex = /^\s*\+\s*\w+\s*\+\s*["'](\.[^"']+)["']/;
        const indexMatch = indexConcatRegex.exec(afterMatch);

        if (indexMatch) {
            const ext = indexMatch[1];
            const pattern = fullPath + '*' + ext;
            references.push({
                resourcePath: pattern,
                source,
                line: lineNum,
                snippet: line.trim(),
                type: 'js',
                isPattern: true
            });
        } else if (RESOURCE_EXTS.test(fullPath)) {
            references.push({
                resourcePath: fullPath,
                source,
                line: lineNum,
                snippet: line.trim(),
                type: 'js',
                isPattern: false
            });
        } else {
            extractVariableSuffixPaths(fullPath, line, lineNum, source, references);
        }
    }
}

/**
 * When we see: let path = ROOT_PATH + "Anim/cao"
 * The variable "path" is later used as: path + ".json", path + ".atlas"
 * We detect the assignment and generate both paths.
 */
function extractVariableSuffixPaths(basePath, line, lineNum, source, references) {
    // Look for variable assignment: let/var/const varName = ... our concat
    const assignRegex = /(?:let|var|const)\s+(\w+)\s*=/;
    const assignMatch = assignRegex.exec(line);
    if (!assignMatch) return;

    // Generate common animation/resource extension pairs
    const commonPairs = [
        ['.json', '.atlas'],  // Spine animation
        ['.json', '.png'],    // Sprite sheet
        ['.plist', '.png'],   // Cocos plist sheet
    ];

    for (const pair of commonPairs) {
        for (const ext of pair) {
            references.push({
                resourcePath: basePath + ext,
                source,
                line: lineNum,
                snippet: line.trim(),
                type: 'js',
                isPattern: false
            });
        }
    }
}

/**
 * Pattern 3: Relative paths in API calls (without res/ prefix).
 * These are less reliable but still worth tracking.
 * e.g., loadTexture("Friend/bg.jpg"), ccs.load("RoomItemCell.json")
 */
function extractRelativeApiPaths(line, lineNum, source, references) {
    // Match common Cocos API calls with string arguments
    const apiPatterns = [
        /\.loadTexture\s*\(\s*["']([^"']+\.(png|jpg|jpeg))["']/gi,
        /\.loadTextures?\s*\(\s*["']([^"']+\.(png|jpg|jpeg))["']/gi,
        /cc\.Sprite(?:\.create)?\s*\(\s*["']([^"']+\.(png|jpg|jpeg))["']/gi,
        /new\s+cc\.Sprite\s*\(\s*["']([^"']+\.(png|jpg|jpeg))["']/gi,
        /cc\.spriteFrameCache\.addSpriteFrames\s*\(\s*["']([^"']+\.plist)["']/gi,
        /ccs\.load\s*\(\s*["']([^"']+\.json)["']/gi,
        /initWithBinaryFile\s*\(\s*["']([^"']+\.json)["']/gi,
        /cc\.audioEngine\.play(?:Effect|Music)\s*\(\s*["']([^"']+\.(mp3|ogg|wav))["']/gi,
        /sp\.SkeletonAnimation\s*\(\s*["']([^"']+\.(json|skel))["']/gi,
        /createSkeleton\s*\(\s*["']([^"']+\.(json|skel))["']/gi,
    ];

    for (const regex of apiPatterns) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(line)) !== null) {
            const refPath = match[1];
            // Skip if already starts with res/ (handled by Pattern 1)
            if (refPath.startsWith('res/')) continue;
            // Skip default resources
            if (refPath.startsWith('Default/')) continue;

            references.push({
                resourcePath: refPath,
                source,
                line: lineNum,
                snippet: line.trim(),
                type: 'js',
                isPattern: false,
                isRelative: true // Mark as needing path resolution during matching
            });
        }
    }
}

module.exports = { parseJsFile };
