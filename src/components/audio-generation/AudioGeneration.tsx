import React, { useState } from "react";
import { Music, Mic, Wand2 } from "lucide-react";
import { useTheme } from "../theme-provider";

export function AudioGeneration() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<"sfx" | "music" | "tts">("sfx");

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden relative">
      <div className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full">
        
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-extrabold text-foreground mb-4">
            Audio Studio
          </h1>
          <p className="text-muted-foreground text-lg">
            Generate state-of-the-art sound effects, music, and text-to-speech utilizing advanced AI models.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-4 mb-8">
          <button
            onClick={() => setActiveTab("sfx")}
            className={`flex items-center space-x-2 px-6 py-3 rounded-2xl font-bold transition-all ${
              activeTab === "sfx"
                ? "bg-primary text-primary-foreground shadow-lg"
                : "bg-white/5 text-foreground hover:bg-white/10"
            }`}
          >
            <Wand2 className="w-5 h-5" />
            <span>Sound Effects</span>
          </button>
          
          <button
            onClick={() => setActiveTab("music")}
            className={`flex items-center space-x-2 px-6 py-3 rounded-2xl font-bold transition-all ${
              activeTab === "music"
                ? "bg-primary text-primary-foreground shadow-lg"
                : "bg-white/5 text-foreground hover:bg-white/10"
            }`}
          >
            <Music className="w-5 h-5" />
            <span>Music Generation</span>
          </button>
          
          <button
            onClick={() => setActiveTab("tts")}
            className={`flex items-center space-x-2 px-6 py-3 rounded-2xl font-bold transition-all ${
              activeTab === "tts"
                ? "bg-primary text-primary-foreground shadow-lg"
                : "bg-white/5 text-foreground hover:bg-white/10"
            }`}
          >
            <Mic className="w-5 h-5" />
            <span>Text-to-Speech</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="glass-panel p-8 rounded-[32px] border border-white/10 bg-white/5 relative overflow-hidden min-h-[500px] flex items-center justify-center">
            
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                {activeTab === "sfx" && <Wand2 className="w-10 h-10 text-primary" />}
                {activeTab === "music" && <Music className="w-10 h-10 text-primary" />}
                {activeTab === "tts" && <Mic className="w-10 h-10 text-primary" />}
              </div>
              <h2 className="text-2xl font-bold mb-2">
                {activeTab === "sfx" && "Generate Sound Effects"}
                {activeTab === "music" && "Generate Music Tracks"}
                {activeTab === "tts" && "Voice Synthesis"}
              </h2>
              <p className="text-muted-foreground w-3/4 mx-auto max-w-sm mb-8">
                The Audio Generation component was corrupted and restored automatically. Please configure the integration or let me know if you would like to restore the full component behavior.
              </p>
            </div>
            
        </div>
      </div>
    </div>
  );
}