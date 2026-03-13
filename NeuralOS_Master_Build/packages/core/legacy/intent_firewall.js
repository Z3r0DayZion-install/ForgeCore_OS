"use strict";

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * INTENT_FIREWALL Module
 * Constitutional policy engine for ForgeCore™ OMEGA Kernel.
 */
class IntentFirewall {
    constructor(rootDir, tearEngine) {
        this.rootDir = rootDir;
        this.tear = tearEngine;
        this.policyPath = path.join(rootDir, 'core', 'omega_policy.json');
        this.policies = this.loadPolicies();
    }

    loadPolicies() {
        try {
            if (!fs.existsSync(this.policyPath)) {
                return [];
            }
            return JSON.parse(fs.readFileSync(this.policyPath, 'utf8'));
        } catch (e) {
            console.error("[OMEGA] Failed to load policies:", e.message);
            return []; // Deny-by-default if load fails
        }
    }

    /**
     * Evaluate an intent against the active policies.
     * @param {object} intent { entity, action, resource, data }
     * @returns {object} { allowed: boolean, effect: string, reason: string }
     */
    evaluate(intent) {
        const { entity, action, resource } = intent;
        
        // Find matching policy (last one wins for overrides, but DENY is prioritized)
        const matches = this.policies.filter(p => 
            (p.entity === '*' || p.entity === entity) &&
            this.actionMatches(p.action, action) &&
            (this.resourceMatches(p.resource, resource))
        );

        let finalEffect = 'DENY';
        let matchedPolicy = null;

        if (matches.length > 0) {
            // Priority 1: Explicit DENY
            const explicitDeny = matches.find(p => p.effect === 'DENY');
            if (explicitDeny) {
                finalEffect = 'DENY';
                matchedPolicy = explicitDeny;
            } else {
                // Priority 2: Explicit ALLOW
                const explicitAllow = matches.find(p => p.effect === 'ALLOW');
                if (explicitAllow) {
                    finalEffect = 'ALLOW';
                    matchedPolicy = explicitAllow;
                }
            }
        }

        const allowed = finalEffect === 'ALLOW';
        const result = {
            allowed,
            effect: finalEffect,
            reason: matchedPolicy ? `Policy match: ${matchedPolicy.id || 'anonymous'}` : 'No matching allow policy found (Deny-by-Default)'
        };

        // Audit the evaluation in the TEAR chain
        this.tear.seal('POLICY_EVAL', { intent, result }, { title: `Firewall: ${action} [${finalEffect}]` });

        return result;
    }

    resourceMatches(pattern, resource) {
        if (!pattern || pattern === '*') return true;
        if (!resource) return false;

        const normalizedPattern = String(pattern).replace(/\\/g, '/');
        const normalizedResource = String(resource).replace(/\\/g, '/');
        return this.globToRegExp(normalizedPattern).test(normalizedResource);
    }

    actionMatches(pattern, action) {
        if (!pattern || pattern === '*') return true;
        if (!action) return false;

        return this.globToRegExp(pattern).test(action);
    }

    globToRegExp(globPattern) {
        const escaped = String(globPattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&');
        const regexSource = '^' + escaped.replace(/\*/g, '.*') + '$';
        return new RegExp(regexSource, 'i');
    }
}

module.exports = IntentFirewall;
