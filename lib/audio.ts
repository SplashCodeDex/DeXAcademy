/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioController {
  private ctx: AudioContext | null = null;
  // Muted by default until user interaction to comply with Autoplay policies
  private enabled: boolean = true; 
  private swooshBuffer: AudioBuffer | null = null;

  private init() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) this.ctx = new Ctx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  playClick() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // High-pitch blip
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.05);
    
    gain.gain.setValueAtTime(0.03, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(t + 0.05);
  }

  playSuccess() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    // Ascending Major Triad Arpeggio
    [523.25, 659.25, 783.99].forEach((freq, i) => { // C5, E5, G5
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        const start = t + i * 0.08;
        
        osc.type = 'sine';
        osc.frequency.value = freq;
        
        gain.gain.setValueAtTime(0.05, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        
        osc.start(start);
        osc.stop(start + 0.3);
    });
  }

  playError() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // Low Sawtooth Buzz
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.linearRampToValueAtTime(100, t + 0.3);
    
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.linearRampToValueAtTime(0.001, t + 0.3);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(t + 0.3);
  }

  playSwoosh() {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      // Lazy load buffer once
      if (!this.swooshBuffer) {
          const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 sec
          const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
          const data = buffer.getChannelData(0);

          // White Noise
          for (let i = 0; i < bufferSize; i++) {
              data[i] = Math.random() * 2 - 1;
          }
          this.swooshBuffer = buffer;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = this.swooshBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, t);
      filter.frequency.exponentialRampToValueAtTime(3000, t + 0.2);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start();
  }
}

export const audio = new AudioController();