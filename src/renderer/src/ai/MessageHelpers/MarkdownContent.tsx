import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { MDXProvider } from '@mdx-js/react';
import 'katex/dist/katex.min.css';
import { useView } from '../../components/parts/ViewContext';
import { Button } from '../../ui/button';
import 'katex/dist/katex.min.css';
import { ChatMessageProps, CodeBlockProps, MapLocation, MapResult } from '../../types/MessageTypes';
import { Check, Clipboard } from '@phosphor-icons/react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="relative my-2 rounded-md overflow-hidden group">
      <Button
        variant="outline"
        size="sm"
        className="absolute right-2 top-2 z-10 hover:bg-transparent"
        onClick={handleCopy}
      >
        {isCopied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
      </Button>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: '0.5rem',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

const MarkdownContent: React.FC<{ content: string }> = ({ content }) => {
  const { activeTabId, webviewRefs, updateTabState, activeTab } = useView();

  const handleLinkClick = (url: string, e: React.MouseEvent) => {
    e.preventDefault()
    let processedUrl = url
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      processedUrl = `https://${url}`
    }
    
    const webview = webviewRefs.current.get(activeTabId)
    if (webview) {
      webview
        .loadURL(processedUrl)
        .then(() => {
          updateTabState(activeTabId, {
            url: processedUrl,
            navigationHistory: [...activeTab.navigationHistory.slice(0, activeTab.historyIndex + 1), processedUrl],
            historyIndex: activeTab.historyIndex + 1,
          })
        })
        .catch((error: any) => {
          console.error("Failed to load URL:", error)
        })
    }
  };

  const mdxComponents = {
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : 'plaintext';
      return !inline ? (
        <CodeBlock language={language} code={String(children).trim()} />
      ) : (
        <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>
          {children}
        </code>
      );
    },
    a: ({ node, href, children, ...props }: any) => {
      const isExternal = href?.startsWith('http');
      return (
        <a
          href={href}
          onClick={(e) => isExternal ? handleLinkClick(href, e) : undefined}
          {...props}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="underline text-blue-500"
        >
          {children}
        </a>
      );
    },
  };

  return (
    <MDXProvider components={mdxComponents}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={mdxComponents}
      >
        {content}
      </ReactMarkdown>
    </MDXProvider>
  );
};

export default MarkdownContent;