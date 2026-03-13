// 3D DAG Visualizer for XXXplorer Pane
// Uses Vanilla HTML5 Canvas to fake a 3D Merkle-DAG network graph

class DAGRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.nodes = [];
        this.links = [];
        this.angle = 0;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.animate();
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    // Call this when new history is loaded
    updateGraph(historyList) {
        this.nodes = [];
        this.links = [];
        
        let prevNode = null;
        
        // Generate pseudo-3D spiral layout based on Merkle history
        historyList.forEach((h, index) => {
            const z = index * 20;
            const radius = 50 + (index * 5);
            const theta = index * 0.8;
            
            const node = {
                x: Math.cos(theta) * radius,
                y: Math.sin(theta) * radius,
                z: z - (historyList.length * 10), // Center Z
                cid: h.cid,
                ts: h.timestamp,
                selected: false
            };
            
            this.nodes.push(node);
            
            if (prevNode) {
                this.links.push({ source: prevNode, target: node });
            }
            prevNode = node;
        });
    }

    animate() {
        if (!this.canvas) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        
        this.angle += 0.005;
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);

        // Project and Draw Links
        this.ctx.strokeStyle = 'rgba(88, 166, 255, 0.3)'; // accent color
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.links.forEach(link => {
            const p1 = this.project(link.source, cos, sin, cx, cy);
            const p2 = this.project(link.target, cos, sin, cx, cy);
            this.ctx.moveTo(p1.x, p1.y);
            this.ctx.lineTo(p2.x, p2.y);
        });
        this.ctx.stroke();

        // Project and Draw Nodes
        this.nodes.forEach(node => {
            const p = this.project(node, cos, sin, cx, cy);
            const scale = p.scale;
            
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 4 * scale, 0, Math.PI * 2);
            this.ctx.fillStyle = node.selected ? '#ff4040' : '#58a6ff';
            this.ctx.fill();
            
            // Glow effect
            this.ctx.shadowBlur = 10 * scale;
            this.ctx.shadowColor = node.selected ? '#ff4040' : '#58a6ff';
            
            // Draw CID snippet if close enough
            if (scale > 0.8) {
                this.ctx.fillStyle = 'rgba(255,255,255,0.7)';
                this.ctx.font = `${8 * scale}px monospace`;
                this.ctx.shadowBlur = 0;
                this.ctx.fillText(node.cid.substring(0, 6), p.x + 8, p.y + 3);
            }
        });

        requestAnimationFrame(() => this.animate());
    }

    project(node, cos, sin, cx, cy) {
        // Rotate around Y axis
        const rx = node.x * cos - node.z * sin;
        const rz = node.x * sin + node.z * cos;
        
        // Perspective projection
        const fl = 300; // Focal length
        const scale = fl / (fl + rz);
        
        return {
            x: cx + rx * scale,
            y: cy + node.y * scale,
            scale: scale
        };
    }
}

// Attach to global window
window.DAGRenderer = DAGRenderer;
