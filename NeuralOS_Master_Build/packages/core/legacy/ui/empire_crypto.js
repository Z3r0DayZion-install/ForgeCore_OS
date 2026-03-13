/**
 * Secure IndexedDB Wrapper for ForgeCore OS
 * Encrypts all offline data utilizing Web Crypto API (AES-GCM).
 */
export class SecureDB {
    constructor(dbName = 'ForgeCoreSecureDB') {
        this.dbName = dbName;
        this.db = null;
        this.key = null; // CryptoKey
    }

    async init() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.dbName, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('Vault')) {
                    db.createObjectStore('Vault');
                }
            };
            req.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };
            req.onerror = () => reject('Failed to open IndexedDB');
        });
    }

    // Derive key from Master Passphrase
    async deriveKey(passphrase) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(passphrase),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        // Static salt for local isolation, ideally dynamically handled per OS instance
        const salt = enc.encode('ForgeCore_Sovereign_Salt_v2');

        this.key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    // Encrypt and save
    async set(key, valueObj) {
        if (!this.key || !this.db) throw new Error("DB or Key not initialized");

        const pt = new TextEncoder().encode(JSON.stringify(valueObj));
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const ct = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            this.key,
            pt
        );

        const payload = {
            iv: Array.from(iv),
            data: Array.from(new Uint8Array(ct))
        };

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('Vault', 'readwrite');
            const store = tx.objectStore('Vault');
            const req = store.put(payload, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject('Failed to write to Secure DB');
        });
    }

    async delete(key) {
        if (!this.db) throw new Error("DB not initialized");
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('Vault', 'readwrite');
            const store = tx.objectStore('Vault');
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject('Failed to delete from Secure DB');
        });
    }

    // Retrieve and decrypt
    async get(key) {
        if (!this.key || !this.db) throw new Error("DB or Key not initialized");

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('Vault', 'readonly');
            const store = tx.objectStore('Vault');
            const req = store.get(key);

            req.onsuccess = async () => {
                if (!req.result) return resolve(null); // Not found
                try {
                    const payload = req.result;
                    const iv = new Uint8Array(payload.iv);
                    const ct = new Uint8Array(payload.data);

                    const pt = await crypto.subtle.decrypt(
                        { name: 'AES-GCM', iv: iv },
                        this.key,
                        ct
                    );

                    const str = new TextDecoder().decode(pt);
                    resolve(JSON.parse(str));
                } catch (e) {
                    reject('Decryption Failed - Tampering detected or wrong passphrase');
                }
            };
            req.onerror = () => reject('Failed to read from Secure DB');
        });
    }
}

export const CryptoDB = new SecureDB();
