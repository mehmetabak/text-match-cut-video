// src/lib/audioUtils.js
// eslint-disable-next-line no-unused-vars
import { toBlobURL } from '@ffmpeg/util';

export class AudioGenerator {
    constructor(whooshBuffer) {
        this.whooshBuffer = whooshBuffer;
    }

    // Asenkron olarak ses dosyasını yükleyip AudioGenerator örneği oluşturan fabrika metodu
    static async create(soundUrl) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const response = await fetch(soundUrl);
        const arrayBuffer = await response.arrayBuffer();
        const whooshBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return new AudioGenerator(whooshBuffer);
    }

    async generateAudio(totalFrames, fps, framesPerCut) {
        const totalDuration = totalFrames / fps;
        const durationPerCut = framesPerCut / fps;
        const numCuts = Math.floor(totalFrames / framesPerCut);

        const audioContext = new OfflineAudioContext(
            this.whooshBuffer.numberOfChannels,
            Math.ceil(totalDuration * this.whooshBuffer.sampleRate),
            this.whooshBuffer.sampleRate
        );

        // Her kesimin başına "whoosh" sesini yerleştir
        for (let i = 0; i < numCuts; i++) {
            const time = i * durationPerCut;
            const source = audioContext.createBufferSource();
            source.buffer = this.whooshBuffer;
            source.connect(audioContext.destination);
            source.start(time);
        }

        const renderedBuffer = await audioContext.startRendering();
        return this.bufferToWave(renderedBuffer, renderedBuffer.length);
    }

    // Bu yardımcı fonksiyon değiştirilmedi, WAV formatına dönüştürme işini yapıyor.
    bufferToWave(abuffer, len) {
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
}