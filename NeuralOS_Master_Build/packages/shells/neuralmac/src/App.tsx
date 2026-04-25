import React, { useState, useEffect } from 'react';
import { 
  Monitor, Grid, Terminal, Settings, 
  Cpu, Shield, Power, Menu, ChevronDown, 
  Command, Layers, Box, Disc
} from 'lucide-react';

declare global {
  interface Window {
    neuralos: any;
  }
}

// --- macOS Inspired MenuBar ---
const MenuBar = () => {
  return (
    <div className="h-7 w-full bg-black/60 backdrop-blur-3xl border-b border-white/5 flex items-center px-4 justify-between z-50 text-[11px] font-mono text-gray-400">
      <div className="flex items-center gap-6">
        <Shield size={14} className="text-neural-green" />
        <span className="font-bold text-white tracking-tighter">NeuralOS</span>
        <span className="hover:text-white cursor-pointer">File</span>
        <span className="hover:text-white cursor-pointer">Node</span>
        <span className="hover:text-white cursor-pointer">Ritual</span>
        <span className="hover:text-white cursor-pointer">Vault</span>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1.5 text-neural-blue">
          <Cpu size={12}/> <span className="text-[10px]">98% SECURE</span>
        </div>
        <span>{new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

// --- macOS Inspired Grid Pane ---
const GridPane = ({ title, icon: Icon, colorClass }: any) => {
  return (
    <div className="w-80 h-96 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 flex flex-col hover:bg-white/10 transition-all group">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-2xl ${colorClass}`}>
        <Icon size={28} className="text-white" />
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-[11px] text-gray-500 font-mono leading-relaxed mb-8 uppercase tracking-widest">
        Integrated Sovereign Module for Triple-Shell Navigation.
      </p>
      <div className="mt-auto flex justify-between items-center text-[10px] font-mono text-gray-400 group-hover:text-white transition-colors">
        <span>MOUNTED_VAULT</span>
        <ChevronDown size={14}/>
      </div>
    </div>
  );
};

function App() {
  const [seal, setSeal] = useState('...');

  useEffect(() => {
    setSeal(window.neuralos.core.getSeal());
  }, []);

  return (
    <div className="h-screen w-screen bg-[#050505] text-white overflow-hidden relative select-none">
      {/* Background with Ambient Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-neural-blue/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-neural-green/10 rounded-full blur-[100px] animate-pulse"></div>

      <MenuBar />

      {/* Main Grid View */}
      <div className="h-[calc(100vh-28px)] w-full flex flex-col items-center justify-center px-20 relative z-10">
        <h1 className="text-4xl font-black tracking-[-0.05em] mb-4 text-white uppercase drop-shadow-2xl">NeuralMac™ // Sovereign Grid</h1>
        <p className="text-xs font-mono text-gray-500 uppercase tracking-[0.4em] mb-20 border-t border-white/5 pt-4">Singularity-Prime Phase 1: Triple-Shell Active</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <GridPane title="XXXplorer" icon={Layers} colorClass="bg-blue-600/80" />
          <GridPane title="VIPN" icon={Globe} colorClass="bg-green-600/80" />
          <GridPane title="NeuralShell" icon={Terminal} colorClass="bg-red-600/80" />
        </div>
      </div>

      {/* Sovereign Dock */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-3xl flex items-center gap-8 z-20 shadow-2xl">
        <button onClick={() => window.neuralos.shell.switch('winshadow')} className="hover:scale-125 transition-transform"><Monitor size={24} className="text-gray-400 hover:text-white" title="Switch to WinShadow"/></button>
        <button className="scale-125"><Grid size={24} className="text-white" title="Active: NeuralMac"/></button>
        <button onClick={() => window.neuralos.shell.switch('neurallinux')} className="hover:scale-125 transition-transform"><Terminal size={24} className="text-gray-400 hover:text-white" title="Switch to NeuralLinux"/></button>
        <div className="h-6 w-[1px] bg-white/10 mx-2"></div>
        <button className="hover:scale-125 transition-transform"><Disc size={24} className="text-neural-green"/></button>
        <button className="hover:scale-125 transition-transform"><Settings size={24} className="text-gray-400 hover:text-white"/></button>
      </div>

      <div className="absolute top-12 right-12 text-right font-mono">
        <div className="text-[10px] text-gray-500 uppercase tracking-widest">Seal_Pulse V3</div>
        <div className="text-[10px] text-neural-blue font-bold tracking-tighter uppercase">{seal?.substring(0, 16)}</div>
      </div>
    </div>
  );
}

export default App;
