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
        this.ctx.fillStyle = 'rgba(3, 5, 8, 0.2)'; // Fading trail
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;

            this.ctx.fillStyle = 'rgba(88, 166, 255, 0.4)';
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();

            // Inter-particle lines
            this.particles.forEach(p2 => {
                const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
                if (dist < 100) {
                    this.ctx.strokeStyle = `rgba(88, 166, 255, ${0.1 * (1 - dist/100)})`;
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
            this.ctx.fillStyle = 'rgba(88, 166, 255, 0.2)';
            const txt = "[NEURAL_SEAL_BOUND_" + Math.random().toString(16).substring(2,8).toUpperCase() + "]";
            this.ctx.fillText(txt, Math.random() * this.canvas.width, Math.random() * this.canvas.height);
        }

        requestAnimationFrame(() => this.animate());
    }
}

class WindowManagerSystem {
    constructor() {
        this.neuralBg = new NeuralBackground('neural-canvas');
        this.windows = [];
        this.zIndexCounter = 100;
        this.desktop = document.getElementById('desktop');
        this.openAppsContainer = document.getElementById('open-apps');
        this.startMenu = document.getElementById('start-menu');
        
        // Setup clock
        setInterval(this.updateClock, 1000);
        this.updateClock();

        // Inject seal if available
        try {
            if (typeof process !== 'undefined' && process.env && process.env.NEURALOS_SEAL) {
                document.getElementById('seal-display').innerText = `SEAL: ${process.env.NEURALOS_SEAL.substring(0, 16)}`;
            } else {
                document.getElementById('seal-display').innerText = `SEAL: BROWSER_EMULATED`;
            }
        } catch(e) {
            document.getElementById('seal-display').innerText = `SEAL: BROWSER_MODE`;
        }
        
        // Hide start menu on desktop click
        this.desktop.addEventListener('click', () => {
            if (!this.startMenu.classList.contains('hidden')) {
                this.startMenu.classList.add('hidden');
            }
        });
    }

    updateClock() {
        const now = new Date();
        document.getElementById('clock').innerText = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    toggleStartMenu() {
        this.startMenu.classList.toggle('hidden');
    }

    openApp(title, url) {
        // Bring to front if already open
        const existing = this.windows.find(w => w.title === title);
        if (existing) {
            this.focusWindow(existing.element);
            return;
        }

        const winId = 'win_' + Date.now();
        
        // Create Window DOM
        const winEl = document.createElement('div');
        winEl.className = 'os-window';
        winEl.id = winId;
        // Stagger positions
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
                    <div class="win-btn min" onclick="WindowManager.minimizeWindow('${winId}')"></div>
                    <div class="win-btn max" onclick="WindowManager.maximizeWindow('${winId}')"></div>
                    <div class="win-btn close" onclick="WindowManager.closeWindow('${winId}')"></div>
                </div>
            </div>
            <div class="window-content">
                <iframe src="${url}"></iframe>
            </div>
        `;

        this.desktop.appendChild(winEl);

        // Make draggable
        this.makeDraggable(winEl, document.getElementById(`${winId}_header`));

        // Focus on click
        winEl.addEventListener('mousedown', () => this.focusWindow(winEl));

        // Add to state
        this.windows.push({ id: winId, title: title, element: winEl, minimized: false, maximized: false });

        this.updateTaskbar();
    }

    closeWindow(id) {
        const index = this.windows.findIndex(w => w.id === id);
        if (index > -1) {
            this.windows[index].element.remove();
            this.windows.splice(index, 1);
            this.updateTaskbar();
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
        this.updateTaskbar();
    }

    focusWindow(el) {
        this.zIndexCounter++;
        el.style.zIndex = this.zIndexCounter;
    }

    updateTaskbar() {
        this.openAppsContainer.innerHTML = '';
        this.windows.forEach(w => {
            const btn = document.createElement('div');
            btn.className = `taskbar-app ${w.minimized ? '' : 'active'}`;
            btn.innerText = w.title;
            btn.onclick = () => {
                if (w.minimized) {
                    this.minimizeWindow(w.id); // unminimize
                } else {
                    this.focusWindow(w.element);
                }
            };
            this.openAppsContainer.appendChild(btn);
        });
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

window.WindowManager = new WindowManagerSystem();
