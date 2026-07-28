"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; body: string; actions?: { label: string; href: string }[] };

const GREETING: Message = {
  role: "assistant",
  body: "Hi! I can help with your balance, prepaid electricity, maintenance and visitor codes. What do you need?",
  actions: [
    { label: "My balance", href: "/tenant/billing" },
    { label: "Buy electricity", href: "/tenant/electricity" },
    { label: "Log an issue", href: "/tenant/maintenance/new" },
  ],
};

/**
 * Support assistant, pinned bottom-right across every portal.
 *
 * Answers come from /api/chat, which resolves intents against the caller's own
 * data under RLS. The rule-based responder there is a deliberate placeholder
 * for a model-backed one; the transport and persistence are already real.
 */
export function ChatWidget({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    setMessages((m) => [...m, { role: "user", body: text }]);
    setInput("");
    setBusy(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) throw new Error(`Chat failed: ${response.status}`);

      const data = (await response.json()) as { reply: string; actions?: Message["actions"] };
      setMessages((m) => [...m, { role: "assistant", body: data.reply, actions: data.actions }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          body: "Sorry, I could not reach the assistant just now. Please try again, or log a maintenance request if it is urgent.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close support chat" : "Open support chat"}
        className="bg-brand-700 hover:bg-brand-800 dark:bg-brand-600 fixed right-5 bottom-5 z-40 flex h-13 w-13 items-center justify-center rounded-full p-3.5 text-white shadow-lg transition"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M3 6a3 3 0 013-3h8a3 3 0 013 3v5a3 3 0 01-3 3H8l-4 3v-3a3 3 0 01-1-2V6z"
              fill="currentColor"
            />
          </svg>
        )}
      </button>

      {open && (
        <div className="animate-in fixed right-5 bottom-24 z-40 flex h-[26rem] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="bg-brand-700 px-4 py-3 text-white">
            <p className="text-sm font-semibold">veriBills assistant</p>
            <p className="text-brand-100 text-xs">Signed in as {userName}</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((message, i) => (
              <div
                key={i}
                className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    message.role === "user"
                      ? "bg-brand-700 max-w-[85%] rounded-lg rounded-br-sm px-3 py-2 text-sm text-white"
                      : "max-w-[85%] rounded-lg rounded-bl-sm bg-slate-100 px-3 py-2 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                  }
                >
                  <p className="whitespace-pre-wrap">{message.body}</p>
                  {message.actions && message.actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.actions.map((action) => (
                        <a
                          key={action.href}
                          href={action.href}
                          className="text-brand-700 dark:text-brand-300 rounded-full bg-white px-2 py-1 text-xs font-medium dark:bg-slate-900"
                        >
                          {action.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && <p className="text-xs text-slate-400">Assistant is typing…</p>}
            <div ref={endRef} />
          </div>

          <form onSubmit={send} className="flex gap-2 border-t border-slate-200 p-2 dark:border-slate-700">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              aria-label="Message"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="bg-brand-700 hover:bg-brand-800 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
