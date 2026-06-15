"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Icon, cn } from "@/components/ui";
import {
  listThreads,
  loadThread,
  saveConversation,
  deleteThread,
  type ChatThreadSummary,
} from "./chat-history-actions";

/** Short, locale-aware date for a thread row ("13 Jun" / "13 Jun 2025"). */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

let messageIdCounter = 0;
/** Stable unique id for a rehydrated message (crypto when available). */
function newMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  messageIdCounter += 1;
  return `msg-${Date.now()}-${messageIdCounter}`;
}

/** Renders the copilot's markdown replies (bold, lists, links) on-brand. */
function ChatMarkdown({ children }: { children: string }) {
  return (
    <div className="space-y-2 [&_strong]:font-semibold [&_strong]:text-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: (props) => <p className="leading-relaxed" {...props} />,
          ul: (props) => <ul className="space-y-1 pl-1" {...props} />,
          ol: (props) => <ol className="list-decimal space-y-1 pl-5" {...props} />,
          li: ({ children }) => (
            <li className="flex gap-2">
              <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-slate-400" />
              <span className="min-w-0">{children}</span>
            </li>
          ),
          a: (props) => (
            <a className="font-medium text-primary underline underline-offset-2" {...props} />
          ),
          code: (props) => (
            <code className="rounded bg-slate-200/70 px-1 py-0.5 text-[12px]" {...props} />
          ),
          h1: (props) => <p className="font-semibold text-ink" {...props} />,
          h2: (props) => <p className="font-semibold text-ink" {...props} />,
          h3: (props) => <p className="font-semibold text-ink" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

const SUGGESTIONS = [
  "Who are my stalled candidates?",
  "Best matches for the Cement Plant Manager role",
  "Which candidates are TN-visa eligible?",
  "How is the pipeline looking?",
];

/** Read-only recruiter copilot. Rendered only when NEXT_PUBLIC_AI_ENABLED. */
export function Assistant() {
  const { messages, sendMessage, setMessages, status, error } = useChat();
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [view, setView] = useState<"chat" | "history">("chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  // Number of messages captured by the most recent successful save — guards
  // the persistence effect from firing duplicate saves on re-render.
  const lastSavedCount = useRef(0);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  // Persist the conversation once the assistant has finished replying.
  useEffect(() => {
    if (status !== "ready" || messages.length === 0) return;
    if (messages.length === lastSavedCount.current) return;
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;

    const payload = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join(""),
    }));
    const count = messages.length;
    lastSavedCount.current = count;

    void saveConversation({ threadId, messages: payload })
      .then((res) => {
        if (res.threadId) setThreadId(res.threadId);
      })
      .catch(() => {
        // Persistence is best-effort; never block the chat on a failed save.
        lastSavedCount.current = 0;
      });
  }, [status, messages, threadId]);

  async function refreshThreads() {
    const list = await listThreads();
    setThreads(list);
    // Restore the most recent conversation when opening into an empty chat, so
    // reopening the panel resumes where you left off (not a blank screen).
    if (list.length > 0 && threadId === null && messages.length === 0) {
      await openThread(list[0].id);
    }
  }

  function startNewChat() {
    setMessages([]);
    setThreadId(null);
    lastSavedCount.current = 0;
    setView("chat");
  }

  async function openThread(id: string) {
    const history = await loadThread(id);
    setMessages(
      history.map((m) => ({
        id: newMessageId(),
        role: m.role,
        parts: [{ type: "text" as const, text: m.content }],
      })),
    );
    setThreadId(id);
    lastSavedCount.current = history.length;
    setView("chat");
  }

  async function removeThread(id: string) {
    await deleteThread(id);
    if (id === threadId) startNewChat();
    await refreshThreads();
  }

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    void sendMessage({ text: t });
    setInput("");
    setView("chat");
  }

  return (
    <Sheet
      onOpenChange={(open) => {
        if (open) void refreshThreads();
      }}
    >
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-300 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <Icon name="bolt" size={15} className="text-emerald-400" />
          <span className="hidden sm:inline">Ask AI</span>
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 bg-surface p-0 sm:max-w-[440px]"
      >
        <SheetHeader className="shrink-0 border-b border-slate-200 px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-ink">
            <span className="grid size-7 place-items-center rounded-full bg-primary-soft">
              <Icon name="bolt" size={15} className="text-primary-ink" />
            </span>
            Recruiting copilot
          </SheetTitle>
          <p className="text-[12.5px] text-slate-500">
            Answers from your live data — read-only.
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <button
              type="button"
              onClick={startNewChat}
              className="inline-flex items-center gap-1.5 rounded-control border border-slate-200 bg-surface px-2.5 py-1.5 text-[12px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft"
            >
              <Icon name="plus" size={13} />
              New chat
            </button>
            <button
              type="button"
              onClick={() => setView((v) => (v === "history" ? "chat" : "history"))}
              aria-pressed={view === "history"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft",
                view === "history"
                  ? "border-primary/30 bg-primary-soft text-primary-ink"
                  : "border-slate-200 bg-surface text-slate-600 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              <Icon name="clock" size={13} />
              History
            </button>
          </div>
        </SheetHeader>

        {/* History */}
        {view === "history" ? (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {threads.length === 0 ? (
              <p className="text-[13px] text-slate-500">No saved conversations yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {threads.map((t) => (
                  <div
                    key={t.id}
                    className="group flex items-center gap-2 rounded-card border border-slate-200 bg-surface px-3.5 py-2.5 text-left shadow-[0_1px_1px_rgb(15_23_42/0.04)] transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    <button
                      type="button"
                      onClick={() => void openThread(t.id)}
                      className="min-w-0 flex-1 text-left focus-visible:outline-none"
                    >
                      <p className="truncate text-[13px] font-medium text-slate-700">
                        {t.title}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-slate-400">
                        {shortDate(t.updatedAt)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeThread(t.id)}
                      aria-label="Delete conversation"
                      className="grid size-7 shrink-0 place-items-center rounded-control text-slate-400 transition-colors hover:bg-danger-soft hover:text-danger-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
        /* Conversation */
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <div className="space-y-3">
              <p className="text-[13px] text-slate-500">Try asking:</p>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-card border border-slate-200 bg-surface px-3.5 py-2.5 text-left text-[13px] text-slate-700 shadow-[0_1px_1px_rgb(15_23_42/0.04)] transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {messages.map((m) => {
                const text = m.parts
                  .filter((p): p is { type: "text"; text: string } => p.type === "text")
                  .map((p) => p.text)
                  .join("");
                const tools = m.parts.filter((p) => p.type.startsWith("tool-")).length;
                return (
                  <li
                    key={m.id}
                    className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-card px-3.5 py-2.5 text-[13px] leading-relaxed",
                        m.role === "user"
                          ? "whitespace-pre-wrap bg-primary text-white"
                          : "border border-slate-200 bg-slate-50 text-slate-700",
                      )}
                    >
                      {m.role === "user" ? (
                        text
                      ) : text ? (
                        <ChatMarkdown>{text}</ChatMarkdown>
                      ) : tools > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-500">
                          <Icon name="search" size={13} /> Looking that up…
                        </span>
                      ) : (
                        ""
                      )}
                    </div>
                  </li>
                );
              })}
              {busy && messages[messages.length - 1]?.role === "user" ? (
                <li className="flex justify-start">
                  <div className="rounded-card border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                    <TypingDots />
                  </div>
                </li>
              ) : null}
            </ul>
          )}

          {error ? (
            <p className="mt-3 rounded-control bg-danger-soft px-3 py-2 text-[12.5px] text-danger-ink">
              Something went wrong. Please try again.
            </p>
          ) : null}
        </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex shrink-0 items-end gap-2 border-t border-slate-200 px-4 py-3"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask about candidates, jobs, the pipeline…"
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-control border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-900 shadow-[var(--shadow-input-inset)] outline-none placeholder:text-slate-400 focus:border-primary focus:ring-[3px] focus:ring-primary-soft"
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            aria-label="Send"
            className="grid size-10 shrink-0 place-items-center rounded-control bg-[linear-gradient(180deg,#10b981_0%,#059669_100%)] text-white shadow-[var(--shadow-button)] transition-[filter] hover:brightness-[1.05] disabled:opacity-50 disabled:shadow-none"
          >
            <Icon name="chevronRight" size={18} />
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-pulse rounded-full bg-slate-400"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}
