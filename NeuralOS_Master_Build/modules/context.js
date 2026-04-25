/**
 * Shared mutable context – every module reads/writes through this
 * object so there are no circular require() chains.
 */
module.exports = {
    mainWindow: null,
    ptyProcess: null,
    ptyHandlersBound: false,
};
