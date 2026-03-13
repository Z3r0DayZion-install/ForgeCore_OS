/**
 * DYNAMIC DNA SEAL GENERATOR v1.0
 * Generates hardware-bound DNA seals at runtime instead of using hardcoded values
 */

const crypto = require('crypto');
const DNALock = require('./security_dna');

class DynamicDNASeal {
    constructor() {
        this.currentSeal = null;
        this.lastGenerated = null;
        this.cacheTimeout = 300000; // 5 minutes
    }

    /**
     * Generate a new DNA seal based on current hardware
     */
    generateSeal() {
        try {
            // Get current machine DNA
            const machineDNA = DNALock.getMachineID();
            
            // Add timestamp for uniqueness
            const timestamp = Date.now().toString();
            
            // Create seal with hardware binding
            const sealData = `${machineDNA}|${timestamp}`;
            const seal = crypto.createHash('sha256').update(sealData).digest('hex');
            
            this.currentSeal = seal;
            this.lastGenerated = Date.now();
            
            console.log('[DNA_SEAL] Generated new hardware-bound seal');
            return seal;
        } catch (error) {
            console.error('[DNA_SEAL] Failed to generate seal:', error.message);
            throw new Error('DNA seal generation failed');
        }
    }

    /**
     * Verify current DNA seal against hardware
     */
    verifySeal(storedSeal) {
        try {
            if (!storedSeal || storedSeal === 'GENERATED_AT_RUNTIME') {
                return false;
            }

            // Generate current seal
            const currentSeal = this.generateSeal();
            
            // Compare with stored seal
            const isValid = currentSeal === storedSeal;
            
            if (isValid) {
                console.log('[DNA_SEAL] Hardware binding verified');
            } else {
                console.warn('[DNA_SEAL] Hardware binding failed - possible tampering');
            }
            
            return isValid;
        } catch (error) {
            console.error('[DNA_SEAL] Verification failed:', error.message);
            return false;
        }
    }

    /**
     * Get cached seal or generate new one
     */
    getSeal() {
        const now = Date.now();
        
        // Check if cache is valid
        if (this.currentSeal && this.lastGenerated && 
            (now - this.lastGenerated) < this.cacheTimeout) {
            return this.currentSeal;
        }
        
        // Generate new seal
        return this.generateSeal();
    }

    /**
     * Force regeneration of seal
     */
    regenerateSeal() {
        console.log('[DNA_SEAL] Forced regeneration requested');
        return this.generateSeal();
    }

    /**
     * Get seal information for debugging
     */
    getSealInfo() {
        return {
            currentSeal: this.currentSeal ? `${this.currentSeal.substring(0, 8)}...` : null,
            lastGenerated: this.lastGenerated ? new Date(this.lastGenerated).toISOString() : null,
            cacheTimeout: this.cacheTimeout,
            isCached: this.currentSeal && this.lastGenerated && 
                     (Date.now() - this.lastGenerated) < this.cacheTimeout
        };
    }
}

// Singleton instance
const dnaSealGenerator = new DynamicDNASeal();

module.exports = dnaSealGenerator;
