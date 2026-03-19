const path = require('path');
const fs = require('fs');
const { scanResources, collectJsFiles } = require('./ResourceScanner');
const { parseJsonUI } = require('./parsers/JsonUIParser');
const { buildConstMap } = require('./parsers/ConstResolver');
const { parseJsFile } = require('./parsers/JsCodeParser');
const { matchReferences } = require('./PatternMatcher');

/**
 * Orchestrator: runs the full scan pipeline.
 * 
 * 1. Scan res/ → collect all resource files + identify Cocos Studio JSONs
 * 2. Scan src/ → collect all JS files
 * 3. Parse Cocos Studio JSONs → extract references
 * 4. Build const map from JS files
 * 5. Parse JS files → extract references
 * 6. Match all references against resources
 * 7. Return final result
 * 
 * @param {string} projectRoot - Path to the project folder (contains res/ and src/)
 * @param {function} onProgress - Progress callback({ phase, message, current, total })
 * @returns {{ resources: Map, results: Map, stats: object }}
 */
function resolveReferences(projectRoot, onProgress, options) {
    const resDir = path.join(projectRoot, 'res');
    const srcDir = path.join(projectRoot, 'src');
    const opts = options || {};

    const progress = (data) => { if (onProgress) onProgress(data); };

    // Phase 1: Scan resources
    progress({ phase: 'scan-res', message: 'Scanning resources...', current: 0, total: 0 });
    const { resources, cocosJsonFiles } = scanResources(resDir, (p) => {
        progress({ phase: 'scan-res', message: `Scanning: ${p.file}`, current: p.count, total: 0 });
    });

    // Phase 2: Collect JS files
    progress({ phase: 'scan-src', message: 'Collecting source files...', current: 0, total: 0 });
    const jsFiles = collectJsFiles(srcDir);
    progress({ phase: 'scan-src', message: `Found ${jsFiles.length} JS files`, current: jsFiles.length, total: jsFiles.length });

    // Phase 3: Parse Cocos Studio JSONs
    const allReferences = [];
    const totalJsons = cocosJsonFiles.length;
    for (let i = 0; i < totalJsons; i++) {
        progress({
            phase: 'parse-json',
            message: `Parsing JSON ${i + 1}/${totalJsons}`,
            current: i + 1,
            total: totalJsons
        });
        const refs = parseJsonUI(cocosJsonFiles[i], projectRoot);
        allReferences.push(...refs);
    }

    // Phase 4: Build const map
    progress({ phase: 'const-resolve', message: 'Resolving constants...', current: 0, total: jsFiles.length });
    const constMap = buildConstMap(jsFiles);

    // Phase 5: Parse JS files
    const totalJs = jsFiles.length;
    for (let i = 0; i < totalJs; i++) {
        if (i % 50 === 0) {
            progress({
                phase: 'parse-js',
                message: `Parsing JS ${i + 1}/${totalJs}`,
                current: i + 1,
                total: totalJs
            });
        }
        const refs = parseJsFile(jsFiles[i], projectRoot, constMap);
        allReferences.push(...refs);
    }

    // Phase 6: Match references to resources
    progress({ phase: 'matching', message: 'Matching references...', current: 0, total: 0 });
    const matched = matchReferences(allReferences, resources);

    // Phase 6b: Resolve companion textures (.atlas → .png, .plist → .png)
    // If an atlas/plist is used, its texture PNGs are also used
    resolveCompanionTextures(matched, resources);

    // Phase 6c: Filename matching (optional)
    let filenameMatchCount = 0;
    if (opts.filenameMatch) {
        progress({ phase: 'filename-match', message: 'Matching by filename in strings...', current: 0, total: 0 });
        filenameMatchCount = resolveByFilename(matched, jsFiles, projectRoot, progress);
    }

    // Phase 7: Build stats
    let usedCount = 0;
    let unusedCount = 0;
    for (const [resPath, refs] of matched) {
        if (refs.length > 0) {
            usedCount++;
        } else {
            unusedCount++;
        }
    }

    const stats = {
        totalResources: resources.size,
        usedCount,
        unusedCount,
        totalReferences: allReferences.length,
        cocosJsonCount: cocosJsonFiles.length,
        jsFileCount: jsFiles.length,
        constCount: constMap.size,
        filenameMatchCount
    };

    progress({ phase: 'done', message: 'Scan complete', current: 1, total: 1 });

    // Convert resources map to serializable format
    const resourceList = [];
    for (const [resPath, meta] of resources) {
        const refs = matched.get(resPath) || [];
        resourceList.push({
            path: resPath,
            type: meta.type,
            size: meta.size,
            absPath: meta.absPath,
            used: refs.length > 0,
            references: refs
        });
    }

    return { resourceList, stats };
}

/**
 * Resolve companion textures: when an .atlas or .plist file is used,
 * the .png textures it references should also be marked as used.
 */
function resolveCompanionTextures(matched, resources) {
    for (const [resPath, refs] of matched) {
        if (refs.length === 0) continue;

        const ext = path.extname(resPath).toLowerCase();
        const resDir = path.dirname(resPath);

        if (ext === '.atlas') {
            // Parse atlas to find texture filenames (lines ending with .png)
            const meta = resources.get(resPath);
            if (!meta) continue;
            try {
                const content = fs.readFileSync(meta.absPath, 'utf-8');
                const lines = content.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (/\.(png|jpg|jpeg)$/i.test(trimmed)) {
                        const texPath = resDir + '/' + trimmed;
                        if (matched.has(texPath) && matched.get(texPath).length === 0) {
                            matched.get(texPath).push({
                                source: resPath,
                                line: 0,
                                snippet: `Texture referenced by ${path.basename(resPath)}`,
                                type: 'atlas-texture',
                                isPattern: false
                            });
                        }
                    }
                }
            } catch { /* skip unreadable */ }
        }

        if (ext === '.plist') {
            // Parse plist to find texture filename
            const meta = resources.get(resPath);
            if (!meta) continue;
            try {
                const content = fs.readFileSync(meta.absPath, 'utf-8');
                // Match <key>textureFileName</key> or <key>realTextureFileName</key>
                const texMatch = content.match(/<key>(?:real)?[Tt]exture[Ff]ile[Nn]ame<\/key>\s*<string>([^<]+)<\/string>/);
                if (texMatch) {
                    const texPath = resDir + '/' + texMatch[1];
                    if (matched.has(texPath) && matched.get(texPath).length === 0) {
                        matched.get(texPath).push({
                            source: resPath,
                            line: 0,
                            snippet: `Texture referenced by ${path.basename(resPath)}`,
                            type: 'plist-texture',
                            isPattern: false
                        });
                    }
                }
            } catch { /* skip unreadable */ }
        }
    }
}

/**
 * For each unused resource, check if its filename (without extension)
 * appears inside a string literal in JS source code. Comments are stripped first.
 */
function resolveByFilename(matched, jsFiles, projectRoot, progress) {
    // Collect unused resources and group by basename (no ext)
    const basenameToRes = new Map();
    for (const [resPath, refs] of matched) {
        if (refs.length > 0) continue;
        const ext = path.extname(resPath);
        const basename = path.basename(resPath, ext);
        if (!basename || basename.length < 2) continue; // skip very short names
        if (!basenameToRes.has(basename)) {
            basenameToRes.set(basename, []);
        }
        basenameToRes.get(basename).push(resPath);
    }

    if (basenameToRes.size === 0) return 0;

    let totalMatched = 0;

    for (let i = 0; i < jsFiles.length; i++) {
        if (i % 50 === 0) {
            progress({ phase: 'filename-match', message: `Filename matching (${i}/${jsFiles.length})...`, current: i, total: jsFiles.length });
        }

        let content;
        try {
            content = fs.readFileSync(jsFiles[i], 'utf-8');
        } catch { continue; }

        // Strip comments (single-line and multi-line)
        const stripped = content.replace(/\/\/[^\n]*/g, '  ').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

        // Extract all string literal contents
        const strings = [];
        const strRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g;
        let sm;
        while ((sm = strRegex.exec(stripped)) !== null) {
            strings.push(sm[1] !== undefined ? sm[1] : sm[2]);
        }

        if (strings.length === 0) continue;

        const relSource = path.relative(projectRoot, jsFiles[i]).replace(/\\/g, '/');

        // Find the line number for a match position (for context)
        const lines = content.split('\n');

        for (const [basename, resPaths] of basenameToRes) {
            // Check if this basename appears in any string literal
            const foundInStr = strings.find(s => s.includes(basename));
            if (!foundInStr) continue;

            // Find line number in original content
            let lineIdx = 0;
            const searchStr = basename;
            for (let li = 0; li < lines.length; li++) {
                if (lines[li].includes(searchStr)) {
                    // Verify it's inside a string on this line
                    const lineStrRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g;
                    let lm;
                    while ((lm = lineStrRegex.exec(lines[li])) !== null) {
                        const strContent = lm[1] !== undefined ? lm[1] : lm[2];
                        if (strContent.includes(searchStr)) {
                            lineIdx = li;
                            break;
                        }
                    }
                    if (lineIdx > 0) break;
                }
            }

            // Build context array (same format as JsCodeParser)
            const startCtx = Math.max(0, lineIdx - 1);
            const endCtx = Math.min(lines.length - 1, lineIdx + 1);
            const context = [];
            for (let ci = startCtx; ci <= endCtx; ci++) {
                context.push({ lineNum: ci + 1, text: lines[ci], highlight: ci === lineIdx });
            }
            const snippet = lines.slice(startCtx, endCtx + 1).join('\n');

            for (const resPath of resPaths) {
                if (matched.get(resPath).length > 0) continue; // already matched
                matched.get(resPath).push({
                    source: relSource,
                    line: lineIdx + 1,
                    snippet: snippet,
                    context: context,
                    type: 'filename-match',
                    isPattern: false
                });
                totalMatched++;
            }
        }
    }

    return totalMatched;
}

module.exports = { resolveReferences };
