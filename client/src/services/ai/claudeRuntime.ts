/** Minimal typing for the Claude artifact runtime (window.claude), used only by ClaudeArtifactProvider. */
export interface SampleFn {
  (input: string, opts?: Record<string, unknown>): Promise<{ text: string }>;
  json<T = unknown>(input: string, opts?: Record<string, unknown>): Promise<T>;
  limits(): Promise<{ images?: { maxCount: number } }>;
}

interface ClaudeRuntime {
  use(name: string): Promise<unknown>;
}

declare global {
  interface Window {
    claude?: ClaudeRuntime;
  }
}

let samplePromise: Promise<SampleFn | null> | null = null;

export function getSample(): Promise<SampleFn | null> {
  if (!samplePromise) {
    samplePromise = window.claude
      ? (window.claude.use("sample") as Promise<SampleFn | null>).catch(() => null)
      : Promise.resolve(null);
  }
  return samplePromise;
}

export function useRuntime<T>(name: string): Promise<T | null> {
  return window.claude ? (window.claude.use(name) as Promise<T | null>).catch(() => null) : Promise.resolve(null);
}
