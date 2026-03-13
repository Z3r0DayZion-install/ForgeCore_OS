import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, Cpu, Globe, Terminal, Folder, 
  Settings, Power, Zap, Lock, Unlock, 
  ChevronRight, Command, MessageSquare, Maximize2, Minimize2, X 
} from 'lucide-react';

declare global {
  interface Window {
    neuralos: any;
  }
}

// --- OS Window Manager ---
const OSWindow = ({ title, icon: Icon, children, isOpen, onClose, defaultPos = { x: 100, y: 100 } }: any) => {
  if (!isOpen) return null;
  return (
    <div 
      className="absolute bg-neural-900/90 backdrop-blur-xl border border-neural-800 shadow-2xl rounded-lg overflow-hidden flex flex-col"
      style={{ top: defaultPos.y, left: defaultPos.x, width: '800px', height: '500px', zIndex: 50 }}
    >
      <div className="h-10 bg-neural-800/50 border-b border-neural-700 flex items-center justify-between px-4 cursor-move select-none">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-neural-green" />
          <span className="font-mono text-[11px] font-bold text-gray-300 uppercase tracking-widest">{title}</span>
        </div>
        <div className="flex gap-3">
          <button className="text-gray-500 hover:text-white transition-colors"><Minimize2 size={14}/></button>
          <button className="text-gray-500 hover:text-white transition-colors"><Maximize2 size={14}/></button>
          <button onClick={onClose} className="text-neural-red hover:text-red-400 transition-colors"><X size={14}/></button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>
    </div>
  );
};

// --- VIPN Control Panel ---
const VIPNPanel = () => {
  const [status, setStatus] = useState('OFFLINE');
  const [isConnecting, setIsConnecting] = useState(false);

  const toggleVPN = async () => {
    setIsConnecting(true);
    if (status === 'OFFLINE') {
      await window.neuralos.vpn.start('{"node": "Oasis-Prime"}');
      setStatus('CONNECTED');
    } else {
      await window.neuralos.vpn.stop();
      setStatus('OFFLINE');
    }
    setIsConnecting(false);
  };

  return (
    <div className="p-8 h-full flex flex-col items-center justify-center bg-gradient-to-b from-transparent to-black/40">
      <div className={`w-32 h-32 rounded-full border-2 flex items-center justify-center transition-all duration-700 ${status === 'CONNECTED' ? 'border-neural-green shadow-[0_0_30px_rgba(0,255,0,0.2)]' : 'border-neural-red shadow-[0_0_30px_rgba(255,0,0,0.1)]'}`}>
        <Globe size={48} className={status === 'CONNECTED' ? 'text-neural-green animate-pulse' : 'text-neural-red'} />
      </div>
      <h2 className={`mt-6 font-mono font-black text-2xl tracking-tighter ${status === 'CONNECTED' ? 'text-neural-green' : 'text-neural-red'}`}>
        {status}
      </h2>
      <div className="mt-2 text-gray-500 font-mono text-[10px] uppercase tracking-[0.3em]">WFP_KILL_SWITCH: ACTIVE</div>
      
      <button 
        onClick={toggleVPN}
        disabled={isConnecting}
        className={`mt-10 px-12 py-3 rounded-full font-mono text-sm font-bold border transition-all ${status === 'CONNECTED' ? 'bg-neural-green text-black border-neural-green hover:bg-transparent hover:text-neural-green' : 'bg-transparent text-neural-red border-neural-red hover:bg-neural-red hover:text-white'}`}
      >
        {isConnecting ? 'PROCESSING...' : status === 'OFFLINE' ? 'ESTABLISH_LINK' : 'SEVER_CONNECTION'}
      </button>

      <div className="mt-auto w-full grid grid-cols-3 gap-4 font-mono text-center">
        <div className="bg-neural-800/30 p-3 rounded border border-neural-700/50">
          <div className="text-[9px] text-gray-500 uppercase">Latency</div>
          <div className="text-xs text-neural-blue">14ms</div>
        </div>
        <div className="bg-neural-800/30 p-3 rounded border border-neural-700/50">
          <div className="text-[9px] text-gray-500 uppercase">Traffic</div>
          <div className="text-xs text-neural-green">Encrypted</div>
        </div>
        <div className="bg-neural-800/30 p-3 rounded border border-neural-700/50">
          <div className="text-[9px] text-gray-500 uppercase">Sovereignty</div>
          <div className="text-xs text-neural-green">100%</div>
        </div>
      </div>
    </div>
  );
};

// --- Main Desktop ---
function App() {
  const [windows, setWindows] = useState({
    explorer: true,
    vpn: true,
    shell: false
  });
  const [seal, setSeal] = useState('LOADING...');
  const [commandInput, setCommandInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    setSeal(window.neuralos.core.getSeal());
  }, []);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    setIsTyping(true);
    setAiResponse('PROCESSING_SOVEREIGN_COMMAND...');
    
    const result = await window.neuralos.shell.execute(commandInput);
    
    setAiResponse(result.response);
    setIsTyping(false);
    setCommandInput('');
    
    // Auto-clear response after 5s
    setTimeout(() => setAiResponse(''), 5000);
  };

  return (
    <div className="h-screen w-screen bg-[#020202] text-white overflow-hidden relative select-none">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#0a0a0a_0%,#020202_100%)] opacity-100 z-0"></div>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 contrast-150 mix-blend-overlay z-0"></div>

      {/* Desktop Icons */}
      <div className="absolute top-10 left-10 flex flex-col gap-8 z-10">
        <div onClick={() => setWindows({...windows, explorer: true})} className="flex flex-col items-center gap-2 group cursor-pointer">
          <div className="p-4 bg-neural-800/40 rounded-xl border border-neural-700 group-hover:bg-neural-700 group-hover:scale-110 transition-all shadow-xl">
            <Folder size={32} className="text-neural-blue" />
          </div>
          <span className="text-[10px] font-mono text-gray-400 group-hover:text-white tracking-widest uppercase">XXXplorer</span>
        </div>
        <div onClick={() => setWindows({...windows, vpn: true})} className="flex flex-col items-center gap-2 group cursor-pointer">
          <div className="p-4 bg-neural-800/40 rounded-xl border border-neural-700 group-hover:bg-neural-700 group-hover:scale-110 transition-all shadow-xl">
            <Globe size={32} className="text-neural-green" />
          </div>
          <span className="text-[10px] font-mono text-gray-400 group-hover:text-white tracking-widest uppercase">VIPN</span>
        </div>
      </div>

      {/* NeuralShell Command Bar */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 w-[650px] z-50 flex flex-col items-center">
        <form 
          onSubmit={handleCommand}
          className={`w-full bg-neural-800/80 backdrop-blur-md border rounded-full flex items-center px-6 py-2.5 shadow-2xl transition-all duration-300 ${isTyping ? 'border-neural-blue ring-1 ring-neural-blue/30' : 'border-neural-700 hover:border-neural-green'}`}
        >
          <Command size={18} className={isTyping ? 'text-neural-blue' : 'text-neural-green mr-4'} />
          <input 
            type="text" 
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="NEURALSHELL™ // ENTER SOVEREIGN COMMAND..." 
            className="bg-transparent border-none outline-none flex-1 font-mono text-xs text-neural-green placeholder-gray-600 uppercase tracking-tighter"
          />
          <div className="flex gap-2">
            <div className={`w-2 h-2 rounded-full ${isTyping ? 'bg-neural-blue animate-pulse' : 'bg-neural-green'}`}></div>
            <div className="w-2 h-2 rounded-full bg-neural-blue/40"></div>
          </div>
        </form>
        {aiResponse && (
          <div className="mt-2 bg-neural-900/90 border border-neural-800 px-6 py-2 rounded-lg backdrop-blur-md shadow-xl animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <MessageSquare size={12} className="text-neural-blue" />
              <span className="font-mono text-[10px] text-neural-blue uppercase tracking-widest">{aiResponse}</span>
            </div>
          </div>
        )}
      </div>

      {/* Windows Layer */}
      <OSWindow 
        title="VIPN™ // Native_KillSwitch" 
        icon={Shield} 
        isOpen={windows.vpn} 
        onClose={() => setWindows({...windows, vpn: false})}
        defaultPos={{ x: 300, y: 200 }}
      >
        <VIPNPanel />
      </OSWindow>

      <OSWindow 
        title="XXXplorer™ // Dual_Pane_Lineage" 
        icon={Folder} 
        isOpen={windows.explorer} 
        onClose={() => setWindows({...windows, explorer: false})}
        defaultPos={{ x: 150, y: 150 }}
      >
        <iframe src="../modules/xxxplorer/dist/index.html" className="w-full h-full border-none" />
      </OSWindow>

      {/* Taskbar */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-black/60 backdrop-blur-2xl border-t border-neural-800 flex items-center px-6 justify-between z-[100]">
        <div className="flex items-center gap-6">
          <button className="bg-neural-800 p-2 rounded border border-neural-700 hover:bg-neural-700 transition-all group">
            <Shield size={20} className="text-neural-green group-hover:scale-110" />
          </button>
          <div className="h-6 w-[1px] bg-neural-800"></div>
          <div className="flex gap-4">
            <Folder size={18} className="text-gray-500 hover:text-neural-green cursor-pointer" />
            <Globe size={18} className="text-gray-500 hover:text-neural-green cursor-pointer" />
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex flex-col items-end font-mono">
            <span className="text-[10px] text-neural-green font-bold">SOVEREIGN_V0.1</span>
            <span className="text-[9px] text-gray-600 uppercase tracking-widest font-black">Seal: {seal?.substring(0, 16)}</span>
          </div>
          <div className="h-6 w-[1px] bg-neural-800"></div>
          <div className="text-neural-green font-mono text-xs font-bold tabular-nums">
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
