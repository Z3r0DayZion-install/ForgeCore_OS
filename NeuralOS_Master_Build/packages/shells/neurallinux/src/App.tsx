import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Activity, Monitor, Grid, Terminal as TermIcon } from 'lucide-react';

declare global {
  interface Window {
    neuralos: any;
  }
}

function App() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize XTerm
    const term = new Terminal({
      theme: {
        background: '#020202',
        foreground: '#00ff00',
        cursor: '#00ff00',
        selectionBackground: 'rgba(0, 255, 0, 0.3)',
      },
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      fontSize: 12,
      cursorBlink: true,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;

    // Connect to Native PTY Bridge
    window.neuralos.pty.onData((data: string) => {
      term.write(data);
    });

    term.onData((data) => {
      window.neuralos.pty.send(data);
    });

    window.addEventListener('resize', () => {
      fitAddon.fit();
      window.neuralos.pty.resize(term.cols, term.rows);
    });

    term.writeln('\x1b[1;34m# NeuralLinux Kernel v1.0.1 Sovereign-Prime\x1b[0m');
    term.writeln('\x1b[1;32m# Lineage confirmed via trustctl\x1b[0m');
    term.writeln('');

    return () => {
      term.dispose();
    };
  }, []);

  return (
    <div className="h-screen w-screen bg-[#020202] text-neural-green overflow-hidden flex font-mono select-none">
      
      {/* Sidebar Metrics */}
      <div className="w-64 border-r border-neural-800 bg-black/40 p-6 flex flex-col gap-10">
        <div className="flex items-center gap-2 text-neural-blue">
          <Activity size={20} />
          <span className="text-xs font-bold tracking-widest">SYSTEM_PULSE</span>
        </div>
        
        <div className="space-y-6">
          <div>
            <div className="text-[10px] text-gray-600 mb-2 uppercase">CPU_LOAD</div>
            <div className="h-1.5 w-full bg-neural-900 rounded-full overflow-hidden border border-neural-800">
              <div className="h-full bg-neural-green w-[42%]"></div>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-600 mb-2 uppercase">MEM_VAULT</div>
            <div className="h-1.5 w-full bg-neural-900 rounded-full overflow-hidden border border-neural-800">
              <div className="h-full bg-neural-blue w-[68%]"></div>
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-4 text-[10px]">
          <button onClick={() => window.neuralos.shell.switch('winshadow')} className="flex items-center gap-3 text-gray-500 hover:text-white transition-colors">
            <Monitor size={14}/> WINSHADOW
          </button>
          <button onClick={() => window.neuralos.shell.switch('neuralmac')} className="flex items-center gap-3 text-gray-500 hover:text-white transition-colors">
            <Grid size={14}/> NEURALMAC
          </button>
          <button className="flex items-center gap-3 text-neural-green text-left">
            <TermIcon size={14}/> NEURALLINUX
          </button>
        </div>
      </div>

      {/* Terminal Main Area */}
      <div className="flex-1 flex flex-col bg-black/20 relative">
        <div className="absolute top-4 right-6 z-10 text-[9px] text-gray-700 uppercase tracking-[0.5em]">
          Tiling_WM: i3-Sovereign
        </div>
        <div ref={terminalRef} className="flex-1 p-4 overflow-hidden" />
      </div>
    </div>
  );
}

export default App;
