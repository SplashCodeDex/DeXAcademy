/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { Package } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

export const SplashScreen = () => (
  <div className="flex-1 bg-black flex flex-col items-center justify-center overflow-hidden h-full w-full absolute inset-0 z-50">
     <div className="flex flex-col items-center justify-center">
        <div className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center mb-6 animate-hop-in shadow-xl shadow-indigo-500/30">
           <Package size={48} className="text-white" />
        </div>
        <h1 className="text-4xl font-black text-white mb-2 animate-swoop-in">
           Mockup Studio
        </h1>
        <p className="text-zinc-400 text-lg animate-pop-in" style={{ animationDelay: '0.5s' }}>
           AI Product Visualization
        </p>
     </div>
     <div className="absolute bottom-12 animate-spin-appear" style={{ animationDelay: '1s' }}>
        <LoadingSpinner color="text-indigo-500" />
     </div>
  </div>
);