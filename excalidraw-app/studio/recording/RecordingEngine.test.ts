import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { RecordingEngine, type RecordingEnvironment } from "./RecordingEngine";

import type { CanvasCompositeSource } from "./CanvasCompositeSource";

type RecorderListener = () => void;

const instances: FakeMediaRecorder[] = [];

class FakeMediaRecorder {
  static isTypeSupported = vi.fn(() => true);
  state: "inactive" | "recording" | "paused" = "inactive";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onstop: (() => void) | null = null;
  private listeners: Record<string, RecorderListener[]> = {};

  constructor(
    public stream: MediaStream,
    public options?: MediaRecorderOptions,
  ) {
    instances.push(this);
  }

  start = vi.fn(() => {
    this.state = "recording";
  });
  pause = vi.fn(() => {
    this.state = "paused";
  });
  resume = vi.fn(() => {
    this.state = "recording";
  });
  stop = vi.fn(() => {
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob(["chunk"], { type: "video/webm" }),
    } as BlobEvent);
    this.onstop?.();
    this.listeners.stop?.forEach((listener) => listener());
  });
  addEventListener = vi.fn((name: string, listener: RecorderListener) => {
    this.listeners[name] = [...(this.listeners[name] ?? []), listener];
  });
}

const makeSource = () => {
  const track = { stop: vi.fn() };
  return {
    label: "test",
    getStream: vi.fn(
      () => ({ getTracks: () => [track] } as unknown as MediaStream),
    ),
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    dispose: vi.fn(),
    track,
  } as unknown as CanvasCompositeSource & {
    track: { stop: ReturnType<typeof vi.fn> };
  };
};

const originalCaptureStream = HTMLCanvasElement.prototype.captureStream;

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", {
    configurable: true,
    value: vi.fn(() => ({} as MediaStream)),
  });
});

afterAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", {
    configurable: true,
    value: originalCaptureStream,
  });
});

describe("RecordingEngine", () => {
  let environment: RecordingEnvironment;

  beforeEach(() => {
    instances.length = 0;
    FakeMediaRecorder.isTypeSupported.mockClear();
    environment = {
      MediaRecorder: FakeMediaRecorder as unknown as typeof MediaRecorder,
      createObjectURL: vi.fn(() => "blob:recording"),
      revokeObjectURL: vi.fn(),
    };
  });

  it("starts, pauses, resumes and stops without recreating the source", async () => {
    const source = makeSource();
    const engine = new RecordingEngine(() => source, environment);
    expect(engine.isSupported()).toBe(true);

    await engine.start();
    const recorder = instances[0];
    expect(recorder.state).toBe("recording");
    expect(source.start).toHaveBeenCalledTimes(1);
    expect(recorder.options?.mimeType).toBe("video/webm;codecs=vp9");

    engine.pause();
    expect(recorder.state).toBe("paused");
    expect(source.pause).toHaveBeenCalledTimes(1);

    engine.resume();
    expect(recorder.state).toBe("recording");
    expect(source.resume).toHaveBeenCalledTimes(1);

    const result = await engine.stop();
    expect(result.url).toBe("blob:recording");
    expect(result.mimeType).toBe("video/webm;codecs=vp9");
    expect(result.blob.size).toBeGreaterThan(0);
    expect(source.getStream).toHaveBeenCalledTimes(1);
    expect(engine.getElapsedMs()).toBe(0);
  });

  it("reports recorder errors through the callback", async () => {
    const onError = vi.fn();
    const engine = new RecordingEngine(makeSource, environment, onError);
    await engine.start();
    instances[0].onerror?.();
    expect(onError).toHaveBeenCalledWith(
      "The recording was interrupted by the browser.",
    );
    engine.dispose();
  });

  it("disposes the recorder and source", async () => {
    const source = makeSource();
    const engine = new RecordingEngine(() => source, environment);
    await engine.start();
    engine.dispose();
    expect(source.dispose).toHaveBeenCalledTimes(1);
    expect(instances[0].state).toBe("inactive");
  });

  it("fails gracefully when MediaRecorder is unavailable", async () => {
    const engine = new RecordingEngine(makeSource, {
      ...environment,
      MediaRecorder: undefined,
    });
    expect(engine.isSupported()).toBe(false);
    await expect(engine.start()).rejects.toThrow(/not supported/);
  });
});
