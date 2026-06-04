"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";

export default function Home() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
  });

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

            {messages.map((message) => (
              <div
                key={message.id}
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

                  {message.toolInvocations && message.toolInvocations.length > 0 && (
                    <div className="mt-2 text-sm text-purple-600">
                      {message.toolInvocations.map((tool, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="inline-block w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
                          <span>Creating your slides...</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {message.toolResults && message.toolResults.length > 0 && (
                    <div className="mt-3">
                      {message.toolResults.map((result, i) => {
                        const data = result.result as { pptxUrl?: string };
                        return (
                          <div key={i} className="space-y-2">
                            {data.pptxUrl && (
                              <a
                                href={data.pptxUrl}
                                download="presentation.pptx"
                                className="inline-flex items-center gap-2 bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download Presentation
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4">
            <div className="flex gap-3">
              <input
                value={input}
                onChange={handleInputChange}
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
