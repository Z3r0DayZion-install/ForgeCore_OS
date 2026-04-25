/**
 * Canvas Rendering for ForgeCore OS
 */
import { State } from './empire_state.js';

export class CanvasRenderer {
    constructor() {
        this.particleCanvas = document.getElementById('particles');
        this.topoCanvas = document.getElementById('topoCanvas');
        this.activityCanvas = document.getElementById('activityCanvas');
        this.meshCanvas = document.getElementById('meshCanvas');

        this.particles = [];
        this.activityData = [];
        this.meshNodes = [];
        this.animationFrameId = null;

        this.initParticles();
        window.addEventListener('resize', () => this.resizeParticles());
    }

    getAccentColor() {
        return getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#58a6ff';
    }

    resizeParticles() {
        if (!this.particleCanvas) return;
        this.particleCanvas.width = window.innerWidth;
        this.particleCanvas.height = window.innerHeight;
    }

    initParticles() {
        if (!this.particleCanvas) return;
        this.resizeParticles();
        for (let i = 0; i < 60; i++) {
            this.particles.push({
                x: Math.random() * this.particleCanvas.width,
                y: Math.random() * this.particleCanvas.height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                r: Math.random() * 2 + 1
            });
        }
    }

    drawParticles() {
        if (!this.particleCanvas) return;
        const ctx = this.particleCanvas.getContext('2d');
        const w = this.particleCanvas.width;
        const h = this.particleCanvas.height;
        const accent = this.getAccentColor();

        ctx.clearRect(0, 0, w, h);

        this.particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0 || p.x > w) p.vx *= -1;
            if (p.y < 0 || p.y > h) p.vy *= -1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = accent;
            ctx.fill();
        });

        this.particles.forEach((a, i) => {
            this.particles.slice(i + 1).forEach(b => {
                const d = Math.hypot(a.x - b.x, a.y - b.y);
                if (d < 150) {
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = accent;
                    ctx.globalAlpha = 1 - d / 150;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            });
        });
    }

    drawTopology() {
        if (!this.topoCanvas) return;
        const ctx = this.topoCanvas.getContext('2d');
        const w = this.topoCanvas.width;
        const h = this.topoCanvas.height;
        ctx.clearRect(0, 0, w, h);

        const accent = this.getAccentColor();
        const t = Date.now() / 1000;
        const p1 = (Math.sin(t * 2) + 1) / 2;

        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 8 + p1 * 2, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.shadowBlur = 10 + p1 * 10;
        ctx.shadowColor = accent;
        ctx.fill();
        ctx.shadowBlur = 0;

        const swarmData = State.get('swarmData') || { peers: [] };
        const peers = swarmData.peers || [];

        peers.forEach((p, i) => {
            const span = (i / peers.length) * Math.PI * 2 + t * 0.15;
            const dist = 70 + Math.sin(t * 1.5 + i) * 6;
            const nx = w / 2 + Math.cos(span) * dist;
            const ny = h / 2 + Math.sin(span) * dist;

            ctx.beginPath();
            ctx.moveTo(w / 2, h / 2);
            ctx.lineTo(nx, ny);
            ctx.strokeStyle = accent;
            ctx.globalAlpha = 0.12 + p1 * 0.05;
            ctx.stroke();
            ctx.globalAlpha = 1;

            ctx.beginPath();
            ctx.arc(nx, ny, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#00ff41';
            ctx.fill();

            ctx.fillStyle = '#666';
            ctx.font = '7px monospace';
            ctx.fillText(p.id.slice(0, 8), nx + 8, ny + 2);
        });

        if (peers.length === 0) {
            ctx.beginPath();
            ctx.arc(w / 2, h / 2, 40 + (Math.sin(t * 5) * 12), 0, Math.PI * 2);
            ctx.strokeStyle = accent;
            ctx.globalAlpha = 0.08;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }

    drawNeuralTopology() {
        if (!this.meshCanvas) return;
        const ctx = this.meshCanvas.getContext('2d');
        const w = this.meshCanvas.width = this.meshCanvas.offsetWidth;
        const h = this.meshCanvas.height = this.meshCanvas.offsetHeight;
        ctx.clearRect(0, 0, w, h);

        const accent = this.getAccentColor();
        const t = Date.now() / 1000;

        const swarmData = State.get('swarmData') || { peers: [] };
        const peers = swarmData.peers || [];

        // Dynamic node management
        if (this.meshNodes.length !== peers.length + 1) {
            this.meshNodes = [{ x: w / 2, y: h / 2, id: 'LOCAL_CORE', isCore: true }];
            peers.forEach((p, i) => {
                const angle = (i / peers.length) * Math.PI * 2;
                const dist = 100 + (i % 2 === 0 ? 20 : -20);
                this.meshNodes.push({
                    x: w / 2 + Math.cos(angle) * dist,
                    y: h / 2 + Math.sin(angle) * dist,
                    id: p.id,
                    targetX: w / 2 + Math.cos(angle) * dist,
                    targetY: h / 2 + Math.sin(angle) * dist,
                    pulse: Math.random() * Math.PI
                });
            });
        }

        // Render Mesh
        ctx.lineWidth = 1;
        this.meshNodes.forEach((node, i) => {
            if (node.isCore) return;

            // Organic drift
            node.x += Math.sin(t + i) * 0.2;
            node.y += Math.cos(t + i) * 0.2;

            // Connection line
            ctx.beginPath();
            ctx.moveTo(this.meshNodes[0].x, this.meshNodes[0].y);
            ctx.lineTo(node.x, node.y);

            const grad = ctx.createLinearGradient(this.meshNodes[0].x, this.meshNodes[0].y, node.x, node.y);
            grad.addColorStop(0, accent + '22');
            grad.addColorStop(1, accent + '88');
            ctx.strokeStyle = grad;
            ctx.stroke();

            // Handshake pulses
            node.pulse += 0.05;
            const pulseScale = (Math.sin(node.pulse) + 1) / 2;
            const px = this.meshNodes[0].x + (node.x - this.meshNodes[0].x) * pulseScale;
            const py = this.meshNodes[0].y + (node.y - this.meshNodes[0].y) * pulseScale;

            ctx.beginPath();
            ctx.arc(px, py, 2, 0, Math.PI * 2);
            ctx.fillStyle = accent;
            ctx.fill();

            // Node dot
            ctx.beginPath();
            ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = accent;
            ctx.shadowBlur = 10;
            ctx.shadowColor = accent;
            ctx.fill();
            ctx.shadowBlur = 0;

            // Label
            ctx.fillStyle = '#888';
            ctx.font = '8px "JetBrains Mono"';
            ctx.fillText(node.id.slice(0, 10).toUpperCase(), node.x + 10, node.y + 3);
        });

        // Core dot
        const core = this.meshNodes[0];
        const corePulse = (Math.sin(t * 3) + 1) / 2;
        ctx.beginPath();
        ctx.arc(core.x, core.y, 8 + corePulse * 4, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.shadowBlur = 20 + corePulse * 10;
        ctx.shadowColor = accent;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    addActivityData(cpu) {
        this.activityData.push(cpu);
        if (this.activityData.length > 60) this.activityData.shift();
    }

    drawActivity() {
        if (!this.activityCanvas) return;
        const ctx = this.activityCanvas.getContext('2d');
        const w = this.activityCanvas.width;
        const h = this.activityCanvas.height;
        ctx.clearRect(0, 0, w, h);

        const accent = this.getAccentColor();

        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const y = (h / 5) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        if (this.activityData.length > 1) {
            ctx.beginPath();
            this.activityData.forEach((v, i) => {
                const x = (i / (this.activityData.length - 1)) * w;
                const y = h - (v / 100) * h;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.strokeStyle = accent;
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.closePath();

            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, accent + '33');
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.fill();
        }
    }

    startRenderLoop() {
        this._renderFrame = () => {
            this.drawParticles();

            // Only draw heavy graphs when on the dashboard
            if (State.get('activeTab') === 'dashboard' && !State.get('uiLocked')) {
                this.drawTopology();
                this.drawActivity();
            }

            if (State.get('activeTab') === 'swarm' && !State.get('uiLocked')) {
                this.drawNeuralTopology();
            }

            this.animationFrameId = requestAnimationFrame(this._renderFrame);
        };

        // Visibility gate — fully cancel rAF when hidden, restart when visible
        this._visibilityHandler = () => {
            if (document.hidden) {
                this.stopRenderLoop();
            } else {
                if (!this.animationFrameId) {
                    this._renderFrame();
                }
            }
        };
        document.addEventListener('visibilitychange', this._visibilityHandler);

        // Kick it off
        this._renderFrame();
    }

    stopRenderLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
}
