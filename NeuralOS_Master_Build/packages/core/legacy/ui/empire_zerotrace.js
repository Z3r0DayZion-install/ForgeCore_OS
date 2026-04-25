import { State } from './empire_state.js';
import { apiFetch } from './empire_api.js';

class ZeroTraceModule {
    constructor() {
        this.dropzone = document.getElementById('ztDropzone');
        this.statusPanel = document.getElementById('ztStatusPanel');
        this.fileListPanel = document.getElementById('ztFileListPanel');
        this.btnPurge = document.getElementById('ztBtnPurge');
        this.mainPanel = document.getElementById('ztMainPanel');

        this.queuedFiles = [];
        this.isPurging = false;

        // Matrix Canvas logic
        this.canvas = document.getElementById('zerotraceMatrixCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.drops = [];
        this.matrixChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*)*&^%+-/~{[|`]}".split("");
        this.fontSize = 14;
        this.matrixColor = '#0f0';
        this.animationTimer = null;

        this.init();
    }

    init() {
        if (!this.dropzone) return;

        this.setupCanvas();
        this.setupEventListeners();

        // Pause/play Matrix fx based on tab visibility
        State.subscribe((key, state) => {
            if (key === 'activeTab' || key === 'visibility') {
                if (state.activeTab === 'zerotrace' && state.visibility !== 'hidden') {
                    this.startMatrix();
                } else {
                    this.stopMatrix();
                }
            }
        });

        // Ensure proper layout if resizing
        window.addEventListener('resize', () => {
            if (this.canvas) {
                this.canvas.height = this.canvas.parentElement.clientHeight;
                this.canvas.width = this.canvas.parentElement.clientWidth;
                const newCols = this.canvas.width / this.fontSize;
                for (let x = this.drops.length; x < newCols; x++) { this.drops[x] = 1; }
            }
        });
    }

    log(msg, type = 'info') {
        const line = document.createElement('div');
        line.style.marginBottom = '4px';

        if (type === 'success') line.style.color = '#0f0';
        else if (type === 'warning') line.style.color = 'yellow';
        else if (type === 'error') { line.style.color = '#ff003c'; line.style.textShadow = '0 0 10px #ff003c'; }
        else line.style.color = '#888';

        line.textContent = `>[SYSTEM] ${msg}`;
        this.statusPanel.appendChild(line);
        this.statusPanel.scrollTop = this.statusPanel.scrollHeight;
    }

    setupEventListeners() {
        this.dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!this.isPurging) {
                this.dropzone.style.borderColor = '#0f0';
                this.dropzone.style.background = 'rgba(0, 255, 0, 0.1)';
            }
        });

        this.dropzone.addEventListener('dragleave', () => {
            this.dropzone.style.borderColor = '#003300';
            this.dropzone.style.background = 'rgba(0, 50, 0, 0.1)';
        });

        this.dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropzone.style.borderColor = '#003300';
            this.dropzone.style.background = 'rgba(0, 50, 0, 0.1)';
            if (this.isPurging) return;
            this.handleDrop(e.dataTransfer);
        });

        this.dropzone.addEventListener('click', () => {
            if (this.isPurging) return;
            let input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.onchange = (e) => this.handleFiles(Array.from(e.target.files));
            input.click();
        });

        this.btnPurge.addEventListener('click', () => {
            if (this.queuedFiles.length > 0 && !this.isPurging) {
                if (confirm(`INITIATING DOD 5220.22-M OBLITERATION\n\nYou are about to shred ${this.queuedFiles.length} artifacts.\nForensic recovery will be impossible.\n\nProceed?`)) {
                    this.executePurge();
                }
            }
        });
    }

    handleDrop(dataTransfer) {
        if (!dataTransfer.items) return;
        const files = [];
        for (let i = 0; i < dataTransfer.items.length; i++) {
            if (dataTransfer.items[i].kind === 'file') {
                const file = dataTransfer.items[i].getAsFile();
                if (file) files.push(file);
            }
        }
        this.handleFiles(files);
    }

    handleFiles(files) {
        if (files.length === 0) return;

        files.forEach(file => {
            // Note: In Chrome browser file.path is often blank or fake. Electron gives full path.
            // On standard browser, we warn if path isn't absolute.
            const p = file.path || file.name;
            if (!this.queuedFiles.find(f => (f.path || f.name) === p)) {
                this.queuedFiles.push(file);
            }
        });

        this.log(`Added artifacts to destruction queue.`, 'warning');
        this.updateUI();
    }

    removeFile(index) {
        if (this.isPurging) return;
        const removed = this.queuedFiles[index];
        this.queuedFiles.splice(index, 1);
        this.log(`Removed ${removed.name} from queue.`, 'info');
        this.updateUI();
    }

    updateUI() {
        if (this.queuedFiles.length > 0) {
            this.btnPurge.style.display = 'block';
            this.btnPurge.textContent = `ANNIHILATE ${this.queuedFiles.length} ARTIFACTS`;
            this.mainPanel.style.borderColor = '#ff003c';
            this.mainPanel.style.boxShadow = '0 0 30px rgba(255, 0, 60, 0.2)';
            document.getElementById('ztDropText').textContent = `${this.queuedFiles.length} TARGETS ACQUIRED`;
            this.matrixColor = '#ff003c';

            this.fileListPanel.style.display = 'block';
            this.fileListPanel.innerHTML = '';

            this.queuedFiles.forEach((file, index) => {
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.background = 'rgba(0, 50, 0, 0.6)';
                item.style.padding = '8px 12px';
                item.style.marginBottom = '4px';
                item.style.border = '1px solid #003300';

                const nameSpan = document.createElement('span');
                nameSpan.style.overflow = 'hidden';
                nameSpan.style.textOverflow = 'ellipsis';
                nameSpan.style.whiteSpace = 'nowrap';
                nameSpan.style.maxWidth = '85%';
                // Attempt to show full path if available (Electron context)
                nameSpan.textContent = file.path || file.name;

                const removeBtn = document.createElement('button');
                removeBtn.textContent = 'X';
                removeBtn.style.background = 'rgba(255, 0, 60, 0.2)';
                removeBtn.style.color = '#ff003c';
                removeBtn.style.border = '1px solid #ff003c';
                removeBtn.style.cursor = 'pointer';
                removeBtn.style.padding = '2px 8px';
                removeBtn.onclick = () => this.removeFile(index);

                item.appendChild(nameSpan);
                item.appendChild(removeBtn);
                this.fileListPanel.appendChild(item);
            });
        } else {
            this.resetUI();
        }
    }

    async executePurge() {
        this.isPurging = true;
        this.btnPurge.disabled = true;
        this.btnPurge.textContent = "PURGING...";
        this.dropzone.style.borderColor = '#ff003c';
        document.getElementById('ztDropText').textContent = "SHREDDING IN PROGRESS";

        Array.from(this.fileListPanel.querySelectorAll('button')).forEach(b => b.style.display = 'none');
        this.log("INITIATING DOD 5220.22-M 3-PASS WIPE...", "error");

        const paths = this.queuedFiles.map(f => f.path || f.name);

        try {
            const result = await apiFetch('/api/zerotrace/purge', { paths: paths }, 'POST');

            if (result && result.success) {
                this.log(`Successfully shredded ${result.shredded} artifacts.`, 'success');
                if (result.errors && result.errors.length > 0) {
                    result.errors.forEach(err => this.log(`ERR: ${err}`, 'warning'));
                }
                this.queuedFiles = [];
                setTimeout(() => this.resetUI(), 2000);
            } else {
                throw new Error(result ? result.error : 'Unknown error');
            }
        } catch (e) {
            this.log(`CRITICAL ERROR: ${e.message}`, "error");
            this.log("Ensure you are running ForgeCore as an Electron app for valid absolute file paths. Drag-and-drop from a web browser sandbox may fail.", "warning");
            this.isPurging = false;
            this.btnPurge.disabled = false;
            this.btnPurge.textContent = `RETRY ANNIHILATION`;
            Array.from(this.fileListPanel.querySelectorAll('button')).forEach(b => b.style.display = 'block');
        }
    }

    resetUI() {
        this.isPurging = false;
        this.mainPanel.style.borderColor = '#0f0';
        this.mainPanel.style.boxShadow = '0 0 30px rgba(0, 255, 0, 0.1)';
        this.dropzone.style.borderColor = '#003300';
        document.getElementById('ztDropText').textContent = "AWAITING TARGET ARTIFACTS";
        this.btnPurge.style.display = 'none';
        this.btnPurge.disabled = false;
        this.matrixColor = '#0f0';
        this.fileListPanel.style.display = 'none';
        this.fileListPanel.innerHTML = '';
        this.log("System Ready.", "info");
    }

    setupCanvas() {
        if (!this.canvas || !this.ctx) return;
        this.canvas.height = this.canvas.parentElement.clientHeight;
        this.canvas.width = this.canvas.parentElement.clientWidth;
        const columns = this.canvas.width / this.fontSize;
        for (let x = 0; x < columns; x++) { this.drops[x] = 1; }
    }

    startMatrix() {
        if (!this.canvas || !this.ctx || this.animationTimer) return;
        this.animationTimer = setInterval(() => {
            this.ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            this.ctx.fillStyle = this.matrixColor;
            this.ctx.font = this.fontSize + "px 'JetBrains Mono'";

            for (let i = 0; i < this.drops.length; i++) {
                const text = this.matrixChars[Math.floor(Math.random() * this.matrixChars.length)];
                this.ctx.fillText(text, i * this.fontSize, this.drops[i] * this.fontSize);

                if (this.drops[i] * this.fontSize > this.canvas.height && Math.random() > 0.975) {
                    this.drops[i] = 0;
                }
                this.drops[i]++;
            }
        }, 35);
    }

    stopMatrix() {
        if (this.animationTimer) {
            clearInterval(this.animationTimer);
            this.animationTimer = null;
        }
    }
}

// Instantiate
export const ZeroTraceEngine = new ZeroTraceModule();
