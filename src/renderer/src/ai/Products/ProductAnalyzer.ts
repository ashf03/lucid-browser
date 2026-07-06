import { ChatAnthropic } from '@langchain/anthropic';
import { MessageContent, MessageContentText } from '@langchain/core/messages';

export interface ProductQueryAnalysis {
  isProductQuery: boolean;
  queryType: 'specific-product' | 'product-category' | 'comparison' | 'none';
  confidence: number;
  reasoning: string;
  productName?: string;
  category?: string;
  priceRange?: {
    min?: number;
    max?: number;
  };
  brands?: string[];
  features?: string[];
}

export interface ProductData {
  displayType: 'product-list' | 'product-comparison' | 'category-overview';
  searchQuery: string;
  analysis: ProductQueryAnalysis;
}

export class ProductAnalyzer {
  private model: ChatAnthropic;

  constructor(model: ChatAnthropic) {
    this.model = model;
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

  private extractJsonFromResponse(responseText: string): string {
    // Look for JSON content between curly braces
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    throw new Error('No JSON found in response');
  }

  async analyzeQuery(query: string): Promise<ProductQueryAnalysis> {
    const productAnalysisPrompt = `You must respond with ONLY valid JSON, no other text before or after.

Analyze if this query is product or shopping related: "${query}"

Return this exact JSON structure:
{
  "isProductQuery": boolean,
  "queryType": "specific-product" | "product-category" | "comparison" | "none",
  "confidence": number between 0 and 1,
  "reasoning": "Brief explanation of the product analysis",
  "productName": "specific product mentioned (if any)",
  "category": "product category (if applicable)",
  "priceRange": {
    "min": number or null,
    "max": number or null
  },
  "brands": ["array of mentioned brands"],
  "features": ["array of important features mentioned"]
}`;

    try {
      console.log('🔍 ProductAnalyzer: Analyzing query:', query);
      const response = await this.model.invoke(productAnalysisPrompt);
      const responseText = this.getMessageString(response.content);
      console.log('🤖 ProductAnalyzer: Raw response:', responseText);
      
      const jsonText = this.extractJsonFromResponse(responseText);
      const analysis: ProductQueryAnalysis = JSON.parse(jsonText);
      
      console.log('✅ ProductAnalyzer: Analysis successful:', analysis);
      return analysis;
    } catch (error) {
      console.error('❌ ProductAnalyzer: Analysis failed:', error);
      return {
        isProductQuery: false,
        queryType: 'none',
        confidence: 0,
        reasoning: 'Analysis failed'
      };
    }
  }

  getDisplayConfig(analysis: ProductQueryAnalysis): ProductData | null {
    if (!analysis.isProductQuery) return null;

    let searchQuery = '';
    if (analysis.productName) {
      searchQuery = analysis.productName;
    } else if (analysis.category) {
      searchQuery = analysis.category;
    }

    if (analysis.brands && analysis.brands.length > 0) {
      searchQuery += ` ${analysis.brands.join(' ')}`;
    }

    if (analysis.features && analysis.features.length > 0) {
      searchQuery += ` ${analysis.features.join(' ')}`;
    }

    return {
      displayType: analysis.queryType === 'comparison' 
        ? 'product-comparison'
        : analysis.queryType === 'product-category'
        ? 'category-overview'
        : 'product-list',
      searchQuery: searchQuery.trim(),
      analysis
    };
  }
}