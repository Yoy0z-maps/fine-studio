import { EventEmitter, requireNativeModule } from "expo-modules-core";

type AudioFramePayload = {
  sampleRate: number;
  frameSize: number;
  data: string; // base64
};

type PcmEvents = {
  onAudioFrame: (payload: AudioFramePayload) => void;
  onError: (payload: { message?: string }) => void;
};

const Pcm = requireNativeModule("ExpoPcmStream");

// 핵심: EventEmitter에 이벤트 맵 타입을 박아준다
const emitter = new EventEmitter<PcmEvents>(Pcm as any);

export function startPcm(frameSize = 4096) {
  return (Pcm as any).start(frameSize);
}

export function stopPcm() {
  return (Pcm as any).stop();
}

export function onAudioFrame(cb: (p: AudioFramePayload) => void) {
  return emitter.addListener("onAudioFrame", cb);
}

export function onError(cb: (p: { message?: string }) => void) {
  return emitter.addListener("onError", cb);
}

export function base64ToFloat32(base64: string) {
  const bin = atob(base64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);

  const view = new DataView(buf.buffer);
  const out = new Float32Array(buf.length / 2);

  for (let i = 0; i < out.length; i++) {
    out[i] = view.getInt16(i * 2, true) / 32768;
  }
  return out;
}
