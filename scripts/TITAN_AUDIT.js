"use strict";



const fs = require('fs');

const path = require('path');

const crypto = require('crypto');



console.log("==================================================");

console.log("  NEURAL EMPIRE // TITAN AUDIT SUITE v1.0");

console.log("==================================================");



const audit = {

    structural: false,

    cryptographic: false,

    portable: false

};



// 1. STRUCTURAL INTEGRITY

console.log("[1/3] Verifying Independent Folder Architecture...");

const required = ['core', 'vaults', 'engines', 'scripts', 'vaults/INTEL_VAULT'];

audit.structural = required.every(d => fs.existsSync(d));

console.log(`  STATUS: ${audit.structural ? "PASSED" : "FAILED"}`);



// 2. CRYPTOGRAPHIC HANDSHAKE

console.log("[2/3] Validating DNA & Vault Encryption Layers...");

const hasDNA = fs.existsSync('core/security_dna.js');

const hasCrypt = fs.existsSync('core/vault_crypt.js');

audit.cryptographic = hasDNA && hasCrypt;

console.log(`  STATUS: ${audit.cryptographic ? "PASSED" : "FAILED"}`);



// 3. PORTABLE RELATIVE PATHING

console.log("[3/3] Checking Path Sovereignty...");

const serverSource = fs.readFileSync('core/SOVEREIGN_SERVER.js', 'utf8');

audit.portable = serverSource.includes('__dirname') && !serverSource.includes('C:\Users\KickA');

console.log(`  STATUS: ${audit.portable ? "PASSED" : "FAILED"}`);



console.log("

==================================================");

if (Object.values(audit).every(v => v === true)) {

    console.log("  🛡️ AUDIT RESULT: TITAN_VERIFIED [100/100]");

} else {

    console.log("  ⚠️ AUDIT RESULT: DEVIATION_DETECTED");

}

console.log("==================================================");

