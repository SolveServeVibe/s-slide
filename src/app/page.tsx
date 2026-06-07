"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

interface SlidePreview {
  type: "title" | "fire" | "claim" | "proof" | "closing";
  headline: string;
  bullets?: string[];
}

const typeStyles: Record<string, { bg: string; text: string; accent: string }> = {
  title:   { bg: "bg-[#6B21A8]", text: "text-white",      accent: "text-purple-200" },
  fire:    { bg: "bg-[#1E1B2E]", text: "text-white",      accent: "text-amber-400" },
  claim:   { bg: "bg-white",     text: "text-purple-800", accent: "text-gray-700" },
  proof:   { bg: "bg-[#F3F0FF]", text: "text-purple-800", accent: "text-gray-700" },
  closing: { bg: "bg-[#6B21A8]", text: "text-white",      accent: "text-purple-200" },
};

export default function Home() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [previewSlides, setPreviewSlides] = useState<SlidePreview[]>([]);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [presTitle, setPresTitle] = useState<string>("");
  const [genStatus, setGenStatus] = useState<string>(""); // "streaming" | "building" | "done"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    const query = input;
    setInput("");
    setIsLoading(true);
    setPreviewSlides([]);
    setDownloadUrl(null);
    setPresTitle("");
    setGenStatus("streaming");

    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    // Stream chat response
    try {
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      if (chatRes.ok) {
        const reader = chatRes.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let text = "";
          let buf = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() || "";
            for (const line of lines) {
              const t = line.trim();
              if (!t.startsWith("data:")) continue;
              try {
                const d = JSON.parse(t.slice(5).trim());
                if (d.content) {
                  text += d.content;
                  setMessages(prev => {
                    const u = [...prev];
                    u[u.length - 1] = { role: "assistant", content: text };
                    return u;
                  });
                }
              } catch {}
            }
          }
        }
      }
    } catch {
      setMessages(prev => {
        const u = [...prev];
        u[u.length - 1] = { role: "assistant", content: "Something went wrong. Try again." };
        return u;
      });
    } finally {
      setIsLoading(false);
    }

    // Stream presentation generation — slides appear incrementally
    try {
      const presRes = await fetch("/api/create-presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query }),
      });

      if (!presRes.ok || !presRes.body) return;

      const reader = presRes.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";

        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          try {
            const event = JSON.parse(t.slice(5).trim());

            if (event.type === "slides" && event.slides) {
              setPreviewSlides(event.slides);
              if (event.slides[0]?.headline) {
                setPresTitle(event.slides[0].headline);
              }
            } else if (event.type === "building") {
              setGenStatus("building");
            } else if (event.type === "done") {
              setDownloadUrl(event.downloadUrl);
              setGenStatus("done");
            } else if (event.type === "error") {
              setGenStatus("done");
            }
          } catch {}
        }
      }
    } catch {
      setGenStatus("done");
    }
  };

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, previewSlides]);

  const isWorking = isLoading || (genStatus !== "" && genStatus !== "done");
  const showBuildingSpinner = genStatus === "building" && !downloadUrl;

  return (
    <div className="min-h-screen gradient-bg">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-purple-600 mb-2">s-slide</h1>
          <p className="text-gray-600">Create stunning presentations with AI</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chat panel */}
          <div className="bg-white rounded-2xl shadow-lg flex flex-col">
            <div className="h-[560px] overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 py-20">
                  <p className="text-lg mb-2">Describe your presentation</p>
                  <p className="text-sm">Try: &quot;Create a 5-slide deck about sustainable energy&quot;</p>
                  <p className="text-xs mt-2 text-gray-300">Iterate: &quot;Add a slide about costs&quot; or &quot;Make it more technical&quot;</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                    m.role === "user" ? "bg-purple-100 text-gray-900" : "bg-gray-50 text-gray-900"
                  }`}>
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none prose-headings:text-purple-700 prose-a:text-purple-600">
                        <ReactMarkdown>{m.content || (isLoading ? "..." : "")}</ReactMarkdown>
                      </div>
                    ) : (
                      <div>{m.content}</div>
                    )}
                  </div>
                </div>
              ))}
              {isWorking && (
                <div className="flex justify-start">
                  <div className="px-4 py-2 bg-purple-50 text-purple-700 rounded-xl flex items-center gap-2 text-sm">
                    <span className="inline-block w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    {isLoading ? "Thinking..." : showBuildingSpinner ? "Building PPTX..." : "Generating slides..."}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
            <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4">
              <div className="flex gap-3">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Describe or refine your presentation..."
                  disabled={isWorking}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isWorking || !input.trim()}
                  className="px-6 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 disabled:opacity-50 transition-colors font-medium"
                >
                  {isWorking ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {isLoading ? "Thinking..." : showBuildingSpinner ? "Building..." : "Creating..."}
                    </span>
                  ) : "Create"}
                </button>
              </div>
            </form>
          </div>

          {/* Preview panel */}
          <div className="bg-white rounded-2xl shadow-lg flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">
                {presTitle || "Slide Preview"}
              </h2>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium no-underline"
                >
                  Download .pptx
                </a>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {previewSlides.length === 0 && !isWorking && (
                <div className="text-center text-gray-400 py-20">
                  <p className="text-lg mb-2">Slides appear here</p>
                  <p className="text-sm">Chat with AI to generate your deck</p>
                </div>
              )}
              {previewSlides.length === 0 && genStatus === "streaming" && (
                <div className="text-center text-gray-400 py-20">
                  <span className="inline-block w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p>AI is designing your slides...</p>
                </div>
              )}
              {previewSlides.map((slide, i) => {
                const style = typeStyles[slide.type] ?? typeStyles.claim;
                const isLast = i === previewSlides.length - 1;
                return (
                  <div key={`${slide.type}-${i}`} className={`rounded-lg overflow-hidden shadow-sm border border-gray-200 transition-all duration-300 ${isLast && isWorking ? "ring-2 ring-purple-300" : ""}`}>
                    <div className={`relative ${style.bg} ${style.text} p-4`} style={{ aspectRatio: "16/9" }}>
                      {slide.type === "fire" && (
                        <span className="absolute top-3 left-3 text-2xl">&#x1F525;</span>
                      )}
                      {slide.type === "claim" && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-600" />
                      )}
                      <div className={`h-full flex flex-col justify-center ${
                        slide.type === "title" || slide.type === "closing" ? "items-center text-center" : "pl-3"
                      }`}>
                        <h3 className={`font-bold mb-2 ${
                          slide.type === "title" || slide.type === "closing" ? "text-xl" : "text-base"
                        }`}>
                          {slide.headline}
                        </h3>
                        {slide.bullets && slide.bullets.length > 0 && (
                          <ul className="space-y-1">
                            {slide.bullets.slice(0, 4).map((b, j) => (
                              <li key={j} className={`text-xs flex gap-1.5 ${style.accent}`}>
                                {slide.type !== "title" && slide.type !== "closing" && (
                                  <span className="shrink-0">&#x25CF;</span>
                                )}
                                <span className="truncate">{b}</span>
                              </li>
                            ))}
                            {slide.bullets.length > 4 && (
                              <li className={`text-xs ${style.accent}`}>+{slide.bullets.length - 4} more</li>
                            )}
                          </ul>
                        )}
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-gray-50 text-xs text-gray-400 flex justify-between border-t border-gray-100">
                      <span>Slide {i + 1} of {previewSlides.length}</span>
                      <span className="uppercase tracking-wide font-medium">{slide.type}</span>
                    </div>
                  </div>
                );
              })}
              {showBuildingSpinner && previewSlides.length > 0 && (
                <div className="text-center py-3 text-sm text-gray-400 flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  Building PPTX file...
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Powered by AI &bull; PptxGenJS &bull; Claude</p>
        </div>
      </div>
    </div>
  );
}
