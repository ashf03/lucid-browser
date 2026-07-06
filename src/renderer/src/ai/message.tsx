import React, { useCallback, useContext, useEffect, useRef, useState, useMemo } from 'react';
import { Button } from '../ui/button';
import 'katex/dist/katex.min.css';
import MapboxDisplay from './Maps/MapboxDisplay';
import { DynamicChart, ChartData } from './Charts/ChartComponents';
import ProductDisplay from './Products/ProductDisplay';
import { useChat } from './ChatContext';
import { useElectronSearch } from './hook';
import { cn } from '../lib/utils';
import { SpeakerHigh, Repeat, Shapes, TextAlignLeft, ChartPie, LinkSimple, Headphones, ChartLineUp, X, ChartBar } from '@phosphor-icons/react';

import { MessageFormatter } from './Containers/MessageFormat';
import ImageAnalysisDisplay from './ImageSearch/ImageAnalysisDisplay';
import { ChatMessageProps } from '../types/MessageTypes';
import getValidLocations from './Location/getValidLocations';
import mermaid from 'mermaid';
import { ChatAnthropic } from '@langchain/anthropic';

const ChatMessage: React.FC<ChatMessageProps> = React.memo(({ 
  message, 
  messageIndex, 
  tabId
}) => {
  // Use refs for values that shouldn't trigger re-renders
  const messageRef = useRef(message);
  const messageIndexRef = useRef(messageIndex);
  const lastIsLoadingState = useRef(false);
  const lastIsSearchingState = useRef(false);
  const isLastMessageRef = useRef(false);
  
  // Only destructure the minimum needed functions and state
  const { isLoading } = useChat(tabId);
  const { isSearching } = useElectronSearch();

  // Initialize Claude model
  const claudeModel = useMemo(() => new ChatAnthropic({
    anthropicApiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
    modelName: 'claude-sonnet-4-20250514',
    temperature: 0.7,
  }), []);

  // Update refs when props change to avoid unnecessary re-renders
  useEffect(() => {
    messageRef.current = message;
    messageIndexRef.current = messageIndex;
  }, [message, messageIndex]);

  // Update loading state refs
  useEffect(() => {
    lastIsLoadingState.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    lastIsSearchingState.current = isSearching;
  }, [isSearching]);

  // Calculate if this is the last message only when needed
  useEffect(() => {
    const checkIfLastMessage = async () => {
      try {
        const messagesCount = await window.electronAPI.ipcRenderer.invoke('get-messages-count', tabId);
        isLastMessageRef.current = messageIndexRef.current === messagesCount - 1;
      } catch (error) {
        console.error('Failed to get messages count:', error);
        // Fallback
        isLastMessageRef.current = false;
      }
    };
    
    checkIfLastMessage();
  }, [tabId, messageIndex]);

  const [isAudioVisible, setIsAudioVisible] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioSrc, setAudioSrc] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  // Diagram generation states
  const [isDiagramDialogOpen, setIsDiagramDialogOpen] = useState(false);
  const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);
  const [generatedDiagram, setGeneratedDiagram] = useState('');
  const [diagramError, setDiagramError] = useState('');
  const mermaidRef = useRef<HTMLDivElement>(null);

  // Chart generation states
  const [isChartDialogOpen, setIsChartDialogOpen] = useState(false);
  const [isGeneratingChart, setIsGeneratingChart] = useState(false);
  const [generatedChart, setGeneratedChart] = useState<ChartData | null>(null);
  const [chartError, setChartError] = useState('');

  // Sources view mode state
  const [sourcesViewMode, setSourcesViewMode] = useState<'compact' | 'full'>('compact');

  // Track image full view state at ChatMessage level
  const [isImageFullView, setIsImageFullView] = useState(false);

  // Track video full view state at ChatMessage level
  const [internalVideoViewMode, setInternalVideoViewMode] = useState<'compact' | 'full'>('compact');

  // Handle sources view mode change
  const handleSourcesViewModeChange = useCallback((mode: 'compact' | 'full') => {
    setSourcesViewMode(mode);
  }, []);

  // Handle image full view mode change
  const handleImageFullViewChange = useCallback((isFullView: boolean) => {
    setIsImageFullView(isFullView);
  }, []);

  // Handle video full view mode change
  const handleVideoFullViewChange = useCallback((isFullView: boolean) => {
    setInternalVideoViewMode(isFullView ? 'full' : 'compact');
  }, []);

  // Initialize Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'Arial, sans-serif',
    });
  }, []);

  // Define diagram template types
  type DiagramType = 'flowchart' | 'timeline' | 'conceptMap' | 'hierarchical';
  type ChartType = 'bar' | 'pie' | 'line';

  // Claude-powered diagram generation
  const generateDiagramWithClaude = async (diagramType: DiagramType, messageContent: string): Promise<string> => {
    const prompts = {
      flowchart: `Analyze the following content and create a Mermaid flowchart diagram that represents the key concepts, processes, or decision points:

Content: "${messageContent}"

Requirements:
- Use proper Mermaid flowchart syntax (start with "flowchart TD" or "flowchart LR")
- Include 5-10 meaningful nodes maximum
- Show logical connections and flow between concepts
- Use appropriate node shapes (rectangles for processes, diamonds for decisions, etc.)
- Keep node labels concise (max 25 characters)
- Ensure the diagram is logically structured and easy to follow

Return ONLY the Mermaid diagram code, no explanation:`,

      timeline: `Analyze the following content and create a Mermaid timeline diagram that shows the chronological progression or sequence of events/concepts:

Content: "${messageContent}"

Requirements:
- Use proper Mermaid timeline syntax
- Include 4-8 timeline entries maximum
- Organize content into logical sections (Beginning, Development, Conclusion, etc.)
- Extract key temporal or sequential elements
- Keep timeline entries concise and meaningful

Return ONLY the Mermaid timeline code, no explanation:`,

      conceptMap: `Analyze the following content and create a Mermaid graph diagram that shows relationships between key concepts and ideas:

Content: "${messageContent}"

Requirements:
- Use "graph LR" or "graph TD" syntax
- Show 6-10 interconnected concepts maximum
- Demonstrate relationships between main topics and subtopics
- Use meaningful connections that show how concepts relate
- Keep node labels clear and concise

Return ONLY the Mermaid graph code, no explanation:`,

      hierarchical: `Analyze the following content and create a Mermaid hierarchical diagram that organizes information in a tree-like structure:

Content: "${messageContent}"

Requirements:
- Use "graph TD" syntax for top-down hierarchy
- Show clear parent-child relationships
- Include 2-3 levels of hierarchy maximum
- Organize content from general to specific
- Include 6-12 nodes total

Return ONLY the Mermaid diagram code, no explanation:`
    };

    try {
      const response = await claudeModel.invoke(prompts[diagramType]);
      const diagramCode = response.content.toString().trim();
      
      // Clean up the response to ensure it's valid Mermaid code
      const cleanCode = diagramCode
        .replace(/```mermaid\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
        
      return cleanCode;
    } catch (error) {
      console.error('Claude diagram generation error:', error);
      throw new Error(`Failed to generate ${diagramType} diagram: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Claude-powered chart generation
  const generateChartWithClaude = async (chartType: ChartType, messageContent: string): Promise<ChartData> => {
    const prompt = `Analyze the following content and create data for a ${chartType} chart:

Content: "${messageContent}"

Your task:
1. Extract or infer numerical data that would be meaningful to visualize
2. If no explicit data exists, generate realistic sample data that relates to the content theme
3. Create 4-8 data points for optimal visualization
4. Ensure data is contextually relevant and meaningful

Return ONLY a JSON object in this exact format (no explanation):
{
  "title": "Descriptive chart title based on content",
  "data": [
    {"name": "Category1", "value": number1},
    {"name": "Category2", "value": number2},
    {"name": "Category3", "value": number3}
  ]
}

Requirements:
- Use appropriate value ranges for the context
- Make category names descriptive but concise (max 20 characters)
- For line charts, use time-based or sequential categories
- For pie charts, ensure values represent parts of a whole
- For bar charts, use comparative categories`;

    try {
      const response = await claudeModel.invoke(prompt);
      const responseText = response.content.toString().trim();
      
      // Clean up the response to extract JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }
      
      const parsedData = JSON.parse(jsonMatch[0]);
      
      if (!parsedData.data || !Array.isArray(parsedData.data) || parsedData.data.length === 0) {
        throw new Error('Invalid data structure in response');
      }

      const chartData: ChartData = {
        type: chartType,
        data: parsedData.data,
        dataKey: 'value',
        nameKey: 'name',
        title: parsedData.title || `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`
      };
      
      return chartData;
    } catch (error) {
      console.error('Claude chart generation error:', error);
      throw new Error(`Failed to generate ${chartType} chart: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Memoize the audio handler
  const handleTextToSpeech = useCallback(async () => {
    // If audio is already visible, just hide it
    if (isAudioVisible) {
      setIsAudioVisible(false);
      return;
    }
    
    setIsGeneratingAudio(true);
    
    try {
      // Extract clean text for TTS
      const textToConvert = messageRef.current.pureResponse || 
        messageRef.current.content.replace(/\*\*|__|\*|_|```[\s\S]*?```|`[\s\S]*?`|#|>/g, '').substring(0, 5000);
      
      // Call the TTS API
      const result = await window.electronAPI.ipcRenderer.invoke('generate-speech', { 
        text: textToConvert
      });
      
      if (result.success) {
        // Set audio source and show player
        setAudioSrc(result.dataUrl);
        setIsAudioVisible(true);
        
        // Use setTimeout to ensure the audio element is ready before playing
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play().catch(e => console.error('Failed to play audio:', e));
          }
        }, 100);
      } else {
        console.error('Failed to generate speech:', result.error);
      }
    } catch (error) {
      console.error('TTS error:', error);
    } finally {
      setIsGeneratingAudio(false);
    }
  }, [isAudioVisible]);

  // Generate diagram based on selected template using Claude
  const generateDiagram = useCallback(async (templateType: DiagramType) => {
    setIsGeneratingDiagram(true);
    setDiagramError('');
    
    try {
      // Extract content from the message
      const messageContent = messageRef.current.pureResponse || messageRef.current.content;
      const cleanText = messageContent.replace(/\*\*|__|\*|_|```[\s\S]*?```|`[\s\S]*?`|#|>/g, '').trim();
      
      if (!cleanText) {
        setDiagramError('No content available to generate diagram');
        return;
      }

      // Use Claude to generate the diagram
      const diagram = await generateDiagramWithClaude(templateType, cleanText);
      
      setGeneratedDiagram(diagram);
      setIsDiagramDialogOpen(false);
      
    } catch (error) {
      setDiagramError(`Error generating diagram: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Diagram generation error:', error);
    } finally {
      setIsGeneratingDiagram(false);
    }
  }, [claudeModel]);

  // Generate chart based on selected type using Claude
  const generateChart = useCallback(async (chartType: ChartType) => {
    setIsGeneratingChart(true);
    setChartError('');
    
    try {
      // Extract content from the message
      const messageContent = messageRef.current.pureResponse || messageRef.current.content;
      const cleanText = messageContent.replace(/\*\*|__|\*|_|```[\s\S]*?```|`[\s\S]*?`|#|>/g, '').trim();
      
      if (!cleanText) {
        setChartError('No content available to generate chart');
        return;
      }

      // Use Claude to generate the chart
      const chartData = await generateChartWithClaude(chartType, cleanText);
      
      setGeneratedChart(chartData);
      setIsChartDialogOpen(false);
      
    } catch (error) {
      setChartError(`Error generating chart: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Chart generation error:', error);
    } finally {
      setIsGeneratingChart(false);
    }
  }, [claudeModel]);

  // Render the generated diagram
  useEffect(() => {
    if (generatedDiagram && mermaidRef.current) {
      renderMermaidDiagram();
    }
  }, [generatedDiagram]);

  const renderMermaidDiagram = async () => {
    if (!mermaidRef.current || !generatedDiagram) return;

    try {
      // Clear previous diagram
      mermaidRef.current.innerHTML = '';
      
      // Generate unique ID for the diagram
      const diagramId = `mermaid-${Date.now()}`;
      
      // Validate and render the diagram
      const isValid = await mermaid.parse(generatedDiagram);
      if (isValid) {
        const { svg } = await mermaid.render(diagramId, generatedDiagram);
        mermaidRef.current.innerHTML = svg;
        setDiagramError('');
      }
    } catch (err) {
      setDiagramError(`Diagram rendering error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('Mermaid rendering error:', err);
    }
  };

  // Memoize this to prevent unnecessary recalculations
  const shouldShowLoadingState = useMemo(() => {
    const isLastMessage = isLastMessageRef.current;
    return (
      (message.role === 'assistant' && (message.content === '' || message.isLoading)) ||
      (message.role === 'assistant' && isLastMessage && (lastIsLoadingState.current || lastIsSearchingState.current))
    );
  }, [message, isLoading, isSearching]);

  // Audio and Diagram Controls Component
  const AudioDiagramControls = () => (
    <div className="mb-4 flex gap-2">
      {/* Audio Button */}
      {isAudioVisible && audioSrc ? (
        <audio 
          ref={audioRef}
          src={audioSrc} 
          className="flex-1" 
          controls
          autoPlay 
          onEnded={() => setIsAudioVisible(false)}
          onError={() => {
            console.error('Audio playback error');
            setIsAudioVisible(false);
          }}
        />
      ) : (
        <button 
          onClick={handleTextToSpeech}
          disabled={isGeneratingAudio}
          className="flex items-center gap-2 px-4 py-2 dark:bg-zinc-800 bg-zinc-300 rounded-xl disabled:opacity-50"
        >
          {isGeneratingAudio ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
              <span className="text-foreground">Loading...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-foreground">
              <SpeakerHigh className="h-5 w-5" />
              <span>Listen</span>
            </div>
          )}
        </button>
      )}
      
      {/* Diagram Button */}
      <button 
        onClick={() => setIsDiagramDialogOpen(true)}
        disabled={isGeneratingDiagram}
        className="flex items-center gap-2 px-4 py-2 dark:bg-zinc-800 bg-zinc-300 rounded-xl hover:bg-zinc-300 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
      >
        {isGeneratingDiagram ? (
          <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
        ) : (
          <ChartLineUp className="h-5 w-5" />
        )}
        <span className="text-foreground">
          {isGeneratingDiagram ? 'Generating...' : 'Mind Map'}
        </span>
      </button>

      {/* Chart Generation Button */}
      <button 
        onClick={() => setIsChartDialogOpen(true)}
        disabled={isGeneratingChart}
        className="flex items-center gap-2 px-4 py-2 dark:bg-zinc-800 bg-zinc-300 rounded-xl hover:bg-zinc-300 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
      >
        {isGeneratingChart ? (
          <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
        ) : (
          <ChartBar className="h-5 w-5" />
        )}
        <span className="text-foreground">
          {isGeneratingChart ? 'Generating...' : 'Charts'}
        </span>
      </button>
    </div>
  );

  return (
      <>
        <div className="flex items-start flex-1 gap-2">
            {shouldShowLoadingState ? (
              <div></div>
            ) : (
              <div className='flex flex-row w-full'>
                <div className="flex-1 overflow-y-auto h-[300px] sidebar-scrollbar scroll-smooth">
                  {/* When in full view modes, show only the appropriate component */}
                  {(sourcesViewMode === 'full' || isImageFullView || internalVideoViewMode === 'full') ? (
                    <div className="p-3 h-full">
                      <MessageFormatter 
                        message={message} 
                        sourcesViewMode={sourcesViewMode}
                        onSourcesViewModeChange={handleSourcesViewModeChange}
                        onImageFullViewChange={handleImageFullViewChange}
                        onVideoFullViewChange={handleVideoFullViewChange}
                        imageViewMode={isImageFullView ? 'full' : 'compact'}
                        videoViewMode={internalVideoViewMode}
                      />
                    </div>
                  ) : (
                    /* Normal view - mainview content, then buttons, then rest */
                    <div className="p-3 space-y-4">
                      {/* MAINVIEW CONTENT - Specialized Content */}
                      {message.imageData && (
                        <ImageAnalysisDisplay
                          displayType={message.imageData.displayType}
                          searchQuery={message.imageData.searchQuery}
                          analysis={message.imageData.analysis}
                          imageResults={message.imageData.imageResults}
                          imageData={message.imageData.imageData}
                          imageName={message.imageData.imageName}
                        />
                      )}
        
                      {message.isLocationBased && message.mapResults && (
                        <MapboxDisplay locations={getValidLocations(message.mapResults)} />
                      )}
        
                      {message.productData && (
                        <ProductDisplay {...message.productData} />
                      )}

                      {/* BUTTONS - Audio and Action Controls */}
                      <AudioDiagramControls />

                      {/* REST OF CONTENT - Generated Diagrams, Charts, and Message Content */}
                      {/* Generated Diagram Display */}
                      {generatedDiagram && (
                        <div className="p-4 border rounded-lg bg-zinc-50 dark:bg-zinc-800">
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Generate Mind Map</h3>
                            <button 
                              onClick={() => setGeneratedDiagram('')}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          {diagramError && (
                            <div className="mb-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                              {diagramError}
                            </div>
                          )}
                          <div ref={mermaidRef} className="mermaid-container" />
                        </div>
                      )}

                      {/* Generated Chart Display */}
                      {generatedChart && (
                        <div className="p-4 border rounded-lg bg-zinc-50 dark:bg-zinc-800">
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">AI-Generated Chart</h3>
                            <button 
                              onClick={() => setGeneratedChart(null)}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          {chartError && (
                            <div className="mb-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                              {chartError}
                            </div>
                          )}
                          <div className="chart-container w-full">
                            <DynamicChart
                              data={generatedChart.data}
                              type={generatedChart.type}
                              dataKey={generatedChart.dataKey}
                              nameKey={generatedChart.nameKey}
                              title={generatedChart.title || 'AI-Generated Chart'}
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Message Content */}
                      <MessageFormatter 
                        message={message} 
                        sourcesViewMode={sourcesViewMode}
                        onSourcesViewModeChange={handleSourcesViewModeChange}
                        onImageFullViewChange={handleImageFullViewChange}
                        onVideoFullViewChange={handleVideoFullViewChange}
                        imageViewMode="compact"
                        videoViewMode={internalVideoViewMode}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>

        {/* Diagram Generation Dialog */}
        {isDiagramDialogOpen && (
          <div className="fixed inset-0 bg-zinc-950 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Mind Map Generation</h2>
                <button 
                  onClick={() => setIsDiagramDialogOpen(false)}
                  className="rounded"
                  disabled={isGeneratingDiagram}
                >
                  <X className="size-6" />
                </button>
              </div>
              
              <div className="space-y-3">
                {Object.entries({
                  flowchart: { label: 'Process Flow', desc: 'Shows logical flow and decision points with intelligent analysis' },
                  timeline: { label: 'Timeline View', desc: 'Chronological organization with contextual understanding' },
                  conceptMap: { label: 'Concept Relations', desc: 'AI-identified relationships between key concepts' },
                  hierarchical: { label: 'Structured Hierarchy', desc: 'Intelligent categorization from general to specific' }
                } as const).map(([type, info]) => (
                  <button
                    key={type}
                    onClick={() => generateDiagram(type as DiagramType)}
                    disabled={isGeneratingDiagram}
                    className="w-full p-4 text-left bg-zinc-200 dark:bg-zinc-700 border rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <div className="font-medium text-zinc-950 dark:text-zinc-50">{info.label}</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">{info.desc}</div>
                  </button>
                ))}
              </div>
              
              {isGeneratingDiagram && (
                <div className="mt-4 flex items-center justify-center">
                  <div className="animate-spin h-6 w-6 border-2 border-foreground border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chart Generation Dialog */}
        {isChartDialogOpen && (
          <div className="fixed inset-0 bg-zinc-950 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Chart Generation</h2>
                <button 
                  onClick={() => setIsChartDialogOpen(false)}
                  className="rounded"
                  disabled={isGeneratingChart}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-3">
                {Object.entries({
                  bar: { 
                    label: 'Bar Chart', 
                    icon: <ChartBar className="h-5 w-5" />
                  },
                  pie: { 
                    label: 'Pie Chart', 
                    icon: <ChartPie className="h-5 w-5" />
                  },
                  line: { 
                    label: 'Line Chart', 
                    icon: <ChartLineUp className="h-5 w-5" />
                  }
                } as const).map(([type, info]) => (
                  <button
                    key={type}
                    onClick={() => generateChart(type as ChartType)}
                    disabled={isGeneratingChart}
                    className="w-full p-4 text-left bg-zinc-200 dark:bg-zinc-700 border rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-foreground">
                        {info.icon}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-zinc-950 dark:text-zinc-50">{info.label}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              
              {isGeneratingChart && (
                <div className="mt-4 flex items-center justify-center">
                  <div className="animate-spin h-6 w-6 border-2 border-foreground border-t-transparent rounded-full"></div>
                </div>
              )}

              {chartError && (
                <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                  {chartError}
                </div>
              )}
            </div>
          </div>
        )}
      </>
  );
}, (prevProps, nextProps) => {
  // Deep comparison for message to prevent unnecessary rerenders
  // Only rerender if specific important properties changed
  
  const prevMsg = prevProps.message;
  const nextMsg = nextProps.message;
  
  // Always rerender if the message index or tab ID changed
  if (prevProps.messageIndex !== nextProps.messageIndex || 
      prevProps.tabId !== nextProps.tabId) {
    return false; // Return false to indicate we should rerender
  }
  
  // Compare content and loading state
  if (prevMsg.content !== nextMsg.content || 
      prevMsg.isLoading !== nextMsg.isLoading) {
    return false;
  }
  
  // Deep compare specialized content presence (not their full content)
  if ((!!prevMsg.imageData !== !!nextMsg.imageData) ||
      (!!prevMsg.chart !== !!nextMsg.chart) ||
      (!!prevMsg.productData !== !!nextMsg.productData) ||
      (!!prevMsg.searchResults !== !!nextMsg.searchResults) ||
      (!!prevMsg.imageResults !== !!nextMsg.imageResults) ||
      (!!prevMsg.videoResults !== !!nextMsg.videoResults) ||
      (!!prevMsg.youtubeResults !== !!nextMsg.youtubeResults) ||
      (!!prevMsg.mapResults !== !!nextMsg.mapResults)) {
    return false;
  }
  
  // If we got here, no important props changed
  return true; // Skip rerender
});

export default ChatMessage;