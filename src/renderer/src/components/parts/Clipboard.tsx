import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { ClipboardCheck, Copy, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ArrowsClockwise, Trash } from '@phosphor-icons/react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';

interface ClipboardData {
  type: 'text' | 'image';
  content: string;
  timestamp: string;
  id: string;
}

interface CodeBlockProps {
  language: string;
  code: string;
}

const STORAGE_KEY = 'clipboardHistory';
const MAX_HISTORY = 50;

const generateId = () => Math.random().toString(36).substr(2, 9);

// Simple CodeBlock component for clipboard items
const SimpleCodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  return (
    <div className="relative my-2 rounded-md overflow-hidden group">
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: '0.5rem',
          maxHeight: '80px',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

// Define MDX components directly in the clipboard component
const mdxComponents = {
  code: ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : 'plaintext';
    return !inline ? (
      <SimpleCodeBlock language={language} code={String(children).trim()} />
    ) : (
      <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>
        {children}
      </code>
    );
  },
  a: ({ node, href, children, ...props }: any) => {
    return (
      <a
        href={href}
        {...props}
        rel="noopener noreferrer"
        className="underline text-blue-500"
      >
        {children}
      </a>
    );
  },
  // Keep the amount of text visible limited for the clipboard preview
  p: ({ children, ...props }: any) => (
    <p className="truncate" {...props}>{children}</p>
  ),
  h1: ({ children, ...props }: any) => (
    <h1 className="text-lg font-bold truncate" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: any) => (
    <h2 className="text-md font-bold truncate" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: any) => (
    <h3 className="text-sm font-bold truncate" {...props}>{children}</h3>
  ),
  ul: ({ children, ...props }: any) => (
    <ul className="ml-4 list-disc" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: any) => (
    <ol className="ml-4 list-decimal" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: any) => (
    <li className="truncate" {...props}>{children}</li>
  ),
};

const Clipboard: React.FC = () => {
  const [clipboardHistory, setClipboardHistory] = useState<ClipboardData[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (err) {
      console.error('Failed to load clipboard history:', err);
      return [];
    }
  });

  const [error, setError] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copySuccess, setCopySuccess] = useState<number | null>(null);
  const lastContentRef = useRef<string>('');
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clipboardHistory));
    } catch (err) {
      console.error('Failed to save clipboard history:', err);
    }
  }, [clipboardHistory]);

  const addToHistory = (newItem: Omit<ClipboardData, 'id'>) => {
    setClipboardHistory(prev => {
      const filteredHistory = prev.filter(item => item.content !== newItem.content);
      
      const newHistory = [{
        ...newItem,
        id: generateId()
      }, ...filteredHistory];
      
      return newHistory.slice(0, MAX_HISTORY);
    });
  };

  const readClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      
      for (const item of items) {
        if (item.types.includes('text/plain')) {
          const blob = await item.getType('text/plain');
          const text = await blob.text();
          
          if (lastContentRef.current !== text) {
            lastContentRef.current = text;
            addToHistory({
              type: 'text',
              content: text,
              timestamp: new Date().toLocaleString()
            });
          }
          break;
        }
        
        if (item.types.some(type => type.startsWith('image/'))) {
          const imageType = item.types.find(type => type.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const reader = new FileReader();
            
            reader.onload = () => {
              const content = reader.result as string;
              if (lastContentRef.current !== content) {
                lastContentRef.current = content;
                addToHistory({
                  type: 'image',
                  content,
                  timestamp: new Date().toLocaleString()
                });
              }
            };
            
            reader.readAsDataURL(blob);
            break;
          }
        }
      }
      
      setError('');
    } catch (err) {
      if (err instanceof Error) {
        setError(`Failed to read clipboard: ${err.message}`);
      } else {
        setError('Failed to read clipboard. Please ensure you have granted permission.');
      }
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await readClipboard();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleCopy = async (content: string, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(content);
      setCopySuccess(index);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setClipboardHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearHistory = () => {
    setClipboardHistory([]);
    localStorage.removeItem(STORAGE_KEY);
    lastContentRef.current = '';
  };

  useEffect(() => {
    readClipboard();
    const intervalId = setInterval(readClipboard, 1000);
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const renderClipboardItem = (entry: ClipboardData, index: number) => {
    return (
      <div 
        key={entry.id}
        className="
          p-3 bg-zinc-100 bg-opacity-40 dark:bg-zinc-900 dark:bg-opacity-40 
          rounded-lg relative group h-[120px]
          hover:bg-opacity-60 dark:hover:bg-opacity-60 
          transition-all duration-200 ease-in-out
        "
      >
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          <button
            onClick={(e) => handleRemove(entry.id, e)}
            className="p-1.5 rounded-md bg-zinc-200 dark:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-zinc-300 dark:hover:bg-zinc-700"
            aria-label="Remove item"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => handleCopy(entry.content, index, e)}
            className="p-1.5 rounded-md bg-zinc-200 dark:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-zinc-300 dark:hover:bg-zinc-700"
            aria-label="Copy to clipboard"
          >
            {copySuccess === index ? (
              <ClipboardCheck className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4 text-zinc-500" />
            )}
          </button>
        </div>

        {entry.type === 'text' ? (
          <div className="h-[80px] overflow-hidden break-all rounded-lg">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={mdxComponents}
            >
              {entry.content || '<empty clipboard>'}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="flex justify-center h-20">
            <img 
              src={entry.content} 
              alt="Clipboard image" 
              className="max-h-full w-auto rounded object-contain"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full h-full bg-transparent shadow-transparent border-none">
      <CardContent className="flex flex-col space-y-4 h-full p-0">
        <div className='flex justify-between items-center'>
          <span className='font-bold'>Clipboard</span>
          <div className="flex gap-2">
          <button 
              onClick={handleRefresh}
              className="flex items-center gap-2"
            >
              <ArrowsClockwise className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            {clipboardHistory.length > 0 && (
              <button 
                onClick={clearHistory}
              className="flex items-center gap-2"
              >
                <Trash className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto sidebar-scrollbar pr-2">
          <div className="flex flex-col gap-2">
            {clipboardHistory.map((entry, index) => (
              renderClipboardItem(entry, index)
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Clipboard;