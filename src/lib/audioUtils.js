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

/**
 * Procedurally generates an authentic audio track for typing animations.
 * When mode === 'vintage', synthesizes authentic heavy mechanical typewriter strikes with body thud and classic carriage return bell.
 * When mode !== 'vintage' (classic, terminal, code), synthesizes modern, soft, satisfying tactile keyboard clicks.
 */
export async function generateTypewriterAudioTrack(text, duration, mode = 'classic', sampleRate = 44100) {
    if (!text || duration <= 0) return null;

    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const offlineCtx = new OfflineAudioContext(1, Math.ceil(duration * sampleRate), sampleRate);

        const totalChars = text.length;
        const isVintage = mode === 'vintage';

        for (let i = 0; i < totalChars; i++) {
            const char = text[i];
            const time = Math.max(0.005, Math.min(duration - 0.05, ((i + 1) / (totalChars + 4)) * duration));

            const isSpace = char === ' ' || char === '\t';
            const isNewline = char === '\n';

            if (isVintage) {
                // --- VINTAGE DAKTİLO SES PROFİLİ ---
                // 1. Metal Hammer Snap (Daktilo Harf Çekici Vuruşu)
                const snapLen = Math.floor(sampleRate * (isSpace ? 0.022 : 0.016));
                const snapBuf = offlineCtx.createBuffer(1, snapLen, sampleRate);
                const snapData = snapBuf.getChannelData(0);
                for (let s = 0; s < snapLen; s++) {
                    snapData[s] = (Math.random() * 2 - 1) * Math.exp(-s / (sampleRate * 0.003));
                }
                const snapSource = offlineCtx.createBufferSource();
                snapSource.buffer = snapBuf;

                const snapFilter = offlineCtx.createBiquadFilter();
                snapFilter.type = 'bandpass';
                snapFilter.frequency.value = isSpace ? 1150 : (2400 + (i % 5) * 110);
                snapFilter.Q.value = 3.4;

                const snapGain = offlineCtx.createGain();
                snapGain.gain.setValueAtTime(isSpace ? 0.22 : 0.32, time);
                snapGain.gain.exponentialRampToValueAtTime(0.001, time + 0.028);

                snapSource.connect(snapFilter);
                snapFilter.connect(snapGain);
                snapGain.connect(offlineCtx.destination);
                snapSource.start(time);

                // 2. Rubber Platen Body Thud (Daktilo Silindir Gövde Vuruşu)
                const thudOsc = offlineCtx.createOscillator();
                thudOsc.type = 'triangle';
                thudOsc.frequency.setValueAtTime(isSpace ? 105 : (135 + (i % 4) * 12), time);
                thudOsc.frequency.exponentialRampToValueAtTime(42, time + 0.04);

                const thudGain = offlineCtx.createGain();
                thudGain.gain.setValueAtTime(isSpace ? 0.35 : 0.26, time);
                thudGain.gain.exponentialRampToValueAtTime(0.001, time + 0.042);

                thudOsc.connect(thudGain);
                thudGain.connect(offlineCtx.destination);
                thudOsc.start(time);
                thudOsc.stop(time + 0.045);

                // 3. Vintage Carriage Bell & Return Ratchet (Daktilo Satır Sonu Çanı & Kızak Kayması)
                if (isNewline) {
                    const bellOsc = offlineCtx.createOscillator();
                    bellOsc.type = 'sine';
                    bellOsc.frequency.setValueAtTime(2450, time + 0.015);
                    const bellGain = offlineCtx.createGain();
                    bellGain.gain.setValueAtTime(0.18, time + 0.015);
                    bellGain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
                    bellOsc.connect(bellGain);
                    bellGain.connect(offlineCtx.destination);
                    bellOsc.start(time + 0.015);
                    bellOsc.stop(time + 0.24);
                }
            } else {
                // --- MODERN / KOD / TERMİNAL SES PROFİLİ (Yumuşak, Tok & Doğal) ---
                const snapLen = Math.floor(sampleRate * (isNewline ? 0.024 : (isSpace ? 0.018 : 0.014)));
                const snapBuf = offlineCtx.createBuffer(1, snapLen, sampleRate);
                const snapData = snapBuf.getChannelData(0);
                const decayRate = isNewline ? 0.0034 : 0.0026;

                for (let s = 0; s < snapLen; s++) {
                    snapData[s] = (Math.random() * 2 - 1) * Math.exp(-s / (sampleRate * decayRate));
                }

                const snapSource = offlineCtx.createBufferSource();
                snapSource.buffer = snapBuf;

                const snapFilter = offlineCtx.createBiquadFilter();
                snapFilter.type = 'bandpass';
                snapFilter.frequency.value = isNewline ? 1350 : (isSpace ? 1050 : (2150 + (i % 4) * 75));
                snapFilter.Q.value = 2.8;

                const snapGain = offlineCtx.createGain();
                const volume = isNewline ? 0.24 : (isSpace ? 0.16 : 0.22);
                snapGain.gain.setValueAtTime(volume, time);
                snapGain.gain.exponentialRampToValueAtTime(0.001, time + (isNewline ? 0.034 : 0.022));

                snapSource.connect(snapFilter);
                snapFilter.connect(snapGain);
                snapGain.connect(offlineCtx.destination);
                snapSource.start(time);

                // Modern Enter key subtle double latch click (no bells)
                if (isNewline && time + 0.04 < duration) {
                    const latchTime = time + 0.036;
                    const latchLen = Math.floor(sampleRate * 0.012);
                    const latchBuf = offlineCtx.createBuffer(1, latchLen, sampleRate);
                    const latchData = latchBuf.getChannelData(0);
                    for (let s = 0; s < latchLen; s++) {
                        latchData[s] = (Math.random() * 2 - 1) * Math.exp(-s / (sampleRate * 0.002));
                    }
                    const latchSource = offlineCtx.createBufferSource();
                    latchSource.buffer = latchBuf;

                    const latchFilter = offlineCtx.createBiquadFilter();
                    latchFilter.type = 'bandpass';
                    latchFilter.frequency.value = 1650;
                    latchFilter.Q.value = 3.0;

                    const latchGain = offlineCtx.createGain();
                    latchGain.gain.setValueAtTime(0.14, latchTime);
                    latchGain.gain.exponentialRampToValueAtTime(0.001, latchTime + 0.018);

                    latchSource.connect(latchFilter);
                    latchFilter.connect(latchGain);
                    latchGain.connect(offlineCtx.destination);
                    latchSource.start(latchTime);
                }
            }
        }

        const renderedBuffer = await offlineCtx.startRendering();
        return bufferToWave(renderedBuffer, renderedBuffer.length);
    } catch (e) {
        console.warn("Typewriter procedural audio generation fallback:", e);
        return null;
    }
}

// Live interactive keystroke click sound for preview
let liveAudioCtx = null;

export function muteLiveAudio() {
    if (liveAudioCtx && liveAudioCtx.state === 'running') {
        liveAudioCtx.suspend().catch(() => {});
    }
}

export function playLiveTypewriterClick(charType = 'letter', enabled = true, mode = 'classic') {
    if (!enabled) return;
    try {
        if (!liveAudioCtx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            liveAudioCtx = new AudioCtx();
        }
        if (liveAudioCtx.state === 'suspended') {
            liveAudioCtx.resume();
        }

        const now = liveAudioCtx.currentTime;
        const isSpace = charType === 'space';
        const isNewline = charType === 'newline';
        const isVintage = mode === 'vintage';

        if (isVintage) {
            // --- VINTAGE DAKTİLO CANLI ÖNİZLEME ---
            const snapLen = Math.floor(liveAudioCtx.sampleRate * (isSpace ? 0.022 : 0.016));
            const snapBuf = liveAudioCtx.createBuffer(1, snapLen, liveAudioCtx.sampleRate);
            const snapData = snapBuf.getChannelData(0);
            for (let s = 0; s < snapLen; s++) {
                snapData[s] = (Math.random() * 2 - 1) * Math.exp(-s / (liveAudioCtx.sampleRate * 0.003));
            }
            const snapSource = liveAudioCtx.createBufferSource();
            snapSource.buffer = snapBuf;

            const snapFilter = liveAudioCtx.createBiquadFilter();
            snapFilter.type = 'bandpass';
            snapFilter.frequency.value = isSpace ? 1150 : 2450;
            snapFilter.Q.value = 3.4;

            const snapGain = liveAudioCtx.createGain();
            snapGain.gain.setValueAtTime(isSpace ? 0.22 : 0.32, now);
            snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);

            snapSource.connect(snapFilter);
            snapFilter.connect(snapGain);
            snapGain.connect(liveAudioCtx.destination);
            snapSource.start(now);

            // Platen thud
            const thudOsc = liveAudioCtx.createOscillator();
            thudOsc.type = 'triangle';
            thudOsc.frequency.setValueAtTime(isSpace ? 105 : 135, now);
            thudOsc.frequency.exponentialRampToValueAtTime(42, now + 0.04);

            const thudGain = liveAudioCtx.createGain();
            thudGain.gain.setValueAtTime(isSpace ? 0.35 : 0.26, now);
            thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);

            thudOsc.connect(thudGain);
            thudGain.connect(liveAudioCtx.destination);
            thudOsc.start(now);
            thudOsc.stop(now + 0.045);

            // Vintage bell for newline
            if (isNewline) {
                const bellOsc = liveAudioCtx.createOscillator();
                bellOsc.type = 'sine';
                bellOsc.frequency.setValueAtTime(2450, now + 0.015);
                const bellGain = liveAudioCtx.createGain();
                bellGain.gain.setValueAtTime(0.18, now + 0.015);
                bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                bellOsc.connect(bellGain);
                bellGain.connect(liveAudioCtx.destination);
                bellOsc.start(now + 0.015);
                bellOsc.stop(now + 0.24);
            }
        } else {
            // --- MODERN / TERMİNAL / KOD CANLI ÖNİZLEME (Yumuşak & Tok) ---
            const snapLen = Math.floor(liveAudioCtx.sampleRate * (isNewline ? 0.024 : (isSpace ? 0.018 : 0.014)));
            const snapBuf = liveAudioCtx.createBuffer(1, snapLen, liveAudioCtx.sampleRate);
            const snapData = snapBuf.getChannelData(0);
            const decayRate = isNewline ? 0.0034 : 0.0026;

            for (let s = 0; s < snapLen; s++) {
                snapData[s] = (Math.random() * 2 - 1) * Math.exp(-s / (liveAudioCtx.sampleRate * decayRate));
            }
            const snapSource = liveAudioCtx.createBufferSource();
            snapSource.buffer = snapBuf;

            const snapFilter = liveAudioCtx.createBiquadFilter();
            snapFilter.type = 'bandpass';
            snapFilter.frequency.value = isNewline ? 1350 : (isSpace ? 1050 : 2200);
            snapFilter.Q.value = 2.8;

            const snapGain = liveAudioCtx.createGain();
            const volume = isNewline ? 0.24 : (isSpace ? 0.16 : 0.22);
            snapGain.gain.setValueAtTime(volume, now);
            snapGain.gain.exponentialRampToValueAtTime(0.001, now + (isNewline ? 0.034 : 0.022));

            snapSource.connect(snapFilter);
            snapFilter.connect(snapGain);
            snapGain.connect(liveAudioCtx.destination);
            snapSource.start(now);

            // Secondary latch for newline
            if (isNewline) {
                const latchTime = now + 0.036;
                const latchLen = Math.floor(liveAudioCtx.sampleRate * 0.012);
                const latchBuf = liveAudioCtx.createBuffer(1, latchLen, liveAudioCtx.sampleRate);
                const latchData = latchBuf.getChannelData(0);
                for (let s = 0; s < latchLen; s++) {
                    latchData[s] = (Math.random() * 2 - 1) * Math.exp(-s / (liveAudioCtx.sampleRate * 0.002));
                }
                const latchSource = liveAudioCtx.createBufferSource();
                latchSource.buffer = latchBuf;

                const latchFilter = liveAudioCtx.createBiquadFilter();
                latchFilter.type = 'bandpass';
                latchFilter.frequency.value = 1650;
                latchFilter.Q.value = 3.0;

                const latchGain = liveAudioCtx.createGain();
                latchGain.gain.setValueAtTime(0.14, latchTime);
                latchGain.gain.exponentialRampToValueAtTime(0.001, latchTime + 0.018);

                latchSource.connect(latchFilter);
                latchFilter.connect(latchGain);
                latchGain.connect(liveAudioCtx.destination);
                latchSource.start(latchTime);
            }
        }
    } catch (e) {
        // Silently ignore if browser blocks audio autoplay
    }
}