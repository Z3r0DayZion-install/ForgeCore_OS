"use strict";

const { spawn } = require('child_process');
const path = require('path');

/**
 * QUANTUM_BRIDGE Module
 * Bridges Node.js to the Rust Quantum Crypto CLI.
 */
class QuantumBridge {
    constructor(rootDir) {
        // Path to the compiled Rust binary
        this.binPath = path.join(rootDir, 'rust_quantum_crypto', 'target', 'release', 'rust_quantum_crypto.exe');
    }

    /**
     * Call the Rust CLI with a JSON command.
     */
    async call(command, params = {}) {
        return new Promise((resolve, reject) => {
            const proc = spawn(this.binPath, [], { stdio: ['pipe', 'pipe', 'inherit'] });
            
            let output = '';
            proc.stdout.on('data', (data) => {
                output += data.toString();
            });

            proc.on('close', (code) => {
                if (code !== 0) {
                    return reject(new Error(`Rust CLI exited with code ${code}`));
                }
                try {
                    const response = JSON.parse(output);
                    if (response.success) {
                        resolve(response.data);
                    } else {
                        reject(new Error(response.error || 'Unknown Rust error'));
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse Rust output: ${output}`));
                }
            });

            // Send JSON request to Rust via stdin
            const request = JSON.stringify({ command, params });
            proc.stdin.write(request);
            proc.stdin.end();
        });
    }

    async generateKeyPair(type = 'Kyber768') {
        return await this.call('gen_key', { type });
    }

    async encrypt(message, publicKey) {
        return await this.call('encrypt', { message, publicKey });
    }

    async decrypt(ciphertext, privateKey) {
        return await this.call('decrypt', { ciphertext, privateKey });
    }

    async sign(message, privateKey) {
        return await this.call('sign', { message, privateKey });
    }

    async verify(message, signature, publicKey) {
        return await this.call('verify', { message, signature, publicKey });
    }
}

module.exports = QuantumBridge;
