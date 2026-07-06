import { chromium } from 'playwright';
import { Document } from 'langchain/document';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

export interface Link {
  href: string;
  text: string;
}

export interface ChunkData {
  text: string;
  metadata: any;
}

export interface ScrapeResult {
  url: string;
  title: string;
  chunks: ChunkData[];
  links: Link[];
  screenshot: string;
  timestamp: string;
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  console.log(`Starting to scrape: ${url}`);
  
  // Launch browser
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to the URL
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Extract the page content
    const title = await page.title();
    
    // Get the visible text content
    const textContent = await page.evaluate(() => {
      return document.body.innerText;
    });
    
    // Process content with LangChain
    const doc = new Document({ pageContent: textContent, metadata: { source: url, title } });
    
    // Split text into chunks for easier processing
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    const chunks = await textSplitter.splitDocuments([doc]);
    
    // Get all links from the page
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(a => ({
        href: a.href,
        text: a.innerText.trim(),
      })).filter(link => link.href && link.href.startsWith('http'));
    });
    
    // Take a screenshot
    const screenshot = await page.screenshot({ fullPage: true });
    const screenshotBase64 = screenshot.toString('base64');
    
    return {
      url,
      title,
      chunks: chunks.map(chunk => ({
        text: chunk.pageContent,
        metadata: chunk.metadata,
      })),
      links: links.slice(0, 100), // Limit to 100 links
      screenshot: screenshotBase64,
      timestamp: new Date().toISOString(),
    };
  } finally {
    // Close browser
    await browser.close();
  }
}