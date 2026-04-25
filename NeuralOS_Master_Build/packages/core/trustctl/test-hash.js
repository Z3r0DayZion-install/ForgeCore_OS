const trustctl = require('./index.js');
const path = require('path');
const fs = require('fs');

const testFile = path.join(__dirname, 'package.json');
try {
  const hash = trustctl.calculateHash(testFile);
  console.log(`[TEST-SUCCESS] Hash for package.json: ${hash}`);
} catch (err) {
  console.error('[TEST-FAILED] trustctl failed:', err);
  process.exit(1);
}
