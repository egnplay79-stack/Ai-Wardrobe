import type { AIProvider } from "./ai/AIProvider";
import { MockProvider } from "./ai/MockProvider";
import { ClaudeArtifactProvider } from "./ai/ClaudeArtifactProvider";
import { HttpProvider } from "./ai/HttpProvider";
import { API_URL, healthApi } from "../api/client";

export type ProviderChoice = "auto" | "mock" | "claude" | "http";

export interface AIStatus {
  provider: AIProvider["id"];
  label: string;
  /** Set when the last call fell back to the on-device provider. */
  fallbackReason?: string;
}

type Listener = (s: AIStatus) => void;

/**
 * Picks the active provider and falls back to the on-device mock on failure,
 * so the app always completes the flow. Configure with VITE_AI_PROVIDER.
 */
class AIServiceImpl {
  private primary: AIProvider | null = null;
  private readonly mock = new MockProvider();
  private ready: Promise<AIProvider> | null = null;
  private status: AIStatus = { provider: "mock", label: "On-device" };
  private listeners = new Set<Listener>();

  init(choice: ProviderChoice = (import.meta.env.VITE_AI_PROVIDER as ProviderChoice) || "auto"): Promise<AIProvider> {
    if (!this.ready) this.ready = this.select(choice).then((p) => {
      this.primary = p;
      this.setStatus({ provider: p.id, label: p.label });
      return p;
    });
    return this.ready;
  }

  private async select(choice: ProviderChoice): Promise<AIProvider> {
    if (choice === "mock") return this.mock;
    if (choice === "claude") return new ClaudeArtifactProvider();
    if (choice === "http") return new HttpProvider();
    if (await ClaudeArtifactProvider.isAvailable()) return new ClaudeArtifactProvider();
    if (API_URL && (await healthApi())) return new HttpProvider();
    return this.mock;
  }

  async provider(): Promise<AIProvider> {
    return this.primary ?? this.init();
  }

  get fallback(): AIProvider {
    return this.mock;
  }

  /** Run with the primary provider; on any failure except cancel, retry on-device. */
  async run<T>(task: (p: AIProvider) => Promise<T>): Promise<T> {
    const p = await this.provider();
    if (p === this.mock) return task(p);
    try {
      const r = await task(p);
      if (this.status.fallbackReason) this.setStatus({ provider: p.id, label: p.label });
      return r;
    } catch (e) {
      const code = (e as { code?: string; name?: string })?.code ?? (e as Error)?.name;
      if (code === "cancelled" || code === "AbortError") throw e;
      this.setStatus({ provider: "mock", label: this.mock.label, fallbackReason: reasonFor(code) });
      return task(this.mock);
    }
  }

  getStatus() {
    return this.status;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  private setStatus(s: AIStatus) {
    this.status = s;
    this.listeners.forEach((l) => l(s));
  }
}

function reasonFor(code?: string): string {
  switch (code) {
    case "not_granted": return "AI access was declined, so this was done on-device.";
    case "rate_limited": return "AI is busy right now, so this was done on-device.";
    case "images_unavailable": return "Photos can't be sent to AI here, so this was done on-device.";
    default: return "AI didn't respond, so this was done on-device.";
  }
}

export const AIService = new AIServiceImpl();
