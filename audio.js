// Web Audio API Synthesizer for Lo-Fi Ambient Soundscapes & UI FX
class ChillSoundEngine {
  constructor() {
    this.ctx = null;
    this.ambientGain = null;
    this.droneGain = null;
    this.noiseGain = null;
    this.isPlayingAmbient = false;
    this.isPlayingDrone = false;
    this.droneOscs = [];
    this.ambientNodes = [];
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Play subtle UI click/pop
  playPop(pitch = 440) {
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.4, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.09);
    } catch (e) {
      console.warn('Audio FX disabled or blocked:', e);
    }
  }

  // Play message notification chime (soft warm marimba-like double chime)
  playMessageChime() {
    try {
      this.init();
      const now = this.ctx.currentTime;
      [523.25, 659.25].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const time = now + idx * 0.12;

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.06, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + 0.36);
      });
    } catch (e) {
      console.warn(e);
    }
  }

  // Toggle ambient lo-fi drone & rain
  toggleAmbient(volume = 0.25) {
    this.init();
    if (this.isPlayingAmbient) {
      this.stopAmbient();
      return false;
    } else {
      this.startAmbient(volume);
      return true;
    }
  }

  startAmbient(masterVol = 0.25) {
    if (this.isPlayingAmbient) return;
    this.init();

    // Master Ambient Gain
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    this.ambientGain.gain.linearRampToValueAtTime(masterVol, this.ctx.currentTime + 2);
    this.ambientGain.connect(this.ctx.destination);

    // Warm chords: Ebm9 frequencies (Eb3, Gb3, Bb3, Db4, F4)
    const chordFreqs = [155.56, 185.0, 233.08, 277.18, 349.23];
    this.ambientNodes = [];

    // Filter for low-fi warmth
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;

    chordFreqs.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq + (Math.random() - 0.5) * 1.5; // slight organic detune

      // Slow breathing LFO
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.1 + i * 0.05;
      lfoGain.gain.value = 0.02;
      lfo.connect(oscGain.gain);

      oscGain.gain.value = 0.04 / chordFreqs.length;
      osc.connect(filter);
      lfo.start();
      osc.start();

      this.ambientNodes.push(osc, lfo);
    });

    // Gentle filtered tape noise / rain generator
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02; // brown noise
      lastOut = output[i];
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 750;
    noiseFilter.Q.value = 1.2;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = 0.015;

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ambientGain);
    noiseSource.start();

    this.ambientNodes.push(noiseSource);

    filter.connect(this.ambientGain);
    this.isPlayingAmbient = true;
  }

  stopAmbient() {
    if (!this.isPlayingAmbient || !this.ambientGain) return;
    this.ambientGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);
    setTimeout(() => {
      this.ambientNodes.forEach(node => {
        try { node.stop(); } catch (e) {}
      });
      this.ambientNodes = [];
      this.isPlayingAmbient = false;
    }, 1300);
  }

  // 432Hz Grounding Meditative Drone for Anxiety / Panic relief
  startGroundingDrone() {
    this.init();
    if (this.isPlayingDrone) return;

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    this.droneGain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 3);
    this.droneGain.connect(this.ctx.destination);

    // Root 432Hz + 216Hz Sub + 648Hz Harmonic
    const frequencies = [216, 432, 648];
    this.droneOscs = frequencies.map((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.value = idx === 0 ? 0.35 : idx === 1 ? 0.45 : 0.15;
      osc.connect(g);
      g.connect(this.droneGain);
      osc.start();
      return osc;
    });

    this.isPlayingDrone = true;
  }

  stopGroundingDrone() {
    if (!this.isPlayingDrone || !this.droneGain) return;
    this.droneGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);
    setTimeout(() => {
      this.droneOscs.forEach(osc => {
        try { osc.stop(); } catch (e) {}
      });
      this.droneOscs = [];
      this.isPlayingDrone = false;
    }, 1600);
  }
}

export const soundEngine = new ChillSoundEngine();
