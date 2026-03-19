const path = require('path');
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
function resolveReferences(projectRoot, onProgress) {
    const resDir = path.join(projectRoot, 'res');
    const srcDir = path.join(projectRoot, 'src');

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
        constCount: constMap.size
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

module.exports = { resolveReferences };
