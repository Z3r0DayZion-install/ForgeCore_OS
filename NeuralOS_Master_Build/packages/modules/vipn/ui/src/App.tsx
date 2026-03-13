import React, { useState, useEffect } from 'react';
import { Globe, Shield, Activity, Cpu } from 'lucide-react';

declare global {
  interface Window {
    neuralos: any;
  }
}

function App() {
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
    <div className="h-screen w-screen bg-[#050505] text-white p-12 flex flex-col items-center justify-center font-sans select-none overflow-hidden">
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

      <div className="mt-auto w-full grid grid-cols-3 gap-6 font-mono text-center max-w-md">
        <div className="bg-white/5 p-4 rounded-xl border border-white/5 backdrop-blur-md">
          <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Latency</div>
          <div className="text-xs text-neural-blue font-black">14ms</div>
        </div>
        <div className="bg-white/5 p-4 rounded-xl border border-white/5 backdrop-blur-md">
          <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Protocol</div>
          <div className="text-xs text-neural-green font-black">Sovereign</div>
        </div>
        <div className="bg-white/5 p-4 rounded-xl border border-white/5 backdrop-blur-md">
          <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Integrity</div>
          <div className="text-xs text-neural-green font-black">100%</div>
        </div>
      </div>
    </div>
  );
}

export default App;
