"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { ChevronDown, Code2, Save, X, Eye, Edit3, ZoomIn, ZoomOut, RotateCcw } from "lucide-react"

interface CodeEditorProps {
  id: string
  content: string
  language: string
  onContentChange: (id: string, content: string) => void
  onLanguageChange: (id: string, language: string) => void
  onBlur?: (id: string) => void
  onFocus?: (id: string) => void
  
  // Optional props for additional features
  filename?: string
  onSave?: (id: string, content: string) => void
  showSaveButton?: boolean
  showLanguageSelector?: boolean
  width?: number
  height?: number
  scale?: number
  className?: string
}

const LANGUAGES = [
  { id: "javascript", name: "JavaScript", icon: "js" },
  { id: "typescript", name: "TypeScript", icon: "ts" },
  { id: "python", name: "Python", icon: "py" },
  { id: "java", name: "Java", icon: "java" },
  { id: "csharp", name: "C#", icon: "cs" },
  { id: "cpp", name: "C++", icon: "cpp" },
  { id: "c", name: "C", icon: "c" },
  { id: "go", name: "Go", icon: "go" },
  { id: "ruby", name: "Ruby", icon: "rb" },
  { id: "php", name: "PHP", icon: "php" },
  { id: "swift", name: "Swift", icon: "swift" },
  { id: "kotlin", name: "Kotlin", icon: "kt" },
  { id: "rust", name: "Rust", icon: "rs" },
  { id: "html", name: "HTML", icon: "html" },
  { id: "css", name: "CSS", icon: "css" },
  { id: "sql", name: "SQL", icon: "sql" },
  { id: "bash", name: "Bash", icon: "sh" },
  { id: "json", name: "JSON", icon: "json" },
  { id: "yaml", name: "YAML", icon: "yaml" },
  { id: "markdown", name: "Markdown", icon: "md" },
  { id: "xml", name: "XML", icon: "xml" },
  { id: "plaintext", name: "Plain Text", icon: "txt" },
  { id: "plain", name: "Plain Text", icon: "txt" },
]

const CodeEditor: React.FC<CodeEditorProps> = ({
  id,
  content,
  language,
  onContentChange,
  onLanguageChange,
  onBlur,
  onFocus,
  filename,
  onSave,
  showSaveButton = true,
  showLanguageSelector = true,
  width = 600,
  height = 400,
  scale = 1,
  className = "",
}) => {
  const [cursorPosition, setCursorPosition] = useState("Ln 1, Col 1")
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const getCurrentLanguageName = () => {
    const lang = LANGUAGES.find((l) => l.id === language)
    return lang ? lang.name : "Plain Text"
  }

  const getFileStats = () => {
    const lines = content.split('\n').length
    const characters = content.length
    const words = content.trim() ? content.trim().split(/\s+/).length : 0
    return { lines, characters, words }
  }

  const generateLineNumbers = () => {
    const lines = content.split('\n')
    return lines.map((_, i) => i + 1).join('\n')
  }

  const updateCursorPosition = () => {
    if (!textareaRef.current) return
    
    const target = textareaRef.current
    const position = target.selectionStart
    const textBeforeCursor = target.value.slice(0, position)
    const lines = textBeforeCursor.split('\n')
    const line = lines.length
    const column = lines[lines.length - 1].length + 1
    setCursorPosition(`Ln ${line}, Col ${column}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const target = e.target as HTMLTextAreaElement
      const start = target.selectionStart
      const end = target.selectionEnd
      const value = target.value

      if (e.shiftKey) {
        // Remove indentation
        const beforeSelection = value.slice(0, start)
        const lineStart = beforeSelection.lastIndexOf('\n') + 1
        const lineContent = beforeSelection.slice(lineStart)
        if (lineContent.startsWith('    ')) {
          const newBefore = beforeSelection.slice(0, lineStart) + lineContent.slice(4)
          const newValue = newBefore + value.slice(end)
          onContentChange(id, newValue)
          setTimeout(() => {
            target.selectionStart = target.selectionEnd = start - 4
          }, 0)
        }
      } else {
        // Add indentation
        const newValue = value.slice(0, start) + '    ' + value.slice(end)
        onContentChange(id, newValue)
        setTimeout(() => {
          target.selectionStart = target.selectionEnd = start + 4
        }, 0)
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 's' && onSave) {
      e.preventDefault()
      onSave(id, content)
    }
  }

  useEffect(() => {
    updateCursorPosition()
  }, [content])

  const baseFontSize = 14
  const finalFontSize = baseFontSize * scale
  const stats = getFileStats()

  return (
    <div className={`relative ${className}`}>
      <div
        className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg"
        style={{ 
          width: `${width}px`,
          height: `${height}px`
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-white border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Code2 size={16} className="text-zinc-800 dark:text-white" />
            
            {filename && (
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate text-zinc-800 dark:text-white" title={filename}>
                  {filename}
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-300 uppercase tracking-wide">
                  {getCurrentLanguageName()}
                </div>
              </div>
            )}

            {!filename && showLanguageSelector && (
              <div className="relative">
                <select
                  value={language}
                  onChange={(e) => onLanguageChange(id, e.target.value)}
                  className="bg-zinc-200 dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1 text-xs text-zinc-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {onSave && showSaveButton && (
              <button
                className="w-7 h-7 rounded-md bg-zinc-200 hover:bg-zinc-300 dark:bg-white/10 dark:hover:bg-white/20 text-zinc-700 dark:text-white flex items-center justify-center transition-colors"
                onClick={() => onSave(id, content)}
                title="Save (Ctrl+S)"
              >
                <Save size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 px-3 py-1 text-xs text-zinc-600 dark:text-zinc-400 flex justify-between">
          <div className="flex gap-4">
            <span>Lines: {stats.lines}</span>
            <span>Characters: {stats.characters}</span>
            <span>Words: {stats.words}</span>
          </div>
          <div>
            <span>{cursorPosition}</span>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex h-full">
          {/* Line Numbers */}
          <div 
            className="select-none font-mono text-right pr-2 pl-2 py-3 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500 border-r border-zinc-200 dark:border-zinc-700 overflow-hidden"
            style={{ 
              fontSize: `${finalFontSize}px`,
              lineHeight: "1.5",
              width: "3.5rem"
            }}
          >
            <div className="whitespace-pre-line">
              {generateLineNumbers()}
            </div>
          </div>
          
          {/* Code Editor */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => onContentChange(id, e.target.value)}
              onKeyDown={handleKeyDown}
              onKeyUp={updateCursorPosition}
              onClick={updateCursorPosition}
              onFocus={() => onFocus?.(id)}
              onBlur={() => onBlur?.(id)}
              className="w-full h-full p-3 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 border-none outline-none resize-none font-mono placeholder:text-zinc-500 dark:placeholder:text-zinc-400"
              style={{ 
                fontSize: `${finalFontSize}px`,
                lineHeight: "1.5",
                fontFamily: "'Fira Code', 'Courier New', monospace"
              }}
              placeholder="Type your code here..."
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default CodeEditor