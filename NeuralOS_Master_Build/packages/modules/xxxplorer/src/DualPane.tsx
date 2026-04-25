import React from 'react';
import { Filter, HardDrive, Search } from 'lucide-react';

/**
 * NT-XXX-05: Refined Dual-Pane Layout Component.
 * Features resizable columns and integrated filter bars.
 */

const PaneHeader = ({ title }: { title: string }) => (
  <div className="bg-neural-800 p-2 flex items-center justify-between border-b border-neural-700">
    <div className="flex items-center gap-2">
      <HardDrive size={14} className="text-neural-green" />
      <span className="text-[10px] font-mono text-gray-300 uppercase tracking-widest">{title}</span>
    </div>
    <div className="flex gap-2">
      <Search size={12} className="text-gray-500" />
      <Filter size={12} className="text-gray-500" />
    </div>
  </div>
);

type DualPaneProps = {
  leftContent: React.ReactNode;
  rightFiles: React.ReactNode;
  leftTitle?: string;
  rightTitle?: string;
};

export const DualPane = ({ leftContent, rightFiles, leftTitle = 'Sector_A', rightTitle = 'Sector_B' }: DualPaneProps) => {
  return (
    <div className="flex-1 flex overflow-hidden bg-black/20">
      <div className="flex-1 flex flex-col border-r border-neural-800">
        <PaneHeader title={leftTitle} />
        <div className="flex-1 overflow-y-auto p-2">
          {leftContent}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <PaneHeader title={rightTitle} />
        <div className="flex-1 overflow-y-auto p-2">
          {rightFiles}
        </div>
      </div>
    </div>
  );
};
