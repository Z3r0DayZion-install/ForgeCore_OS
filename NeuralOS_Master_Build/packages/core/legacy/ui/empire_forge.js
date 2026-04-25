/**
 * Forge Code Browser Module
 */
import { State } from './empire_state.js';
import { API } from './empire_api.js';
import { log } from './empire_app.js';
const escapeActionArg = (value) => String(value == null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
const escapeHtml = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export class ForgeEditor {
    constructor() {
        this.editor = null;
        this.requireLoaded = false;
        this.currentPath = 'NO_FILE_SELECTED';
        this.searchHits = [];
    }

    init() {
        if (this.editor || !window.require) return;

        window.require.config({ paths: { vs: '/vendor/monaco/min/vs' } });
        window.require(['vs/editor/editor.main'], () => {
            this.editor = monaco.editor.create(document.getElementById('forgeMonaco'), {
                value: '',
                language: 'javascript',
                theme: 'vs-dark',
                automaticLayout: true,
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
                minimap: { enabled: false },
                scrollbar: { verticalWidth: 4, horizontalHeight: 4 },
                renderLineHighlight: 'all',
                lineNumbers: 'on',
                roundedSelection: true,
                scrollBeyondLastLine: false,
                readOnly: false
            });

            const loader = document.getElementById('forgeLoading');
            if (loader) loader.style.display = 'none';
            this.requireLoaded = true;
        });
    }

    async loadRepos() {
        this.init();
        try {
            const res = await API.request('/api/forge/repos');
            const repos = await res.json();
            const sel = document.getElementById('forgeRepoSelect');
            if (sel) {
                sel.innerHTML = '<option value="">SELECT_REPOSITORY</option>' +
                    '<option value="vaults">[SYSTEM_VAULTS]</option>' +
                    repos.map(rep => `<option value="${rep}">${rep}</option>`).join('');
                const savedRepo = State.get('forgeRepo');
                if (savedRepo && Array.from(sel.options).some(o => o.value === savedRepo)) {
                    sel.value = savedRepo;
                    this.loadTree(savedRepo, State.get('forgeDir') || '/');
                }
            }
        } catch (e) {
            console.error("Failed to load Forge repos", e);
            const sel = document.getElementById('forgeRepoSelect');
            if (sel && !sel.options.length) {
                sel.innerHTML = '<option value="">REPO_DISCOVERY_FAILED</option><option value="vaults">[SYSTEM_VAULTS]</option>';
            }
            log(`Forge repo discovery failed: ${e && e.message ? e.message : e}`, "ERR");
        }
    }

    async loadTree(repo, dir = '/') {
        repo = repo || document.getElementById('forgeRepoSelect').value;
        if (!repo) return;
        State.set('forgeRepo', repo);
        State.set('forgeDir', dir || '/');

        try {
            const res = await API.request(`/api/forge/tree?repo=${encodeURIComponent(repo)}&dir=${encodeURIComponent(dir)}`);
            const tree = await res.json();
            let html = '';
            const safeRepo = escapeActionArg(repo);

            if (dir !== '/') {
                const up = dir.substring(0, dir.lastIndexOf('/')) || '/';
                const safeUp = escapeActionArg(up);
                html += `<div class="file-card" data-action="loadForgeTree('${safeRepo}', '${safeUp}')">📁 ..</div>`;
            }

            tree.forEach(f => {
                const safePath = escapeActionArg(f.path);
                if (f.type === 'dir') {
                    html += `<div class="file-card" style="color:var(--accent)" data-action="loadForgeTree('${safeRepo}', '${safePath}')">📁 ${f.name}</div>`;
                } else {
                    html += `<div class="file-card" data-action="loadForgeFile('${safeRepo}', '${safePath}')">📄 ${f.name}</div>`;
                }
            });

            document.getElementById('forgeTree').innerHTML = html;
            this.loadHistory(repo);
        } catch (e) {
            console.error("Failed to load Forge tree", e);
            const treeEl = document.getElementById('forgeTree');
            if (treeEl) treeEl.innerHTML = '<div class="dim">FORGE_TREE_UNAVAILABLE</div>';
            log(`Forge tree load failed: ${e && e.message ? e.message : e}`, "ERR");
        }
    }

    async loadFile(repo, filepath) {
        if (!this.editor) {
            this.init();
            setTimeout(() => this.loadFile(repo, filepath), 500);
            return;
        }

        const normalizedPath = String(filepath || '').startsWith('/') ? String(filepath) : `/${String(filepath || '')}`;
        this.currentPath = repo + normalizedPath;
        State.set('forgeRepo', repo);
        const dirPath = normalizedPath.includes('/') ? (normalizedPath.slice(0, normalizedPath.lastIndexOf('/')) || '/') : '/';
        State.set('forgeDir', dirPath);
        State.set('forgePath', normalizedPath);
        const repoSelect = document.getElementById('forgeRepoSelect');
        if (repoSelect) repoSelect.value = repo;
        document.getElementById('forgeCurrentPath').textContent = this.currentPath;

        const loader = document.getElementById('forgeLoading');
        if (loader) {
            loader.style.display = 'flex';
            loader.textContent = 'LOADING...';
        }

        try {
            const response = await API.request(`/api/forge/file?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(normalizedPath)}`);
            const contentType = String(response.headers.get('content-type') || '');
            let res = null;
            if (contentType.includes('application/json')) {
                try {
                    res = await response.json();
                } catch (parseErr) {
                    throw new Error(`Invalid JSON response (status ${response.status})`);
                }
            } else {
                const raw = await response.text();
                res = { error: raw || `HTTP_${response.status}` };
            }

            if (!response.ok) {
                const errMsg = res && res.error ? String(res.error) : `HTTP_${response.status}`;
                log(`Forge Err: ${errMsg}`, "ERR");
                if (loader) {
                    loader.style.display = 'flex';
                    loader.textContent = response.status === 401 ? '[LOCKED]' : `[ERROR ${response.status}]`;
                }
                return;
            }

            if (res.error) {
                log(`Forge Err: ${res.error}`, "ERR");
                if (loader) loader.textContent = '[ERROR]';
                return;
            }

            const ext = normalizedPath.split('.').pop();
            const langMap = { 'js': 'javascript', 'ts': 'typescript', 'html': 'html', 'css': 'css', 'md': 'markdown', 'json': 'json', 'rs': 'rust' };
            const lang = langMap[ext] || 'plaintext';
            const text = res.kind === 'binary'
                ? `[BINARY_ARTIFACT]\nSize: ${res.size} bytes`
                : (typeof res.text === 'string' ? res.text : '');

            // Fix for Monaco Memory Leak: Use Models instead of setValue
            const oldModel = this.editor.getModel();
            if (oldModel) oldModel.dispose();

            const newModel = monaco.editor.createModel(text, lang);
            this.editor.setModel(newModel);

            if (loader) loader.style.display = 'none';
        } catch (e) {
            const errMsg = e && e.message ? e.message : String(e);
            if (loader) {
                loader.style.display = 'flex';
                loader.textContent = `[FAILED] ${String(errMsg).slice(0, 56)}`;
            }
            log(`Forge load failed: ${errMsg}`, "ERR");
            console.error(e);
        }
    }

    async commitFile() {
        if (this.currentPath === 'NO_FILE_SELECTED') return;
        const content = this.editor.getValue();
        const repoSelect = document.getElementById('forgeRepoSelect');
        let repo = repoSelect ? repoSelect.value : '';
        if (!repo && this.currentPath.includes('/')) {
            repo = this.currentPath.split('/')[0];
        }
        if (!repo) {
            log("Select repository before commit.", "WARN");
            return;
        }
        const message = window.EmpireOS && typeof window.EmpireOS.requestTextInput === 'function'
            ? await window.EmpireOS.requestTextInput('COMMIT_MESSAGE_REQUIRED:', {
                title: 'FORGE_COMMIT',
                placeholder: 'commit message',
                native: true
            })
            : prompt("COMMIT_MESSAGE_REQUIRED:");
        if (!message) return;

        log("Sealing changes into Forge TEAR Chain...", "SYS");

        try {
            // 1. Save file content first
            const saveRes = await API.request('/api/forge/save', 'POST', { path: this.currentPath, content });
            const saveData = await saveRes.json();
            if (!saveData.ok) {
                log(`Save Err: ${saveData.error}`, "ERR");
                return;
            }

            if (repo === 'vaults') {
                const vaultName = this.currentPath.split('/')[1];
                if (!vaultName) {
                    log("Seal Err: Missing vault context.", "ERR");
                    return;
                }
                const sealRes = await API.request('/api/tear/seal', 'POST', { vault: vaultName });
                const sealData = await sealRes.json();
                if (sealData && sealData.success) {
                    log(`Vault Seal Successful: ${vaultName}`, "OK");
                } else {
                    log(`Seal Err: ${(sealData && sealData.error) || 'unknown'}`, "ERR");
                }
                return;
            }

            // 2. Perform Git Commit + TEAR Seal
            const commitRes = await API.request('/api/forge/git/commit', 'POST', { 
                repo, 
                message,
                author: 'ARCHITECT_ZERO'
            });
            const commitData = await commitRes.json();
            
            if (commitData.success) {
                log(`Forge Commit Successful: [${commitData.hash.substring(0, 7)}]`, "OK");
                log(`TEAR Fingerprint: ${commitData.tearFingerprint.substring(0, 16)}...`, "KERN");
                this.loadHistory(repo);
            } else {
                log(`Commit Err: ${commitData.error}`, "ERR");
            }
        } catch (e) {
            log("Forge connection failed.", "ERR");
        }
    }

    async initRepo() {
        const repo = document.getElementById('forgeRepoSelect').value;
        if (!repo || repo === 'vaults') return;
        
        log(`Initializing Sovereign Repo: ${repo}`, "SYS");
        try {
            const res = await API.request('/api/forge/git/init', 'POST', { repo });
            const data = await res.json();
            if (data.success) log("Repo Initialized and Sealed in TEAR.", "OK");
            else log(`Init Err: ${data.error}`, "ERR");
        } catch (e) { log("Connection lost.", "ERR"); }
    }

    async loadHistory(repo) {
        repo = repo || document.getElementById('forgeRepoSelect').value;
        if (!repo || repo === 'vaults') return;

        try {
            const res = await API.request(`/api/forge/git/log?repo=${repo}`);
            const history = await res.json();
            const histEl = document.getElementById('forgeHistory');
            if (!histEl) return;

            if (history.length === 0) {
                histEl.innerHTML = '<div class="dim">NO_HISTORY_FOUND</div>';
                return;
            }

            histEl.innerHTML = history.map(h => `
                <div class="history-item" data-action="loadForgeDiff('${escapeActionArg(repo)}', '${escapeActionArg(h.hash)}')">
                    <div style="color:var(--accent); font-size:0.6rem;">[${h.hash.substring(0, 7)}]</div>
                    <div style="font-size:0.7rem; margin:2px 0;">${h.msg}</div>
                    <div style="color:var(--dim); font-size:0.5rem;">${h.author} • ${h.date}</div>
                </div>
            `).join('');
        } catch (e) { console.error("Failed to load history", e); }
    }

    async loadDiff(repo, hash) {
        log(`Analyzing Quantum Diff: ${hash.substring(0, 7)}`, "SYS");
        try {
            const res = await API.request(`/api/forge/git/diff?repo=${repo}&hash=${hash}`);
            const data = await res.json();
            const rawDiff = String(data && data.diff ? data.diff : '');
            const trimmed = rawDiff.length > 12000 ? `${rawDiff.slice(0, 12000)}\n\n...[TRUNCATED]` : rawDiff;
            const history = document.getElementById('forgeHistory');
            if (history) {
                history.innerHTML = `
                    <div style="font-size:0.62rem; color:var(--dim); letter-spacing:2px; margin-bottom:8px; text-align:center;">
                        DIFF_PREVIEW_${escapeHtml(hash.substring(0, 7))}
                    </div>
                    <pre id="forgeDiffOutput" style="margin:0; white-space:pre-wrap; word-break:break-word; font-size:0.6rem; line-height:1.35; color:#cfd7df;">${escapeHtml(trimmed || 'NO_DIFF_OUTPUT')}</pre>
                `;
            }
            log(`Diff loaded: ${hash.substring(0, 7)}`, "OK");
        } catch (e) { log("Diff analysis failed.", "ERR"); }
    }

    async executeFile() {
        if (this.currentPath === 'NO_FILE_SELECTED') return;
        log(`Executing Artifact: ${this.currentPath}`, "SYS");
        try {
            const response = await API.request('/api/forge/execute', 'POST', { path: this.currentPath });
            const res = await response.json();
            if (res.ok) {
                const launchInfo = `${res.command || 'PROCESS'}${Array.isArray(res.args) && res.args.length ? ` ${res.args.join(' ')}` : ''}`;
                log(`Execution Initialized: ${launchInfo}`, "OK");
            }
            else log(`Exec Err: ${res.error}`, "ERR");
        } catch (e) {
            log("Execution connection failed.", "ERR");
        }
    }

    async search() {
        const repoEl = document.getElementById('forgeRepoSelect');
        const qEl = document.getElementById('forgeSearchInput');
        const historyEl = document.getElementById('forgeHistory');
        const repo = repoEl ? repoEl.value : '';
        const query = qEl ? qEl.value.trim() : '';
        State.set('forgeSearch', query);

        if (!repo) {
            log("Select repository before search.", "WARN");
            return;
        }
        if (!query) {
            log("Enter search query.", "WARN");
            return;
        }

        try {
            const res = await API.request(`/api/forge/search?repo=${encodeURIComponent(repo)}&q=${encodeURIComponent(query)}`);
            const hits = await res.json();
            this.searchHits = Array.isArray(hits) ? hits : [];

            if (!historyEl) return;
            historyEl.innerHTML = '';

            if (!this.searchHits.length) {
                historyEl.innerHTML = '<div class="dim">NO_MATCHES_FOUND</div>';
                log(`Search complete: 0 results for "${query}"`, "SYS");
                return;
            }

            this.searchHits.forEach((hit) => {
                const rawPath = String(hit.file || '');
                const filePath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
                const snippet = String(hit.snippet || '');

                const row = document.createElement('div');
                row.className = 'history-item';
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => this.loadFile(repo, filePath));

                const fileNode = document.createElement('div');
                fileNode.style.cssText = 'color:var(--accent); font-size:0.6rem;';
                fileNode.textContent = filePath;

                const snippetNode = document.createElement('div');
                snippetNode.style.cssText = 'font-size:0.62rem; margin:4px 0; color:var(--dim);';
                snippetNode.textContent = snippet;

                row.appendChild(fileNode);
                row.appendChild(snippetNode);
                historyEl.appendChild(row);
            });

            log(`Search complete: ${this.searchHits.length} results for "${query}"`, "OK");
        } catch (e) {
            log("Forge search failed.", "ERR");
        }
    }

    layout() {
        if (this.editor) {
            setTimeout(() => this.editor.layout(), 100);
        }
    }
}
