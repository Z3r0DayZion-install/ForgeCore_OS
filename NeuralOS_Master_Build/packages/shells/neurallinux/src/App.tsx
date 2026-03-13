import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal as TermIcon, Monitor, Grid, 
  Cpu, Zap, Shield, Cpu as Processor,
  HardDrive, Activity
} from 'lucide-react';

declare global {
  interface Window {
    neuralos: any;
  }
}

const TerminalLine = ({ type, text }: { type: 'cmd' | 'res' | 'sys', text: string }) => {
  const colors = {
    cmd: 'text-neural-green',
    res: 'text-gray-400',
    sys: 'text-neural-blue'
  };
  return (
    <div className="flex gap-2 font-mono text-xs mb-1">
      <span className={colors[type]}>{type === 'cmd' ? '>' : type === 'sys' ? '#' : '|'}</span>
      <span className={colors[type]}>{text}</span>
    </div>
  );
};

function App() {
  const [lines, setLines] = useState([
    { type: 'sys', text: 'NeuralLinux Kernel v1.0.1 Sovereign-Prime' },
    { type: 'sys', text: 'Lineage confirmed via trustctl' },
    { type: 'cmd', text: 'neofetch --sovereign' }
  ]);
  const [input, setInput] = useState('');
  const terminalEndRef = useRef<null | HTMLDivElement>(null);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newLines = [...lines, { type: 'cmd', text: input }];
    setLines(newLines);
    
    const result = await window.neuralos.shell.execute(input);
    setLines([...newLines, { type: 'res', text: result.response }]);
    setInput('');
  };

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

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
          <div>
            <div className="text-[10px] text-gray-600 mb-2 uppercase">TRUST_INDEX</div>
            <div className="h-1.5 w-full bg-neural-900 rounded-full overflow-hidden border border-neural-800">
              <div className="h-full bg-neural-green w-[100%]"></div>
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
          <button className="flex items-center gap-3 text-neural-green">
            <TermIcon size={14}/> NEURALLINUX
          </button>
        </div>
      </div>

      {/* Terminal Main Area */}
      <div className="flex-1 flex flex-col bg-black/20 relative">
        <div className="absolute top-4 right-6 text-[9px] text-gray-700 uppercase tracking-[0.5em]">
          Tiling_WM: i3-Sovereign
        </div>
        
        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
          {lines.map((line, i) => (
            <TerminalLine key={i} {...line as any} />
          ))}
          <div ref={terminalEndRef} />
        </div>

        <form onSubmit={handleCommand} className="p-4 bg-neural-900/50 border-t border-neural-800 flex items-center gap-3">
          <span className="text-neural-green font-bold">$</span>
          <input 
            autoFocus
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="bg-transparent border-none outline-none flex-1 text-xs text-neural-green font-mono uppercase"
            placeholder="Command_Input..."
          />
        </form>
      </div>
    </div>
  );
}

export default App;
