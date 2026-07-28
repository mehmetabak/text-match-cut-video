import numpy as np

def old_transform(frame: np.ndarray, shift_px: int, noise) -> np.ndarray:
    r = np.roll(frame[:, :, 0], -shift_px, axis=1)
    g = frame[:, :, 1]
    b = np.roll(frame[:, :, 2], shift_px, axis=1)
    out = np.stack([r, g, b], axis=2).astype(np.int16)
    out[::2, :, :] = (out[::2, :, :] * 0.72).astype(np.int16)
    out = out + noise
    return np.clip(out, 0, 255).astype(np.uint8)

def new_transform(frame: np.ndarray, shift_px: int, noise) -> np.ndarray:
    r = np.roll(frame[:, :, 0], -shift_px, axis=1)
    g = frame[:, :, 1]
    b = np.roll(frame[:, :, 2], shift_px, axis=1)
    
    out = np.empty(frame.shape, dtype=np.int16)
    out[:, :, 0] = r
    out[:, :, 1] = g
    out[:, :, 2] = b

    out[::2, :, :] = (out[::2, :, :] * 0.72).astype(np.int16)
    out += noise

    np.clip(out, 0, 255, out=out)
    return out.astype(np.uint8)

frame = np.random.randint(0, 255, (1080, 1920, 3), dtype=np.uint8)
noise = np.random.randint(-14, 14, (frame.shape[0], frame.shape[1], 1), dtype=np.int16)
out1 = old_transform(frame, 5, noise)
out2 = new_transform(frame, 5, noise)
print("Transforms match:", np.allclose(out1, out2))
