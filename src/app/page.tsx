"use client";

import { useState, useRef, useEffect } from "react";

export default function Home() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState("");

  const generatePresentation = async () => {
    if (!lastUserMessage || isGenerating) return;

    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: lastUserMessage })
      });

      const data = await response.json();

      if (data.success) {
        // Download the file
        const link = document.createElement("a");
        link.href = data.downloadUrl;
        link.download = data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Add success message
        setMessages(prev => [...prev, { role: "assistant", content: `✅ Presentation generated! Downloaded as ${data.filename}` }]);
      } else {
        throw new Error(data.error || "Generation failed");
      }
    } catch (error) {
      console.error("Generation error:", error);
      setMessages(prev => [...prev, { role: "assistant", content: `❌ Failed to generate presentation: ${error instanceof Error ? error.message : "Unknown error"}` }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user", content: input };
    setMessages([...messages, userMessage]);
    setLastUserMessage(input);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage] })
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let assistantMessage = "";
      let buffer = "";

      // Add placeholder for assistant message
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("data:")) {
            try {
              const jsonStr = trimmed.slice(5).trim();
              if (jsonStr === "[DONE]") continue;
              const data = JSON.parse(jsonStr);
              if (data.content) {
                assistantMessage += data.content;
                // Update only the last message
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = { role: "assistant", content: assistantMessage };
                  return newMessages;
                });
              }
            } catch (e) {
              console.error("Parse error:", e, "Line:", trimmed);
            }
          } else {
            // Plain text fallback
            assistantMessage += trimmed;
            // Update only the last message
            setMessages(prev => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = { role: "assistant", content: assistantMessage };
              return newMessages;
            });
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages(prev => {
        const newMessages = [...prev];
        // If last message is empty assistant message, replace it with error
        if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === "assistant" && !newMessages[newMessages.length - 1].content) {
          newMessages[newMessages.length - 1] = { role: "assistant", content: "Sorry, something went wrong. Please try again." };
        } else {
          newMessages.push({ role: "assistant", content: "Sorry, something went wrong. Please try again." });
        }
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="min-h-screen gradient-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-purple-600 mb-2">s-slide</h1>
          <p className="text-gray-600">Create stunning presentations with AI</p>
        </header>

        <div className="bg-white rounded-2xl shadow-lg purple-glow">
          <div className="h-[500px] overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 py-20">
                <p className="text-lg mb-2">Start creating your presentation</p>
                <p className="text-sm">Try: &quot;Create a 5-slide presentation about sustainable energy&quot;</p>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-purple-100 text-gray-900"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {message.role === "assistant" && message.content ? (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  ) : (
                    <div>{message.content}</div>
                  )}
                </div>
              </div>
            ))}

            {/* Show download button after assistant responds */}
            {messages.length > 0 &&
             messages[messages.length - 1].role === "assistant" &&
             !isGenerating && (
              <div className="flex justify-start">
                <button
                  onClick={generatePresentation}
                  className="px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-medium flex items-center gap-2"
                >
                  📥 Download Presentation
                </button>
              </div>
            )}

            {isGenerating && (
              <div className="flex justify-start">
                <div className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                  Generating PowerPoint...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4">
            <div className="flex gap-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe your presentation..."
                disabled={isLoading}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-6 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Creating...
                  </span>
                ) : (
                  "Generate"
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Powered by AI • PptxGenJS • Claude</p>
        </div>
      </div>
    </div>
  );
}
