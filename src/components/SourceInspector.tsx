import React, { useState } from "react";
import { KOTLIN_PROJECT_FILES, KotlinFile } from "../data/kotlinFiles";
import { File, FolderOpen, Copy, Check, FileCode, Cpu } from "lucide-react";

export default function SourceInspector() {
  const [selectedFile, setSelectedFile] = useState<KotlinFile>(KOTLIN_PROJECT_FILES[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
      {/* File Explorer Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <Cpu className="text-blue-400 w-5 h-5 animate-pulse" />
          <h2 className="text-sm font-bold text-slate-100 tracking-wider uppercase font-mono">
            Android Source Viewer
          </h2>
        </div>
        <div className="flex-1 max-w-xs mx-4 text-center">
          <span className="px-2 py-1 text-xs font-mono font-bold bg-blue-950 border border-blue-500/30 text-blue-400 rounded-full">
            Kotlin + Material3 + Room
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-[500px]">
        {/* Left Side: Directory Structure Tree */}
        <div className="w-64 bg-slate-950/80 border-r border-slate-800 p-4 space-y-3 overflow-y-auto font-mono text-xs text-slate-300">
          <div className="flex items-center text-slate-400 space-x-2 pb-2 border-b border-slate-800/60">
            <FolderOpen className="w-4 h-4 text-amber-500" />
            <span className="font-bold">project-root /</span>
          </div>

          <div className="space-y-1">
            {KOTLIN_PROJECT_FILES.map((file) => {
              const isSelected = selectedFile.name === file.name;
              return (
                <button
                  key={file.name}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-lg text-left transition-all ${
                    isSelected
                      ? "bg-blue-600/15 border border-blue-500/30 text-blue-300"
                      : "hover:bg-slate-800/50 border border-transparent text-slate-400"
                  }`}
                >
                  <FileCode className={`w-4 h-4 ${isSelected ? "text-blue-400" : "text-slate-500"}`} />
                  <span className="truncate text-[11px] font-medium">{file.name}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-6 border-t border-slate-800/60 text-[10px] text-slate-500">
            <p>📁 Target App Settings:</p>
            <p className="mt-1 font-semibold text-slate-400">Min SDK: API 29 (Android 10)</p>
            <p className="font-semibold text-slate-400">Database Engine: Room</p>
          </div>
        </div>

        {/* Right Side: Code Viewer Canvas */}
        <div className="flex-1 flex flex-col bg-slate-900/95 overflow-hidden">
          {/* File Tab Info Bar */}
          <div className="flex items-center justify-between px-6 py-2.5 bg-slate-950 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <File className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-mono text-slate-400 truncate max-w-md">
                {selectedFile.path}
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-slate-100 rounded-lg transition-colors font-sans hover:cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          {/* Actual Code Layout */}
          <div className="flex-1 overflow-auto p-6 font-mono text-xs leading-relaxed text-slate-300 bg-slate-950/40 select-text">
            <pre className="whitespace-pre">
              <code>{selectedFile.code}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
