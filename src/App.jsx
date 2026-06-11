import { useEffect, useRef, useState } from "react";
import { Heart, Moon, Send, Sun, Trash2 } from "lucide-react";
import { BOT_META, WELCOME_TEXT, makeBotReply } from "./persona.js";

const STORAGE_KEY = "positive-boyfriend-chat";

const INITIAL_MESSAGES = [
  {
    id: crypto.randomUUID(),
    role: "bot",
    text: WELCOME_TEXT,
    meta: BOT_META,
  },
];

async function requestAiReply(conversation) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: conversation.map(({ role, text }) => ({ role, text })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data?.text) {
    throw new Error("Chat response did not include text");
  }

  return data.text;
}

function App() {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_MESSAGES;
  });
  const [input, setInput] = useState("");
  const [theme, setTheme] = useState("light");
  const [isThinking, setIsThinking] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  async function sendMessage(text = input) {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: trimmed,
      meta: "나",
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsThinking(true);

    try {
      const replyText = await requestAiReply(nextMessages.slice(-14));
      const reply = {
        id: crypto.randomUUID(),
        role: "bot",
        text: replyText,
        meta: BOT_META,
      };
      setMessages((current) => [...current, reply]);
    } catch (error) {
      console.warn(error);
      const fallbackReply = {
        id: crypto.randomUUID(),
        role: "bot",
        text: makeBotReply(trimmed),
        meta: BOT_META,
      };
      setMessages((current) => [...current, fallbackReply]);
    } finally {
      setIsThinking(false);
    }
  }

  function resetChat() {
    setMessages(INITIAL_MESSAGES);
    setInput("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  return (
    <main className={`app-shell ${theme}`}>
      <section className="chat-panel" aria-label="대화">
        <header className="chat-header">
          <div>
            <span className="status-dot" />
            <p>{BOT_META}</p>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="icon-button"
              onClick={() => setTheme(theme === "light" ? "night" : "light")}
              title={theme === "light" ? "밤 모드" : "낮 모드"}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={resetChat}
              title="대화 초기화"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </header>

        <div className="messages">
          {messages.map((message) => (
            <article
              className={`message-row ${message.role}`}
              key={message.id}
            >
              {message.role === "bot" && (
                <div className="avatar">
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
              <div className="avatar">
                <Heart size={18} />
              </div>
              <div className="bubble thinking">
                <span>{BOT_META}</span>
                <p>
                  <i />
                  <i />
                  <i />
                </p>
              </div>
            </article>
          )}
          <div ref={endRef} />
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <input
            aria-label="메시지"
            onChange={(event) => setInput(event.target.value)}
            placeholder="놀리거나 고민을 말해보세요"
            value={input}
          />
          <button className="send-button" disabled={!input.trim()} type="submit">
            <Send size={18} />
            <span>보내기</span>
          </button>
        </form>
      </section>
    </main>
  );
}

export default App;
