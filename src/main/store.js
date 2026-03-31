const Store = require('electron-store');

const store = new Store({
  schema: {
    recentFolders: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          name: { type: 'string' },
          lastOpened: { type: 'number' }
        }
      }
    },
    settings: {
      type: 'object',
      default: {
        fontSize: 13,
        codeFontSize: 11,
        enableFilenameMatching: false
      },
      properties: {
        fontSize: { type: 'number' },
        codeFontSize: { type: 'number' },
        enableFilenameMatching: { type: 'boolean' }
      }
    }
  }
});

module.exports = store;
