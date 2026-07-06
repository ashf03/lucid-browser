// src/utils/transcript.ts
import axios from 'axios';
import * as cheerio from 'cheerio';

// Define interfaces for transcript data
interface TranscriptEntry {
  text: string;
  start: number;
  duration: number;
}

interface CaptionTrack {
  baseUrl: string;
  name?: {
    simpleText?: string;
  };
  languageCode?: string;
}

interface TranscriptItem {
  text: string;
  offset: number;
  duration: number;
}

/**
 * Fetches the transcript for a YouTube video by ID
 * @param videoId The YouTube video ID
 * @returns The transcript text or null if not available
 */
export async function fetchTranscript(videoId: string): Promise<string | null> {
  try {
    // Try to use youtube-transcript package if available
    let YoutubeTranscript: any;
    try {
      YoutubeTranscript = require('youtube-transcript').YoutubeTranscript;
      
      // First try to get English transcript
      try {
        const transcriptList = await YoutubeTranscript.fetchTranscript(videoId, {
          lang: 'en'  // Request English language transcript
        });
        
        if (transcriptList && transcriptList.length > 0) {
          return transcriptList.map((item: TranscriptItem) => item.text).join(' ');
        }
      } catch (langError) {
        console.log('Specific English transcript not found, trying default language');
        
        // If English-specific request fails, try getting any transcript
        const transcriptList = await YoutubeTranscript.fetchTranscript(videoId);
        if (transcriptList && transcriptList.length > 0) {
          return transcriptList.map((item: TranscriptItem) => item.text).join(' ');
        }
      }
    } catch (error) {
      console.log('youtube-transcript package not available or failed:', error);
      // Continue to fallback methods
    }
    
    // Fallback method: Web scraping approach
    return await scrapeTranscript(videoId);
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return null;
  }
}

/**
 * Scrapes transcript data directly from YouTube page and caption data
 * @param videoId The YouTube video ID
 * @returns Formatted transcript text with timestamps
 */
async function scrapeTranscript(videoId: string): Promise<string> {
  try {
    const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`);
    const $ = cheerio.load(response.data);
    
    // Try to find captions data in script tags
    let captionUrl: string | null = null;
    let preferredUrl: string | null = null;
    
    // Use type 'any' to avoid cheerio Element type issues
    $('script').each((i: number, script: any) => {
      const scriptContent = $(script).html() || '';
      if (scriptContent.includes('captionTracks')) {
        // Extract all caption tracks
        const captionTracksMatch = scriptContent.match(/"captionTracks":\s*(\[.*?\])/);
        if (captionTracksMatch && captionTracksMatch[1]) {
          try {
            // Parse the JSON of caption tracks
            const captionTracksJson = JSON.parse(captionTracksMatch[1].replace(/\\"/g, '"')
              .replace(/\\u/g, '\\u')
              .replace(/\\n/g, '\\n')) as CaptionTrack[];
            
            // First look for English tracks
            for (const track of captionTracksJson) {
              if (track.languageCode === 'en' || (track.name?.simpleText && track.name.simpleText.includes('English'))) {
                preferredUrl = track.baseUrl.replace(/\\u0026/g, '&');
                break;
              }
            }
            
            // If no English track found, take the first available
            if (!preferredUrl && captionTracksJson.length > 0) {
              captionUrl = captionTracksJson[0].baseUrl.replace(/\\u0026/g, '&');
            }
          } catch (jsonError) {
            console.error('Error parsing caption tracks JSON:', jsonError);
            
            // Fallback to regex matching if JSON parsing fails
            const captionMatch = scriptContent.match(/"captionTracks":\s*\[\s*\{\s*"baseUrl":\s*"([^"]+)"/);
            if (captionMatch && captionMatch[1]) {
              captionUrl = captionMatch[1].replace(/\\u0026/g, '&');
            }
          }
        }
      }
    });
    
    // Use the English URL if found, otherwise fall back to any caption URL
    const finalCaptionUrl = preferredUrl || captionUrl;
    
    if (!finalCaptionUrl) {
      // If captions not found, provide a placeholder message
      return `[This YouTube video (${videoId}) doesn't appear to have available captions or transcripts.]`;
    }
    
    // Fetch and parse caption data
    const captionResponse = await axios.get(finalCaptionUrl);
    const $captions = cheerio.load(captionResponse.data, { xmlMode: true });
    
    // Extract all text nodes and timestamps
    const transcriptEntries: TranscriptEntry[] = [];
    
    // Use standard function without 'this' type annotation to avoid Element type issues
    $captions('text').each(function() {
      // Access 'this' as any to avoid type issues
      const element = this as any;
      const text = $captions(element).text();
      const start = $captions(element).attr('start');
      const dur = $captions(element).attr('dur');
      
      if (start && dur) {
        transcriptEntries.push({
          text,
          start: parseFloat(start),
          duration: parseFloat(dur)
        });
      }
    });
    
    // Sort by start time to ensure correct order
    transcriptEntries.sort((a, b) => a.start - b.start);
    
    // Format with timestamps (HH:MM:SS) for better readability
    const formattedTranscript = transcriptEntries.map(entry => {
      const time = formatTime(entry.start);
      return `[${time}] ${entry.text}`;
    }).join('\n');
    
    return formattedTranscript || `[No transcript content could be extracted from ${videoId}]`;
  } catch (error: any) {
    console.error('Error scraping transcript:', error);
    return `[Unable to retrieve transcript for video ${videoId}. Error: ${error.message}]`;
  }
}

/**
 * Helper function to format seconds into HH:MM:SS
 * @param seconds Number of seconds
 * @returns Formatted time string
 */
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  return [
    h > 0 ? h.toString().padStart(2, '0') : '00',
    m.toString().padStart(2, '0'),
    s.toString().padStart(2, '0')
  ].join(':');
}

/**
 * Helper function to extract video ID from YouTube URL
 * @param url YouTube URL (various formats supported)
 * @returns YouTube video ID or null if invalid
 */
export function extractVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}