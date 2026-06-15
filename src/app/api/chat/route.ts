import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { getVertexModel, isAIEnabled } from "@/lib/ai";
import { aiTools } from "@/lib/ai/tools";

// Vertex needs the Node runtime (google-auth-library); allow streaming headroom.
export const maxDuration = 30;

const SYSTEM = `You are the recruiting copilot for Jenny Mcrich Recruitment, an agency placing candidates into heavy-industry roles (cement, mining, aggregates, steel), including US roles with TN-visa constraints.

Rules:
- Answer ONLY using the provided tools. Never invent candidates, jobs, scores, or numbers.
- If the tools return nothing relevant, say you couldn't find it — do not guess.
- Be concise and scannable: short sentences, compact lists. Lead with the answer.
- Match scores are 0-100 (green ≥80, amber 60-79, red <60). When ranking, mention the score.
- You are READ-ONLY: you can look things up and draft text, but you cannot change records, move candidates, or send emails. If asked, explain that and offer the information instead.
- Never output candidates' email addresses or phone numbers (you won't receive them).`;

export async function POST(req: Request): Promise<Response> {
  if (!isAIEnabled()) {
    return Response.json(
      { error: "The AI assistant isn't configured yet." },
      { status: 503 },
    );
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: getVertexModel("fast"),
    system: SYSTEM,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: aiTools,
  });

  return result.toUIMessageStreamResponse();
}
