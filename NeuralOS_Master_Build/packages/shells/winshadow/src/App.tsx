import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, Cpu, Globe, Terminal, Folder, 
  Settings, Power, Zap, Lock, Unlock, 
  ChevronRight, Command, MessageSquare, Maximize2, Minimize2, X,
  Search, HardDrive, Battery, Activity
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
      className="absolute bg-neural-900/95 backdrop-blur-3xl border border-neural-800 shadow-[0_30px_60px_rgba(0,0,0,0.8)] rounded-xl overflow-hidden flex flex-col"
      style={{ top: defaultPos.y, left: defaultPos.x, width: '900px', height: '600px', zIndex: 50 }}
    >
      <div className="h-11 bg-neural-800/40 border-b border-neural-700 flex items-center justify-between px-4 cursor-move select-none">
        <div className="flex items-center gap-2.5">
          <Icon size={16} className="text-neural-green" />
          <span className="font-mono text-[10px] font-black text-gray-200 uppercase tracking-[0.2em]">{title}</span>
        </div>
        <div className="flex gap-4">
          <button className="text-gray-500 hover:text-white transition-colors"><Minimize2 size={14}/></button>
          <button className="text-gray-500 hover:text-white transition-colors"><Maximize2 size={14}/></button>
          <button onClick={onClose} className="text-neural-red hover:text-red-400 transition-colors"><X size={16}/></button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative bg-black/20">
        {children}
      </div>
    </div>
  );
};

// --- VIPN Control Panel ---
const VIPNPanel = () => {
  const [status, setStatus] = useState('OFFLINE');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      const s = await window.neuralos.vpn.status();
      setStatus(s);
    };
    checkStatus();
  }, []);

  const toggleVPN = async () => {
    setIsConnecting(true);
    if (status === 'OFFLINE') {
      const res = await window.neuralos.vpn.start('{"node": "Oasis-Prime"}');
      if (res.success) setStatus('CONNECTED');
    } else {
      const res = await window.neuralos.vpn.stop();
      if (res.success) setStatus('OFFLINE');
    }
    setIsConnecting(false);
  };

  return (
    <div className="p-12 h-full flex flex-col items-center justify-center bg-gradient-to-br from-neural-900 via-black to-neural-800/20">
      <div className={`w-40 h-40 rounded-full border-2 flex items-center justify-center transition-all duration-1000 ${status === 'CONNECTED' ? 'border-neural-green shadow-[0_0_50px_rgba(0,255,0,0.15)]' : 'border-neural-red shadow-[0_0_50px_rgba(255,0,0,0.1)]'}`}>
        <Globe size={64} className={status === 'CONNECTED' ? 'text-neural-green animate-pulse' : 'text-neural-red'} />
      </div>
      <h2 className={`mt-8 font-mono font-black text-3xl tracking-tighter ${status === 'CONNECTED' ? 'text-neural-green' : 'text-neural-red'}`}>
        {status}
      </h2>
      <div className="mt-3 text-gray-500 font-mono text-[10px] uppercase tracking-[0.4em] font-bold">WFP_NETWORK_LOCK: {status === 'CONNECTED' ? 'ENGAGED' : 'READY'}</div>
      
      <button 
        onClick={toggleVPN}
        disabled={isConnecting}
        className={`mt-12 px-16 py-4 rounded-full font-mono text-sm font-black border transition-all duration-300 ${status === 'CONNECTED' ? 'bg-neural-green text-black border-neural-green hover:shadow-[0_0_30px_rgba(0,255,0,0.4)]' : 'bg-transparent text-neural-red border-neural-red hover:bg-neural-red hover:text-white'}`}
      >
        {isConnecting ? 'INITIALIZING_TUNNEL...' : status === 'OFFLINE' ? 'SECURE_CONNECTION' : 'DISCONNECT_NODE'}
      </button>
    </div>
  );
};

// --- Main Desktop ---
function App() {
  const [windows, setWindows] = useState({
    explorer: true,
    vpn: false,
    panel: false
  });
  const [seal, setSeal] = useState('...');
  const [commandInput, setCommandInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [metrics, setMetrics] = useState({ cpu: 0, ram: 0, battery: 100 });

  useEffect(() => {
    const fetchMetrics = async () => {
      const m = await window.neuralos.system.metrics();
      setMetrics(m);
    }
    const interval = setInterval(fetchMetrics, 2000);
    
    window.neuralos.core.getSeal().then((s: string) => setSeal(s));

    return () => clearInterval(interval);
  }, []);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    setIsTyping(true);
    const result = await window.neuralos.shell.execute(commandInput);
    setAiResponse(result.response);
    setIsTyping(false);
    setCommandInput('');
    setTimeout(() => setAiResponse(''), 8000);
  };

  const launchApp = async (path: string) => {
    await window.neuralos.system.launch(path);
  };

  return (
    <div className="h-screen w-screen bg-[#020202] text-white overflow-hidden relative select-none font-sans">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#0a0a0a_0%,#020202_100%)] opacity-100 z-0"></div>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] contrast-150 mix-blend-overlay z-0"></div>

      {/* Desktop Icons */}
      <div className="absolute top-12 left-12 grid grid-cols-1 gap-10 z-10 text-center">
        <div onClick={() => setWindows({...windows, explorer: true})} className="flex flex-col items-center gap-2 group cursor-pointer">
          <div className="p-5 bg-neural-800/30 rounded-2xl border border-white/5 group-hover:bg-neural-700/50 transition-all shadow-2xl backdrop-blur-md">
            <Folder size={36} className="text-neural-blue" />
          </div>
          <span className="text-[10px] font-mono text-gray-400 group-hover:text-white tracking-widest font-black uppercase">Vault</span>
        </div>
        <div onClick={() => launchApp('calc.exe')} className="flex flex-col items-center gap-2 group cursor-pointer">
          <div className="p-5 bg-neural-800/30 rounded-2xl border border-white/5 group-hover:bg-neural-700/50 transition-all shadow-2xl backdrop-blur-md">
            <Activity size={36} className="text-neural-green" />
          </div>
          <span className="text-[10px] font-mono text-gray-400 group-hover:text-white tracking-widest font-black uppercase">Calculator</span>
        </div>
        <div onClick={() => launchApp('notepad.exe')} className="flex flex-col items-center gap-2 group cursor-pointer">
          <div className="p-5 bg-neural-800/30 rounded-2xl border border-white/5 group-hover:bg-neural-700/50 transition-all shadow-2xl backdrop-blur-md">
            <HardDrive size={36} className="text-neural-red" />
          </div>
          <span className="text-[10px] font-mono text-gray-400 group-hover:text-white tracking-widest font-black uppercase">Notepad</span>
        </div>
      </div>

      {/* NeuralShell Command Bar */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] z-[100] flex flex-col items-center">
        <form 
          onSubmit={handleCommand}
          className={`w-full bg-neural-800/60 backdrop-blur-2xl border rounded-full flex items-center px-8 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all ${isTyping ? 'border-neural-blue' : 'border-white/10 hover:border-neural-green/50'}`}
        >
          <Command size={20} className={isTyping ? 'text-neural-blue animate-spin' : 'text-neural-green mr-5'} />
          <input 
            type="text" 
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="NEURALSHELL™ // SYSTEM_OVERRIDE_ENABLED" 
            className="bg-transparent border-none outline-none flex-1 font-mono text-xs text-neural-green uppercase tracking-widest font-bold"
          />
        </form>
        {aiResponse && (
          <div className="mt-4 bg-neural-900/80 border border-neural-800 px-8 py-3 rounded-2xl backdrop-blur-3xl animate-in fade-in slide-in-from-top-4 duration-500">
            <span className="font-mono text-[11px] text-neural-blue uppercase tracking-widest font-bold">{aiResponse}</span>
          </div>
        )}
      </div>

      {/* Windows Layer */}
      <OSWindow title="VIPN™ // Native_KillSwitch" icon={Shield} isOpen={windows.vpn} onClose={() => setWindows({...windows, vpn: false})} defaultPos={{ x: 400, y: 220 }}>
        <iframe src="../../../modules/vipn/ui/dist/index.html" className="w-full h-full border-none" />
      </OSWindow>
      <OSWindow title="XXXplorer™ // Dual_Pane_Lineage" icon={Folder} isOpen={windows.explorer} onClose={() => setWindows({...windows, explorer: false})} defaultPos={{ x: 180, y: 160 }}><iframe src="../../../modules/xxxplorer/dist/index.html" className="w-full h-full border-none" /></OSWindow>
      <OSWindow title="VaultPanel+™ // Cockpit" icon={Zap} isOpen={windows.panel} onClose={() => setWindows({...windows, panel: false})} defaultPos={{ x: 600, y: 100 }}><iframe src="../../../modules/vaultpanel-plus/dist/index.html" className="w-full h-full border-none" /></OSWindow>

      {/* Taskbar */}
      <div className="absolute bottom-0 left-0 right-0 h-14 bg-black/40 backdrop-blur-3xl border-t border-white/5 flex items-center px-8 justify-between z-[1000]">
        <div className="flex items-center gap-10">
          <Shield size={22} className="text-neural-green drop-shadow-[0_0_8px_rgba(0,255,0,0.4)] cursor-pointer" />
          <div className="flex gap-8">
            <Folder onClick={() => setWindows({...windows, explorer: true})} size={20} className="text-gray-500 hover:text-neural-blue cursor-pointer" />
            <Globe onClick={() => setWindows({...windows, vpn: true})} size={20} className="text-gray-500 hover:text-neural-green cursor-pointer" />
            <Zap onClick={() => setWindows({...windows, panel: true})} size={20} className="text-gray-500 hover:text-neural-green cursor-pointer" />
          </div>
        </div>

        <div className="flex items-center gap-10">
          {/* Metrics Widget */}
          <div className="flex gap-6 font-mono text-[10px] text-gray-500 font-black">
            <div className="flex items-center gap-2"><Cpu size={12} className="text-neural-blue"/> {metrics.cpu}%</div>
            <div className="flex items-center gap-2"><Activity size={12} className="text-neural-green"/> {metrics.ram}%</div>
            <div className="flex items-center gap-2"><Battery size={12} className="text-neural-green"/> {metrics.battery}%</div>
          </div>
          <div className="h-7 w-[1px] bg-white/5"></div>
          <div className="flex flex-col items-end font-mono">
            <span className="text-[10px] text-neural-green font-black">SOVEREIGN_V0.1</span>
            <span className="text-[9px] text-gray-600 uppercase">Seal: {seal?.substring(0, 16)}</span>
          </div>
          <div className="h-7 w-[1px] bg-white/5"></div>
          <div className="text-neural-green font-mono text-sm font-black tabular-nums">
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
