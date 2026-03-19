const fs = require('fs');

/**
 * Parse Apple Property List (plist) XML files used by Cocos2d for sprite sheets.
 * Extracts the sprite frame names defined in the plist.
 * 
 * Format:
 * <plist>
 *   <dict>
 *     <key>frames</key>
 *     <dict>
 *       <key>coin0.png</key>  ← sprite frame name
 *       ...
 */

/**
 * Parse a plist file and return the list of sprite frame names.
 * @param {string} filePath - Absolute path to the .plist file
 * @returns {string[]} List of sprite frame names
 */
function parsePlistFrames(filePath) {
    const frames = [];
    try {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Quick regex extraction of frame names from plist XML
        // Look for <key>frames</key> section, then extract all <key>name</key> entries
        const framesMatch = content.match(/<key>frames<\/key>\s*<dict>([\s\S]*?)<\/dict>/);
        if (!framesMatch) return frames;

        const framesBlock = framesMatch[1];
        const keyRegex = /<key>([^<]+)<\/key>\s*<dict>/g;
        let match;
        while ((match = keyRegex.exec(framesBlock)) !== null) {
            frames.push(match[1]);
        }
    } catch {
        // Not a valid plist or unreadable
    }
    return frames;
}

module.exports = { parsePlistFrames };
