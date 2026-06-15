/**
 * Server-only Vertex AI provider factory.
 *
 * Builds the Google Vertex provider from Doppler-injected env vars and caches
 * it at module scope so the auth client isn't rebuilt on every call. Never
 * import this from client components.
 *
 * Env vars (all injected via Doppler — never committed to .env):
 *   AI_ENABLED                  "true" to turn the AI path on
 *   GOOGLE_VERTEX_PROJECT        GCP project id
 *   GOOGLE_VERTEX_LOCATION       region, e.g. "us-central1"
 *   GOOGLE_VERTEX_CLIENT_EMAIL   service-account email
 *   GOOGLE_VERTEX_PRIVATE_KEY    service-account PEM (newlines as "\n")
 *   AI_MODEL_FAST                default "gemini-2.5-flash"
 *   AI_MODEL_SMART               default "gemini-2.5-pro"
 */

import { createVertex, type GoogleVertexProvider } from "@ai-sdk/google-vertex";
import type { LanguageModel } from "ai";

const DEFAULT_MODEL_FAST = "gemini-2.5-flash";
const DEFAULT_MODEL_SMART = "gemini-2.5-pro";

/**
 * True only when AI is explicitly enabled and every Vertex credential is
 * present and non-empty. Callers must guard with this before getVertexModel.
 */
export function isAIEnabled(): boolean {
  if (process.env.AI_ENABLED !== "true") return false;
  return [
    process.env.GOOGLE_VERTEX_PROJECT,
    process.env.GOOGLE_VERTEX_LOCATION,
    process.env.GOOGLE_VERTEX_CLIENT_EMAIL,
    process.env.GOOGLE_VERTEX_PRIVATE_KEY,
  ].every((value) => typeof value === "string" && value.length > 0);
}

let cachedProvider: GoogleVertexProvider | null = null;

function getProvider(): GoogleVertexProvider {
  if (cachedProvider) return cachedProvider;

  const project = process.env.GOOGLE_VERTEX_PROJECT;
  const location = process.env.GOOGLE_VERTEX_LOCATION;
  const clientEmail = process.env.GOOGLE_VERTEX_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_VERTEX_PRIVATE_KEY;

  if (!project || !location || !clientEmail || !privateKey) {
    throw new Error(
      "Vertex AI credentials are missing. Set GOOGLE_VERTEX_PROJECT, " +
        "GOOGLE_VERTEX_LOCATION, GOOGLE_VERTEX_CLIENT_EMAIL and " +
        "GOOGLE_VERTEX_PRIVATE_KEY (guard calls with isAIEnabled()).",
    );
  }

  cachedProvider = createVertex({
    project,
    location,
    googleAuthOptions: {
      credentials: {
        client_email: clientEmail,
        // Doppler stores the PEM with literal "\n"; restore real newlines.
        private_key: privateKey.replace(/\\n/g, "\n"),
      },
    },
  });

  return cachedProvider;
}

/**
 * Build a Vertex language model for the requested tier. Throws if credentials
 * are missing — callers should check isAIEnabled() first.
 */
export function getVertexModel(tier: "fast" | "smart" = "fast"): LanguageModel {
  const modelId =
    tier === "smart"
      ? process.env.AI_MODEL_SMART || DEFAULT_MODEL_SMART
      : process.env.AI_MODEL_FAST || DEFAULT_MODEL_FAST;

  return getProvider()(modelId);
}
