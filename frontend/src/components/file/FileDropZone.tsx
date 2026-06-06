"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropZoneProps {
  onFileSelect: (file: File, content: string) => void;
  className?: string;
}

export function FileDropZone({
  onFileSelect,
  className,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.match(/\.(yaml|yml|kb\.yaml)$/i)) {
        setError("Only YAML files can be uploaded (.yaml, .yml, .kb.yaml).");
        return;
      }

      setError(null);
      setIsLoading(true);
      setSelectedFile(file.name);

      try {
        const content = await file.text();

        if (!content.includes("strategy:") && !content.includes("metadata:")) {
          setError("This does not look like a valid strategy YAML file.");
          return;
        }

        onFileSelect(file, content);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to read the file.");
      } finally {
        setIsLoading(false);
      }
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        "relative border-2 border-dashed rounded-xl p-8 transition-all",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-slate-300 dark:border-slate-600 hover:border-slate-400",
        isLoading && "opacity-50 pointer-events-none",
        className
      )}
    >
      <input
        type="file"
        accept=".yaml,.yml,.kb.yaml"
        onChange={handleInputChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isLoading}
      />

      <div className="flex flex-col items-center text-center">
        {isLoading ? (
          <>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 animate-pulse">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              Loading <span className="font-mono">{selectedFile}</span>
            </p>
          </>
        ) : error ? (
          <>
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-red-600 dark:text-red-400 mb-2">{error}</p>
            <p className="text-sm text-slate-500">Try another file.</p>
          </>
        ) : selectedFile ? (
          <>
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
              <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-emerald-600 dark:text-emerald-400 font-medium mb-1">
              File loaded
            </p>
            <p className="text-sm text-slate-500 font-mono">{selectedFile}</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Upload className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-slate-700 dark:text-slate-300 font-medium mb-1">
              Drop a .kb.yaml file here, or click to choose one
            </p>
            <p className="text-sm text-slate-500">
              Strategy YAML files are loaded into the builder automatically.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default FileDropZone;
