"use strict";

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * DECENTRALIZED IDENTITY SYSTEM v3.0
 * Self-sovereign identity management with blockchain integration
 * Implements DID (Decentralized Identifiers) and VC (Verifiable Credentials)
 */

class DecentralizedIdentity {
    constructor() {
        this.didMethod = 'did:forgecore';
        this.didRegistry = new Map();
        this.ledgerPath = path.join(__dirname, '..', 'vaults', 'IDENTITY_LEDGER.json');
        this.networkNodes = [];
        this.consensusProtocol = 'Proof-of-Authority';
        this.blockchain = [];
    }

    // Initialize decentralized identity system
    async initialize() {
        console.log("[DID_SYS] Initializing decentralized identity system...");
        
        // Load existing identity ledger
        await this._loadIdentityLedger();
        
        // Initialize blockchain
        await this._initializeBlockchain();
        
        // Connect to network nodes
        await this._connectToNetwork();
        
        console.log("[DID_SYS] Decentralized identity system initialized");
        return {
            networkSize: this.networkNodes.length,
            blockchainHeight: this.blockchain.length,
            didMethod: this.didMethod
        };
    }

    // Create new decentralized identity
    async createIdentity(attributes = {}) {
        const keyPair = await this._generateKeyPair();
        const did = this._generateDID(keyPair.publicKey);
        
        const identityDocument = {
            '@context': ['https://www.w3.org/ns/did/v1'],
            id: did,
            verificationMethod: [{
                id: `${did}#key-1`,
                type: 'Ed25519VerificationKey2018',
                controller: did,
                publicKeyJwk: keyPair.publicKeyJwk
            }],
            authentication: [`${did}#key-1`],
            assertionMethod: [`${did}#key-1`],
            service: [],
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            ...attributes
        };
        
        // Register on blockchain
        const registration = await this._registerIdentity(did, identityDocument, keyPair.privateKey);
        
        return {
            did: did,
            identityDocument: identityDocument,
            keyPair: {
                publicKey: keyPair.publicKey,
                privateKey: keyPair.privateKey
            },
            registration: registration,
            selfSovereign: true
        };
    }

    // Resolve DID to identity document
    async resolveDID(did) {
        // Check local registry first
        if (this.didRegistry.has(did)) {
            return this.didRegistry.get(did);
        }
        
        // Query blockchain network
        const identityDocument = await this._resolveFromNetwork(did);
        
        if (identityDocument) {
            this.didRegistry.set(did, identityDocument);
            return identityDocument;
        }
        
        throw new Error(`DID not found: ${did}`);
    }

    // Issue verifiable credential
    async issueCredential(issuerDID, subjectDID, credentialData, issuerPrivateKey) {
        const credential = {
            '@context': [
                'https://www.w3.org/2018/credentials/v1',
                'https://www.w3.org/2018/credentials/examples/v1'
            ],
            id: `urn:uuid:${crypto.randomUUID()}`,
            type: ['VerifiableCredential'],
            issuer: issuerDID,
            issuanceDate: new Date().toISOString(),
            credentialSubject: {
                id: subjectDID,
                ...credentialData
            }
        };
        
        // Sign credential
        const signature = await this._signCredential(credential, issuerPrivateKey);
        credential.proof = signature;
        
        // Store on blockchain
        const credentialHash = await this._storeCredential(credential);
        
        return {
            credential: credential,
            hash: credentialHash,
            blockchainStored: true,
            verifiable: true
        };
    }

    // Verify verifiable credential
    async verifyCredential(credential) {
        try {
            // Resolve issuer DID
            const issuerDID = credential.issuer;
            const issuerDocument = await this.resolveDID(issuerDID);
            
            // Verify signature
            const isValidSignature = await this._verifySignature(
                credential,
                credential.proof,
                issuerDocument
            );
            
            // Check credential status on blockchain
            const isRevoked = await this._checkCredentialStatus(credential.id);
            
            // Verify credential subject
            const subjectDID = credential.credentialSubject.id;
            const subjectDocument = await this.resolveDID(subjectDID);
            
            return {
                valid: isValidSignature && !isRevoked,
                issuerVerified: !!issuerDocument,
                subjectVerified: !!subjectDocument,
                revoked: isRevoked,
                verificationTime: new Date().toISOString()
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message,
                verificationTime: new Date().toISOString()
            };
        }
    }

    // Create decentralized identity presentation
    async createPresentation(credentials, holderPrivateKey, holderDID) {
        const presentation = {
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            type: ['VerifiablePresentation'],
            holder: holderDID,
            verifiableCredential: credentials,
            issuanceDate: new Date().toISOString()
        };
        
        // Sign presentation
        const signature = await this._signPresentation(presentation, holderPrivateKey);
        presentation.proof = signature;
        
        return {
            presentation: presentation,
            credentialsCount: credentials.length,
            holderVerified: true
        };
    }

    // Verify presentation
    async verifyPresentation(presentation) {
        try {
            // Resolve holder DID
            const holderDID = presentation.holder;
            const holderDocument = await this.resolveDID(holderDID);
            
            // Verify presentation signature
            const isValidSignature = await this._verifyPresentationSignature(
                presentation,
                presentation.proof,
                holderDocument
            );
            
            // Verify all credentials in presentation
            const credentialVerifications = [];
            for (const credential of presentation.verifiableCredential) {
                const verification = await this.verifyCredential(credential);
                credentialVerifications.push(verification);
            }
            
            const allCredentialsValid = credentialVerifications.every(v => v.valid);
            
            return {
                valid: isValidSignature && allCredentialsValid,
                holderVerified: !!holderDocument,
                credentialsValid: allCredentialsValid,
                credentialCount: presentation.verifiableCredential.length,
                verificationTime: new Date().toISOString()
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message,
                verificationTime: new Date().toISOString()
            };
        }
    }

    // Update identity document
    async updateIdentity(did, updates, privateKey) {
        const currentDocument = await this.resolveDID(did);
        
        const updatedDocument = {
            ...currentDocument,
            ...updates,
            updated: new Date().toISOString()
        };
        
        // Sign update
        const signature = await this._signDocument(updatedDocument, privateKey);
        updatedDocument.proof = signature;
        
        // Broadcast update to network
        const updateResult = await this._broadcastUpdate(did, updatedDocument);
        
        return {
            updated: updateResult.success,
            document: updatedDocument,
            blockHeight: updateResult.blockHeight
        };
    }

    // Revoke credential
    async revokeCredential(credentialHash, issuerPrivateKey, reason = '') {
        const revocation = {
            credentialHash: credentialHash,
            revokedAt: new Date().toISOString(),
            reason: reason,
            revoker: await this._getSignerDID(issuerPrivateKey)
        };
        
        // Sign revocation
        const signature = await this._signRevocation(revocation, issuerPrivateKey);
        revocation.proof = signature;
        
        // Store revocation on blockchain
        const revocationResult = await this._storeRevocation(revocation);
        
        return {
            revoked: revocationResult.success,
            revocationId: revocationResult.revocationId,
            timestamp: revocation.revokedAt
        };
    }

    // --- Internal DID methods ---

    async _generateKeyPair() {
        const privateKey = crypto.randomBytes(32);
        const publicKey = crypto.createPublicKey({
            key: privateKey,
            format: 'der',
            type: 'pkcs8'
        });
        
        return {
            privateKey: privateKey.toString('hex'),
            publicKey: publicKey.export({ format: 'jwk' }),
            publicKeyJwk: publicKey.export({ format: 'jwk' })
        };
    }

    _generateDID(publicKeyJwk) {
        const publicKeyHash = crypto.createHash('sha256')
            .update(JSON.stringify(publicKeyJwk))
            .digest('hex');
        
        return `${this.didMethod}:${publicKeyHash.substring(0, 16)}`;
    }

    async _registerIdentity(did, document, privateKey) {
        const block = {
            index: this.blockchain.length,
            timestamp: Date.now(),
            operation: 'IDENTITY_CREATE',
            did: did,
            document: document,
            signature: await this._signDocument(document, privateKey),
            previousHash: this._getLastBlockHash()
        };
        
        const blockHash = this._calculateBlockHash(block);
        block.hash = blockHash;
        
        // Add to blockchain
        this.blockchain.push(block);
        
        // Update registry
        this.didRegistry.set(did, document);
        
        return {
            blockHeight: block.index,
            blockHash: blockHash,
            confirmed: true
        };
    }

    async _resolveFromNetwork(did) {
        // Query network nodes for DID
        for (const node of this.networkNodes) {
            try {
                const response = await this._queryNode(node, 'resolve', { did });
                if (response.success) {
                    return response.document;
                }
            } catch (error) {
                console.warn(`Failed to query node ${node}:`, error.message);
            }
        }
        
        return null;
    }

    async _signCredential(credential, privateKey) {
        const credentialCopy = { ...credential };
        delete credentialCopy.proof;
        
        const credentialHash = crypto.createHash('sha256')
            .update(JSON.stringify(credentialCopy))
            .digest();
        
        const signature = crypto.sign('sha256', credentialHash, Buffer.from(privateKey, 'hex'));
        
        return {
            type: 'Ed25519Signature2018',
            created: new Date().toISOString(),
            proofPurpose: 'assertionMethod',
            verificationMethod: `${credential.issuer}#key-1`,
            jws: this._createJWS(credentialHash, signature)
        };
    }

    async _verifySignature(credential, proof, issuerDocument) {
        try {
            const credentialCopy = { ...credential };
            delete credentialCopy.proof;
            
            const credentialHash = crypto.createHash('sha256')
                .update(JSON.stringify(credentialCopy))
                .digest();
            
            const publicKeyJwk = issuerDocument.verificationMethod[0].publicKeyJwk;
            const publicKey = crypto.createPublicKey({ key: publicKeyJwk, format: 'jwk' });
            
            return crypto.verify('sha256', credentialHash, publicKey, Buffer.from(proof.jws.split('.')[2], 'base64'));
        } catch (error) {
            return false;
        }
    }

    async _storeCredential(credential) {
        const block = {
            index: this.blockchain.length,
            timestamp: Date.now(),
            operation: 'CREDENTIAL_ISSUE',
            credential: credential,
            hash: crypto.createHash('sha256').update(JSON.stringify(credential)).digest('hex'),
            previousHash: this._getLastBlockHash()
        };
        
        block.hash = this._calculateBlockHash(block);
        this.blockchain.push(block);
        
        return block.hash;
    }

    async _checkCredentialStatus(credentialId) {
        // Check if credential is revoked
        for (const block of this.blockchain) {
            if (block.operation === 'CREDENTIAL_REVOKE' && 
                block.credentialHash === credentialId) {
                return true;
            }
        }
        
        return false;
    }

    _calculateBlockHash(block) {
        const blockData = {
            index: block.index,
            timestamp: block.timestamp,
            operation: block.operation,
            previousHash: block.previousHash
        };
        
        return crypto.createHash('sha256')
            .update(JSON.stringify(blockData))
            .digest('hex');
    }

    _getLastBlockHash() {
        return this.blockchain.length > 0 ? 
            this.blockchain[this.blockchain.length - 1].hash : 
            '0'.repeat(64);
    }

    async _loadIdentityLedger() {
        try {
            if (fs.existsSync(this.ledgerPath)) {
                const ledgerData = fs.readFileSync(this.ledgerPath, 'utf8');
                const ledger = JSON.parse(ledgerData);
                
                this.blockchain = ledger.blockchain || [];
                this.didRegistry = new Map(ledger.identities || []);
            }
        } catch (error) {
            console.warn('[DID_SYS] Failed to load identity ledger:', error.message);
        }
    }

    async _saveIdentityLedger() {
        try {
            const ledgerData = {
                blockchain: this.blockchain,
                identities: Array.from(this.didRegistry.entries()),
                lastUpdated: new Date().toISOString()
            };
            
            fs.writeFileSync(this.ledgerPath, JSON.stringify(ledgerData, null, 2));
        } catch (error) {
            console.error('[DID_SYS] Failed to save identity ledger:', error.message);
        }
    }

    async _initializeBlockchain() {
        if (this.blockchain.length === 0) {
            // Genesis block
            const genesisBlock = {
                index: 0,
                timestamp: Date.now(),
                operation: 'GENESIS',
                data: 'ForgeCore DID System Genesis',
                previousHash: '0'.repeat(64),
                hash: '0'.repeat(64)
            };
            
            genesisBlock.hash = this._calculateBlockHash(genesisBlock);
            this.blockchain.push(genesisBlock);
        }
    }

    async _connectToNetwork() {
        // Simulate network connection
        this.networkNodes = [
            'node1.forgecore.network:3001',
            'node2.forgecore.network:3002',
            'node3.forgecore.network:3003'
        ];
    }

    _createJWS(payload, signature) {
        const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', crv: 'Ed25519' })).toString('base64url');
        const payloadBase64 = payload.toString('base64url');
        const signatureBase64 = signature.toString('base64url');
        
        return `${header}.${payloadBase64}.${signatureBase64}`;
    }

    // Additional utility methods
    async _queryNode(node, operation, data) {
        // Simulate network query
        return {
            success: Math.random() > 0.3,
            document: null
        };
    }

    async _signDocument(document, privateKey) {
        const documentHash = crypto.createHash('sha256')
            .update(JSON.stringify(document))
            .digest();
        
        const signature = crypto.sign('sha256', documentHash, Buffer.from(privateKey, 'hex'));
        
        return {
            type: 'Ed25519Signature2018',
            created: new Date().toISOString(),
            proofPurpose: 'authentication',
            jws: this._createJWS(documentHash, signature)
        };
    }

    async _signPresentation(presentation, privateKey) {
        const presentationCopy = { ...presentation };
        delete presentationCopy.proof;
        
        const presentationHash = crypto.createHash('sha256')
            .update(JSON.stringify(presentationCopy))
            .digest();
        
        const signature = crypto.sign('sha256', presentationHash, Buffer.from(privateKey, 'hex'));
        
        return {
            type: 'Ed25519Signature2018',
            created: new Date().toISOString(),
            proofPurpose: 'authentication',
            verificationMethod: `${presentation.holder}#key-1`,
            jws: this._createJWS(presentationHash, signature)
        };
    }

    async _verifyPresentationSignature(presentation, proof, holderDocument) {
        try {
            const presentationCopy = { ...presentation };
            delete presentationCopy.proof;
            
            const presentationHash = crypto.createHash('sha256')
                .update(JSON.stringify(presentationCopy))
                .digest();
            
            const publicKeyJwk = holderDocument.verificationMethod[0].publicKeyJwk;
            const publicKey = crypto.createPublicKey({ key: publicKeyJwk, format: 'jwk' });
            
            return crypto.verify('sha256', presentationHash, publicKey, Buffer.from(proof.jws.split('.')[2], 'base64'));
        } catch (error) {
            return false;
        }
    }

    async _broadcastUpdate(did, document) {
        const block = {
            index: this.blockchain.length,
            timestamp: Date.now(),
            operation: 'IDENTITY_UPDATE',
            did: did,
            document: document,
            previousHash: this._getLastBlockHash()
        };
        
        block.hash = this._calculateBlockHash(block);
        this.blockchain.push(block);
        
        await this._saveIdentityLedger();
        
        return {
            success: true,
            blockHeight: block.index
        };
    }

    async _storeRevocation(revocation) {
        const block = {
            index: this.blockchain.length,
            timestamp: Date.now(),
            operation: 'CREDENTIAL_REVOKE',
            revocation: revocation,
            previousHash: this._getLastBlockHash()
        };
        
        block.hash = this._calculateBlockHash(block);
        this.blockchain.push(block);
        
        await this._saveIdentityLedger();
        
        return {
            success: true,
            revocationId: block.hash
        };
    }

    async _signRevocation(revocation, privateKey) {
        const revocationHash = crypto.createHash('sha256')
            .update(JSON.stringify(revocation))
            .digest();
        
        const signature = crypto.sign('sha256', revocationHash, Buffer.from(privateKey, 'hex'));
        
        return {
            type: 'Ed25519Signature2018',
            created: new Date().toISOString(),
            proofPurpose: 'revocation',
            jws: this._createJWS(revocationHash, signature)
        };
    }

    async _getSignerDID(privateKey) {
        // Derive DID from private key
        const publicKey = crypto.createPublicKey({
            key: Buffer.from(privateKey, 'hex'),
            format: 'der',
            type: 'pkcs8'
        });
        
        const publicKeyJwk = publicKey.export({ format: 'jwk' });
        return this._generateDID(publicKeyJwk);
    }
}

module.exports = DecentralizedIdentity;
