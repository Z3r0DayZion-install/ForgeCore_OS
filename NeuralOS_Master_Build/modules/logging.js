const fs = require('fs');
const { SESSION_LOG, LOG_FILE } = require('./config');
const ctx = require('./context');

/**
 * Append a typed entry to the session memory log and
 * push a live update to the renderer.
 */
function commitMemory(type, content, metadata = {}) {
    const safeContent = typeof content === 'string' ? content : JSON.stringify(content);
    const entry = {
        timestamp: new Date().toISOString(),
        type,
        content: safeContent,
        metadata,
        seal: process.env.NEURALOS_SEAL?.substring(0, 8)
    };
    fs.appendFileSync(SESSION_LOG, JSON.stringify(entry) + '\n');
    console.log(`[MEMORY] ${type}: ${safeContent.substring(0, 30)}...`);

    if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.webContents.send('memory-update', entry);
    }
}

/**
 * Append a structured proof-log entry to OPERATIONS.log.
 */
function logOperation(op, data) {
    const entry = {
        timestamp: new Date().toISOString(),
        operation: op,
        ...data,
        seal: process.env.NEURALOS_SEAL?.substring(0, 16)
    };
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
    console.log(`[PROOF-LOG] ${op} recorded.`);
}

module.exports = { commitMemory, logOperation };
