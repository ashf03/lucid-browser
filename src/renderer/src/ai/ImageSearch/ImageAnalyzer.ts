import { ChatAnthropic } from '@langchain/anthropic';
import { MessageContent, MessageContentText } from '@langchain/core/messages';

// Interface for individual image analysis results
interface SingleImageAnalysis {
  userAnalysis: string;
  searchQuery: string;
  confidence: number;
  imageData: string;
  imageName: string;
}

export interface ImageAnalysisResult {
  isImageQuery: boolean;
  userAnalysis: string;
  searchQuery: string;
  confidence: number;
  reasoning: string;
  imageData?: string; // base64 image data for primary image
  imageName?: string; // name of primary image
  allImages?: Array<{src: string, name: string}>; // All uploaded images
}

export class ImageAnalyzer {
  private claudeModel: ChatAnthropic;

  constructor(claudeModel: ChatAnthropic) {
    this.claudeModel = claudeModel;
  }

  private getMessageString(content: MessageContent): string {
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
  }

  // 🔥 NEW: Helper function to clean search queries
  private cleanSearchQuery(query: string): string {
    return query
      // Remove markdown formatting
      .replace(/\*\*([^*]+)\*\*/g, '$1') // **bold** -> bold
      .replace(/\*([^*]+)\*/g, '$1')     // *italic* -> italic
      .replace(/__([^_]+)__/g, '$1')     // __underline__ -> underline
      .replace(/_([^_]+)_/g, '$1')       // _italic_ -> italic
      .replace(/`([^`]+)`/g, '$1')       // `code` -> code
      .replace(/```[\s\S]*?```/g, '')    // Remove code blocks
      .replace(/#{1,6}\s?/g, '')         // Remove headers
      .replace(/>\s?/g, '')              // Remove blockquotes
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link](url) -> link
      .replace(/\n+/g, ' ')              // Replace newlines with spaces
      .replace(/\s+/g, ' ')              // Normalize whitespace
      .replace(/[^\w\s-]/g, '')          // Remove special characters except hyphens
      .trim()
      .substring(0, 200); // Limit length for API compatibility
  }

  // 🔥 IMPROVED: Better search query extraction
  private extractSearchQuery(content: string): string {
    // Look for search query in various formats
    const patterns = [
      /SEARCH QUERY:\s*(.+?)(?:\n|$)/i,
      /Search query:\s*(.+?)(?:\n|$)/i,
      /Query:\s*(.+?)(?:\n|$)/i,
      /For searching:\s*(.+?)(?:\n|$)/i
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1].trim()) {
        const rawQuery = match[1].trim();
        console.log('🔍 Raw extracted query:', rawQuery);
        const cleanedQuery = this.cleanSearchQuery(rawQuery);
        console.log('🧹 Cleaned query:', cleanedQuery);
        return cleanedQuery;
      }
    }
    
    // Fallback: use first meaningful sentence
    const sentences = content.split(/[.!?]+/);
    for (const sentence of sentences) {
      const cleaned = this.cleanSearchQuery(sentence);
      if (cleaned.length > 10) { // Only use if meaningful length
        console.log('🔄 Fallback query from sentence:', cleaned);
        return cleaned;
      }
    }
    
    // Last resort: clean the entire content and truncate
    const fallback = this.cleanSearchQuery(content);
    console.log('⚠️ Last resort query:', fallback);
    return fallback;
  }

  // Function to detect image type from base64 data
  private detectMediaType(base64Data: string): string {
    // Default to JPEG if we can't determine
    let mediaType = "image/jpeg";

    // Base64 signature detection
    if (base64Data.startsWith('/9j/')) {
      mediaType = "image/jpeg";
    } else if (base64Data.startsWith('iVBORw0KGgo')) {
      mediaType = "image/png";
    } else if (base64Data.startsWith('R0lGODlh')) {
      mediaType = "image/gif";
    } else if (base64Data.startsWith('UklGR')) {
      mediaType = "image/webp";
    }

    return mediaType;
  }

  // Check if this is an image analysis query and process all images
  public async analyzeQuery(query: string, images?: Array<{src: string, name: string}>): Promise<ImageAnalysisResult> {
    // If no images are provided, return early
    if (!images || images.length === 0) {
      return {
        isImageQuery: false,
        userAnalysis: "",
        searchQuery: "",
        confidence: 0,
        reasoning: "No image provided"
      };
    }

    try {
      // Create an array to hold individual analysis results
      const individualAnalyses: SingleImageAnalysis[] = [];
      
      // Process each image sequentially
      for (const image of images) {
        console.log(`Analyzing image: ${image.name}`);
        
        // Extract image data
        const base64Image = image.src.split(',')[1]; // Remove data:image/jpeg;base64,
        const mediaType = this.detectMediaType(base64Image);

        // 🔥 IMPROVED: More focused search-oriented prompt
        const searchSystemPrompt = `You are an expert image analyzer. Analyze this image and provide:

1. A clear, factual description of what you see
2. Key objects, people, scenes, or elements
3. Any visible text or notable features
4. Context or setting information

IMPORTANT: At the end, provide a clean search query on a new line starting with "SEARCH QUERY:" followed by a simple, descriptive phrase (2-4 words) that would be good for searching similar images. Do NOT use markdown formatting, asterisks, or special characters in the search query.

Example: "SEARCH QUERY: red sports car"`;

        const searchResponse = await this.claudeModel.invoke([
          {
            role: "system", 
            content: searchSystemPrompt
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this image and provide a clean search query."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mediaType};base64,${base64Image}`
                }
              }
            ],
          }
        ]);
        
        // Process the search response
        const searchAnalysis = this.getMessageString(searchResponse.content);
        
        // 🔥 IMPROVED: Use the enhanced extraction method
        const searchQuery = this.extractSearchQuery(searchAnalysis);
        
        // Get analysis with user's query if provided
        let userAnalysis = searchAnalysis;
        
        if (query.trim()) {
          // 🔥 IMPROVED: Better user-focused prompt
          const userSystemPrompt = `You are an expert image analyzer. The user has uploaded an image with a specific question. 

Analyze the image and answer their question thoroughly and accurately. Provide:
1. Direct answers to their specific question
2. Relevant context about what's in the image
3. Additional insights that might be helpful

Keep your response clear and informative without excessive formatting.`;

          // Make user-focused API call
          const userResponse = await this.claudeModel.invoke([
            {
              role: "system",
              content: userSystemPrompt
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `I have this image and I'd like to know: ${query}`
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mediaType};base64,${base64Image}`
                  }
                }
              ]
            }
          ]);
          
          userAnalysis = this.getMessageString(userResponse.content);
        }
        
        // Add this image's analysis to the collection
        individualAnalyses.push({
          userAnalysis,
          searchQuery,
          confidence: 0.95,
          imageData: image.src,
          imageName: image.name
        });
      }
      
      // Now, combine results from all images
      return this.combineImageAnalyses(individualAnalyses, images, query);
      
    } catch (error) {
      console.error('Error analyzing images:', error);
      return {
        isImageQuery: false,
        userAnalysis: "",
        searchQuery: "",
        confidence: 0,
        reasoning: `Error analyzing images: ${error}`
      };
    }
  }

  // Method to combine individual image analyses into a unified result
  private async combineImageAnalyses(
    analyses: SingleImageAnalysis[], 
    images: Array<{src: string, name: string}>,
    originalQuery: string
  ): Promise<ImageAnalysisResult> {
    // If there's only one image, use its analysis directly
    if (analyses.length === 1) {
      return {
        isImageQuery: true,
        userAnalysis: analyses[0].userAnalysis,
        searchQuery: analyses[0].searchQuery,
        confidence: analyses[0].confidence,
        reasoning: "Single image analyzed",
        imageData: analyses[0].imageData,
        imageName: analyses[0].imageName,
        allImages: images
      };
    }
    
    // For multiple images, synthesize a combined analysis
    
    // First, prepare a comprehensive input for the synthesis
    let synthesisInput = `The user has uploaded ${analyses.length} images with the query: "${originalQuery || 'Analyze these images'}"\n\n`;
    
    // Add analysis for each image
    analyses.forEach((analysis, index) => {
      synthesisInput += `IMAGE ${index + 1} (${analysis.imageName}):\n`;
      synthesisInput += `Analysis: ${analysis.userAnalysis}\n`;
      synthesisInput += `Search query: ${analysis.searchQuery}\n\n`;
    });
    
    // 🔥 IMPROVED: Better synthesis prompt
    const synthesisSystemPrompt = `You are an expert at synthesizing analyses of multiple images. 
The user has uploaded multiple images, and each has been analyzed individually.

Create a unified analysis that considers all images together and provides:
1. A comprehensive summary of what's shown across all images
2. Common themes or elements between the images
3. How the images relate to each other (if at all)

IMPORTANT: At the end, provide a clean search query on a new line starting with "SEARCH QUERY:" followed by a simple phrase (2-5 words) that captures the main theme across all images. Do NOT use markdown formatting or special characters.

Example: "SEARCH QUERY: modern architecture buildings"`;

    try {
      // Make the synthesis API call
      const synthesisResponse = await this.claudeModel.invoke([
        {
          role: "system",
          content: synthesisSystemPrompt
        },
        {
          role: "user",
          content: synthesisInput
        }
      ]);
      
      // Extract the synthesis
      const combinedAnalysis = this.getMessageString(synthesisResponse.content);
      
      // 🔥 IMPROVED: Use the enhanced extraction method
      let combinedSearchQuery = this.extractSearchQuery(combinedAnalysis);
      
      // If extraction failed, combine individual search queries as fallback
      if (!combinedSearchQuery || combinedSearchQuery.length < 5) {
        const individualQueries = analyses.map(a => a.searchQuery).filter(q => q.length > 0);
        combinedSearchQuery = this.cleanSearchQuery(individualQueries.join(' '));
        console.log('🔄 Using combined individual queries:', combinedSearchQuery);
      }
      
      // Return the combined result
      return {
        isImageQuery: true,
        userAnalysis: combinedAnalysis,
        searchQuery: combinedSearchQuery,
        confidence: 0.9, // Slightly lower confidence for combined analysis
        reasoning: `${analyses.length} images analyzed and synthesized`,
        imageData: analyses[0].imageData, // Use the first image as the primary image
        imageName: analyses[0].imageName,
        allImages: images
      };
    } catch (error) {
      console.error('Error in synthesis:', error);
      // Fallback to simple combination
      const fallbackQuery = this.cleanSearchQuery(
        analyses.map(a => a.searchQuery).join(' ')
      );
      return {
        isImageQuery: true,
        userAnalysis: analyses.map(a => a.userAnalysis).join('\n\n'),
        searchQuery: fallbackQuery,
        confidence: 0.8,
        reasoning: `${analyses.length} images analyzed (synthesis failed, using simple combination)`,
        imageData: analyses[0].imageData,
        imageName: analyses[0].imageName,
        allImages: images
      };
    }
  }

  // Get display configuration based on analysis
  public getDisplayConfig(analysis: ImageAnalysisResult) {
    if (!analysis.isImageQuery) return null;
    
    return {
      displayType: 'image-analysis',
      searchQuery: analysis.searchQuery,
      imageData: analysis.imageData,
      imageName: analysis.imageName,
      allImages: analysis.allImages
    };
  }
}