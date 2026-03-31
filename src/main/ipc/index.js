const { registerAppHandlers } = require('./app');
const { registerScannerHandlers } = require('./scanner');

function registerAllHandlers(mainWindow) {
  registerAppHandlers();
  registerScannerHandlers(mainWindow);
}

module.exports = { registerAllHandlers };
