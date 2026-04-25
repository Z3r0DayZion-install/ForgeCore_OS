"use strict";

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * FORGE_GIT Module
 * Handles local version control and bridges Git hashes to TEAR Audit Chain.
 */
class ForgeGit {
    constructor(rootDir, tearEngine, omega) {
        this.rootDir = rootDir;
        this.reposDir = path.join(rootDir, 'repos');
        this.tear = tearEngine;
        this.omega = omega;
    }

    /**
     * Run a git command in a specific repo via OMEGA Broker.
     */
    async run(repo, cmd) {
        const repoPath = path.join(this.reposDir, repo);
        try {
            return await this.omega.exec('user', `git ${cmd}`, { cwd: repoPath });
        } catch (e) {
            console.error(`[FORGE_GIT] Broker command failed: git ${cmd}`, e);
            throw e;
        }
    }

    async initRepo(repoName) {
        const repoPath = path.join(this.reposDir, repoName);
        if (!fs.existsSync(repoPath)) {
            fs.mkdirSync(repoPath, { recursive: true });
        }
        await this.run(repoName, 'init');
        
        // Initial TEAR seal for repo creation
        this.tear.seal('REPO_INIT', { repo: repoName, timestamp: new Date().toISOString() }, { title: `Repo Created: ${repoName}` });
        return { success: true };
    }

    async commit(repoName, message, author = "ARCHITECT_ZERO") {
        try {
            await this.run(repoName, 'add .');
            // Check if there are changes to commit
            const status = await this.run(repoName, 'status --porcelain');
            if (!status) return { success: true, message: "No changes to commit" };

            const result = await this.run(repoName, `commit -m "${message}" --author="${author} <forgecore@local>"`);
            
            // Get the new commit hash
            const hash = await this.run(repoName, 'rev-parse HEAD');

            // CRITICAL: Mirror Git Hash to TEAR Audit Chain
            const container = this.tear.seal('FORGE_COMMIT', {
                repo: repoName,
                commitHash: hash,
                message,
                author
            }, { title: `Commit: ${repoName} [${hash.substring(0, 7)}]` });

            return { 
                success: true, 
                hash, 
                tearFingerprint: container.fingerprint,
                message: "Commit successful and sealed in TEAR chain"
            };
        } catch (e) {
            return { success: false, error: e };
        }
    }

    async getLog(repoName) {
        const logRaw = await this.run(repoName, 'log --pretty=format:"%H|%an|%ar|%s" -n 20');
        if (!logRaw) return [];
        return logRaw.split('\n').map(line => {
            const [hash, author, date, msg] = line.split('|');
            return { hash, author, date, msg };
        });
    }

    async getDiff(repoName, hash) {
        // If hash is provided, diff that commit, otherwise diff working directory
        const cmd = hash ? `show ${hash}` : 'diff';
        return await this.run(repoName, cmd);
    }
}

module.exports = ForgeGit;
