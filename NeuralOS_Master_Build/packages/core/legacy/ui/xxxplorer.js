/**
 * XXXplorer™ Universal File System Logic
 * Handles mocked dynamic OS file reading logic.
 */

const VIRTUAL_DRIVES = {
    'win': {
        path: 'C:\\',
        files: [
            { name: 'System32', type: 'folder', os: 'win' },
            { name: 'Sovereign.exe', type: 'exe', os: 'win' },
            { name: 'NeuralBridge.dll', type: 'dll', os: 'win' },
            { name: 'HyperSnatch_Config.json', type: 'file', os: 'win' }
        ]
    },
    'mac': {
        path: '/Volumes/Macintosh HD/',
        files: [
            { name: 'Applications', type: 'folder', os: 'mac' },
            { name: 'LogicPro.app', type: 'app', os: 'mac' },
            { name: 'MindUnset.neuro', type: 'neuro', os: 'mac' },
            { name: 'Release_Note.dmg', type: 'dmg', os: 'mac' }
        ]
    },
    'lin': {
        path: '/',
        files: [
            { name: 'etc', type: 'folder', os: 'lin' },
            { name: 'bin', type: 'folder', os: 'lin' },
            { name: 'ZeroTrace_Core.elf', type: 'elf', os: 'lin' },
            { name: 'installer.deb', type: 'deb', os: 'lin' }
        ]
    },
    'vault': {
        path: 'SOVEREIGN_VAULT://',
        files: [
            { name: 'Encrypted_Evidence', type: 'folder', os: 'win' },
            { name: 'HARD_EVIDENCE.zip.sig', type: 'file', os: 'win' },
            { name: 'Identity_Root.key', type: 'file', os: 'win' }
        ]
    }
};

class UniversalExplorer {
    constructor() {
        this.currentDrive = 'win';
        this.pathInput = document.getElementById('path-input');
        this.fileGrid = document.getElementById('file-grid');
        this.execModal = document.getElementById('exec-modal');
        this.execProgress = document.getElementById('exec-progress');
        this.execDesc = document.getElementById('exec-desc');
        
        this.loadDrive('win');
    }

    loadDrive(driveKey) {
        this.currentDrive = driveKey;
        
        document.querySelectorAll('.drive-item').forEach(el => el.classList.remove('active'));
        const activeItem = document.querySelector(`.drive-item[onclick*="'${driveKey}'"]`);
        if (activeItem) activeItem.classList.add('active');

        const driveData = VIRTUAL_DRIVES[driveKey];
        this.pathInput.value = driveData.path;
        this.renderFiles(driveData.files);
    }

    renderFiles(files) {
        this.fileGrid.innerHTML = '';
        files.forEach(f => {
            const item = document.createElement('div');
            item.className = `file-item ${f.os}`;
            
            let icon = '📄';
            if (f.type === 'folder') icon = '📁';
            if (f.type === 'exe' || f.type === 'app' || f.type === 'elf') icon = '⚙️';
            if (f.type === 'dmg' || f.type === 'deb') icon = '📦';
            if (f.type === 'neuro') icon = '🧠';
            if (f.type === 'sh') icon = '>_';

            item.innerHTML = `
                <div class="file-icon">${icon}</div>
                <div class="file-name">${f.name}</div>
                <div class="file-type">${f.type.toUpperCase()}</div>
            `;

            item.onclick = () => this.handleFileClick(f);
            this.fileGrid.appendChild(item);
        });
    }

    handleFileClick(file) {
        if (file.type === 'folder') {
            const sep = (this.currentDrive === 'win') ? '\\' : '/';
            this.pathInput.value += `${file.name}${sep}`;
            this.fileGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-dim); margin-top: 50px;">Directory is empty</div>';
        } else {
            this.triggerUniversalExecution(file);
        }
    }

    triggerUniversalExecution(file) {
        this.execModal.classList.remove('hidden');
        document.getElementById('exec-title').innerText = `Executing ${file.name}`;
        
        let targetOS = 'Universal Runtime...';
        if (file.os === 'mac') targetOS = 'Darwin/XNU compatibility layer...';
        if (file.os === 'win') targetOS = 'Win32 translation layer...';
        if (file.os === 'lin') targetOS = 'POSIX subsystem...';
        if (file.type === 'neuro') targetOS = 'NeuroDrop™ Sovereign Runtime...';

        this.execDesc.innerText = `Initializing ${targetOS}`;
        this.execProgress.style.width = '0%';

        let progress = 0;
        this.execInterval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 100) {
                progress = 100;
                clearInterval(this.execInterval);
                this.execDesc.innerText = `Execution Context Ready. Launching...`;
                setTimeout(() => {
                    this.closeExecModal();
                    alert(`[NEURAL-ENGINE] ${file.name} successfully launched via Sovereign Universal Wrapper.`);
                }, 800);
            }
            this.execProgress.style.width = `${progress}%`;
        }, 200);
    }

    closeExecModal() {
        if (this.execInterval) clearInterval(this.execInterval);
        this.execModal.classList.add('hidden');
    }

    goUp() {
        this.loadDrive(this.currentDrive);
    }
}

window.Explorer = new UniversalExplorer();