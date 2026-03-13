const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const OUTPUT_FILE = path.join(__dirname, '..', 'proof_bundle', 'OMEGA_FREEZE_HASHES.txt');

/**
 * Recursive file walker to find build assets.
 * @param {string} dir
 * @param {string[]} fileList
 * @returns {string[]}
 */
function walk(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
                walk(filePath, fileList);
            }
        } else {
            // Include only build assets according to spec (§9.10)
            if (['.html', '.js', '.css', '.wasm', '.json'].includes(path.extname(file))) {
                fileList.push(filePath);
            }
        }
    });
    return fileList;
}

/**
 * Calculate SHA-256 hash for a file.
 * @param {string} filePath
 * @returns {string}
 */
function calculateHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

function run() {
    console.log('[PROOF-RUNNER] Scanning packages for build assets...');
    const assets = walk(PACKAGES_DIR);
    const hashes = assets.map(asset => {
        const relativePath = path.relative(PACKAGES_DIR, asset);
        const hash = calculateHash(asset);
        return `${hash}  ${relativePath}`;
    });

    if (!fs.existsSync(path.dirname(OUTPUT_FILE))) {
        fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, hashes.join('\n') + '\n');
    console.log(`[PROOF-RUNNER] SHA-256 list generated: ${OUTPUT_FILE}`);
    console.log(`[PROOF-RUNNER] Total assets hashed: ${assets.length}`);
}

run();
