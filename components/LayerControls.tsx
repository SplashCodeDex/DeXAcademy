/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { Settings2, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { PlacedLayer } from '../types';

interface LayerControlsProps {
  layer: PlacedLayer;
  onUpdate: (updates: Partial<PlacedLayer>) => void;
  onCommit: () => void; // Trigger history save
  onDelete: () => void;
  onReorder: (direction: 'forward' | 'backward') => void;
  onClose: () => void;
}

export const LayerControls: React.FC<LayerControlsProps> = ({
  layer,
  onUpdate,
  onCommit,
  onDelete,
  onReorder,
  onClose
}) => {
  return (
    <div className="p-4 h-64 flex flex-col overflow-y-auto animate-slide-up">
      <div className="flex justify-between items-center mb-4">
        <span className="text-white font-bold flex items-center">
            <Settings2 size={16} className="mr-2" /> 
            Edit Layer
        </span>
        <div className="flex gap-2">
          <button 
            onClick={onDelete} 
            className="p-2 bg-red-500/20 rounded text-red-500 hover:bg-red-500/30 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {/* Sliders */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between">
            <span className="text-zinc-400 text-xs font-bold uppercase">Scale</span>
            <span className="text-white text-xs font-mono">{(layer.scale * 100).toFixed(0)}%</span>
          </div>
          <input 
            type="range" 
            min="0.1" 
            max="5" 
            step="0.1"
            value={layer.scale}
            onChange={(e) => onUpdate({ scale: parseFloat(e.target.value) })}
            onMouseUp={onCommit}
            onTouchEnd={onCommit}
            className="w-full"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between">
             <span className="text-zinc-400 text-xs font-bold uppercase">Rotation</span>
             <span className="text-white text-xs font-mono">{Math.round(layer.rotation)}°</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="360" 
            step="15"
            value={layer.rotation}
            onChange={(e) => onUpdate({ rotation: parseFloat(e.target.value) })}
            onMouseUp={onCommit}
            onTouchEnd={onCommit}
            className="w-full"
          />
        </div>

        {/* Blend Mode Controls */}
        <div className="flex flex-col gap-2">
          <span className="text-zinc-500 text-xs font-bold uppercase">Blend Mode</span>
          <div className="flex bg-zinc-800 rounded-lg p-1">
            {['normal', 'multiply', 'screen'].map((mode) => (
              <button
                key={mode}
                onClick={() => {
                    onUpdate({ blendMode: mode as any });
                    // Blend mode changes are instant clicks, so we commit immediately
                    setTimeout(onCommit, 0); 
                }}
                className={`flex-1 py-1.5 text-xs font-bold capitalize rounded-md transition-all ${
                    (layer.blendMode === mode || (!layer.blendMode && mode === 'normal'))
                    ? 'bg-indigo-600 text-white shadow' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Z-Index Controls */}
        <div className="flex flex-row gap-3">
          <button
            onClick={() => onReorder('backward')}
            className="flex-1 bg-zinc-800 py-2.5 rounded-lg flex items-center justify-center text-zinc-300 hover:bg-zinc-700 active:scale-95 transition-all"
          >
            <ArrowDown size={14} className="mr-2" />
            <span className="text-xs font-bold">Move Back</span>
          </button>
          <button
            onClick={() => onReorder('forward')}
            className="flex-1 bg-zinc-800 py-2.5 rounded-lg flex items-center justify-center text-zinc-300 hover:bg-zinc-700 active:scale-95 transition-all"
          >
            <ArrowUp size={14} className="mr-2" />
            <span className="text-xs font-bold">Move Front</span>
          </button>
        </div>
      </div>
    </div>
  );
};