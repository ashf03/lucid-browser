import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Clipboard, Check, Code, ChevronDown, ChevronUp, Languages } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { MDXProvider } from '@mdx-js/react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { a11yDark, dracula, materialOceanic, nightOwl } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { useView } from '../../components/parts/ViewContext';
import { Badge } from '../../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';
import { ProductQueryAnalysis } from '../Products/ProductAnalyzer';
import { YouTubeResult } from '../../types/types';
import { ImageAnalysisResult } from '../ImageSearch/ImageAnalyzer';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import SearchResultsSlider from './SearchResultsSlider';
import ImageGallery from '../Gallery/ImageGallery';
import VideoGallery from '../Gallery/VideoGallery';

// Types
interface CodeBlock {
  language: string;
  code: string;
}

interface ImageResult {
  url: string;
  title: string;
  thumbnail: string;
}

interface VideoResult {
  link: string;
  title: string;
  thumbnail: string;
  duration: string;
  platform: string;
  date: string;
}

interface ConversationHistory {
  messages: (HumanMessage | AIMessage)[];
}

interface EnhancedMessage {
  role: 'user' | 'assistant';
  content: string;
  codeBlocks?: CodeBlock[];
  webResponse?: string;
  searchResults?: string;
  imageResults?: ImageResult[];
  videoResults?: VideoResult[];
  mapResults?: MapResult[];
  isLocationBased?: boolean;
  productData?: {
    displayType: 'product-list' | 'product-comparison' | 'category-overview';
    searchQuery: string;
    analysis: ProductQueryAnalysis;
    products: any[];
  };
  youtubeResults?: YouTubeResult[];
  imageData?: {
    displayType: 'image-analysis';
    searchQuery: string;
    analysis: ImageAnalysisResult;
    imageResults?: ImageResult[];
    imageData: string;
    imageName: string;
    allImages?: Array<{src: string, name: string}>;
  };
  structuredData?: {
    text: string;
    pastedItems: Array<{id: string, content: string, timestamp: number}>;
    uploadedFiles: Array<{id: string, name: string, content: string, fileInfo: any, timestamp: number}>;
    uploadedImages: Array<{id: string, src: string, name?: string}>;
    attachedUrls?: Array<{
      url: string;
      type: 'web' | 'youtube';
      status: 'loaded';
      content: {
        type: 'web' | 'youtube';
        title: string;
        data?: any;
        youtubeData?: {
          transcript: string;
          videoTitle: string;
          videoId: string;
        };
      };
    }>;
    timestamp: number;
  };
}

interface LocationQueryAnalysis {
  isLocationBased: boolean;
  locationType: 'specific-place' | 'near-me' | 'place-type' | 'none';
  locationConfidence: number;
  locationReasoning: string;
  place?: string;
  placeType?: string;
  searchRadius?: string;
}

interface CodeBlockProps {
  language: string;
  code: string;
  showLineNumbers?: boolean;
  title?: string;
  collapsible?: boolean;
}

interface MapResult {
  title: string;
  rating?: number;
  reviews?: number;
  address?: string;
  website?: string;
  mapsUrl?: string;
  hours?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  gps_coordinates?: {
    latitude: number;
    longitude: number;
  };
}

interface MessageFormatterProps {
  message: EnhancedMessage;
  messageIndex?: number;
  sourcesViewMode?: 'compact' | 'full';
  onSourcesViewModeChange?: (mode: 'compact' | 'full') => void;
  onImageFullViewChange?: (isFullView: boolean) => void;
  onVideoFullViewChange?: (isFullView: boolean) => void;
  imageViewMode?: 'compact' | 'full';
  videoViewMode?: 'compact' | 'full'; // FIXED: Added video view mode prop
}

// Search Results Component - replaces TestComponent
const SearchResultsComponent: React.FC<{
  message: EnhancedMessage;
  sourcesViewMode?: 'compact' | 'full';
  onSourcesViewModeChange?: (mode: 'compact' | 'full') => void;
}> = ({ message, sourcesViewMode = 'compact', onSourcesViewModeChange }) => {
  if (!message.searchResults || message.searchResults.length === 0) {
    return null;
  }

  return (
    <div className="my-2 flex justify-center">
      <div className="w-full max-w-4xl">
        <SearchResultsSlider
          searchResults={message.searchResults}
          viewMode={sourcesViewMode}
          onViewModeChange={onSourcesViewModeChange || (() => {})}
        />
      </div>
    </div>
  );
};

// Fixed Image Gallery Component with controlled state
const ImageGalleryComponent: React.FC<{
  message: EnhancedMessage;
  viewMode: 'compact' | 'full';
  onViewModeChange: (mode: 'compact' | 'full') => void;
}> = ({ message, viewMode, onViewModeChange }) => {
  if (!message.imageResults || message.imageResults.length === 0) {
    return null;
  }

  return (
    <div className="my-2 flex justify-center">
      <div className="w-full max-w-4xl">
        <ImageGallery 
          images={message.imageResults}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
        />
      </div>
    </div>
  );
};

// FIXED: Video Gallery Component with controlled state like ImageGallery
const VideoGalleryComponent: React.FC<{
  message: EnhancedMessage;
  viewMode: 'compact' | 'full';
  onViewModeChange: (mode: 'compact' | 'full') => void;
}> = ({ message, viewMode, onViewModeChange }) => {
  // Check if we have any videos to display
  const hasVideos = (message.youtubeResults && message.youtubeResults.length > 0) || 
                    (message.videoResults && message.videoResults.length > 0);

  if (!hasVideos) {
    return null;
  }

  return (
    <div className="my-2 flex justify-center">
      <div className="w-full max-w-4xl">
        <VideoGallery 
          youtubeVideos={message.youtubeResults}
          videos={message.videoResults}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
        />
      </div>
    </div>
  );
};

// Language display names mapping
const languageNames: Record<string, string> = {
  js: 'JavaScript',
  jsx: 'React JSX',
  ts: 'TypeScript',
  tsx: 'React TSX',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  cs: 'C#',
  go: 'Go',
  ruby: 'Ruby',
  rust: 'Rust',
  php: 'PHP',
  html: 'HTML',
  css: 'CSS',
  sass: 'SASS',
  scss: 'SCSS',
  less: 'LESS',
  json: 'JSON',
  yaml: 'YAML',
  xml: 'XML',
  markdown: 'Markdown',
  shell: 'Shell',
  bash: 'Bash',
  powershell: 'PowerShell',
  sql: 'SQL',
  graphql: 'GraphQL',
  plaintext: 'Plain Text',
  swift: 'Swift',
  kotlin: 'Kotlin',
  r: 'R',
  matlab: 'MATLAB',
  perl: 'Perl',
  lua: 'Lua',
  dart: 'Dart',
  elixir: 'Elixir',
  erlang: 'Erlang',
  haskell: 'Haskell',
  clojure: 'Clojure',
  c: 'C',
  csharp: 'C#',
  fsharp: 'F#',
  objectivec: 'Objective-C',
  scala: 'Scala',
  groovy: 'Groovy',
  coffeescript: 'CoffeeScript',
  dockerfile: 'Dockerfile',
  makefile: 'Makefile',
  ini: 'INI',
  toml: 'TOML',
  diff: 'Diff',
  http: 'HTTP',
};

// Theme options for syntax highlighting
const codeThemes = {
  a11yDark, 
  dracula,
  materialOceanic,
  nightOwl
};

// Default theme
const defaultTheme = 'nightOwl';

// Language-specific color accents
const languageAccents: Record<string, string> = {
  js: 'bg-yellow-700 border-yellow-600',
  jsx: 'bg-blue-700 border-blue-600',
  ts: 'bg-blue-800 border-blue-700',
  tsx: 'bg-blue-900 border-blue-800',
  python: 'bg-green-800 border-green-700',
  java: 'bg-orange-800 border-orange-700',
  html: 'bg-red-800 border-red-700',
  css: 'bg-pink-800 border-pink-700',
  json: 'bg-amber-800 border-amber-700',
  sql: 'bg-cyan-800 border-cyan-700',
  rust: 'bg-orange-900 border-orange-800',
  go: 'bg-cyan-900 border-cyan-800',
  ruby: 'bg-red-900 border-red-800',
  // Default fallback
  default: 'bg-gray-800 border-gray-700'
};

// Get language accent class
const getLanguageAccent = (language: string): string => {
  return languageAccents[language] || languageAccents.default;
};

// LaTeX processing function
const processLatexInText = (text: string): React.ReactNode[] => {
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/);
  return parts.map((part, index) => {
    if (part.startsWith('$$') && part.endsWith('$$')) {
      const formula = part.slice(2, -2);
      return <BlockMath key={index} math={formula} />;
    } else if (part.startsWith('$') && part.endsWith('$')) {
      const formula = part.slice(1, -1);
      return <InlineMath key={index} math={formula} />;
    }
    return part;
  });
};

// Function to determine if a code block should be collapsible based on line count
export const shouldMakeCodeBlockCollapsible = (code: string): boolean => {
  const lineCount = code.split('\n').length;
  return lineCount > 15; // Make collapsible if more than 15 lines
};

// Enhanced Code Block component
export const CodeBlock: React.FC<CodeBlockProps> = ({ 
  language, 
  code, 
  showLineNumbers = true, 
  title,
  collapsible = false
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(defaultTheme);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const displayLanguage = languageNames[language] || language;
  const languageAccentClass = getLanguageAccent(language);

  return (
    <div className="my-4 group rounded-lg overflow-hidden border border-gray-700 bg-zinc-800 shadow-lg transition-all duration-200 hover:shadow-xl">
      {/* Header with language badge, title and actions */}
      <div className={`flex items-center justify-between px-4 py-2 border-b border-gray-700`}>
        <div className="flex items-center space-x-2">
          <Code className="h-4 w-4 text-zinc-200" />
          <Badge variant="outline" className="text-xs bg-opacity-50 text-zinc-100 border-zinc-500">
            {displayLanguage}
          </Badge>
          {title && <span className="text-sm font-medium text-zinc-200 ml-2">{title}</span>}
        </div>
        <div className="flex items-center space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors duration-200"
                  onClick={handleCopy}
                  aria-label="Copy code to clipboard"
                >
                  {isCopied ? (
                    <span className="flex items-center">
                      <Check className="h-4 w-4 mr-1" />
                      <span className="text-xs">Copied</span>
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Clipboard className="h-4 w-4 mr-1" />
                      <span className="text-xs">Copy</span>
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isCopied ? 'Copied to clipboard' : 'Copy to clipboard'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {collapsible && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors duration-200"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    aria-label={isCollapsed ? "Expand code" : "Collapse code"}
                  >
                    {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isCollapsed ? 'Expand code block' : 'Collapse code block'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      
      {/* Code content area */}
      <div className={`transition-all duration-300 ease-in-out ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[2000px] opacity-100'}`}>
        <SyntaxHighlighter
          language={language}
          style={codeThemes[selectedTheme as keyof typeof codeThemes]}
          showLineNumbers={showLineNumbers}
          wrapLongLines={true}
          customStyle={{
            margin: 0,
            padding: '1rem',
            fontSize: '0.9rem',
            borderRadius: 0,
            backgroundColor: '#27272a', // Consistent dark background
          }}
          lineNumberStyle={{
            color: '#6b7280',
            paddingRight: '1em',
            borderRight: '1px solid #374151',
            marginRight: '1em',
            userSelect: 'none',
          }}
          codeTagProps={{
            style: {
              fontFamily: '"Fira Code", "JetBrains Mono", Menlo, Monaco, Consolas, monospace',
              letterSpacing: '-0.025em',
            }
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
      
      {/* Footer for collapsed view */}
      {isCollapsed && (
        <div className="px-4 py-2 text-sm text-zinc-400 italic border-t border-gray-700 bg-zinc-800">
          Code collapsed. Click to expand.
        </div>
      )}
    </div>
  );
};

// Format location content
export const formatLocationContent = (message: EnhancedMessage): string => {
  let content = message.webResponse || message.content;
  
  if (message.mapResults && message.mapResults.length > 0) {
    const locationDetails = message.mapResults.map(location => {
      const parts = [];
      parts.push(`- **${location.title}**`);
      
      if (location.rating) {
        parts.push(`  - Rating: ${location.rating}/5${location.reviews ? ` (${location.reviews} reviews)` : ''}`);
      }
      
      if (location.address) {
        parts.push(`  - Address: ${location.address}`);
      }
      
      if (location.website) {
        parts.push(`  - [Visit Website](${location.website})`);
      }
      
      const mapsUrl = location.mapsUrl || 
        `https://www.google.com/maps/search/${encodeURIComponent(location.title + ' ' + (location.address || ''))}`;
      parts.push(`  - [View on Google Maps](${mapsUrl})`);

      if (location.hours) {
        parts.push(`  - Hours: ${location.hours}`);
      }

      if (location.description) {
        parts.push(`  - ${location.description}`);
      }

      return parts.join('\n');
    }).join('\n\n');

    return content ? `${content}\n\n${locationDetails}` : locationDetails;
  }

  return content;
};

// AUTOMATIC COMPONENT INSERTION LOGIC - Updated for closer positioning
const calculateOptimalInsertionPositions = (params: {
  paragraphs: string[];
  message: EnhancedMessage;
  totalWords: number;
  hasHeaders: boolean;
}): { firstComponent: number; thirdComponent: number; secondComponent: number } => {
  const { paragraphs, message, totalWords, hasHeaders } = params;
  
  // Don't insert in very short content
  if (paragraphs.length < 3 || totalWords < 100) {
    return { firstComponent: -1, thirdComponent: -1, secondComponent: -1 };
  }
  
  let firstPosition = -1;
  let thirdPosition = -1; // Middle component
  let secondPosition = -1;
  
  // Calculate first component position (early in content)
  if (message.searchResults && message.searchResults.length > 0) {
    firstPosition = 1;
  } else if (message.imageResults && message.imageResults.length > 0) {
    firstPosition = Math.min(2, paragraphs.length - 2);
  } else if (totalWords > 500) {
    firstPosition = Math.floor(paragraphs.length * 0.2); // 20% through for long content (closer to start)
  } else if (paragraphs.length >= 4) {
    firstPosition = 1; // After first paragraph for medium content
  } else {
    firstPosition = Math.floor(paragraphs.length / 4); // Early position
  }
  
  // Calculate third component position (middle component) - closer to first
  if (paragraphs.length >= 5 && totalWords > 150) {
    if (totalWords > 500) {
      // For long content, place at 35% through (closer than before)
      thirdPosition = Math.floor(paragraphs.length * 0.35);
    } else if (paragraphs.length >= 6) {
      // For medium content, place earlier in the middle
      thirdPosition = Math.floor(paragraphs.length * 0.4);
    } else {
      // For shorter content, place at 35% through
      thirdPosition = Math.floor(paragraphs.length * 0.35);
    }
    
    // Ensure third component is close to first (minimum spacing reduced)
    if (firstPosition >= 0 && thirdPosition <= firstPosition) {
      thirdPosition = firstPosition + 1;
    }
  }
  
  // Calculate second component position (later in content) - closer to third
  if (paragraphs.length >= 6 && totalWords > 200) {
    if (totalWords > 500) {
      // For long content, insert at 50% through (closer than before)
      secondPosition = Math.floor(paragraphs.length * 0.5);
    } else if (paragraphs.length >= 7) {
      // For medium-long content, insert earlier
      secondPosition = Math.floor(paragraphs.length * 0.6);
    } else {
      // For medium content, insert at 55% through
      secondPosition = Math.floor(paragraphs.length * 0.55);
    }
    
    // Ensure second component is close to third (minimum spacing reduced)
    if (thirdPosition >= 0 && secondPosition <= thirdPosition) {
      secondPosition = thirdPosition + 1;
    }
    
    // If second position is too close to the end, adjust it closer to middle
    if (secondPosition >= paragraphs.length - 1) {
      secondPosition = Math.max(thirdPosition + 1, paragraphs.length - 2);
    }
  }
  
  // Final adjustment to ensure components are closer together
  if (firstPosition >= 0 && thirdPosition >= 0 && secondPosition >= 0) {
    // Ensure components are close but not overlapping
    if (thirdPosition <= firstPosition) {
      thirdPosition = firstPosition + 1;
    }
    if (secondPosition <= thirdPosition) {
      secondPosition = thirdPosition + 1;
    }
    
    // If spacing is too wide, compress them closer together
    const totalSpacing = secondPosition - firstPosition;
    if (totalSpacing > Math.floor(paragraphs.length * 0.4)) {
      // Compress the spacing
      const targetSpacing = Math.floor(paragraphs.length * 0.3);
      const compressionRatio = targetSpacing / totalSpacing;
      
      thirdPosition = Math.floor(firstPosition + (thirdPosition - firstPosition) * compressionRatio);
      secondPosition = Math.floor(firstPosition + (secondPosition - firstPosition) * compressionRatio);
      
      // Ensure minimum spacing of 1
      if (thirdPosition <= firstPosition) thirdPosition = firstPosition + 1;
      if (secondPosition <= thirdPosition) secondPosition = thirdPosition + 1;
    }
  }
  
  return { firstComponent: firstPosition, thirdComponent: thirdPosition, secondComponent: secondPosition };
};

// Enhanced MDX components
export const createMdxComponents = (handleLinkClick: (url: string, e: React.MouseEvent) => void) => {
  return {
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : 'plaintext';
      const code = String(children).trim();
      
      return !inline ? (
        <CodeBlock 
          language={language} 
          code={code} 
          showLineNumbers={true}
          collapsible={shouldMakeCodeBlockCollapsible(code)}
        />
      ) : (
        <code className="bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
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
          className="underline text-blue-500 transition-colors"
        >
          {children}
        </a>
      );
    },
    h1: (props: any) => (
      <h1 {...props} className="text-2xl font-bold pb-2" />
    ),
    h2: (props: any) => (
      <h2 {...props} className="text-xl font-bold pb-1" />
    ),
    h3: (props: any) => (
      <h3 {...props} className="text-lg font-bold mb-2" />
    ),
    p: (props: any) => {
      if (typeof props.children === 'string') {
        return (
          <p className="mb-4 leading-relaxed">
            {processLatexInText(props.children)}
          </p>
        );
      }
      return <p {...props} className="mb-4 leading-relaxed" />;
    },
    ul: (props: any) => (
      <ul {...props} className="list-disc pl-6 mb-4 space-y-1" />
    ),
    ol: (props: any) => (
      <ol {...props} className="list-decimal pl-6 mb-4 space-y-1" />
    ),
    li: (props: any) => (
      <li {...props} className="mb-1" />
    ),
    pre: (props: any) => (
      <pre {...props} className="bg-zinc-800 rounded-lg mb-4 overflow-x-auto" />
    ),
    table: (props: any) => (
      <div className="overflow-x-auto mb-4 rounded-lg border border-gray-700">
        <table {...props} className="min-w-full divide-y divide-gray-700" />
      </div>
    ),
    thead: (props: any) => (
      <thead {...props} className="bg-foreground/20" />
    ),
    th: (props: any) => (
      <th {...props} className="px-4 py-2 text-left font-semibold" />
    ),
    tr: (props: any) => (
      <tr {...props} className="border-b border-gray-700 transition-colors" />
    ),
    td: (props: any) => (
      <td {...props} className="px-4 py-2" />
    ),
    blockquote: (props: any) => (
      <blockquote {...props} className="pl-4 border-l-4 border-gray-600 text-zinc-500 italic my-4" />
    ),
    hr: (props: any) => (
      <hr {...props} className="my-6 border-gray-700" />
    ),
    strong: (props: any) => {
      // Check if the content has our special highlight marker
      const content = props.children?.toString() || '';
      
      // If it starts with "!" it's a highlight, otherwise regular bold
      if (content.startsWith('!') && content.endsWith('!')) {
        // It's a highlight - extract the actual text (remove the ! markers)
        const highlightText = content.substring(1, content.length - 1);
        return (
          <strong 
            className="font-bold px-1 py-0.5 bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200 rounded" 
          >
            {highlightText}
          </strong>
        );
      }
      
      // Regular bold text
      return (
        <strong className="font-bold" {...props} />
      );
    },
    em: (props: any) => (
      <em {...props} className="italic" />
    ),
    del: (props: any) => (
      <del {...props} className="line-through" />
    ),
  };
};

// Enhanced MarkdownContent with automatic component insertion
export const MarkdownContent: React.FC<{ 
  content: string; 
  message?: EnhancedMessage;
  sourcesViewMode?: 'compact' | 'full';
  onSourcesViewModeChange?: (mode: 'compact' | 'full') => void;
  imageViewMode?: 'compact' | 'full';
  onImageViewModeChange?: (mode: 'compact' | 'full') => void;
  videoViewMode?: 'compact' | 'full';
  onVideoViewModeChange?: (mode: 'compact' | 'full') => void;
}> = ({ 
  content, 
  message, 
  sourcesViewMode, 
  onSourcesViewModeChange, 
  imageViewMode = 'compact',
  onImageViewModeChange,
  videoViewMode = 'compact',
  onVideoViewModeChange
}) => {
  const { activeTabId, webviewRefs, updateTabState, activeTab } = useView();

  const handleLinkClick = (url: string, e: React.MouseEvent) => {
    e.preventDefault();
    
    // Process URL
    let processedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      processedUrl = `https://${url}`;
    }
    
    // Get the webview reference and load the URL
    const webview = webviewRefs.current.get(activeTabId);
    if (webview) {
      webview.loadURL(processedUrl)
        .then(() => {
          // Update tab state with new URL and navigation history
          updateTabState(activeTabId, {
            url: processedUrl,
            navigationHistory: [...activeTab.navigationHistory.slice(0, activeTab.historyIndex + 1), processedUrl],
            historyIndex: activeTab.historyIndex + 1
          });
        })
        .catch(error => {
          console.error('Failed to load URL:', error);
        });
    } else {
      console.error('No webview found for active tab');
    }
  };

  const mdxComponents = createMdxComponents(handleLinkClick);

  // AUTOMATIC COMPONENT INSERTION LOGIC
  if (message && message.role === 'assistant') {
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    const totalWords = content.split(/\s+/).length;
    const hasHeaders = /^#+\s/m.test(content);
    
    const { firstComponent, thirdComponent, secondComponent } = calculateOptimalInsertionPositions({
      paragraphs,
      message,
      totalWords,
      hasHeaders
    });
    
    // If we have insertion positions, render with components
    if (firstComponent >= 0 || thirdComponent >= 0 || secondComponent >= 0) {
      const renderSections: React.ReactNode[] = [];
      let currentIndex = 0;
      
      // Determine the order of insertions
      const insertions = [];
      if (firstComponent >= 0) insertions.push({ position: firstComponent, component: 'first' });
      if (thirdComponent >= 0) insertions.push({ position: thirdComponent, component: 'third' });
      if (secondComponent >= 0) insertions.push({ position: secondComponent, component: 'second' });
      
      // Sort insertions by position
      insertions.sort((a, b) => a.position - b.position);
      
      // Render content with components inserted at correct positions
      for (const insertion of insertions) {
        // Add content before this insertion
        if (currentIndex < insertion.position) {
          const sectionContent = paragraphs.slice(currentIndex, insertion.position).join('\n\n');
          if (sectionContent.trim()) {
            renderSections.push(
              <MDXProvider key={`content-${currentIndex}`} components={mdxComponents}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={mdxComponents}
                >
                  {sectionContent}
                </ReactMarkdown>
              </MDXProvider>
            );
          }
        }
        
        // Add the component
        if (insertion.component === 'first') {
          renderSections.push(
            <SearchResultsComponent 
              key={`search-results-${insertion.position}`} 
              message={message}
              sourcesViewMode={sourcesViewMode}
              onSourcesViewModeChange={onSourcesViewModeChange}
            />
          );
        } else if (insertion.component === 'third') {
          // Use the controlled ImageGalleryComponent
          renderSections.push(
            <ImageGalleryComponent 
              key={`image-gallery-${insertion.position}`} 
              message={message}
              viewMode={imageViewMode}
              onViewModeChange={onImageViewModeChange || (() => {})}
            />
          );
        } else if (insertion.component === 'second') {
          // FIXED: Use controlled VideoGalleryComponent
          renderSections.push(
            <VideoGalleryComponent 
              key={`video-gallery-${insertion.position}`} 
              message={message}
              viewMode={videoViewMode}
              onViewModeChange={onVideoViewModeChange || (() => {})}
            />
          );
        }
        
        currentIndex = insertion.position;
      }
      
      // Add remaining content after last insertion
      if (currentIndex < paragraphs.length) {
        const remainingContent = paragraphs.slice(currentIndex).join('\n\n');
        if (remainingContent.trim()) {
          renderSections.push(
            <MDXProvider key={`content-final`} components={mdxComponents}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={mdxComponents}
              >
                {remainingContent}
              </ReactMarkdown>
            </MDXProvider>
          );
        }
      }
      
      return <>{renderSections}</>;
    }
  }

  // Fallback: render without component insertion
  return (
    <>
      <MDXProvider components={mdxComponents}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={mdxComponents}
        >
          {content}
        </ReactMarkdown>
      </MDXProvider>
    </>
  );
};

// Message Formatter - Main function for formatting messages
export const MessageFormatter: React.FC<MessageFormatterProps> = ({ 
  message, 
  messageIndex,
  sourcesViewMode = 'compact',
  onSourcesViewModeChange,
  onImageFullViewChange,
  onVideoFullViewChange,
  imageViewMode: controlledImageViewMode,
  videoViewMode: controlledVideoViewMode // FIXED: Accept controlled video view mode
}) => {
  // Use controlled imageViewMode if provided, otherwise use internal state
  const [internalImageViewMode, setInternalImageViewMode] = useState<'compact' | 'full'>('compact');
  
  // Determine the actual view modes to use
  const imageViewMode = controlledImageViewMode ?? internalImageViewMode;
  const isImageViewControlled = controlledImageViewMode !== undefined;
  
  // FIXED: Use controlled video view mode like images
  const videoViewMode = controlledVideoViewMode ?? 'compact';

  // Handle image view mode changes with proper state synchronization
  const handleImageViewModeChange = useCallback((mode: 'compact' | 'full') => {
    // Update internal state only if not controlled
    if (!isImageViewControlled) {
      setInternalImageViewMode(mode);
    }
    
    // Always notify parent component about the change
    onImageFullViewChange?.(mode === 'full');
  }, [onImageFullViewChange, isImageViewControlled]);

  // FIXED: Simplified video handler - just notify parent like images
  const handleVideoViewModeChange = useCallback((mode: 'compact' | 'full') => {
    onVideoFullViewChange?.(mode === 'full');
  }, [onVideoFullViewChange]);

  // If images are in full view, show ONLY the image gallery
  if (imageViewMode === 'full') {
    return (
      <div data-message-index={messageIndex} className="message-content">
        <ImageGalleryComponent 
          message={message}
          viewMode={imageViewMode}
          onViewModeChange={handleImageViewModeChange}
        />
      </div>
    );
  }

  // FIXED: If videos are in full view, show ONLY the video gallery
  if (videoViewMode === 'full') {
    return (
      <div data-message-index={messageIndex} className="message-content">
        <VideoGalleryComponent 
          message={message}
          viewMode={videoViewMode}
          onViewModeChange={handleVideoViewModeChange}
        />
      </div>
    );
  }

  // If search results are in full view mode, ONLY show search results
  if (sourcesViewMode === 'full') {
    return (
      <div data-message-index={messageIndex} className="message-content">
        <SearchResultsComponent 
          message={message}
          sourcesViewMode={sourcesViewMode}
          onSourcesViewModeChange={onSourcesViewModeChange}
        />
      </div>
    );
  }

  // Normal compact view - show all content
  const isLocationMessage = message.mapResults && message.mapResults.length > 0;
  const formattedContent = isLocationMessage ? formatLocationContent(message) : (message.webResponse || message.content);
  
  return (
    <div data-message-index={messageIndex} className="message-content">
      <MarkdownContent 
        content={formattedContent} 
        message={message} 
        sourcesViewMode={sourcesViewMode}
        onSourcesViewModeChange={onSourcesViewModeChange}
        imageViewMode={imageViewMode}
        onImageViewModeChange={handleImageViewModeChange}
        videoViewMode={videoViewMode}
        onVideoViewModeChange={handleVideoViewModeChange}
      />
    </div>
  );
};

export default MessageFormatter;