/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, X, Mic, MicOff } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

interface AICommandBarProps {
  onCommand: (text: string) => Promise<void>;
  isProcessing: boolean;
  onClose: () => void;
}

export const AICommandBar: React.FC<AICommandBarProps> = ({ onCommand, isProcessing, onClose }) => {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
        const recognition = new (window as any).webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setText(transcript);
            // Auto-submit on voice match
            setTimeout(() => {
                if (transcript.trim()) onCommand(transcript);
            }, 500);
        };
        recognition.onerror = (e: any) => {
            console.error(e);
            setIsListening(false);
        };

        recognitionRef.current = recognition;
    }
  }, [onCommand]);

  const toggleListening = () => {
      if (isListening) {
          recognitionRef.current?.stop();
      } else {
          recognitionRef.current?.start();
          setText(''); // Clear previous text when starting new dictation
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onCommand(text);
      setText('');
    }
  };

  const hasSpeech = !!recognitionRef.current;

  return (
    <div className="absolute bottom-32 left-4 right-4 z-30 animate-slide-up">
       <div className="bg-black/90 backdrop-blur-xl border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden p-3 ring-1 ring-white/10">
          <div className="flex items-center justify-between mb-2 px-1">
             <div className="flex items-center gap-2">
                 <Sparkles size={14} className="text-indigo-400" />
                 <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Studio AI Assistant</span>
             </div>
             <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                 <X size={14} />
             </button>
          </div>
          
          <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
             <div className="relative flex-1">
                <input 
                    autoFocus={!isListening}
                    type="text"
                    value={isListening ? 'Listening...' : text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="e.g. 'Put logo on the pocket'"
                    className={`w-full bg-zinc-900 border border-zinc-700 rounded-xl py-3 pl-4 pr-4 text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all ${isListening ? 'animate-pulse text-indigo-400 font-bold' : ''}`}
                    disabled={isProcessing || isListening}
                />
             </div>

             {hasSpeech && (
                 <button 
                    type="button"
                    onClick={toggleListening}
                    className={`p-3 rounded-xl transition-all active:scale-95 border ${isListening ? 'bg-red-500/20 text-red-500 border-red-500' : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'}`}
                 >
                    {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                 </button>
             )}

             <button 
                type="submit" 
                disabled={!text.trim() || isProcessing || isListening}
                className="p-3 bg-indigo-600 rounded-xl text-white disabled:opacity-50 disabled:bg-zinc-700 transition-all hover:bg-indigo-500 active:scale-95 shadow-lg shadow-indigo-500/20"
             >
                {isProcessing ? <LoadingSpinner size={18} color="text-white" /> : <Send size={18} />}
             </button>
          </form>
          
          {isProcessing && (
              <div className="mt-2 px-1 flex items-center gap-2">
                  <LoadingSpinner size={10} color="text-indigo-400" />
                  <span className="text-[10px] text-zinc-400 font-mono">Thinking & Calculating Coordinates...</span>
              </div>
          )}
       </div>
    </div>
  );
};