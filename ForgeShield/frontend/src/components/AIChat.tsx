import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Sparkles } from "lucide-react";
import { getAIResponse, SUGGESTED_QUESTIONS, generateFinalDecision, type ChatMessage } from "../api/mockData";

interface Props {
  seed: number;
}

export default function AIChat({ seed }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [decision] = useState(() => generateFinalDecision(seed));

  // Initialize with greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "m0",
          role: "assistant",
          content: `Hello! I am your ForgeShield AI Underwriting Assistant. I've audited the corporate filing registers, bank cash flows, and identity document signatures. 

Ask me any question about the risk indicators, GST discrepancies, or default probability of this case.`,
          timestamp: Date.now()
        }
      ]);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate AI thinking and typing response
    setTimeout(() => {
      const responseText = getAIResponse(text, decision);
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: responseText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 1000 }}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            style={{
              width: 380,
              height: 480,
              background: "var(--bg-glass)",
              backdropFilter: "blur(16px)",
              border: "1px solid var(--border-default)",
              borderRadius: 16,
              boxShadow: "var(--shadow-card)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              marginBottom: 10
            }}
          >
            {/* Header */}
            <div style={{
              padding: "12px 16px",
              background: "rgba(99,102,241,0.12)",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={16} color="var(--indigo-light)" />
                <span style={{ fontSize: 13, fontWeight: 700 }}>ForgeShield Underwriting copilot</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Message Area */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: m.role === "user" ? "var(--indigo)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${m.role === "user" ? "transparent" : "var(--border-subtle)"}`,
                    color: m.role === "user" ? "white" : "var(--text-primary)",
                    fontSize: 12,
                    lineHeight: 1.5,
                    whiteSpace: "pre-line"
                  }}
                >
                  {m.content}
                </div>
              ))}
              {isTyping && (
                <div style={{
                  alignSelf: "flex-start", padding: "10px 14px", borderRadius: 12,
                  background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)",
                  fontSize: 12, color: "var(--text-muted)"
                }}>
                  Thinking...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggested Chips (Filtered to fit layout) */}
            <div style={{
              padding: "8px 12px",
              display: "flex",
              gap: 6,
              overflowX: "auto",
              whiteSpace: "nowrap",
              borderTop: "1px solid var(--border-subtle)",
              background: "rgba(0,0,0,0.05)"
            }}>
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSendMessage(q)}
                  style={{
                    padding: "4px 10px",
                    background: "rgba(99,102,241,0.06)",
                    border: "1px solid rgba(99,102,241,0.2)",
                    borderRadius: 20,
                    color: "var(--indigo-light)",
                    fontSize: 10,
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(99,102,241,0.12)";
                    e.currentTarget.style.borderColor = "var(--indigo)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(99,102,241,0.06)";
                    e.currentTarget.style.borderColor = "rgba(99,102,241,0.2)";
                  }}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(input);
              }}
              style={{
                padding: 12,
                background: "rgba(0,0,0,0.1)",
                borderTop: "1px solid var(--border-subtle)",
                display: "flex",
                gap: 8
              }}
            >
              <input
                type="text"
                placeholder="Ask about risk, ratios, fraud checks..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                style={{
                  flex: 1,
                  background: "rgba(0,0,0,0.2)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 12,
                  color: "var(--text-primary)"
                }}
              />
              <button
                type="submit"
                style={{
                  background: "var(--indigo)",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  width: 34,
                  height: 34,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer"
                }}
              >
                <Send size={14} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bubble Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--indigo), var(--cyan-dark))",
          boxShadow: "0 6px 20px rgba(99,102,241,0.4)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          float: "right"
        }}
      >
        {open ? <X size={20} /> : <MessageSquare size={20} />}
      </motion.button>
    </div>
  );
}
