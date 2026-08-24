// src/lib/ffmpeg.js
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const STANDALONE_WORKER_SCRIPT = `
const FFMessageType = {
    LOAD: "LOAD",
    EXEC: "EXEC",
    FFPROBE: "FFPROBE",
    WRITE_FILE: "WRITE_FILE",
    READ_FILE: "READ_FILE",
    DELETE_FILE: "DELETE_FILE",
    RENAME: "RENAME",
    CREATE_DIR: "CREATE_DIR",
    LIST_DIR: "LIST_DIR",
    DELETE_DIR: "DELETE_DIR",
    ERROR: "ERROR",
    DOWNLOAD: "DOWNLOAD",
    PROGRESS: "PROGRESS",
    LOG: "LOG",
    MOUNT: "MOUNT",
    UNMOUNT: "UNMOUNT"
};
const CORE_URL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js";
let ffmpeg;

const load = async ({ coreURL: _coreURL, wasmURL: _wasmURL, workerURL: _workerURL }) => {
    const first = !ffmpeg;
    try {
        if (!_coreURL) _coreURL = CORE_URL;
        importScripts(_coreURL);
    } catch {
        if (!_coreURL || _coreURL === CORE_URL) _coreURL = CORE_URL.replace('/umd/', '/esm/');
        self.createFFmpegCore = (await import(/* @vite-ignore */ _coreURL)).default;
        if (!self.createFFmpegCore) {
            throw new Error("failed to import ffmpeg-core.js");
        }
    }
    const coreURL = _coreURL;
    const wasmURL = _wasmURL ? _wasmURL : _coreURL.replace(/\\.js$/g, ".wasm");
    const workerURL = _workerURL ? _workerURL : _coreURL.replace(/\\.js$/g, ".worker.js");
    ffmpeg = await self.createFFmpegCore({
        mainScriptUrlOrBlob: \`\${coreURL}#\${btoa(JSON.stringify({ wasmURL, workerURL }))}\`,
    });
    ffmpeg.setLogger((data) => self.postMessage({ type: FFMessageType.LOG, data }));
    ffmpeg.setProgress((data) => self.postMessage({
        type: FFMessageType.PROGRESS,
        data,
    }));
    return first;
};

const exec = ({ args, timeout = -1 }) => {
    ffmpeg.setTimeout(timeout);
    ffmpeg.exec(...args);
    const ret = ffmpeg.ret;
    ffmpeg.reset();
    return ret;
};

const ffprobe = ({ args, timeout = -1 }) => {
    ffmpeg.setTimeout(timeout);
    ffmpeg.ffprobe(...args);
    const ret = ffmpeg.ret;
    ffmpeg.reset();
    return ret;
};

const writeFile = ({ path, data }) => {
    ffmpeg.FS.writeFile(path, data);
    return true;
};

const readFile = ({ path, encoding }) => ffmpeg.FS.readFile(path, { encoding });

const deleteFile = ({ path }) => {
    ffmpeg.FS.unlink(path);
    return true;
};

const rename = ({ oldPath, newPath }) => {
    ffmpeg.FS.rename(oldPath, newPath);
    return true;
};

const createDir = ({ path }) => {
    ffmpeg.FS.mkdir(path);
    return true;
};

const listDir = ({ path }) => {
    const names = ffmpeg.FS.readdir(path);
    const nodes = [];
    for (const name of names) {
        const stat = ffmpeg.FS.stat(\`\${path}/\${name}\`);
        const isDir = ffmpeg.FS.isDir(stat.mode);
        nodes.push({ name, isDir });
    }
    return nodes;
};

const deleteDir = ({ path }) => {
    ffmpeg.FS.rmdir(path);
    return true;
};

const mount = ({ fsType, options, mountPoint }) => {
    const str = fsType;
    const fs = ffmpeg.FS.filesystems[str];
    if (!fs) return false;
    ffmpeg.FS.mount(fs, options, mountPoint);
    return true;
};

const unmount = ({ mountPoint }) => {
    ffmpeg.FS.unmount(mountPoint);
    return true;
};

self.onmessage = async ({ data: { id, type, data: _data } }) => {
    const trans = [];
    let data;
    try {
        if (type !== FFMessageType.LOAD && !ffmpeg)
            throw new Error("ffmpeg is not loaded, call await ffmpeg.load() first");
        switch (type) {
            case FFMessageType.LOAD:
                data = await load(_data);
                break;
            case FFMessageType.EXEC:
                data = exec(_data);
                break;
            case FFMessageType.FFPROBE:
                data = ffprobe(_data);
                break;
            case FFMessageType.WRITE_FILE:
                data = writeFile(_data);
                break;
            case FFMessageType.READ_FILE:
                data = readFile(_data);
                break;
            case FFMessageType.DELETE_FILE:
                data = deleteFile(_data);
                break;
            case FFMessageType.RENAME:
                data = rename(_data);
                break;
            case FFMessageType.CREATE_DIR:
                data = createDir(_data);
                break;
            case FFMessageType.LIST_DIR:
                data = listDir(_data);
                break;
            case FFMessageType.DELETE_DIR:
                data = deleteDir(_data);
                break;
            case FFMessageType.MOUNT:
                data = mount(_data);
                break;
            case FFMessageType.UNMOUNT:
                data = unmount(_data);
                break;
            default:
                throw new Error("unknown message type");
        }
    } catch (e) {
        self.postMessage({
            id,
            type: FFMessageType.ERROR,
            data: e.toString(),
        });
        return;
    }
    if (data instanceof Uint8Array) {
        trans.push(data.buffer);
    }
    self.postMessage({ id, type, data }, trans);
};
`;

let ffmpeg = null;
let workerBlobUrl = null;

function getWorkerBlobUrl() {
    if (!workerBlobUrl && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
        const blob = new Blob([STANDALONE_WORKER_SCRIPT], { type: 'text/javascript' });
        workerBlobUrl = URL.createObjectURL(blob);
    }
    return workerBlobUrl;
}

export async function loadFfmpeg() {
    if (ffmpeg) return ffmpeg;

    ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

    const loadConfig = {
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    };

    const workerUrl = getWorkerBlobUrl();
    if (workerUrl) {
        loadConfig.classWorkerURL = workerUrl;
    }

    await ffmpeg.load(loadConfig);

    return ffmpeg;
}

export async function extractAudioFromVideo(videoFile) {
    if (!videoFile) return null;
    try {
        const ffmpeg = await loadFfmpeg();
        const inputName = 'temp_input_media.' + (videoFile.name?.split('.').pop() || 'mp4');
        await ffmpeg.writeFile(inputName, new Uint8Array(await videoFile.arrayBuffer()));

        // Extract audio stream to wav
        const exitCode = await ffmpeg.exec([
            '-i', inputName,
            '-vn',
            '-acodec', 'pcm_s16le',
            '-ar', '44100',
            '-ac', '2',
            'extracted_audio.wav'
        ]);

        await ffmpeg.deleteFile(inputName);

        if (exitCode === 0) {
            const audioData = await ffmpeg.readFile('extracted_audio.wav');
            await ffmpeg.deleteFile('extracted_audio.wav');
            if (audioData && audioData.length > 100) {
                return new Blob([audioData.buffer], { type: 'audio/wav' });
            }
        }
    } catch (err) {
        console.warn("Audio extraction skipped (file may not have audio stream):", err);
    }
    return null;
}

export async function createVideoFromFrames(frames, audioBlob, fps, optionsOrHighQuality = false, onProgress) {
    const ffmpeg = await loadFfmpeg();

    const isOptionsObj = typeof optionsOrHighQuality === 'object' && optionsOrHighQuality !== null;
    const highQuality = isOptionsObj ? !!optionsOrHighQuality.highQuality : !!optionsOrHighQuality;
    const fastRender = isOptionsObj ? !!optionsOrHighQuality.fastRender : false;
    const experimentalRender = isOptionsObj ? !!optionsOrHighQuality.experimentalRender : false;

    const hasAudio = !!audioBlob;
    if (hasAudio) {
        await ffmpeg.writeFile('audio.wav', new Uint8Array(await audioBlob.arrayBuffer()));
    }

    const ext = (highQuality && !fastRender && !experimentalRender) ? 'png' : 'jpg';
    const totalFrames = frames.length;

    // Paralel toplu aktarım (Concurrent Batch Transfer) - roundtrip gecikmesini 10x azaltır
    const BATCH_SIZE = 30;
    for (let b = 0; b < totalFrames; b += BATCH_SIZE) {
        const batchPromises = [];
        const end = Math.min(b + BATCH_SIZE, totalFrames);
        for (let i = b; i < end; i++) {
            const name = `frame${String(i).padStart(4, '0')}.${ext}`;
            batchPromises.push(ffmpeg.writeFile(name, frames[i]));
        }
        await Promise.all(batchPromises);
        if (onProgress) {
            onProgress((end / totalFrames) * 35);
        }
    }

    const onFfmpegProgress = ({ progress }) => {
        if (onProgress) {
            const clampedP = Math.max(0, Math.min(1, progress || 0));
            onProgress(35 + clampedP * 65);
        }
    };
    ffmpeg.on('progress', onFfmpegProgress);

    let preset = 'fast';
    let crf = '22';
    if (experimentalRender) {
        preset = 'ultrafast';
        crf = '20'; // Pristine Full HD 1080p output with ultrafast encode
    } else if (fastRender) {
        preset = 'ultrafast';
        crf = '24';
    } else if (highQuality) {
        preset = 'medium';
        crf = '18';
    }

    const args = [
        '-framerate', `${fps}`,
        '-i', `frame%04d.${ext}`
    ];

    if (hasAudio) {
        args.push('-i', 'audio.wav');
    }

    args.push(
        '-c:v', 'libx264',
        '-preset', preset,
        '-tune', 'zerolatency',
        '-crf', crf,
        '-threads', '0'
    );

    if (hasAudio) {
        args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
    }

    args.push(
        '-pix_fmt', 'yuv420p',
        'output.mp4'
    );

    await ffmpeg.exec(args);

    const data = await ffmpeg.readFile('output.mp4');

    // Bellek (RAM) Temizliği - Paralel silme
    ffmpeg.off('progress', onFfmpegProgress);
    if (hasAudio) {
        ffmpeg.deleteFile('audio.wav').catch(() => {});
    }
    ffmpeg.deleteFile('output.mp4').catch(() => {});
    
    // Arka planda frame'leri asenkron temizle
    (async () => {
        for (let b = 0; b < totalFrames; b += BATCH_SIZE) {
            const batchPromises = [];
            const end = Math.min(b + BATCH_SIZE, totalFrames);
            for (let i = b; i < end; i++) {
                const name = `frame${String(i).padStart(4, '0')}.${ext}`;
                batchPromises.push(ffmpeg.deleteFile(name).catch(() => {}));
            }
            await Promise.all(batchPromises);
        }
    })();

    if (onProgress) onProgress(100);

    return URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
}

