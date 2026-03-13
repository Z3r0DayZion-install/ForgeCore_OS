class NeuralBackground {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.particleCount = 50;
        this.init();
        window.addEventListener('resize', () => this.resize());
        this.animate();
    }

    init() {
        this.resize();
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 2 + 1
            });
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    animate() {
        // Theme aware background fade
        const isMac = document.body.classList.contains('theme-neuralmac');
        const isLin = document.body.classList.contains('theme-neurallinux');
        
        let fadeColor = 'rgba(2, 4, 6, 0.2)'; // WinShadow Blue-Black
        let dotColor = 'rgba(88, 166, 255, 0.4)'; // Blue
        
        if (isMac) {
            fadeColor = 'rgba(13, 4, 7, 0.2)'; // Mac Red-Black
            dotColor = 'rgba(255, 90, 111, 0.4)'; // Rose
        } else if (isLin) {
            fadeColor = 'rgba(2, 5, 2, 0.2)'; // Linux Green-Black
            dotColor = 'rgba(0, 255, 65, 0.4)'; // Terminal Green
        }

        this.ctx.fillStyle = fadeColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;

            this.ctx.fillStyle = dotColor;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();

            // Inter-particle lines
            this.particles.forEach(p2 => {
                const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
                if (dist < 100) {
                    this.ctx.strokeStyle = dotColor.replace('0.4', String(0.1 * (1 - dist/100)));
                    this.ctx.beginPath();
                    this.ctx.moveTo(p.x, p.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.stroke();
                }
            });
        });

        // Occasional Subliminal Matrix Text
        if (Math.random() > 0.99) {
            this.ctx.font = '10px monospace';
            this.ctx.fillStyle = dotColor.replace('0.4', '0.2');
            const txt = "[NEURAL_SEAL_BOUND_" + Math.random().toString(16).substring(2,8).toUpperCase() + "]";
            this.ctx.fillText(txt, Math.random() * this.canvas.width, Math.random() * this.canvas.height);
        }

        requestAnimationFrame(() => this.animate());
    }
}

class OSManagerSystem {
    constructor() {
        this.currentTheme = 'winshadow';
    }

    setTheme(theme) {
        document.body.classList.remove('theme-winshadow', 'theme-neuralmac', 'theme-neurallinux');
        document.body.classList.add(`theme-${theme}`);
        this.currentTheme = theme;
        WindowManager.updateTaskbars();
    }
}

class WindowManagerSystem {
    constructor() {
        this.windows = [];
        this.zIndexCounter = 100;
        this.desktop = document.getElementById('desktop');
        this.startMenu = document.getElementById('start-menu');
        
        setInterval(() => this.updateClock(), 1000);
        this.updateClock();

        try {
            const sealText = (typeof process !== 'undefined' && process.env && process.env.NEURALOS_SEAL) 
                ? process.env.NEURALOS_SEAL.substring(0, 16) 
                : 'BROWSER_EMULATED';
            document.querySelectorAll('.seal-val').forEach(el => el.innerText = sealText);
        } catch(e) {
            document.querySelectorAll('.seal-val').forEach(el => el.innerText = 'BROWSER_MODE');
        }
        
        this.desktop.addEventListener('click', () => {
            if (!this.startMenu.classList.contains('hidden')) {
                this.startMenu.classList.add('hidden');
            }
        });
    }

    updateClock() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        document.querySelectorAll('.clock').forEach(el => el.innerText = timeStr);
    }

    toggleStartMenu(btnContext) {
        this.startMenu.classList.toggle('hidden');
    }

    openApp(title, url, iconType = 'app') {
        const existing = this.windows.find(w => w.title === title);
        if (existing) {
            if (existing.minimized) this.minimizeWindow(existing.id);
            this.focusWindow(existing.element);
            return;
        }

        const winId = 'win_' + Date.now();
        const winEl = document.createElement('div');
        winEl.className = 'os-window';
        winEl.id = winId;
        
        const offset = (this.windows.length * 20) + 50;
        winEl.style.top = `${offset}px`;
        winEl.style.left = `${offset}px`;
        winEl.style.width = '800px';
        winEl.style.height = '600px';
        
        this.zIndexCounter++;
        winEl.style.zIndex = this.zIndexCounter;

        winEl.innerHTML = `
            <div class="window-header" id="${winId}_header">
                <span class="window-title">${title}</span>
                <div class="window-controls">
                    <div class="win-btn min" onclick="WindowManager.minimizeWindow('${winId}')" title="Minimize"></div>
                    <div class="win-btn max" onclick="WindowManager.maximizeWindow('${winId}')" title="Maximize"></div>
                    <div class="win-btn close" onclick="WindowManager.closeWindow('${winId}')" title="Close"></div>
                </div>
            </div>
            <div class="window-content">
                <iframe src="${url}"></iframe>
            </div>
        `;

        this.desktop.appendChild(winEl);
        this.makeDraggable(winEl, document.getElementById(`${winId}_header`));
        winEl.addEventListener('mousedown', () => this.focusWindow(winEl));

        // Use correct icon character for the dock based on app type
        let iconChar = '📦';
        if (iconType === 'folder') iconChar = '📁';
        if (iconType === 'bolt') iconChar = '⚡';
        if (iconType === 'terminal') iconChar = '>_';

        this.windows.push({ id: winId, title: title, element: winEl, minimized: false, maximized: false, icon: iconChar });
        this.updateTaskbars();
    }

    closeWindow(id) {
        const index = this.windows.findIndex(w => w.id === id);
        if (index > -1) {
            this.windows[index].element.remove();
            this.windows.splice(index, 1);
            this.updateTaskbars();
        }
    }

    maximizeWindow(id) {
        const winState = this.windows.find(w => w.id === id);
        if (!winState) return;
        const el = winState.element;

        if (winState.maximized) {
            el.style.width = winState.prevW;
            el.style.height = winState.prevH;
            el.style.top = winState.prevT;
            el.style.left = winState.prevL;
            winState.maximized = false;
        } else {
            winState.prevW = el.style.width;
            winState.prevH = el.style.height;
            winState.prevT = el.style.top;
            winState.prevL = el.style.left;
            el.style.top = '0';
            el.style.left = '0';
            el.style.width = '100%';
            el.style.height = '100%';
            winState.maximized = true;
        }
    }

    minimizeWindow(id) {
        const winState = this.windows.find(w => w.id === id);
        if (!winState) return;
        
        if (winState.minimized) {
            winState.element.style.display = 'flex';
            winState.minimized = false;
            this.focusWindow(winState.element);
        } else {
            winState.element.style.display = 'none';
            winState.minimized = true;
        }
        this.updateTaskbars();
    }

    focusWindow(el) {
        this.zIndexCounter++;
        el.style.zIndex = this.zIndexCounter;
    }

    updateTaskbars() {
        // Update Windows Taskbar
        const winContainer = document.querySelector('.win-bar .open-apps-container');
        if (winContainer) {
            winContainer.innerHTML = '';
            this.windows.forEach(w => {
                const btn = document.createElement('div');
                btn.className = `taskbar-app ${w.minimized ? '' : 'active'}`;
                btn.innerText = w.title;
                btn.onclick = () => {
                    if (w.minimized) this.minimizeWindow(w.id);
                    else this.focusWindow(w.element);
                };
                winContainer.appendChild(btn);
            });
        }

        // Update Linux Top Panel
        const linContainer = document.querySelector('.lin-panel .open-apps-container');
        if (linContainer) {
            linContainer.innerHTML = '';
            this.windows.forEach(w => {
                const btn = document.createElement('div');
                btn.className = `taskbar-app ${w.minimized ? '' : 'active'}`;
                btn.innerText = w.title;
                btn.onclick = () => {
                    if (w.minimized) this.minimizeWindow(w.id);
                    else this.focusWindow(w.element);
                };
                linContainer.appendChild(btn);
            });
        }

        // Update Mac Dock
        const macDock = document.getElementById('mac-dock');
        if (macDock) {
            macDock.innerHTML = '';
            this.windows.forEach(w => {
                const icon = document.createElement('div');
                icon.className = `dock-item ${w.minimized ? '' : 'active'}`;
                icon.innerHTML = w.icon;
                icon.title = w.title;
                icon.onclick = () => {
                    if (w.minimized) this.minimizeWindow(w.id);
                    else this.focusWindow(w.element);
                };
                macDock.appendChild(icon);
            });
        }
    }

    makeDraggable(elmnt, header) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        header.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
            elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }
}

window.NeuralBg = new NeuralBackground('neural-canvas');
window.OSManager = new OSManagerSystem();
window.WindowManager = new WindowManagerSystem();