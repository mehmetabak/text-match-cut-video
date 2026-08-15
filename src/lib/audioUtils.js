// src/lib/audioUtils.js

export function bufferToWave(abuffer, len) {
    let numOfChan = abuffer.numberOfChannels,
        length = len * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit
    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    for (i = 0; i < abuffer.numberOfChannels; i++)
        channels.push(abuffer.getChannelData(i));

    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }
    return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Applies thematic audio processing to an input audio Blob (WAV/AAC)
 * using Web Audio OfflineAudioContext.
 * 
 * Supports:
 * - 'vhs-tape': Low-pass filter (3400Hz), high-pass (120Hz), tape saturation
 * - 'scanline': CRT TV speaker EQ (bandpass 300Hz - 4500Hz), mid-range boxiness
 * - 'glitch-master': Digital overdrive & high-frequency distortion boost
 */
export async function applyAudioEffect(audioBlob, effectType, options = {}) {
    if (!audioBlob) return null;
    
    // If effect doesn't modify audio, return original
    if (!['vhs-tape', 'scanline', 'glitch-master'].includes(effectType)) {
        return audioBlob;
    }

    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuf = await audioBlob.arrayBuffer();
        const decodedBuffer = await audioCtx.decodeAudioData(arrayBuf);

        const sampleRate = decodedBuffer.sampleRate;
        const duration = decodedBuffer.duration;
        const channels = decodedBuffer.numberOfChannels;

        const offlineCtx = new OfflineAudioContext(channels, Math.ceil(duration * sampleRate), sampleRate);
        const source = offlineCtx.createBufferSource();
        source.buffer = decodedBuffer;

        let lastNode = source;

        if (effectType === 'vhs-tape') {
            // 1. VHS High-Pass to cut sub-bass
            const hpFilter = offlineCtx.createBiquadFilter();
            hpFilter.type = 'highpass';
            hpFilter.frequency.value = 120;
            lastNode.connect(hpFilter);
            lastNode = hpFilter;

            // 2. VHS Low-Pass to mimic magnetic tape warmth
            const lpFilter = offlineCtx.createBiquadFilter();
            lpFilter.type = 'lowpass';
            lpFilter.frequency.value = 3400;
            lpFilter.Q.value = 0.8;
            lastNode.connect(lpFilter);
            lastNode = lpFilter;

            // 3. Gentle Tape Saturation WaveShaper
            const shaper = offlineCtx.createWaveShaper();
            const curve = new Float32Array(256);
            for (let i = 0; i < 256; i++) {
                const x = (i * 2) / 256 - 1;
                curve[i] = Math.tanh(x * 1.3);
            }
            shaper.curve = curve;
            lastNode.connect(shaper);
            lastNode = shaper;

        } else if (effectType === 'scanline') {
            // CRT TV Speaker Box Emulation
            const hp = offlineCtx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 300;
            lastNode.connect(hp);
            lastNode = hp;

            const lp = offlineCtx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 4500;
            lp.Q.value = 1.2;
            lastNode.connect(lp);
            lastNode = lp;

            const peak = offlineCtx.createBiquadFilter();
            peak.type = 'peaking';
            peak.frequency.value = 1800;
            peak.gain.value = 4;
            lastNode.connect(peak);
            lastNode = peak;

        } else if (effectType === 'glitch-master') {
            // Digital Overdrive & Saturation
            const intensity = options.intensity ?? 0.6;
            const shaper = offlineCtx.createWaveShaper();
            const curve = new Float32Array(256);
            const k = 2 + (intensity * 6);
            for (let i = 0; i < 256; i++) {
                const x = (i * 2) / 256 - 1;
                curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
            }
            shaper.curve = curve;
            lastNode.connect(shaper);
            lastNode = shaper;

            // High Shelf Edge Boost
            const hs = offlineCtx.createBiquadFilter();
            hs.type = 'highshelf';
            hs.frequency.value = 3000;
            hs.gain.value = 3;
            lastNode.connect(hs);
            lastNode = hs;
        }

        lastNode.connect(offlineCtx.destination);
        source.start(0);

        const renderedBuffer = await offlineCtx.startRendering();
        return bufferToWave(renderedBuffer, renderedBuffer.length);
    } catch (e) {
        console.warn("Audio effect processing fallback to original:", e);
        return audioBlob;
    }
}

export class AudioGenerator {
    constructor(whooshBuffer) {
        this.whooshBuffer = whooshBuffer;
    }

    static async create(soundUrl) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const response = await fetch(soundUrl);
        const arrayBuffer = await response.arrayBuffer();
        const whooshBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return new AudioGenerator(whooshBuffer);
    }

    async generateAudio(numberOfCuts, totalDuration) {
        if (numberOfCuts === 0) {
            const emptyContext = new OfflineAudioContext(1, 1, 44100);
            const buffer = await emptyContext.startRendering();
            return bufferToWave(buffer, 0);
        }

        const audioContext = new OfflineAudioContext(
            this.whooshBuffer.numberOfChannels,
            Math.ceil(totalDuration * this.whooshBuffer.sampleRate),
            this.whooshBuffer.sampleRate
        );

        const durationPerCut = totalDuration / numberOfCuts;

        for (let i = 0; i < numberOfCuts; i++) {
            const time = i * durationPerCut;
            const source = audioContext.createBufferSource();
            source.buffer = this.whooshBuffer;
            source.connect(audioContext.destination);
            source.start(time);
        }

        const renderedBuffer = await audioContext.startRendering();
        return bufferToWave(renderedBuffer, renderedBuffer.length);
    }
}