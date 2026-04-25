import React, { useState, useEffect } from 'react';
import { 
  Shield, Globe, Cpu, Zap, Activity, 
  Terminal, Search, Box, RefreshCw, 
  Lock, CheckCircle2, AlertCircle, Share2
} from 'lucide-react';

declare global {
  interface Window {
    neuralos: any;
  }
}

// --- Dashboard Widget Component ---
const Widget = ({ title, icon: Icon, color, children, status }: any) => (
  <div className="bg-neural-800/40 backdrop-blur-xl border border-neural-700/50 rounded-2xl p-5 flex flex-col hover:border-neural-green/30 transition-all group overflow-hidden relative">
    <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-neural-green/10 transition-all`}></div>
    <div className="flex items-center justify-between mb-6 relative z-10">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-neural-900 border border-neural-700 text-${color}-400`}>
          <Icon size={18} />
        </div>
        <span className="font-mono text-[11px] font-black text-gray-300 uppercase tracking-widest">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full bg-${status === 'ACTIVE' ? 'neural-green' : 'neural-red'} animate-pulse`}></div>
        <span className={`text-[9px] font-mono font-bold ${status === 'ACTIVE' ? 'text-neural-green' : 'text-neural-red'}`}>{status}</span>
      </div>
    </div>
    <div className="flex-1 relative z-10">
      {children}
    </div>
  </div>
);

function App() {
  const [vpnStatus, setVpnStatus] = useState('OFFLINE');
  const [podStatus, setPodStatus] = useState('DISCONNECTED');
  const [vaultStatus, setVaultStatus] = useState('LOCKED');
  const [seal, setSeal] = useState('...');
  const [memEvents, setMemEvents] = useState<any[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);

  useEffect(() => {
    const init = async () => {
      const s = await window.neuralos.core.getSeal();
      setSeal(s);
      
      const v = await window.neuralos.vpn.status();
      setVpnStatus(v);

      const p = await window.neuralos.pod.status();
      setPodStatus(p);

      const state = await window.neuralos.state.get();
      setVaultStatus(state.vaultStatus);
    };
    init();

    // Listen for live memory events
    window.neuralos.shell.onMemoryUpdate((event: any) => {
      setMemEvents(prev => [event, ...prev].slice(0, 10));
    });

    // Listen for state changes
    window.neuralos.state.onUpdate((state: any) => {
      setVaultStatus(state.vaultStatus);
    });
  }, []);

  const runAudit = async () => {
    setIsAuditing(true);
    await window.neuralos.system.audit();
    setIsAuditing(false);
  };

  return (
    <div className="h-screen w-screen bg-[#050505] text-white p-8 font-sans select-none overflow-hidden flex flex-col">
      <header className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3">
            <Shield className="text-neural-green drop-shadow-[0_0_10px_rgba(0,255,0,0.3)]" size={32} />
            VAULTPANEL+™ <span className="text-gray-600 font-mono text-xs ml-2 tracking-[0.3em]">SOVEREIGN_CENTER</span>
          </h1>
        </div>
        <div className="flex gap-4">
          <div className="bg-neural-800/50 border border-neural-700 px-4 py-2 rounded-xl flex items-center gap-3">
            <Cpu size={16} className="text-neural-blue" />
            <div className="flex flex-col">
              <span className="text-[8px] text-gray-500 font-mono uppercase tracking-widest">Hardware_Root</span>
              <span className="text-[10px] font-mono font-black text-neural-blue">{seal.substring(0, 16)}</span>
            </div>
          </div>
          <button 
            onClick={runAudit}
            disabled={isAuditing}
            className={`bg-neural-green text-black px-6 py-2 rounded-xl font-mono text-xs font-black transition-all ${isAuditing ? 'opacity-50 cursor-wait' : 'hover:shadow-[0_0_20px_rgba(0,255,0,0.2)]'}`}
          >
            {isAuditing ? 'AUDITING...' : 'FULL_SYSTEM_AUDIT'}
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        {/* VIPN Status */}
        <Widget title="VIPN™ Tunnel" icon={Globe} color="green" status={vpnStatus === 'CONNECTED' ? 'ACTIVE' : 'READY'}>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-mono text-gray-500">Latency</span>
              <span className="text-lg font-mono font-black text-neural-green">14ms</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-mono text-gray-500">Protocol</span>
              <span className="text-[10px] font-mono font-black text-neural-blue uppercase">AES-256-GCM</span>
            </div>
            <div className="h-12 w-full bg-neural-900/50 rounded-lg border border-neural-700 flex items-center justify-center">
              <div className="flex gap-1">
                {[...Array(20)].map((_, i) => (
                  <div key={i} className={`w-1 h-${Math.random() > 0.5 ? '4' : '6'} bg-neural-green/40 rounded-full animate-pulse`} style={{ animationDelay: `${i * 0.1}s` }}></div>
                ))}
              </div>
            </div>
          </div>
        </Widget>

        {/* NeuralPod Status */}
        <Widget title="NeuralPod™ Mesh" icon={Share2} color="blue" status={podStatus === 'MESH_ACTIVE' ? 'ACTIVE' : 'DISCONNECTED'}>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-mono text-gray-500">Local Peers</span>
              <span className="text-lg font-mono font-black text-neural-blue">04</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-mono text-gray-500">Discovery</span>
              <span className="text-[10px] font-mono font-black text-neural-green uppercase">mDNS Active</span>
            </div>
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-neural-900 bg-neural-800 flex items-center justify-center">
                  <Box size={14} className="text-gray-500" />
                </div>
              ))}
              <div className="w-8 h-8 rounded-full border-2 border-neural-900 bg-neural-700 flex items-center justify-center text-[10px] font-black text-neural-blue">+</div>
            </div>
          </div>
        </Widget>

        {/* Cognitive Memory Stream */}
        <Widget title="Memory Stream" icon={Activity} color="purple" status="ACTIVE">
          <div className="space-y-2 h-[120px] overflow-y-auto custom-scrollbar">
            {memEvents.length > 0 ? memEvents.map((e, i) => (
              <div key={i} className="flex gap-3 text-[10px] font-mono animate-in slide-in-from-left-2 fade-in">
                <span className="text-gray-600">[{e.timestamp.split('T')[1].substring(0, 8)}]</span>
                <span className="text-purple-400 font-bold uppercase">{e.type}:</span>
                <span className="text-gray-400 truncate">{e.content}</span>
              </div>
            )) : (
              <div className="h-full flex items-center justify-center italic text-gray-600 text-[10px]">No recent cognitive activity.</div>
            )}
          </div>
        </Widget>

        {/* Integrity Map (Large Span) */}
        <div className="md:col-span-3 bg-neural-800/20 border border-neural-700/50 rounded-2xl p-6 flex flex-col gap-6 relative overflow-hidden">
          {isAuditing && (
            <div className="absolute inset-0 z-20 bg-neural-green/5 backdrop-blur-[1px] flex items-center justify-center">
              <div className="flex items-center gap-4 bg-black border border-neural-green px-8 py-4 rounded-full shadow-[0_0_50px_rgba(0,255,0,0.2)]">
                <RefreshCw size={24} className="text-neural-green animate-spin" />
                <span className="font-mono text-xs font-black text-neural-green tracking-widest uppercase">Deep_Sector_Lineage_Verification_In_Progress</span>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className={vaultStatus === 'VERIFIED_IMMUTABLE' ? 'text-neural-green' : 'text-neural-blue'} />
              <span className="font-mono text-xs font-black uppercase tracking-widest">
                {vaultStatus === 'VERIFIED_IMMUTABLE' ? 'Integrity_Root: 100%_SECURE' : 'Integrity_Matrix: PENDING_SCAN'}
              </span>
            </div>
            <div className="text-[10px] font-mono text-gray-500">Node_ID: {seal.substring(0, 12)}...</div>
          </div>
          <div className="grid grid-cols-8 md:grid-cols-12 gap-2 relative z-10">
            {[...Array(48)].map((_, i) => (
              <div key={i} className={`aspect-square rounded-[4px] border border-neural-700/50 transition-all duration-1000 ${vaultStatus === 'VERIFIED_IMMUTABLE' ? 'bg-neural-green/30 border-neural-green/40 shadow-[inset_0_0_10px_rgba(0,255,0,0.1)]' : 'bg-neural-blue/10'} hover:bg-neural-green cursor-crosshair`} title={`Sector 0x${i.toString(16)}: ${vaultStatus}`}></div>
            ))}
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-gray-500 border-t border-neural-700/30 pt-4 uppercase tracking-widest relative z-10">
            <div className="flex gap-6">
              <span className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${vaultStatus === 'VERIFIED_IMMUTABLE' ? 'bg-neural-green shadow-[0_0_8px_rgba(0,255,0,0.5)]' : 'bg-neural-blue animate-pulse'}`}></div> Verified_Sector</span>
              <span className="flex items-center gap-2"><div className="w-2 h-2 bg-neural-blue rounded-full"></div> Boot_Code</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap size={12} className={vaultStatus === 'VERIFIED_IMMUTABLE' ? 'text-neural-green animate-pulse' : 'text-gray-600'} />
              {vaultStatus === 'VERIFIED_IMMUTABLE' ? '100% Immutable Baseline' : 'Integrity_Lock: DISENGAGED'}
            </div>
          </div>
        </div>
      </main>

      <footer className="h-10 mt-8 border-t border-neural-800/50 flex items-center justify-between text-[10px] font-mono text-gray-600 uppercase tracking-[0.2em]">
        <div className="flex gap-8">
          <span>Mode: Cockpit</span>
          <span>Buffer: Optimized</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-neural-green">NeuralOS Singularity-Prime</span>
          <span className="bg-neural-800 px-2 py-0.5 rounded text-gray-400">Build: 2026.03.14</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
