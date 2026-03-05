// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Audio Engine
// Web Audio API: AudioContext, AnalyserNode, frequency analysis
// ═══════════════════════════════════════════════════════════

let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let connectedElement: HTMLMediaElement | null = null;
const dataArray = new Uint8Array(128); // frequencyBinCount = fftSize/2

/**
 * Get or create the global AudioContext (singleton).
 * Must be called after user gesture (browser policy).
 */
export function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

/**
 * Get or create the global AnalyserNode.
 */
export function getAnalyser(): AnalyserNode {
  if (!analyser) {
    const ctx = getAudioContext();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    analyser.connect(ctx.destination);
  }
  return analyser;
}

/**
 * Connect an HTML audio/video element to the analyser.
 * Returns a disconnect function.
 */
export function connectMediaElement(element: HTMLMediaElement): () => void {
  if (connectedElement === element) return () => {};

  // Disconnect previous
  disconnectSource();

  const ctx = getAudioContext();
  const an = getAnalyser();

  sourceNode = ctx.createMediaElementSource(element);
  sourceNode.connect(an);
  connectedElement = element;

  return () => disconnectSource();
}

function disconnectSource() {
  if (sourceNode) {
    try {
      sourceNode.disconnect();
    } catch {
      // Already disconnected
    }
    sourceNode = null;
    connectedElement = null;
  }
}

/**
 * Get current frequency data from the analyser.
 * Returns the raw Uint8Array (0-255 values).
 */
export function getFrequencyData(): Uint8Array {
  const an = getAnalyser();
  an.getByteFrequencyData(dataArray);
  return dataArray;
}

/**
 * Calculate average of a portion of the frequency data.
 */
function average(arr: Uint8Array, start: number, end: number): number {
  let sum = 0;
  const len = Math.min(end, arr.length);
  for (let i = start; i < len; i++) {
    sum += arr[i];
  }
  return sum / (len - start) / 255;
}

/**
 * Get normalized frequency band levels (0-1).
 */
export function getFrequencyBands(): {
  bass: number;
  mids: number;
  highs: number;
  overall: number;
} {
  const data = getFrequencyData();
  const bass = average(data, 0, 10);
  const mids = average(data, 10, 80);
  const highs = average(data, 80, 128);
  const overall = (bass + mids + highs) / 3;
  return { bass, mids, highs, overall };
}

/**
 * Clean up audio engine resources.
 */
export function destroyAudioEngine() {
  disconnectSource();
  if (analyser) {
    analyser.disconnect();
    analyser = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}
