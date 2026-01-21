/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { Haptics, ImpactFeedbackStyle } from '../lib/haptics';

export const Header = ({ 
  title, 
  leftAction, 
  rightAction 
}: { 
  title: string, 
  leftAction?: { icon: React.ReactNode, onPress: () => void }, 
  rightAction?: { icon: React.ReactNode, onPress: () => void } 
}) => (
  <header className="h-14 flex flex-row items-center justify-between px-4 border-b border-zinc-800 bg-zinc-950 shrink-0 z-50 w-full">
    <div className="flex flex-row items-center flex-1 pr-4 min-w-0">
      {leftAction && (
        <button 
          onClick={() => {
            Haptics.impactAsync(ImpactFeedbackStyle.Light);
            leftAction.onPress();
          }} 
          className="mr-4 p-1 text-white hover:text-zinc-300 transition-colors"
        >
          {leftAction.icon}
        </button>
      )}
      <h1 className="text-lg font-bold text-white truncate flex-1">{title}</h1>
    </div>
    {rightAction ? (
      <button 
        onClick={() => {
          Haptics.impactAsync(ImpactFeedbackStyle.Light);
          rightAction.onPress();
        }}
        className="p-1 text-white hover:text-zinc-300 transition-colors"
      >
        {rightAction.icon}
      </button>
    ) : <div className="w-8" />}
  </header>
);