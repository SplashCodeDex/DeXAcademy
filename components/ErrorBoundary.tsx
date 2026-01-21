/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 min-h-screen bg-black flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl max-w-md w-full flex flex-col items-center text-center shadow-2xl">
             <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle size={32} className="text-red-500" />
             </div>
             <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
             <p className="text-zinc-400 text-sm mb-6">
                The application encountered an unexpected error. Your data is safe in local storage.
             </p>
             <div className="bg-zinc-950 p-3 rounded-lg w-full mb-6 border border-zinc-800 overflow-hidden">
                <code className="text-xs text-red-300 font-mono break-all block text-left">
                    {this.state.error?.message}
                </code>
             </div>
             <Button 
                onClick={() => window.location.reload()} 
                icon={<RefreshCcw size={18} />}
                className="w-full"
             >
                Reload Application
             </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}