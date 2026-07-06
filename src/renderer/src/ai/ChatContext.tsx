/**
 * Per-tab AI chat state and LangChain orchestration.
 *
 * Each browser tab has isolated messages, loading state, and cancel tokens.
 * handleSubmit() routes queries to SerpAPI (web, images, maps, products, YouTube)
 * then streams an Anthropic response with structured context attached.
 */
import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ChatAnthropic } from '@langchain/anthropic';
import { RunnableSequence, RunnablePassthrough } from '@langchain/core/runnables';
import { AIMessage, HumanMessage, MessageContent, MessageContentText } from '@langchain/core/messages';
import { useElectronSearch } from './hook';
import { useLocation } from './Location/useLocation';
import { LocationParams, MapResult, Tab, YouTubeResult } from '../types/types';
import { ProductAnalyzer, ProductQueryAnalysis } from './Products/ProductAnalyzer';
import { ImageAnalysisResult, ImageAnalyzer } from './ImageSearch/ImageAnalyzer';

interface FollowupMessage {
  structuredData: any;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  webResponse?: string;
  mapResults?: {
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
  }[];
}

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
    attachedUrls?: Array<{ // NEW: Add attached URLs
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

// New interface to track per-tab state
interface TabChatState {
  messages: EnhancedMessage[];
  input: string;
  isLoading: boolean;
  error: string | null;
  followupMessages: FollowupMessage[];
  followupIsLoading: boolean;
}

// Overall chat state interface
interface ChatState {
  tabStates: Record<string, TabChatState>;
  isSearching: boolean;
  tabs: Tab[];
}

interface ChatContextType extends ChatState {
  handleSubmit: (tabId: string, e: React.FormEvent, overrideInput?: string) => Promise<void>;
  handleInputChange: (tabId: string, e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (tabId: string, e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  getMessageString: (content: MessageContent) => string;
  analyzeQuery: (query: string) => Promise<LocationQueryAnalysis>;
  extractCodeBlocks: (content: string) => CodeBlock[];
  formatSearchResults: (webData: any, imageData: any, videoData: any, youtubeData: any) => string;
  webSearchChain: RunnableSequence;
  imageSearchChain: RunnableSequence;
  videoSearchChain: RunnableSequence;
  youtubeSearchChain: RunnableSequence;
  claudeModel: ChatAnthropic;
  productAnalyzer: ProductAnalyzer;
  generateWebsiteTitle: (url: string) => Promise<string>;
  generateQueryTitle: (query: string) => Promise<string>;
  handleEditTitle: (tabId: string, newTitle: string) => void;
  isManuallySet: (tabId: string) => boolean;
  handleStopGeneration: (tabId: string) => void;
  imageAnalyzer: ImageAnalyzer;
  addFollowupMessage: (tabId: string, message: FollowupMessage) => void;
  getFollowupMessages: (tabId: string) => FollowupMessage[];
  clearFollowupMessages: (tabId: string) => void;
  setFollowupLoading: (tabId: string, loading: boolean) => void;
  getFollowupLoading: (tabId: string) => boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tabStates, setTabStates] = useState<Record<string, TabChatState>>({});
  const { searchWeb, searchImages, searchVideos, isSearching } = useElectronSearch();
  const { locationData } = useLocation();
  const manuallySetTitles = useRef(new Set<string>());
  const [tabs, setTabs] = useState<Tab[]>([]);

  const claudeModel = new ChatAnthropic({
    anthropicApiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
    modelName: 'claude-sonnet-4-20250514',
    temperature: 0.7,
  });

  useEffect(() => {
    const handleTabsUpdate = (event: CustomEvent<Tab[]>) => {
      setTabs(event.detail);
    };

    window.addEventListener('tabsUpdate', handleTabsUpdate as EventListener);
    return () => {
      window.removeEventListener('tabsUpdate', handleTabsUpdate as EventListener);
    };
  }, []);

  const canceledRequestsRef = useRef(new Set<string>());

  const handleStopGeneration = (tabId: string) => {
    // Mark this tab's request as canceled
    canceledRequestsRef.current.add(tabId);
    
    // Update UI state
    setTabStates(prev => ({
      ...prev,
      [tabId]: {
        ...prev[tabId],
        isLoading: false,
        error: null
      }
    }));

    window.dispatchEvent(new CustomEvent('stopGeneration'));
  };

  const productAnalyzer = new ProductAnalyzer(claudeModel);

  const imageAnalyzer = new ImageAnalyzer(claudeModel);

  useEffect(() => {
    tabs.forEach(tab => {
      // Initialize tab state if needed
      ensureTabState(tab.id);
    });
  }, [tabs]);

  const webSearchChain = RunnableSequence.from([
    new RunnablePassthrough(),
    async (input: string) => {
      try {
        const results = await searchWeb(input);
        const formattedResults = results.map((result: any) => 
          `[${result.title}](${result.link})\n${result.snippet}\n\n`
        ).join('');
        return { searchResults: formattedResults, query: input, type: 'web' };
      } catch (error) {
        console.error('Web search error:', error);
        return { searchResults: 'No search results found.', query: input, type: 'web' };
      }
    },
  ]);

  const imageSearchChain = RunnableSequence.from([
    new RunnablePassthrough(),
    async (input: string) => {
      try {
        const results = await searchImages(input);
        return { imageResults: results, query: input, type: 'images' };
      } catch (error) {
        console.error('Image search error:', error);
        return { imageResults: [], query: input, type: 'images' };
      }
    },
  ]);

  const videoSearchChain = RunnableSequence.from([
    new RunnablePassthrough(),
    async (input: string) => {
      try {
        const results = await searchVideos(input);
        return { videoResults: results, query: input, type: 'videos' };
      } catch (error) {
        console.error('Video search error:', error);
        return { videoResults: [], query: input, type: 'videos' };
      }
    },
  ]);

  const youtubeSearchChain = RunnableSequence.from([
    new RunnablePassthrough(),
    async (input: string) => {
      try {
        // Ensure locationParams are properly structured
        const locationParams = {
          location: locationData?.country,
        };
  
        const results = await window.electronAPI.ipcRenderer.invoke('search-youtube', input, locationParams);
        
        // Validate and process results
        if (!results?.youtube_results) {
          console.warn('Invalid YouTube results structure:', results);
          return { youtubeResults: [], query: input, type: 'youtube' };
        }
  
        return { 
          youtubeResults: results.youtube_results, 
          query: input, 
          type: 'youtube' 
        };
      } catch (error) {
        console.error('YouTube search chain error:', error);
        return { youtubeResults: [], query: input, type: 'youtube' };
      }
    },
  ]);

  const ensureTabState = (tabId: string) => {
    setTabStates(prev => {
      if (!prev[tabId]) {
        return {
          ...prev,
          [tabId]: {
            messages: [],
            input: '',
            isLoading: false,
            error: null,
            followupMessages: [],
            followupIsLoading: false
          }
        };
      }
      return prev;
    });
  };

  const addFollowupMessage = useCallback((tabId: string, message: FollowupMessage) => {
  ensureTabState(tabId);
  setTabStates(prev => ({
    ...prev,
    [tabId]: {
      ...prev[tabId],
      followupMessages: [...(prev[tabId]?.followupMessages || []), message]
    }
  }));
}, []);

const getFollowupMessages = useCallback((tabId: string): FollowupMessage[] => {
  return tabStates[tabId]?.followupMessages || [];
}, [tabStates]);

const clearFollowupMessages = useCallback((tabId: string) => {
  setTabStates(prev => ({
    ...prev,
    [tabId]: {
      ...prev[tabId],
      followupMessages: []
    }
  }));
}, []);

  // Utility functions
  const getMessageString = (content: MessageContent): string => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map(item => {
          if (typeof item === 'string') return item;
          if ('type' in item && item.type === 'text') {
            return (item as MessageContentText).text;
          }
          return '';
        })
        .join('');
    }
    if (content && typeof content === 'object' && 'type' in content && (content as MessageContentText).type === 'text') {
      return (content as MessageContentText).text;
    }
    return '';
  };

  const generateWebsiteTitle = async (url: string): Promise<string> => {
    try {
      const prompt = `Generate a concise, natural title for this website URL: ${url}
      Rules:
      1. Extract the main brand/website name
      2. Keep it under 30 characters
      3. Remove unnecessary words like "Home", "Official Site", etc.
      4. Don't include URL components like .com, www, etc.
      5. For social media profiles, use format: "[Platform]: [Username]"
      
      Return only the title text with no quotes or formatting.`;
  
      const response = await claudeModel.invoke(prompt);
      const title = getMessageString(response.content).trim();
      return title || new URL(url).hostname; // Fallback to hostname if AI fails
    } catch (error) {
      console.error('Failed to generate website title:', error);
      return new URL(url).hostname; // Fallback to hostname
    }
  };

  const generateQueryTitle = async (query: string): Promise<string> => {
    try {
      const prompt = `Generate a concise, descriptive title for this chat query: "${query}"
      Rules:
      1. Capture the main topic/intent
      2. Keep it under 30 characters
      3. Make it natural and readable
      4. Remove unnecessary words
      5. For questions, convert to topic format (e.g. "How to bake bread?" → "Bread Baking Guide")
      
      Return only the title text with no quotes or formatting.`;
  
      const response = await claudeModel.invoke(prompt);
      return getMessageString(response.content).trim() || query.slice(0, 30); // Fallback to truncated query
    } catch (error) {
      console.error('Failed to generate query title:', error);
      return query.slice(0, 30); // Fallback to truncated query
    }
  };

const analyzeQuery = async (query: string): Promise<LocationQueryAnalysis> => {
  const locationAnalysisPrompt = `You must respond with ONLY valid JSON, no other text before or after.

Analyze if this query is location-based: "${query}"

Return this exact JSON structure:
{
  "isLocationBased": boolean,
  "locationType": "specific-place" | "near-me" | "place-type" | "none",
  "locationConfidence": number between 0 and 1,
  "locationReasoning": "Brief explanation of the location analysis",
  "place": "specific place mentioned (if any)",
  "searchRadius": "search radius for near-me queries (if applicable)",
  "placeType": "type of place being searched for (if applicable)"
}`;

  try {
    console.log('📍 LocationAnalyzer: Analyzing query:', query);
    const response = await claudeModel.invoke(locationAnalysisPrompt);
    const responseText = getMessageString(response.content);
    console.log('🤖 LocationAnalyzer: Raw response:', responseText);
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const analysis: LocationQueryAnalysis = JSON.parse(jsonMatch[0]);
    console.log('✅ LocationAnalyzer: Analysis successful:', analysis);
    return analysis;
  } catch (error) {
    console.error('❌ LocationAnalyzer: Analysis failed:', error);
    return {
      isLocationBased: false,
      locationType: 'none',
      locationConfidence: 0,
      locationReasoning: 'Analysis failed'
    };
  }
};

  const extractCodeBlocks = (content: string): CodeBlock[] => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const codeBlocks: CodeBlock[] = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeBlocks.push({
        language: match[1] || 'plaintext',
        code: match[2].trim(),
      });
    }

    return codeBlocks;
  };

  const formatSearchResults = (webData: any, imageData: any, videoData: any, youtubeData: any): string => {
    const imageList = imageData.imageResults
      .map((img: any) => `- ${img.title}: ${img.url}`)
      .join('\n');

    const videoList = videoData.videoResults
      .map((video: any) => `- ${video.title} (${video.duration}): ${video.link}`)
      .join('\n');

    const youtubeList = youtubeData.youtubeResults
      .map((video: any) => `- ${video.title} (${video.duration || 'N/A'}): ${video.link}`)
      .join('\n');

    return `
      Web Search Results:
      ${webData.searchResults}

      Image Search Results:
      ${imageList}

      Video Search Results:
      ${videoList}

      YouTube Results:
      ${youtubeList}
    `.trim();
  };

  const getLocationParams = (): LocationParams | Record<string, never> => {
    if (!locationData) return {};
    
    return {
      location: `${locationData.district},${locationData.region},${locationData.country}`,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      gl: locationData.country?.toLowerCase(),
      hl: navigator.language,
    };
  };

  const enhanceResponseFormatting = (content: string): string => {
    // Don't modify if content already has headers
    if (/^#\s.+/m.test(content)) {
      return content;
    }
    
    // Extract potential title from first sentence
    const firstLine = content.split('\n')[0].trim();
    const firstSentence = firstLine.split('.')[0].trim();
    
    // Only use as title if it's reasonably short
    let enhancedContent = content;
    if (firstSentence.length > 0 && firstSentence.length < 60) {
      // Remove the first sentence and add it as a title
      enhancedContent = content.replace(firstSentence, '');
      enhancedContent = `# ${firstSentence}\n\n${enhancedContent.trim()}`;
    } else {
      // Add a generic title
      enhancedContent = `# Response\n\n${content}`;
    }
    
    return enhancedContent;
  }

  const createUrlSystemMessage = (attachedUrls: any[]): string => {
  const loadedUrls = attachedUrls.filter(url => url.status === 'loaded' && url.content);
  
  if (loadedUrls.length === 0) return '';
  
  if (loadedUrls.length === 1) {
    const singleUrl = loadedUrls[0];
    return createSingleUrlSystemMessage(singleUrl.content!, singleUrl.url);
  }
  
  // Multiple URLs - create comprehensive system message
  let systemMessage = `You are an AI assistant helping with multiple sources of content. The user has attached ${loadedUrls.length} different sources and can ask questions about any or all of them. Here are the sources:\n\n`;
  
  loadedUrls.forEach((attachedUrl: any, index: number) => {
    const content = attachedUrl.content!;
    systemMessage += `=== SOURCE ${index + 1}: ${content.title} ===\n`;
    systemMessage += `URL: ${attachedUrl.url}\n`;
    systemMessage += `Type: ${content.type === 'youtube' ? 'YouTube Video' : 'Web Page'}\n\n`;
    
    if (content.type === 'youtube' && content.youtubeData) {
      systemMessage += `VIDEO TRANSCRIPT:\n${content.youtubeData.transcript}\n\n`;
    } else if (content.type === 'web' && content.data) {
      const contentChunks = content.data.chunks
        .filter((chunk: any) => chunk.text.trim().length > 20)
        .map((chunk: any) => chunk.text.trim())
        .slice(0, 10); // Limit to prevent token overflow
      
      systemMessage += `PAGE CONTENT:\n${contentChunks.join('\n\n')}\n\n`;
      
      if (content.data.links && content.data.links.length > 0) {
        const links = content.data.links
          .filter((link: any) => link.text?.trim() || link.href?.trim())
          .slice(0, 8)
          .map((link: any) => `- ${link.text?.trim() || 'Link'}: ${link.href}`)
          .join('\n');
        systemMessage += `LINKS ON PAGE:\n${links}\n\n`;
      }
    }
    
    systemMessage += `--- END OF SOURCE ${index + 1} ---\n\n`;
  });
  
  systemMessage += `When responding:
1. You can reference and compare information across all ${loadedUrls.length} sources
2. If asked about specific content, identify which source(s) it comes from
3. If asked to compare or contrast, use information from multiple relevant sources
4. If information isn't available in any of the provided sources, let the user know
5. Be helpful and conversational while clearly indicating which source you're referencing when relevant
6. Feel free to synthesize information across sources when appropriate`;
  
  return systemMessage;
};

// Create system message from single URL content
const createSingleUrlSystemMessage = (activeContent: any, activeUrl: string): string => {
  if (!activeContent) return '';
  
  if (activeContent.type === 'youtube' && activeContent.youtubeData) {
    const { transcript, videoTitle } = activeContent.youtubeData;
    
    return `You are an AI assistant helping with a YouTube video: ${videoTitle} (${activeUrl})

The user is asking about this video content. Use the following transcript from the video to inform your responses:

TRANSCRIPT:
${transcript}

When responding:
1. Directly reference specific information from the transcript when relevant
2. If the user asks about something not covered in the provided transcript, you can say you don't see that information in the transcript
3. Offer insights about the video content when appropriate
4. Be helpful and conversational`;
  }
  
  if (activeContent.type === 'web' && activeContent.data) {
    const scrapedContent = activeContent.data;
    
    // Process page content to extract meaningful text
    const contentChunks = scrapedContent.chunks
      .filter((chunk: any) => chunk.text.trim().length > 20)
      .map((chunk: any) => chunk.text.trim());
    
    const contentText = contentChunks.join('\n\n');
    
    // Process links - get up to 15 meaningful links
    const links = scrapedContent.links
      .filter((link: any) => link.text?.trim() || link.href?.trim())
      .slice(0, 15)
      .map((link: any) => `- ${link.text?.trim() || 'Link'}: ${link.href}`)
      .join('\n');
    
    return `You are an AI assistant helping with the webpage: ${scrapedContent.title} (${scrapedContent.url})

The user is asking about this webpage content. Use the following information from the page to inform your responses.

PAGE CONTENT:
${contentText}

LINKS ON PAGE:
${links}

When responding:
1. Directly reference specific information from the page when relevant
2. If the user asks about something not covered in the provided content, you can say you don't see that information on the provided page
3. Offer insights about the page content when appropriate
4. Be helpful and conversational`;
  }
  
  return '';
};

// In ChatContext.tsx, replace the handleSubmit function with this fixed version:

const handleSubmit = async (tabId: string, e: React.FormEvent, overrideInput?: string) => {
  e.preventDefault();
  ensureTabState(tabId);

  console.log("🎯 ChatContext.handleSubmit called");
  console.log("📥 tabId:", tabId);
  console.log("📥 overrideInput provided:", !!overrideInput);
  console.log("📥 overrideInput length:", overrideInput?.length || 0);
  
  if (overrideInput) {
    console.log("📥 overrideInput preview:", overrideInput.substring(0, 500) + '...');
    
    // Check if it contains file content
    const hasFileContent = overrideInput.includes('UPLOADED FILE') || overrideInput.includes('FILE:');
    const hasPastedContent = overrideInput.includes('PASTED CONTENT');
    console.log("📁 Contains file content:", hasFileContent);
    console.log("📋 Contains pasted content:", hasPastedContent);
    
    // Count file references
    const fileMatches = overrideInput.match(/UPLOADED FILE \d+:/g);
    const fileCount = fileMatches ? fileMatches.length : 0;
    console.log("📁 Number of files detected in content:", fileCount);
  }

  canceledRequestsRef.current.delete(tabId);  
  const currentState = tabStates[tabId] || {
    messages: [],
    input: '',
    isLoading: false,
    error: null,
    followupMessages: []
  };

  // Use overrideInput (compiled content) if provided, otherwise use current input
  const messageText = overrideInput || currentState.input;
  console.log("💬 Final messageText being used:");
  console.log("💬 Length:", messageText.length);
  console.log("💬 Source:", overrideInput ? "overrideInput (compiled)" : "currentState.input");
  console.log("💬 Preview:", messageText.substring(0, 500) + '...');

  const images = uploadedImagesRef.current.get(tabId);

  const structuredData = (window as any).pendingStructuredData;
  console.log("🗂️ ChatContext picked up structured data:", structuredData);

  if ((!messageText.trim() && (!images || images.length === 0)) || currentState.isLoading) {
    console.log("❌ No content or already loading, aborting");
    return;
  }

  setTabStates(prev => ({
    ...prev,
    [tabId]: {
      ...prev[tabId],
      error: null,
      isLoading: true,
      messages: [
        { 
          role: 'user', 
          content: messageText, // This is the compiled content for AI (includes file content)
          structuredData: structuredData, // For display purposes (shows clean user input + components)
          codeBlocks: extractCodeBlocks(messageText),
          imageData: images && images.length > 0 ? {
            displayType: 'image-analysis',
            searchQuery: '',
            analysis: {
              isImageQuery: true,
              userAnalysis: '',
              searchQuery: '',
              confidence: 0,
              reasoning: '',
            },
            imageData: images[0].src,
            imageName: images[0].name,
            allImages: images.map(img => ({ src: img.src, name: img.name }))
          } : undefined
        }
      ],
      input: ''
    }
  }));

  // Clear the structured data after using it
  (window as any).pendingStructuredData = null;

  try {
    console.log("📚 Conversation history length:", history.length);

    let imageAnalysisResult;
    let finalQueryForSearch = messageText; // Start with the original message

    // 🔥 CRITICAL FIX: Analyze images FIRST and get the search query
    if (images && images.length > 0) {
      console.log("🖼️ Analyzing images...");
      imageAnalysisResult = await imageAnalyzer.analyzeQuery(messageText, images);
      
      // 🔥 KEY FIX: Use the image analysis search query for ALL searches if available
      if (imageAnalysisResult?.isImageQuery && imageAnalysisResult.searchQuery) {
        finalQueryForSearch = imageAnalysisResult.searchQuery.trim();
        console.log('🔍 Using image-generated query for ALL searches:', finalQueryForSearch);
      } else {
        console.log('🔍 Using original message for searches (no image search query generated)');
      }
    }

    // 🔥 IMPORTANT: Now use finalQueryForSearch for ALL analyses and searches
    const analysis = await analyzeQuery(finalQueryForSearch);
    const productAnalysis = await productAnalyzer.analyzeQuery(finalQueryForSearch);

    const [ 
      webSearchData, 
      imageSearchData, 
      videoSearchData,
      youtubeSearchData 
    ] = await Promise.all([
      webSearchChain.invoke(finalQueryForSearch),
      imageSearchChain.invoke(finalQueryForSearch),
      videoSearchChain.invoke(finalQueryForSearch),
      youtubeSearchChain.invoke(finalQueryForSearch)
    ]);

    let imageData;
    if (imageAnalysisResult?.isImageQuery) {
      const displayConfig = imageAnalyzer.getDisplayConfig(imageAnalysisResult);
      if (displayConfig) {
        imageData = {
          displayType: 'image-analysis' as const,
          searchQuery: displayConfig.searchQuery || "",
          analysis: imageAnalysisResult,
          imageResults: imageSearchData.imageResults, // Use the search results from finalQueryForSearch
          imageData: displayConfig.imageData || "",
          imageName: displayConfig.imageName || ""
        };
      }
    }

    let mapSearchData;
    if (analysis.isLocationBased) {
      console.log("📍 Running location search...");
      mapSearchData = await window.electronAPI.ipcRenderer.invoke(
        'search-maps', 
        finalQueryForSearch, // 🔥 Use the same query here
        getLocationParams()
      );
    }

    let productData;
    if (productAnalysis.isProductQuery) {
      const displayConfig = productAnalyzer.getDisplayConfig(productAnalysis);
      if (displayConfig) {
        const shoppingResults = await window.electronAPI.ipcRenderer.invoke(
          'search-shopping',
          displayConfig.searchQuery,
          getLocationParams()
        );
        
        productData = {
          ...displayConfig,
          products: shoppingResults.shopping_results
        };
      }
    }

    let urlSystemMessage = '';
    if (structuredData?.attachedUrls && structuredData.attachedUrls.length > 0) {
      urlSystemMessage = createUrlSystemMessage(structuredData.attachedUrls);
      console.log("🔗 Created URL system message, length:", urlSystemMessage.length);
    }

    const searchContext = formatSearchResults(webSearchData, imageSearchData, videoSearchData, youtubeSearchData);

    let locationContext = '';
    if (mapSearchData?.local_results?.length > 0) {
      locationContext = `
Location Search Results:
${mapSearchData.local_results.map((place: MapResult) => `
- ${place.title}
  ${place.rating ? `Rating: ${place.rating}/5 (${place.reviews} reviews)` : ''}
  ${place.address ? `Address: ${place.address}` : ''}
  ${place.website ? `Website: ${place.website}` : ''}
  ${place.description ? `Description: ${place.description}` : ''}
  Maps: ${place.mapsUrl}
`).join('\n')}
`;
    }

    // 🔥 CRITICAL FIX: Include image analysis in the Claude prompt
    let imageAnalysisContext = '';
    if (imageAnalysisResult?.isImageQuery && imageAnalysisResult.userAnalysis) {
      imageAnalysisContext = `

IMAGE ANALYSIS CONTEXT:
The user has uploaded ${images?.length || 1} image(s). Here is the analysis of the image(s):

${imageAnalysisResult.userAnalysis}

Generated search query from image(s): ${imageAnalysisResult.searchQuery}

Please incorporate this image analysis into your response and use it to provide more contextually relevant information.
`;
      console.log("🖼️ Added image analysis context to Claude prompt");
    }

    const enhancedPrompt = `
      ${urlSystemMessage ? `\n\nURL CONTENT CONTEXT:\n${urlSystemMessage}\n` : ''}
      ${imageAnalysisContext}

      Query: ${messageText}

      ${locationContext || ''}
      ${searchContext}
      
      Please provide a well-structured response with rich formatting:
      - Use # for main title and ## for section headings
      - Organize information in bullet points or numbered lists when listing items
      - Use tables for comparing data or options
      - Format code with proper language-specific code blocks
      - Use **regular bold text** for normal emphasis
      - Use **!highlighted important text!** strategically throughout your response to:
        * Highlight key conclusions and main takeaways
        * Emphasize critical definitions and concepts
        * Call attention to important steps in procedures or tutorials
        * Highlight surprising or counterintuitive information
        * Create a "skimmable layer" - if someone only read the highlighted parts, they should understand the essential points
      - Aim to highlight at least 30-40 words across your response, distributed among 4-6 key points
      - Don't highlight entire paragraphs - focus on specific phrases and sentences that contain the most essential information
      - Use *italics* for subtle emphasis
      - Include mathematical expressions in LaTeX format when applicable
    
      Focus on the most relevant information to answer the query.
      ${analysis.isLocationBased ? 'Prioritize presenting the location information first.' : ''}
      ${imageAnalysisResult?.isImageQuery ? 'When relevant, reference the uploaded image(s) and incorporate the image analysis findings into your response.' : ''}`;
      
    const webResponse = await claudeModel.invoke([
      new HumanMessage(enhancedPrompt)  // Only send current message, no history
    ]);
    const webResponseString = getMessageString(webResponse.content);
    const enhancedResponseString = enhanceResponseFormatting(webResponseString);

    console.log("✅ Got response from Claude, length:", webResponseString.length);

    const assistantMessage: EnhancedMessage = {
      role: 'assistant',
      content: enhancedResponseString,
      isLocationBased: analysis.isLocationBased,
      codeBlocks: extractCodeBlocks(webResponseString),
      webResponse: webResponseString,
      searchResults: webSearchData.searchResults,
      imageResults: imageSearchData.imageResults,
      videoResults: videoSearchData.videoResults,
      youtubeResults: youtubeSearchData.youtubeResults,
      mapResults: mapSearchData?.local_results,
      productData,
      imageData 
    };

    if (canceledRequestsRef.current.has(tabId)) {
      console.log('❌ Request was canceled, ignoring results');
      return; 
    }

    setTabStates(prev => ({
      ...prev,
      [tabId]: {
        ...prev[tabId],
        isLoading: false,
        messages: prev[tabId].messages.length > 0 ? 
        [prev[tabId].messages[0], assistantMessage] : 
        [assistantMessage]          
      }
    }));

    console.log("✅ ChatContext handleSubmit completed successfully");

  } catch (error) {
    console.error('❌ Error in ChatContext handleSubmit:', error);
    setTabStates(prev => ({
      ...prev,
      [tabId]: {
        ...prev[tabId],
        isLoading: false,
        error: 'Failed to get response. Please try again.'
      }
    }));
  }
};

  const setFollowupLoading = useCallback((tabId: string, loading: boolean) => {
  setTabStates(prev => ({
    ...prev,
    [tabId]: {
      ...prev[tabId],
      followupIsLoading: loading
    }
  }));
}, []);

const getFollowupLoading = useCallback((tabId: string): boolean => {
  return tabStates[tabId]?.followupIsLoading || false;
}, [tabStates]);

  const uploadedImagesRef = useRef(new Map<string, Array<{src: string, name: string}>>());

  useEffect(() => {
    const handleImageSubmission = async (event: CustomEvent) => {
      const { tabId, images, content } = event.detail;
      
      // Call the regular handleSubmit with the content
      uploadedImagesRef.current.set(tabId, images);
      await handleSubmit(tabId, { preventDefault: () => {} } as React.FormEvent, content);
      uploadedImagesRef.current.delete(tabId);
    };
  
    window.addEventListener('submitImagesWithMessage', handleImageSubmission as unknown as EventListener);
    
    return () => {
      window.removeEventListener('submitImagesWithMessage', handleImageSubmission as unknown as EventListener);
    };
  }, [handleSubmit]);

  const handleEditTitle = (tabId: string, newTitle: string) => {
    if (newTitle.trim()) {
      manuallySetTitles.current.add(tabId);
      // Update the title
      window.dispatchEvent(new CustomEvent('updateTabTitle', {
        detail: {
          tabId,
          title: newTitle.trim()
        }
      }));
    }
  };

  useEffect(() => {
    const currentTabIds = new Set(tabs.map(tab => tab.id));
    
    // Remove closed tabs from tab states
    setTabStates(prev => {
      const updated = { ...prev };
      for (const tabId in updated) {
        if (!currentTabIds.has(tabId)) {
          delete updated[tabId];
        }
      }
      return updated;
    });
    
    // Remove from canceledRequestsRef
    for (const canceledTabId of canceledRequestsRef.current) {
      if (!currentTabIds.has(canceledTabId)) {
        canceledRequestsRef.current.delete(canceledTabId);
      }
    }
    
    // Dispatch an event to clean up chat view state in CommandContext
    currentTabIds.forEach(tabId => {
      if (!currentTabIds.has(tabId)) {
        // Using custom event to notify other components
        window.dispatchEvent(new CustomEvent('tabClosed', { 
          detail: { tabId } 
        }));
      }
    });
    
  }, [tabs]);

  useEffect(() => {
    const currentTabIds = new Set(tabs.map(tab => tab.id));
    
    // Remove closed tabs from manually set titles
    for (const manualId of manuallySetTitles.current) {
      if (!currentTabIds.has(manualId)) {
        manuallySetTitles.current.delete(manualId);
      }
    }
  }, [tabs]);

  const handleInputChange = (tabId: string, e: React.ChangeEvent<HTMLTextAreaElement>) => {
    ensureTabState(tabId);
    setTabStates(prev => ({
      ...prev,
      [tabId]: {
        ...prev[tabId],
        input: e.target.value
      }
    }));
  };

  const handleKeyDown = (tabId: string, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(tabId, e);
    }
  };

  const value: ChatContextType = {
    tabStates,
    isSearching,
    handleSubmit,
    handleInputChange,
    handleKeyDown,
    getMessageString,
    analyzeQuery,
    extractCodeBlocks,
    formatSearchResults,
    webSearchChain,
    imageSearchChain,
    videoSearchChain,
    youtubeSearchChain,
    claudeModel,
    productAnalyzer,
    generateQueryTitle,
    generateWebsiteTitle,
    handleEditTitle,
    isManuallySet: (tabId: string) => manuallySetTitles.current.has(tabId),
    tabs,
    handleStopGeneration,
    imageAnalyzer,
    addFollowupMessage,
    getFollowupMessages,
    clearFollowupMessages,
    setFollowupLoading,
    getFollowupLoading,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = (tabId: string) => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }

  // Ensure tab state exists in the context
  const tabState = context.tabStates[tabId] || {
    messages: [],
    input: '',
    isLoading: false,
    error: null,
    followupMessages: []
  };

  // Memoize function references so they don't change on every render
  // ✅ CRITICAL FIX: Accept overrideInput parameter and pass it through
  const handleSubmit = useCallback(
    (e: React.FormEvent, overrideInput?: string) => context.handleSubmit(tabId, e, overrideInput),
    [context.handleSubmit, tabId]
  );
  
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => context.handleInputChange(tabId, e),
    [context.handleInputChange, tabId]
  );
  
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => context.handleKeyDown(tabId, e),
    [context.handleKeyDown, tabId]
  );
  
  const handleStopGeneration = useCallback(
    () => context.handleStopGeneration(tabId),
    [context.handleStopGeneration, tabId]
  );

  const addFollowupMessage = useCallback(
  (message: FollowupMessage) => context.addFollowupMessage(tabId, message),
  [context.addFollowupMessage, tabId]
);

const getFollowupMessages = useCallback(
  () => context.getFollowupMessages(tabId),
  [context.getFollowupMessages, tabId]
);

const clearFollowupMessages = useCallback(
  () => context.clearFollowupMessages(tabId),
  [context.clearFollowupMessages, tabId]
);

const setFollowupLoading = useCallback(
  (loading: boolean) => context.setFollowupLoading(tabId, loading),
  [context.setFollowupLoading, tabId]
);

const getFollowupLoading = useCallback(
  () => context.getFollowupLoading(tabId),
  [context.getFollowupLoading, tabId]
);

  // Memoize the entire returned object to ensure referential stability
  return useMemo(() => ({
    ...tabState,
    isSearching: context.isSearching,
    handleSubmit,
    handleInputChange,
    handleKeyDown,
    generateWebsiteTitle: context.generateWebsiteTitle,
    generateQueryTitle: context.generateQueryTitle,
    handleStopGeneration,    
    addFollowupMessage,
    getFollowupMessages,
    clearFollowupMessages,
    setFollowupLoading,
    getFollowupLoading
  }), [
    tabState,
    context.isSearching,
    handleSubmit,
    handleInputChange,
    handleKeyDown,
    context.generateWebsiteTitle,
    context.generateQueryTitle,
    handleStopGeneration,
    addFollowupMessage,
    getFollowupMessages,
    clearFollowupMessages,
    setFollowupLoading,
    getFollowupLoading
  ]);
};

export default ChatContext;