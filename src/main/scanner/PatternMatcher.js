const path = require('path');

/**
 * Match extracted references against actual resource files.
 * Handles exact paths, wildcard/glob patterns, and relative path resolution.
 */

/**
 * Match all references against the resource map.
 * 
 * @param {Array} references - All collected references from parsers
 * @param {Map<string, object>} resources - Map of known resource paths → metadata
 * @returns {Map<string, Array>} Map of resourcePath → array of matching references
 */
function matchReferences(references, resources) {
    const matched = new Map();

    // Initialize all resources with empty arrays
    for (const resPath of resources.keys()) {
        matched.set(resPath, []);
    }

    // Build lookup sets for efficient matching
    const resourcePaths = Array.from(resources.keys());
    // Normalized lookup (lowercase, forward slashes)
    const normalizedMap = new Map();
    for (const p of resourcePaths) {
        normalizedMap.set(normalizePath(p), p);
    }

    for (const ref of references) {
        const refPath = ref.resourcePath;
        if (!refPath) continue;

        if (ref.isPattern) {
            // Wildcard pattern matching (e.g., "res/Event/Bingo/MainGui/ProgressBingoPoint/gift*.png")
            matchWildcard(refPath, ref, normalizedMap, matched);
        } else if (ref.isRelative) {
            // Relative path — try to find in any res/ subdirectory
            matchRelative(refPath, ref, normalizedMap, matched);
        } else {
            // Exact match
            matchExact(refPath, ref, normalizedMap, matched);
        }
    }

    return matched;
}

/**
 * Exact path matching with normalization.
 */
function matchExact(refPath, ref, normalizedMap, matched) {
    const normalized = normalizePath(refPath);

    // Try direct match
    const originalPath = normalizedMap.get(normalized);
    if (originalPath) {
        addMatch(matched, originalPath, ref);
        return;
    }

    // Try with res/ prefix if missing
    if (!normalized.startsWith('res/')) {
        const withRes = 'res/' + normalized;
        const origWithRes = normalizedMap.get(withRes);
        if (origWithRes) {
            addMatch(matched, origWithRes, ref);
            return;
        }
    }

    // Try stripping res/ if present
    if (normalized.startsWith('res/')) {
        const withoutRes = normalized.substring(4);
        const origWithoutRes = normalizedMap.get(withoutRes);
        if (origWithoutRes) {
            addMatch(matched, origWithoutRes, ref);
        }
    }
}

/**
 * Wildcard pattern matching.
 * Pattern like "res/Event/Bingo/MainGui/ProgressBingoPoint/gift*.png"
 * matches "res/Event/Bingo/MainGui/ProgressBingoPoint/gift0.png", "gift1.png", etc.
 */
function matchWildcard(pattern, ref, normalizedMap, matched) {
    const normalizedPattern = normalizePath(pattern);

    // Convert pattern to regex: * → [^/]*
    const regexStr = escapeRegex(normalizedPattern).replace(/\\\*/g, '[^/]*');
    const regex = new RegExp('^' + regexStr + '$', 'i');

    // Also try with/without res/ prefix
    const variants = [normalizedPattern];
    if (!normalizedPattern.startsWith('res/')) {
        variants.push('res/' + normalizedPattern);
    }

    for (const [normalized, original] of normalizedMap) {
        for (const variant of variants) {
            const variantRegex = new RegExp(
                '^' + escapeRegex(normalizePath(variant)).replace(/\\\*/g, '[^/]*') + '$', 'i'
            );
            if (variantRegex.test(normalized)) {
                addMatch(matched, original, ref);
                break;
            }
        }
    }
}

/**
 * Relative path matching — try to find the path as a suffix of any resource path.
 * e.g., "Friend/bg.jpg" matches "res/Lobby/Friend/bg.jpg"
 */
function matchRelative(refPath, ref, normalizedMap, matched) {
    const normalized = normalizePath(refPath);

    for (const [normalizedRes, original] of normalizedMap) {
        if (normalizedRes.endsWith('/' + normalized) || normalizedRes === normalized) {
            addMatch(matched, original, ref);
        }
    }
}

function addMatch(matched, resourcePath, ref) {
    if (!matched.has(resourcePath)) {
        matched.set(resourcePath, []);
    }
    const refs = matched.get(resourcePath);
    // Avoid duplicate references from same source+line
    const isDup = refs.some(r => r.source === ref.source && r.line === ref.line && r.snippet === ref.snippet);
    if (!isDup) {
        refs.push({
            source: ref.source,
            line: ref.line,
            snippet: ref.snippet,
            type: ref.type
        });
    }
}

function normalizePath(p) {
    return p.replace(/\\/g, '/').toLowerCase();
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { matchReferences };
