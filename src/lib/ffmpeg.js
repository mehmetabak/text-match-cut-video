// src/lib/ffmpeg.js
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpeg;

export async function loadFfmpeg() {
    if (ffmpeg) return ffmpeg;

    ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    return ffmpeg;
}

export async function createVideoFromFrames(frames, audioBlob, fps, onProgress) {
    const ffmpeg = await loadFfmpeg();

    await ffmpeg.writeFile('audio.wav', new Uint8Array(await audioBlob.arrayBuffer()));

    for (let i = 0; i < frames.length; i++) {
        const name = `frame${String(i).padStart(4, '0')}.png`;
        await ffmpeg.writeFile(name, frames[i]);
        if (onProgress) onProgress((i / frames.length) * 50);
    }

    ffmpeg.on('progress', ({ progress }) => {
        if (onProgress) onProgress(50 + progress * 50);
    });

    await ffmpeg.exec([
        '-framerate', `${fps}`,
        '-i', 'frame%04d.png',
        '-i', 'audio.wav',
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-pix_fmt', 'yuv420p',
        '-shortest',
        'output.mp4',
    ]);

    const data = await ffmpeg.readFile('output.mp4');
    return URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
}
