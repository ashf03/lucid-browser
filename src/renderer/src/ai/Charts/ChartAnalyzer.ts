// src/components/charts/ChartAnalyzer.ts
import { ChatAnthropic } from '@langchain/anthropic';

interface ChartAnalysis {
  needsChart: boolean;
  chartType: 'pie' | 'line' | 'bar' | null;
  scenario: 'direct-request' | 'data-provided' | 'ai-generated' | 'query-enhancement' | null;
  reasoning: string;
  suggestedData?: {
    dataKey: string;
    nameKey: string;
    data: Array<{ [key: string]: string | number }>;
  };
}

// Helper to extract numbers from text
const extractNumbers = (text: string): number[] => {
  const matches = text.match(/\b\d+(?:\.\d+)?\b/g);
  return matches ? matches.map(Number) : [];
};

// Helper to check if text contains data-like patterns
const containsDataPatterns = (text: string): boolean => {
  // Check for common data indicators
  const hasNumbers = /\d+(?:\.\d+)?/.test(text);
  const hasDataStructure = /[\[\{].*[\]\}]/.test(text);
  const hasDelimiters = /[,|:]/.test(text);
  const hasPairs = /\w+\s*[:=]\s*\d+/.test(text);
  
  return hasNumbers && (hasDataStructure || hasDelimiters || hasPairs);
};

// Extract structured data from text
const extractStructuredData = async (
  model: ChatAnthropic,
  query: string
): Promise<{ data: any[] | null; error: string | null }> => {
  const prompt = `Extract numerical data from this text into a structured format: "${query}"

Instructions:
1. Look for numbers and their associated labels/categories
2. If there are multiple related numbers, treat them as a series
3. Format the data as a JSON array of objects

Return ONLY a JSON array in this format (no explanation):
[
  {"name": "Category1", "value": number1},
  {"name": "Category2", "value": number2},
  ...
]

If no clear numerical data can be extracted, return []`;

  try {
    const response = await model.invoke(prompt);
    const parsedData = JSON.parse(response.content.toString());
    return { data: parsedData, error: null };
  } catch (error) {
    console.error('Data extraction error:', error);
    return { data: null, error: 'Failed to extract data' };
  }
};

// Generate sample data based on context
const generateSampleData = async (
  model: ChatAnthropic,
  query: string,
  chartType: 'pie' | 'line' | 'bar'
): Promise<{ data: any[] | null; error: string | null }> => {
  const prompt = `Generate sample data for a ${chartType} chart based on this query: "${query}"

Instructions:
1. Generate realistic but representative data
2. For pie/bar charts: 4-7 categories with values
3. For line charts: 6-10 time points with values
4. Use contextually appropriate value ranges

Return ONLY a JSON array in this format (no explanation):
[
  {"name": "Category1", "value": number1},
  {"name": "Category2", "value": number2},
  ...
]`;

  try {
    const response = await model.invoke(prompt);
    const parsedData = JSON.parse(response.content.toString());
    return { data: parsedData, error: null };
  } catch (error) {
    console.error('Data generation error:', error);
    return { data: null, error: 'Failed to generate data' };
  }
};

// Determine appropriate chart type
const determineChartType = (query: string): 'pie' | 'line' | 'bar' | null => {
  // Check for explicit chart type mentions
  if (/pie\s*chart|breakdown|distribution|portion|percentage/i.test(query)) {
    return 'pie';
  }
  if (/line\s*chart|trend|over time|timeline|progression/i.test(query)) {
    return 'line';
  }
  if (/bar\s*chart|column|compare|comparison|ranking/i.test(query)) {
    return 'bar';
  }
  
  // Default to bar for generic comparisons
  if (/compare|versus|vs\.|difference|show|graph|chart/i.test(query)) {
    return 'bar';
  }
  
  return null;
};

export const analyzeForCharts = async (
  query: string,
  model: ChatAnthropic
): Promise<ChartAnalysis> => {
  // Step 1: Initial analysis
  const hasExplicitChartRequest = /chart|graph|plot|visualize|show/i.test(query);
  const hasData = containsDataPatterns(query);
  const chartType = determineChartType(query);

  // Step 2: Determine scenario
  let scenario: ChartAnalysis['scenario'] = null;
  if (hasExplicitChartRequest && hasData) {
    scenario = 'data-provided';
  } else if (hasExplicitChartRequest) {
    scenario = 'direct-request';
  } else if (hasData) {
    scenario = 'query-enhancement';
  }

  // If no clear scenario, return without chart
  if (!scenario || !chartType) {
    return {
      needsChart: false,
      chartType: null,
      scenario: null,
      reasoning: 'No clear visualization needs detected'
    };
  }

  // Step 3: Get data based on scenario
  let data;
  let error = null;

  if (scenario === 'data-provided') {
    // Extract provided data
    const result = await extractStructuredData(model, query);
    data = result.data;
    error = result.error;
  } else {
    // Generate sample data
    const result = await generateSampleData(model, query, chartType);
    data = result.data;
    error = result.error;
    if (data) {
      scenario = 'ai-generated';
    }
  }

  // If we have data, return complete analysis
  if (data && Array.isArray(data) && data.length > 0) {
    return {
      needsChart: true,
      chartType,
      scenario,
      reasoning: `Creating ${chartType} chart with ${scenario === 'data-provided' ? 'provided' : 'generated'} data`,
      suggestedData: {
        dataKey: 'value',
        nameKey: 'name',
        data
      }
    };
  }

  // If we failed to get data, return error state
  return {
    needsChart: false,
    chartType: null,
    scenario: null,
    reasoning: error || 'Failed to process data for visualization'
  };
};