import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, Send, Sparkles, Trash2 } from "lucide-react";
import {
  BOT_META,
  WELCOME_TEXT,
  makeBotReply,
  makeThinkingLine,
} from "./persona.js";

const STORAGE_KEY = "positive-boyfriend-chat-v4";
const LEGACY_MESSAGE_HINTS = [
  ["비슷한", "솜사탕"],
  ["주제", "빙글빙글"],
  ["꺼낸", "리본"],
];

function createBotMessage(text) {
  return {
    id: crypto.randomUUID(),
    role: "bot",
    text,
    meta: BOT_META,
  };
}

function createUserMessage(text) {
  return {
    id: crypto.randomUUID(),
    role: "user",
    text,
    meta: "자기",
  };
}

function isLegacyBotMessage(message) {
  return (
    message?.role === "bot" &&
    LEGACY_MESSAGE_HINTS.some((hints) =>
      hints.every((hint) => message.text?.includes(hint))
    )
  );
}

function sanitizeMessages(messages) {
  const sanitized = Array.isArray(messages)
    ? messages.filter((message) => !isLegacyBotMessage(message))
    : [];

  return sanitized.length > 0 ? sanitized : [createBotMessage(WELCOME_TEXT)];
}

function loadMessages() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;

    if (Array.isArray(parsed) && parsed.length > 0) {
      return sanitizeMessages(parsed);
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  return [createBotMessage(WELCOME_TEXT)];
}

function waitForFakeInference(text) {
  const base = Math.min(1150, Math.max(520, text.length * 18));
  const jitter = Math.floor(Math.random() * 420);

  return new Promise((resolve) => {
    window.setTimeout(resolve, base + jitter);
  });
}

function App() {
  const [messages, setMessages] = useState(loadMessages);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingLine, setThinkingLine] = useState(makeThinkingLine);
  const endRef = useRef(null);

  const canSend = input.trim().length > 0 && !isThinking;
  const visibleMessages = useMemo(() => sanitizeMessages(messages), [messages]);

  const recentUserCount = useMemo(
    () => visibleMessages.filter((message) => message.role === "user").length,
    [visibleMessages]
  );

  useEffect(() => {
    if (messages.length === 0 || messages.some(isLegacyBotMessage)) {
      setMessages(sanitizeMessages(messages));
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages, isThinking, thinkingLine]);

  async function sendMessage(text = input) {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    const userMessage = createUserMessage(trimmed);
    const nextMessages = [...visibleMessages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setThinkingLine(makeThinkingLine());
    setIsThinking(true);

    await waitForFakeInference(trimmed);

    const reply = createBotMessage(makeBotReply(trimmed, nextMessages));
    setMessages((current) => [...current, reply]);
    setIsThinking(false);
  }

  function resetChat() {
    setMessages([createBotMessage(WELCOME_TEXT)]);
    setInput("");
    setIsThinking(false);
    setThinkingLine(makeThinkingLine());
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  return (
    <main className="app-shell">
      <section className="chat-panel" aria-label="자기만의왕자님 채팅">
        <header className="chat-header">
          <div className="bot-title">
            <span className="status-dot" />
            <div>
              <p>{BOT_META}</p>
              <small>대화 {recentUserCount}회째에도 아직 상처 못 받음</small>
            </div>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="icon-button"
              onClick={resetChat}
              title="대화 초기화"
              aria-label="대화 초기화"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </header>

        <div className="messages">
          {visibleMessages.map((message) => (
            <article className={`message-row ${message.role}`} key={message.id}>
              {message.role === "bot" && (
                <div className="avatar" aria-hidden="true">
                  <Heart size={18} />
                </div>
              )}
              <div className="bubble">
                <span>{message.meta}</span>
                {message.text.split("\n").map((line, index) => (
                  <p key={`${message.id}-${index}`}>{line}</p>
                ))}
              </div>
            </article>
          ))}

          {isThinking && (
            <article className="message-row bot">
              <div className="avatar" aria-hidden="true">
                <Sparkles size={18} />
              </div>
              <div className="bubble thinking">
                <span>{BOT_META}</span>
                <p>{thinkingLine}</p>
                <div className="typing-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </article>
          )}
          <div ref={endRef} />
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <input
            aria-label="메시지"
            onChange={(event) => setInput(event.target.value)}
            value={input}
          />
          <button className="send-button" disabled={!canSend} type="submit">
            <Send size={18} />
            <span>보내기</span>
          </button>
        </form>
      </section>
    </main>
  );
}

export default App;
