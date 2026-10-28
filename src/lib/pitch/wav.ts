export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const n = samples.length;
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);
  writeStr(view, 0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  writeStr(view, 8, "WAVE");
  writeStr(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(view, 36, "data");
  view.setUint32(40, n * 2, true);
  let offset = 44;
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] || 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Uint8Array(buffer);
}

export function decodeWav(bytes: Uint8Array): {
  samples: Float32Array;
  sampleRate: number;
} {
  if (bytes.length < 44) throw new Error("音訊太短");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (readStr(view, 0, 4) !== "RIFF" || readStr(view, 8, 4) !== "WAVE") {
    throw new Error("只可以重計 WAV 練習錄音");
  }

  let sampleRate = 0;
  let channels = 1;
  let bits = 16;
  let dataOffset = -1;
  let dataSize = 0;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = readStr(view, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bits = view.getUint16(body + 14, true);
    } else if (id === "data") {
      dataOffset = body;
      dataSize = size;
      break;
    }
    offset = body + size + (size % 2);
  }
  if (dataOffset < 0 || sampleRate < 8000) throw new Error("WAV 缺少音訊資料");
  if (bits !== 16) throw new Error("只支援 16-bit WAV");

  const available = Math.min(dataSize, bytes.length - dataOffset);
  const frameSize = channels * 2;
  const frames = Math.floor(available / frameSize);
  const samples = new Float32Array(frames);
  let pos = dataOffset;
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      sum += view.getInt16(pos, true) / 0x8000;
      pos += 2;
    }
    samples[i] = sum / channels;
  }
  return { samples, sampleRate };
}

function writeStr(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function readStr(view: DataView, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += String.fromCharCode(view.getUint8(offset + i));
  return out;
}
