"use server";

/**
 * Persistent chat history for the recruiting copilot.
 *
 * All reads/writes go through the RLS-scoped user server client, so
 * `chat_threads` / `chat_messages` are automatically owner-scoped by the
 * `current_profile_id()` policy. When Supabase is unprovisioned (demo data)
 * or the session has no profile, every action no-ops gracefully — returning
 * an empty list / null rather than throwing, so the copilot still works.
 *
 * PII: message content is candidate-adjacent. We NEVER log it.
 */

import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { currentProfileId } from "@/lib/data/supabase-mutations";

/**
 * The generated `Database` type doesn't yet include `chat_threads` /
 * `chat_messages` (they live only in the migration). Until `src/types/db.ts`
 * is regenerated, address those two tables through a minimally-typed view of
 * the same client — RLS still enforces ownership at the DB.
 */
type ChatThreadRow = { id: string; title: string; updated_at: string };
type ChatMessageRow = { role: string; content: string };
type ChatTablesClient = {
  from(table: "chat_threads"): {
    select(cols: string): {
      eq(col: string, val: string): {
        order(
          col: string,
          opts: { ascending: boolean },
        ): {
          limit(n: number): Promise<{ data: ChatThreadRow[] | null; error: unknown }>;
        };
      };
    };
    insert(values: { profile_id: string; title: string }): {
      select(cols: string): {
        single(): Promise<{ data: { id: string } | null; error: unknown }>;
      };
    };
    update(values: { updated_at: string }): {
      eq(col: string, val: string): Promise<{ error: unknown }>;
    };
    delete(): { eq(col: string, val: string): Promise<{ error: unknown }> };
  };
  from(table: "chat_messages"): {
    select(cols: string): {
      eq(col: string, val: string): {
        order(
          col: string,
          opts: { ascending: boolean },
        ): Promise<{ data: ChatMessageRow[] | null; error: unknown }>;
      };
    };
    insert(
      values: { thread_id: string; role: string; content: string }[],
    ): Promise<{ error: unknown }>;
    delete(): { eq(col: string, val: string): Promise<{ error: unknown }> };
  };
};

/** Narrow the RLS client to the chat tables not yet in the generated types. */
function chat(supabase: SupabaseServerClient): ChatTablesClient {
  return supabase as unknown as ChatTablesClient;
}

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const saveSchema = z.object({
  threadId: z.string().uuid().nullable(),
  messages: z.array(messageSchema),
});

export type ChatHistoryMessage = z.infer<typeof messageSchema>;

export type ChatThreadSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

/** The current user's threads, newest first (max 30). Empty if no Supabase. */
export async function listThreads(): Promise<ChatThreadSummary[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];
  const profileId = await currentProfileId(supabase);
  if (!profileId) return [];

  const { data, error } = await chat(supabase)
    .from("chat_threads")
    .select("id, title, updated_at")
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error || !data) return [];

  return data.map((t) => ({
    id: t.id,
    title: t.title,
    updatedAt: t.updated_at,
  }));
}

/** Messages for a thread, chronological. Empty if missing / no Supabase. */
export async function loadThread(id: string): Promise<ChatHistoryMessage[]> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return [];

  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];
  const profileId = await currentProfileId(supabase);
  if (!profileId) return [];

  const { data, error } = await chat(supabase)
    .from("chat_messages")
    .select("role, content")
    .eq("thread_id", parsed.data)
    .order("created_at", { ascending: true });
  if (error || !data) return [];

  return data
    .filter((m): m is { role: "user" | "assistant"; content: string } =>
      m.role === "user" || m.role === "assistant",
    )
    .map((m) => ({ role: m.role, content: m.content }));
}

/**
 * Persist the full conversation. Creates the thread on first save (title from
 * the first user message), then replaces the thread's messages wholesale and
 * bumps `updated_at`. Returns the thread id (new or existing). No-ops to a
 * synthetic id when Supabase is unavailable so the caller stays simple.
 */
export async function saveConversation(input: {
  threadId: string | null;
  messages: ChatHistoryMessage[];
}): Promise<{ threadId: string }> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { threadId: input.threadId ?? "" };
  const { messages } = parsed.data;
  let { threadId } = parsed.data;

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { threadId: threadId ?? "" };
  const profileId = await currentProfileId(supabase);
  if (!profileId) return { threadId: threadId ?? "" };

  const now = new Date().toISOString();

  const db = chat(supabase);

  if (!threadId) {
    const firstUser = messages.find((m) => m.role === "user");
    const title = firstUser?.content.trim().slice(0, 60) || "New conversation";
    const { data, error } = await db
      .from("chat_threads")
      .insert({ profile_id: profileId, title })
      .select("id")
      .single();
    if (error || !data) return { threadId: "" };
    threadId = data.id;
  } else {
    await db.from("chat_threads").update({ updated_at: now }).eq("id", threadId);
  }

  // Replace the thread's messages wholesale: delete then re-insert in order.
  await db.from("chat_messages").delete().eq("thread_id", threadId);
  if (messages.length > 0) {
    await db.from("chat_messages").insert(
      messages.map((m) => ({
        thread_id: threadId as string,
        role: m.role,
        content: m.content,
      })),
    );
  }

  return { threadId };
}

/** Delete a thread (and its messages, via FK cascade / RLS). No-op offline. */
export async function deleteThread(id: string): Promise<void> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return;

  const supabase = await getSupabaseServerClient();
  if (!supabase) return;
  const profileId = await currentProfileId(supabase);
  if (!profileId) return;

  const db = chat(supabase);
  await db.from("chat_messages").delete().eq("thread_id", parsed.data);
  await db.from("chat_threads").delete().eq("id", parsed.data);
}
