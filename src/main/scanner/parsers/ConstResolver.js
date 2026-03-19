const fs = require('fs');
const path = require('path');

/**
 * Pre-scan JS files to resolve constants like ROOT_PATH, DEFAULT_PATH_FOLDER.
 * Builds a map: "ClassName.CONSTANT_NAME" → "resolved string value"
 * 
 * Patterns detected:
 *   ROOT_PATH: "res/Event/Bingo/"
 *   DEFAULT_PATH_FOLDER: "res/Lobby/Friend/"
 *   ROOT_PATH_UI: "res/Event/FortuneSpin/UI/"
 */

// Matches constant definitions in object literals or assignments
// e.g., ROOT_PATH: "res/Event/Bingo/",  or  self.ROOT_PATH = "res/Event/Bingo/";
const CONST_DEF_REGEX = /(\w+)\s*[:=]\s*["']([^"']*res\/[^"']+)["']/g;

// Matches class/variable name like: let BingoConst = { ... } or var FooConst = ...
const CLASS_NAME_REGEX = /(?:let|var|const)\s+(\w+)\s*=\s*(?:\{|cc\.\w+\.extend|[A-Z]\w+\.extend)/;

/**
 * Scan a single JS file for constant definitions.
 * @returns {Array<{className: string, constName: string, value: string}>}
 */
function extractConstsFromFile(filePath) {
    const results = [];
    let content;
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    } catch {
        return results;
    }

    // Try to detect class name from top-level declarations
    const classMatch = CLASS_NAME_REGEX.exec(content);
    const className = classMatch ? classMatch[1] : path.basename(filePath, '.js');

    // Find all constant definitions with "res/" in them
    let match;
    const regex = new RegExp(CONST_DEF_REGEX.source, 'g');
    while ((match = regex.exec(content)) !== null) {
        const constName = match[1];
        const value = match[2];

        // Only track path-like constants
        if (value.includes('/') && value.startsWith('res/')) {
            results.push({
                className,
                constName,
                value,
                filePath
            });
        }
    }

    return results;
}

/**
 * Build a const map from all JS files.
 * Returns Map: "ClassName.CONST_NAME" → "value"
 * Also stores just "CONST_NAME" → "value" for simpler lookups.
 */
function buildConstMap(jsFiles) {
    const constMap = new Map();

    // First pass: direct string definitions (ROOT_PATH: "res/...")
    for (const file of jsFiles) {
        const consts = extractConstsFromFile(file);
        for (const { className, constName, value } of consts) {
            constMap.set(`${className}.${constName}`, value);
            if (!constMap.has(constName)) {
                constMap.set(constName, value);
            }
        }
    }

    // Second pass: chained definitions (ROOT_PATH_SOUND: OtherConst.PATH + "suffix")
    for (const file of jsFiles) {
        extractChainedConsts(file, constMap);
    }

    return constMap;
}

/**
 * Detect chained constant definitions like:
 *   ROOT_PATH_SOUND: AlbumRewardsManager.DEFAULT_PATH_FOLDER + "JoyMiniGame/sound/"
 */
function extractChainedConsts(filePath, constMap) {
    let content;
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    } catch {
        return;
    }

    const classMatch = CLASS_NAME_REGEX.exec(content);
    const className = classMatch ? classMatch[1] : path.basename(filePath, '.js');

    // Match: CONST_NAME: OtherClass.PROP + "suffix"
    const chainRegex = /(\w+)\s*[:=]\s*(\w+)\.(\w+)\s*\+\s*["']([^"']+)["']/g;
    let match;
    while ((match = chainRegex.exec(content)) !== null) {
        const constName = match[1];
        const refClass = match[2];
        const refProp = match[3];
        const suffix = match[4];

        const refKey = `${refClass}.${refProp}`;
        const baseValue = constMap.get(refKey) || constMap.get(refProp);
        if (baseValue) {
            const resolved = baseValue + suffix;
            constMap.set(`${className}.${constName}`, resolved);
            if (!constMap.has(constName)) {
                constMap.set(constName, resolved);
            }
        }
    }
}

module.exports = { buildConstMap, extractConstsFromFile };
