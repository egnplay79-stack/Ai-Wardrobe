import type { ImageEditProvider, LLMProvider } from "./providers/types.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { RulesProvider } from "./providers/rules.js";
import { PassthroughEdit, PhotoroomEdit, RemoveBgEdit, ReplicateFlatLayEdit } from "./providers/imageEdit.js";

const env = process.env;

function need(name: string): string {
  const v = env[name];
  if (!v) throw new Error(`${name} is required for the selected provider`);
  return v;
}

/** Provider registry. Add a vendor = add a class + a case here. Nothing else changes. */
export function createLLM(): LLMProvider {
  switch (env.LLM_PROVIDER ?? "anthropic") {
    case "anthropic":
      return env.ANTHROPIC_API_KEY ? new AnthropicProvider(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL || "claude-sonnet-5-5") : new RulesProvider();
    default:
      return new RulesProvider();
  }
}

export function createImageEdit(): ImageEditProvider {
  switch (env.IMAGE_PROVIDER ?? "none") {
    case "removebg": return new RemoveBgEdit(need("REMOVEBG_API_KEY"));
    case "photoroom": return new PhotoroomEdit(need("PHOTOROOM_API_KEY"));
    case "replicate": return new ReplicateFlatLayEdit(need("REPLICATE_API_TOKEN"), env.REPLICATE_MODEL || "black-forest-labs/flux-kontext-pro");
    default: return new PassthroughEdit();
  }
}
