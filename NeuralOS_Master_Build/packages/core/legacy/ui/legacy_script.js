
    // === TERMINAL ===
    const term = document.getElementById('term');
    function log(msg, st = "SYS") {
      const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
      const color = st === "ERR" || st === "CRITICAL" ? "#f85149" : (st === "OK" ? "#3fb950" : "var(--dim)");
      term.innerHTML += `<br><span style="color:var(--dim)">[${ts}]</span> <span style="color:${color}">[${st}]</span> ${msg}`;
      term.scrollTop = term.scrollHeight;
    }

    // === AUTH ===
    let uiLocked = true; // Start locked
    async function unlock() {
      const passphrase = document.getElementById('passphrase').value;
      const res = await fetch('/api/system/unlock', { method: 'POST', body: JSON.stringify({ passphrase }) });
      const data = await res.json();
      if (data.success) {
        uiLocked = false;
        document.getElementById('lockdown').style.display = 'none';
        log("Sovereign Handshake Established.", "AUTH");
        await syncSettings(); mount('INTEL_VAULT');
        startDashboard();
      } else {
        log("Handshake Rejected: Invalid Passphrase", "ERR");
        if (data.ghost) {
          uiLocked = false;
          document.getElementById('lockdown').style.display = 'none';
          document.getElementById('productTag').innerText = "DECOY_VERSION";
          document.getElementById('productTag').style.color = "orange";
          log("GHOST_PROTOCOL_ACTIVE: Plausible Deniability Engaged.", "CRITICAL");
          await syncSettings(); mount('user_backups');
          startDashboard(); // Start dashboard even in ghost mode
        }
      }
    }

    function triggerLockdown() {
      if (uiLocked) return;
      uiLocked = true;
      document.getElementById('lockdown').style.display = 'flex';
      log("SESSION_EXPIRED: Re-Authentication Required.", "WARN");
    }

    // === COMMAND HANDLER ===
    async function handleCommand(e) {
      if (e.key === 'Enter') {
        const input = e.target.value.trim(); e.target.value = '';
        if (!input) return;
        log(`&gt; ${input}`, "USER");
        try {
          const res = await fetch('/api/system/execute', { method: 'POST', body: JSON.stringify({ command: input.split(' ')[0], args: input.split(' ').slice(1) }) });
          const data = await res.json();
          if (data.output === '__CLEAR__') { term.innerHTML = '[READY] Terminal cleared.'; return; }
          // Normalize all newline representations
          const normalized = data.output.replace(/\\n/g, '\n');
          const lines = normalized.split('\n');
          lines.forEach(line => { if (line !== '') log(line, "KERN"); });
        } catch (err) { log("Execution Failed: " + err.message, "ERR"); }
      }
    }

    // === SETTINGS ===
    async function syncSettings() {
      try {
        const res = await fetch('/api/system/settings'); if (!res.ok) throw new Error("GHOST_LOCKED");
        const cfg = await res.json();
        if (cfg.theme) applyTheme(cfg.theme);
        if (cfg.matrixOpacity) document.getElementById('particles').style.opacity = cfg.matrixOpacity;
        if (cfg.shadowMask) toggleShadowMask(cfg.shadowMask);
        document.getElementById('themeSelect').value = cfg.theme || 'BloodNeon';
        document.getElementById('matrixOpacity').value = cfg.matrixOpacity || 0.15;
        document.getElementById('shadowMaskToggle').checked = !!cfg.shadowMask;
      } catch (e) { log("Settings sync failed: " + e.message, "ERR"); }
    }
    async function saveSettings() {
      const s = { theme: document.getElementById('themeSelect').value, matrixOpacity: document.getElementById('matrixOpacity').value, shadowMask: document.getElementById('shadowMaskToggle').checked };
      const res = await fetch('/api/system/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
      if (res.ok) log("Global Preferences Sealed.", "OK");
    }
    function applyTheme(t) { document.body.setAttribute('data-theme', t); log(`Theme: ${t}`); }
    function toggleShadowMask(active) {
      const names = active ? ["system_logs", "temp_cache", "old_updates", "utility_dump"] : ["INTEL_VAULT", "RELEASE_VAULT", "CHAT_VAULT", "UTILITY_VAULT"];
      document.querySelectorAll('.repo-nav').forEach((el, i) => {
        const icon = el.innerText.split(' ')[0];
        el.innerText = `${icon} ${active ? ['INTEL', 'RELEASE', 'CHAT', 'UTIL'][i] + '_REPOS' : names[i].replace('_VAULT', '_REPOS')}`;
        el.setAttribute('onclick', `mount('${names[i]}', this)`);
      });
    }

    // === TAB SWITCHING ===
    function switchTab(id, el) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.pane').forEach(v => v.classList.remove('active'));
      el.classList.add('active');
      const pane = document.getElementById(id + 'Pane');
      if (pane) pane.classList.add('active');
      window.activeTab = id;
    }

    // === VAULT BROWSER ===
    window.activeVault = '';
    async function mount(v, btn) {
      window.activeVault = v;
      if (btn) { document.querySelectorAll('.repo-nav').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
      document.getElementById('currentVaultName').innerText = v.toUpperCase();
      const res = await fetch(`/api/list?vault=${v}`);
      const files = await res.json();
      const list = document.getElementById('fileList'); list.innerHTML = '';
      if (files.length === 0) { list.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:var(--dim); letter-spacing:2px; border:1px dashed var(--border);">VAULT_VACUUM_DETECTED</div>`; }
      files.forEach(f => {
        const div = document.createElement('div'); div.className = 'file-card glass';
        div.style.display = 'flex'; div.style.justifyContent = 'space-between'; div.style.alignItems = 'center';
        div.innerHTML = `
          <div onclick="loadForgeFile('vaults', '/${v}/${f.name}')" style="flex:1; cursor:pointer;">
            <div style="font-size:0.7rem; color:#ccc;">📄 ${f.name}</div>
            <div style="font-size:0.45rem; color:var(--dim); margin-top:2px;">SIZE: ${f.size}</div>
          </div>
          <div class="delete-icon" onclick="vaultDeleteFile('${v}', '${f.name}')" style="color:var(--dim); cursor:pointer; font-size:0.7rem; padding:5px;">✕</div>
        `;
        list.appendChild(div);
      });
      switchTab('vaults', document.querySelectorAll('.tab')[1]);
    }

    async function vaultNewFile() {
      const name = prompt("ARTIFACT_ID_REQUIRED:");
      if (!name) return;
      log(`Creating Artifact: ${name}`, "SYS");
      try {
        const res = await fetch('/api/vault/new', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vault: window.activeVault, name })
        });
        const data = await res.json();
        if (data.ok) { log("Artifact Manifest Created.", "OK"); mount(window.activeVault); }
        else log(`Err: ${data.error}`, "ERR");
      } catch (e) { log("Vault sync failed.", "ERR"); }
    }

    async function vaultUploadFile(el) {
      const file = el.files[0];
      if (!file) return;
      log(`UPLOADING: ${file.name}`, "SYS");
      const reader = new FileReader();
      reader.onload = async (e) => {
        const b64 = e.target.result.split(',')[1];
        try {
          const res = await fetch('/api/vault/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vault: window.activeVault, name: file.name, b64 })
          });
          const data = await res.json();
          if (data.ok) { log("Artifact Successfully Harvested.", "OK"); mount(window.activeVault); }
          else log(`Err: ${data.error}`, "ERR");
        } catch (err) { log("Connection lost.", "ERR"); }
      };
      reader.readAsDataURL(file);
    }

    async function vaultDeleteFile(v, f) {
      if (!confirm(`PURGE_ARTIFACT: ${f}?`)) return;
      log(`Purging Artifact: ${f}`, "WARN");
      try {
        const res = await fetch('/api/vault/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vault: v, file: f })
        });
        const data = await res.json();
        if (data.ok) { log("Artifact Expunged.", "OK"); mount(window.activeVault); }
        else log(`Err: ${data.error}`, "ERR");
      } catch (e) { log("Purge sequence failed.", "ERR"); }
    }

    // [DELETED] Legacy Editor Functions Unified into Forge


    // === SWARM ===
    async function loadSwarm() {
      try {
        const res = await fetch('/api/swarm/status'); const data = await res.json();
        document.getElementById('insightList').innerHTML = data.insights.length ? data.insights.map(i => `
      <div class="card" style="margin-bottom:10px; padding:12px;">
        <div style="font-size:0.55rem; color:var(--accent); letter-spacing:1px;">${i.type}</div>
        <div style="font-size:0.75rem; margin-top:5px;">${i.recommendation}</div>
        <div style="font-size:0.55rem; color:#444; margin-top:5px;">${i.reason}</div></div>
    `).join('') : '<div style="color:#333; font-size:0.7rem;">No active insights. Synthesis nominal.</div>';
        document.getElementById('ghostNodeList').innerHTML = data.peers.length ? data.peers.map(p => `
      <div class="card" style="margin-bottom:8px; padding:10px; display:flex; justify-content:space-between; align-items:center;">
        <div><div style="font-size:0.7rem;">${p.id.slice(0, 16)}...</div>
          <div style="font-size:0.55rem; color:#333;">${p.address}:${p.port}</div></div>
        <span class="status-dot" style="background:var(--ok);"></span></div>
    `).join('') : '<div style="color:#333; font-size:0.7rem;">No external ghost nodes.</div>';
        document.getElementById('swarmManifest').innerText = `NODE_ID: ${data.nodeID}\nPEER_COUNT: ${data.peers.length}\nACTIVE_VOTES: ${data.activeVotes.length}\nBRAIN_DENSITY: ${(data.peers.length / 10).toFixed(2)}`;
        document.getElementById('peerCount').innerText = data.peers.length;
        document.getElementById('insightCount').innerText = data.insights.length;
      } catch (e) { log("Swarm telemetry failed.", "ERR"); }
    }

    // === MATRIX ===
    async function loadMatrix() {
      try {
        const tRes = await fetch('/api/system/timeline'); const timeline = await tRes.json();
        document.getElementById('timelineList').innerHTML = timeline.map(i => `
      <div class="card" style="padding:12px; display:flex; justify-content:space-between; align-items:center;">
        <div><span style="color:var(--accent); font-size:0.5rem; letter-spacing:1px;">${i.vault}</span>
          <div style="font-size:0.8rem; margin-top:3px;">${i.file}</div></div>
        <div style="text-align:right; font-size:0.55rem; color:#333;">${new Date(i.mtime).toLocaleString()}<br>${i.size}</div></div>
    `).join('');
        const lRes = await fetch('/api/system/ledger'); const ledger = await lRes.json();
        document.getElementById('ledgerList').innerHTML = ledger.reverse().map(l => `
      <div style="margin-bottom:6px; padding-bottom:4px; border-bottom:1px solid #111;">
        <span style="color:var(--ok)">[${new Date(l.timestamp).toLocaleTimeString()}]</span>
        <span style="color:var(--text)">${l.event}</span>
        <span style="color:#333">${JSON.stringify(l.details)}</span></div>
    `).join('');
      } catch (e) { log("Matrix load failed.", "ERR"); }
    }

    // === PEERS ===
    async function loadPeers() {
      try {
        const res = await fetch('/api/peers'); const peers = await res.json();
        document.getElementById('peerList').innerHTML = peers.map(p => `
      <div class="card" style="position:relative;">
        <div style="position:absolute; top:12px; right:12px;"><span class="status-dot" style="background:${p.status === 'ACTIVE' ? 'var(--ok)' : '#300'};"></span></div>
        <h3 style="font-size:0.8rem;">${p.id}</h3>
        <div style="color:var(--dim); font-size:0.6rem; margin-top:5px;">${p.host}:${p.port}</div>
        <button class="btn-primary" style="margin-top:15px; width:100%; font-size:0.55rem;" ${p.status !== 'ACTIVE' ? 'disabled' : ''}>SYNC_VAULTS</button></div>
    `).join('');
      } catch (e) { log("Peer discovery failed.", "ERR"); }
    }

    // === PARTICLE NETWORK ===
    (function () {
      const c = document.getElementById('particles'); const ctx = c.getContext('2d');
      let w, h, particles = [];
      function resize() { w = c.width = window.innerWidth; h = c.height = window.innerHeight; }
      resize(); window.addEventListener('resize', resize);
      for (let i = 0; i < 60; i++) particles.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, r: Math.random() * 2 + 1 });
      function draw() {
        ctx.clearRect(0, 0, w, h);
        const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim();
        particles.forEach(p => {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = accent; ctx.fill();
        });
        particles.forEach((a, i) => {
          particles.slice(i + 1).forEach(b => {
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < 150) {
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
              ctx.strokeStyle = accent; ctx.globalAlpha = 1 - d / 150; ctx.lineWidth = 0.5;
              ctx.stroke(); ctx.globalAlpha = 1;
            }
          });
        });
        requestAnimationFrame(draw);
      }
      draw();
    })();




    // === TOPOLOGY VISUALIZATION ===
    let swarmData = { peers: [] };
    function drawTopology() {
      const c = document.getElementById('topoCanvas'); if (!c) return;
      const ctx = c.getContext('2d'); const w = c.width; const h = c.height;
      ctx.clearRect(0, 0, w, h);
      const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim();
      const t = Date.now() / 1000;
      // Pulse effect
      const p1 = (Math.sin(t * 2) + 1) / 2;
      ctx.beginPath(); ctx.arc(w / 2, h / 2, 8 + p1 * 2, 0, Math.PI * 2);
      ctx.fillStyle = accent; ctx.shadowBlur = 10 + p1 * 10; ctx.shadowColor = accent; ctx.fill(); ctx.shadowBlur = 0;

      const peers = swarmData.peers || [];
      peers.forEach((p, i) => {
        const span = (i / peers.length) * Math.PI * 2 + t * 0.15;
        const dist = 70 + Math.sin(t * 1.5 + i) * 6;
        const nx = w / 2 + Math.cos(span) * dist;
        const ny = h / 2 + Math.sin(span) * dist;
        ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.lineTo(nx, ny);
        ctx.strokeStyle = accent; ctx.globalAlpha = 0.12 + p1 * 0.05; ctx.stroke(); ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(nx, ny, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#00ff41'; ctx.fill();
        ctx.fillStyle = '#666'; ctx.font = '7px monospace';
        ctx.fillText(p.id.slice(0, 8), nx + 8, ny + 2);
      });
      if (peers.length === 0) {
        ctx.beginPath(); ctx.arc(w / 2, h / 2, 40 + (Math.sin(t * 5) * 12), 0, Math.PI * 2);
        ctx.strokeStyle = accent; ctx.globalAlpha = 0.08; ctx.stroke(); ctx.globalAlpha = 1;
      }
    }

    // === ACTIVITY GRAPH ===
    const activityData = [];
    function drawActivity() {
      const c = document.getElementById('activityCanvas'); if (!c) return;
      const ctx = c.getContext('2d'); const w = c.width; const h = c.height;
      ctx.clearRect(0, 0, w, h);
      const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim();
      if (activityData.length > 60) activityData.shift();
      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) { const y = (h / 5) * i; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      // Line
      if (activityData.length > 1) {
        ctx.beginPath();
        activityData.forEach((v, i) => {
          const x = (i / (activityData.length - 1)) * w; const y = h - (v / 100) * h;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
        // Fill
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, accent + '33'); grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad; ctx.fill();
      }
    }

    // === DASHBOARD LOOP ===
    let bootTime = Date.now();
    function startDashboard() {
      window.activeTab = 'dashboard';
      log('Type "help" for available commands.', 'SYS');


      // 60FPS Visual Frame Controller
      function frame() {
        if (window.activeTab === 'dashboard') {
          drawTopology();
          drawActivity();
        }
        requestAnimationFrame(frame);
      }
      frame();

      // Precise Telemetry Loop (1s)
      setInterval(async () => {
        if (uiLocked) return;
        try {
          const r = await fetch('/api/hw');
          if (r.status === 401) { triggerLockdown(); return; }
          const d = await r.json();
          const cpu = parseFloat(d.cpu) || 0;
          const cpuEl = document.getElementById('cpu'); if (cpuEl) cpuEl.innerText = cpu.toFixed(1) + '%';
          const cpuG = document.getElementById('cpuGaugeVal'); if (cpuG) cpuG.innerText = cpu.toFixed(1) + '%';
          const cpuA = document.getElementById('cpuArc'); if (cpuA) cpuA.style.strokeDashoffset = 282.7 - (cpu / 100) * 282.7;
          activityData.push(cpu);
          if (d.locked) location.reload();
        } catch (e) { }

        try {
          const ir = await fetch('/api/system/info');
          if (ir.status === 401) return; // Managed by primary loop
          const info = await ir.json();
          const mem = info.memPercent || 0;
          const memG = document.getElementById('memGaugeVal'); if (memG) memG.innerText = mem.toFixed(1) + '%';
          const memA = document.getElementById('memArc'); if (memA) memA.style.strokeDashoffset = 282.7 - (mem / 100) * 282.7;
          const up = info.uptimeSec || 0;
          const m = Math.floor(up / 60); const s = up % 60;
          const upD = document.getElementById('uptimeDisplay'); if (upD) upD.innerText = `UPTIME: ${m}m ${s}s`;
        } catch (e) { }


        // Update Swarm Data for Topology
        try {
          const sr = await fetch('/api/swarm/status');
          swarmData = await sr.json();
        } catch (e) { }

        const clock = document.getElementById('clockDisplay');
        if (clock) clock.innerText = new Date().toLocaleTimeString('en-US', { hour12: false });
      }, 1000);

      // Subtle Entropy Drift (Simulation of constant monitoring)
      setInterval(() => {
        if (uiLocked) return;
        const ent = (7.98 + Math.random() * 0.04).toFixed(2);
        const eVal = document.getElementById('entropyGaugeVal');
        if (eVal) eVal.innerText = ent;
        const eArc = document.getElementById('entropyArc');
        if (eArc) eArc.style.strokeDashoffset = 282.7 - (parseFloat(ent) / 10) * 282.7;
      }, 1000);

      // System Heartbeat (Subtle status updates)
      const pulseMsgs = ["CORE_STABLE", "VAULT_SYNCED", "SWARM_ACTIVE", "LINK_RELIANCE_OK"];
      setInterval(() => {
        if (uiLocked) return;
        if (Math.random() > 0.8) {
          const msg = pulseMsgs[Math.floor(Math.random() * pulseMsgs.length)];
          log(msg, "HEARTBEAT");
        }
      }, 30000);



      // TEAR stats + live feed polling
      setInterval(async () => {
        try {
          const tr = await fetch('/api/tear/stats'); const ts = await tr.json();
          const badge = document.getElementById('tearBadge');
          if (badge) badge.innerText = `TEAR: ${ts.integrity} (#${ts.chainLength})`;
          const cl = document.getElementById('tearChainLen');
          if (cl) cl.innerText = ts.chainLength;
        } catch (e) { }
        try {
          const cr = await fetch('/api/tear/chain'); const chain = await cr.json();
          const feed = document.getElementById('tearFeed');
          if (feed && chain.length > 0) {
            feed.innerHTML = chain.slice(-12).reverse().map(e =>
              `<div class="entry"><span class="ts">[${new Date(e.header.timestamp).toLocaleTimeString('en-US', { hour12: false })}]</span> <span class="kind">${e.evidence.kind}</span> <span style="color:var(--dim)">${e.header.merkleRoot.substring(0, 12)}…</span></div>`
            ).join('');
          }
        } catch (e) { }
      }, 5000);
      loadSwarm();
    }

    // === FORGE (Code Browser) API ===
    let forgeEditor = null;
    let forgeRequireLoaded = false;

    function initForgeEditor() {
      if (forgeEditor || !window.require) return;
      require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
      require(['vs/editor/editor.main'], function () {
        forgeEditor = monaco.editor.create(document.getElementById('forgeMonaco'), {
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
        document.getElementById('forgeLoading').style.display = 'none';
        forgeRequireLoaded = true;
      });
    }

    async function loadForgeRepos() {
      initForgeEditor();
      try {
        const r = await fetch('/api/forge/repos'); const repos = await r.json();
        const sel = document.getElementById('forgeRepoSelect');
        sel.innerHTML = '<option value="">SELECT_REPOSITORY</option>' +
          '<option value="vaults">[SYSTEM_VAULTS]</option>' +
          repos.map(rep => `<option value="${rep}">${rep}</option>`).join('');
      } catch (e) { }
    }

    async function loadForgeTree(repo, dir = '/') {
      repo = repo || document.getElementById('forgeRepoSelect').value;
      if (!repo) return;
      try {
        const r = await fetch(`/api/forge/tree?repo=${repo}&dir=${encodeURIComponent(dir)}`);
        const tree = await r.json();
        let html = '';
        if (dir !== '/') {
          const up = dir.substring(0, dir.lastIndexOf('/')) || '/';
          html += `<div class="file-card" onclick="loadForgeTree('${repo}', '${up}')">📁 ..</div>`;
        }
        tree.forEach(f => {
          if (f.type === 'dir') {
            html += `<div class="file-card" style="color:var(--accent)" onclick="loadForgeTree('${repo}', '${f.path}')">📁 ${f.name}</div>`;
          } else {
            html += `<div class="file-card" onclick="loadForgeFile('${repo}', '${f.path}')">📄 ${f.name}</div>`;
          }
        });
        document.getElementById('forgeTree').innerHTML = html;
      } catch (e) { }
    }

    async function loadForgeFile(repo, filepath) {
      if (!forgeEditor) { initForgeEditor(); setTimeout(() => loadForgeFile(repo, filepath), 500); return; }
      document.getElementById('forgeCurrentPath').innerText = repo + filepath;
      document.getElementById('forgeLoading').style.display = 'flex';
      document.getElementById('forgeLoading').innerText = 'LOADING...';
      try {
        const r = await fetch(`/api/forge/file?repo=${repo}&path=${encodeURIComponent(filepath)}`);
        const res = await r.json();
        if (res.error) {
          log(`Forge Err: ${res.error}`, "ERR");
          document.getElementById('forgeLoading').innerText = '[ERROR]';
          return;
        }
        const ext = filepath.split('.').pop();
        const langMap = { 'js': 'javascript', 'ts': 'typescript', 'html': 'html', 'css': 'css', 'md': 'markdown', 'json': 'json', 'rs': 'rust' };
        monaco.editor.setModelLanguage(forgeEditor.getModel(), langMap[ext] || 'plaintext');
        forgeEditor.setValue(res.kind === 'binary' ? `[BINARY_ARTIFACT]\nSize: ${res.size} bytes` : res.text);
        document.getElementById('forgeLoading').style.display = 'none';
      } catch (e) {
        document.getElementById('forgeLoading').innerText = '[FAILED]';
      }
    }

    async function commitForge() {
      const path = document.getElementById('forgeCurrentPath').innerText;
      if (path === 'NO_FILE_SELECTED') return;
      const content = forgeEditor.getValue();
      log("Committing to Forge Matrix...", "SYS");
      try {
        const r = await fetch('/api/forge/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, content })
        });
        const res = await r.json();
        if (res.ok) log("Forge Commit Successful.", "OK");
        else log(`Forge Err: ${res.error}`, "ERR");
      } catch (e) { log("Forge connection failed.", "ERR"); }
    }

    async function executeForge() {
      const path = document.getElementById('forgeCurrentPath').innerText;
      if (path === 'NO_FILE_SELECTED') return;
      log(`Executing Artifact: ${path}`, "SYS");
      try {
        const r = await fetch('/api/forge/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path })
        });
        const res = await r.json();
        if (res.ok) log("Execution Initialized.", "OK");
        else log(`Exec Err: ${res.error}`, "ERR");
      } catch (e) { log("Execution connection failed.", "ERR"); }
    }

    async function forgeSearch() {
      const q = document.getElementById('forgeSearchInput').value;
      const repo = document.getElementById('forgeRepoSelect').value;
      if (!repo || !q) return;
      document.getElementById('forgeLoading').style.display = 'flex';
      document.getElementById('forgeLoading').innerText = 'SEARCHING...';
      try {
        const r = await fetch(`/api/forge/search?repo=${repo}&q=${encodeURIComponent(q)}`);
        const hits = await r.json();
        document.getElementById('forgeLoading').style.display = 'none';
        if (hits.length === 0) {
          log("No signatures found in Matrix.", "WARN");
          return;
        }
        // Show hits in a temporary list in the editor area or log em
        log(`Matrix Scan: ${hits.length} hits found.`, "OK");
        // For hit navigation, we'll keep the search list in the sidebar if we want to be fancy
        // But for now, we'll just log them and maybe let user click from log?
        // Actually, let's inject them into the tree area for quick access
        let html = `<div style="color:var(--accent); padding:5px; border-bottom:1px solid var(--border);">SCAN_RESULTS (${hits.length})</div>`;
        hits.forEach(h => {
          html += `<div class="file-card" onclick="loadForgeFile('${repo}', '${h.file}')" style="font-size:0.55rem;">🎯 ${h.file}</div>`;
        });
        document.getElementById('forgeTree').innerHTML = html;
      } catch (e) { document.getElementById('forgeLoading').style.display = 'none'; }
    }

    // Initialize list when switching to Forge tab
    const oldSwitchTab = switchTab;
    switchTab = function (tabId, el) {
      oldSwitchTab(tabId, el);
      if (tabId === 'forgePane') loadForgeRepos();
    };

    // === HANDSHAKE CHECK ===
    (async function () {
      try {
        const r = await fetch('/api/handshake'); const d = await r.json();
        if (d.seal) document.getElementById('coreSeal').innerText = d.seal;
      } catch (e) { }
    })();
  