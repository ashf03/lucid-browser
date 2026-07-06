/**
 * Converts local files to plain text for AI/editor ingestion.
 * Supports PDF, Office docs, images (base64), code, markdown, and archives.
 */
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const marked = require('marked');
const AdmZip = require('adm-zip');

// Function to detect file type based on extension
function detectFileType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  
  // Map of file extensions to types
  const typeMap: Record<string, string> = {
    '.pdf': 'pdf',
    '.docx': 'word',
    '.doc': 'word',
    '.xlsx': 'excel',
    '.xls': 'excel',
    '.pptx': 'powerpoint',
    '.ppt': 'powerpoint',
    '.txt': 'text',
    '.json': 'json',
    '.md': 'markdown',
    // Image files
    '.jpg': 'image',
    '.jpeg': 'image',
    '.png': 'image',
    '.gif': 'image',
    '.svg': 'image',
    '.webp': 'image',
    '.bmp': 'image',
    '.tiff': 'image',
    // Programming language files
    '.js': 'programming',
    '.py': 'programming',
    '.java': 'programming',
    '.c': 'programming',
    '.cpp': 'programming',
    '.cs': 'programming',
    '.php': 'programming',
    '.html': 'programming',
    '.css': 'programming',
    '.rb': 'programming',
    '.go': 'programming',
    '.swift': 'programming',
    '.ts': 'programming',
    '.rs': 'programming'
  };
  
  return typeMap[extension] || 'unknown';
}

// Function to get file info
function getFileInfo(filePath: string): any {
  try {
    const stats = fs.statSync(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    const fileSize = formatFileSize(stats.size);
    const fileType = detectFileType(filePath);
    
    return {
      path: filePath,
      name: fileName,
      extension: extension,
      type: fileType,
      size: fileSize,
      lastModified: stats.mtime
    };
  } catch (error) {
    console.error('Error getting file info:', error);
    return null;
  }
}

// Format file size to human-readable format
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

// PDF to text converter
async function convertPDFToText(filePath: string): Promise<any> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    
    return {
      success: true,
      text: data.text,
      info: {
        pageCount: data.numpages,
        author: data.info?.Author || 'Unknown',
        creator: data.info?.Creator || 'Unknown',
        producer: data.info?.Producer || 'Unknown'
      }
    };
  } catch (error) {
    console.error('PDF conversion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Word document to text converter
async function convertWordToText(filePath: string): Promise<any> {
  try {
    // Extract raw text
    const result = await mammoth.extractRawText({ path: filePath });
    // Optionally get HTML version
    const htmlResult = await mammoth.convertToHtml({ path: filePath });
    
    return {
      success: true,
      text: result.value,
      html: htmlResult.value,
      warnings: [...result.messages, ...htmlResult.messages]
    };
  } catch (error) {
    console.error('Word conversion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to convert Word document'
    };
  }
}

// Excel to text converter
function convertExcelToText(filePath: string): any {
  try {
    const workbook = XLSX.readFile(filePath);
    let result = '';
    let sheetData: Record<string, any[]> = {};
    
    // Process each sheet
    workbook.SheetNames.forEach((sheetName: string) => {
      const worksheet = workbook.Sheets[sheetName];
      
      // Get text representation
      const sheetText = XLSX.utils.sheet_to_txt(worksheet);
      
      // Get JSON representation
      const sheetJson = XLSX.utils.sheet_to_json(worksheet);
      
      result += `Sheet: ${sheetName}\n\n${sheetText}\n\n`;
      sheetData[sheetName] = sheetJson;
    });
    
    return {
      success: true,
      text: result,
      data: sheetData,
      sheets: workbook.SheetNames
    };
  } catch (error) {
    console.error('Excel conversion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to convert Excel file'
    };
  }
}

// PowerPoint to text converter
async function convertPowerPointToText(filePath: string): Promise<any> {
  try {
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();
    
    // Array to store slide content
    const slides: Array<{number: number, content: string}> = [];
    
    // Extract content from slide XML files
    zipEntries.forEach((zipEntry: any) => {
      // Look for slide content in ppt/slides/slide*.xml files
      if (zipEntry.entryName.match(/ppt\/slides\/slide[0-9]+\.xml/)) {
        const slideNumberMatch = zipEntry.entryName.match(/slide([0-9]+)\.xml/);
        if (slideNumberMatch) {
          const slideNumber = parseInt(slideNumberMatch[1]);
          const content = zipEntry.getData().toString('utf8');
          
          // Extract text content from XML using regex
          const textContent = extractTextFromSlideXML(content);
          
          slides.push({
            number: slideNumber,
            content: textContent
          });
        }
      }
    });
    
    // Sort slides by number
    slides.sort((a, b) => a.number - b.number);
    
    // Format the slides with index numbers
    let formattedText = '';
    slides.forEach(slide => {
      formattedText += `Slide ${slide.number}:\n${slide.content}\n\n`;
    });
    
    return {
      success: true,
      text: formattedText,
      slides: slides.map(s => s.content),
      slideCount: slides.length
    };
  } catch (error) {
    console.error('PowerPoint conversion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to convert PowerPoint file'
    };
  }
}

// Extract text content from slide XML
function extractTextFromSlideXML(xmlContent: string): string {
  // Extract text within <a:t> tags which contain slide text
  const textRegex = /<a:t[^>]*>(.*?)<\/a:t>/g;
  let match;
  let extractedText: string[] = [];
  
  while ((match = textRegex.exec(xmlContent)) !== null) {
    // Get the text content and decode XML entities
    const text = decodeXMLEntities(match[1].trim());
    if (text) {
      extractedText.push(text);
    }
  }
  
  return extractedText.join('\n');
}

// Decode XML entities like &amp; &lt; etc.
function decodeXMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Text/Programming file to text converter (basically just reads the file)
function convertTextToText(filePath: string): any {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const extension = path.extname(filePath).toLowerCase();
    
    // Determine if it's a programming file based on extension
    const programmingExtensions = ['.js', '.py', '.java', '.c', '.cpp', '.cs', '.php', '.html', '.css', '.rb', '.go', '.swift', '.ts', '.rs'];
    const isProgrammingFile = programmingExtensions.includes(extension);
    
    return {
      success: true,
      text: content,
      isCode: isProgrammingFile,
      language: isProgrammingFile ? extension.substring(1) : 'text'
    };
  } catch (error) {
    console.error('Text conversion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read text file'
    };
  }
}

// JSON to text converter
function convertJSONToText(filePath: string): any {
  try {
    const jsonContent = fs.readFileSync(filePath, 'utf8');
    let parsedJSON;
    
    try {
      // Attempt to parse JSON
      parsedJSON = JSON.parse(jsonContent);
      
      // Format JSON with indentation
      const formattedJSON = JSON.stringify(parsedJSON, null, 2);
      
      return {
        success: true,
        text: formattedJSON,
        data: parsedJSON,
        isValid: true
      };
    } catch (parseError) {
      // Return raw content if parsing fails
      return {
        success: true,
        text: jsonContent,
        error: parseError instanceof Error ? parseError.message : String(parseError),
        isValid: false
      };
    }
  } catch (error) {
    console.error('JSON conversion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read JSON file'
    };
  }
}

// Markdown to text converter
function convertMarkdownToText(filePath: string): any {
  try {
    const mdContent = fs.readFileSync(filePath, 'utf8');
    
    // Convert to HTML
    const htmlContent = marked.parse(mdContent);
    
    return {
      success: true,
      text: mdContent,
      html: htmlContent,
      markdownAndHtml: `Raw Markdown:\n\n${mdContent}\n\n----\n\nConverted HTML:\n\n${htmlContent}`
    };
  } catch (error) {
    console.error('Markdown conversion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to convert Markdown file'
    };
  }
}

function convertImageToDataURL(filePath: string): any {
  try {
    // Read the image file as binary data
    const imageBuffer = fs.readFileSync(filePath);
    
    // Get the MIME type based on file extension
    const extension = path.extname(filePath).toLowerCase();
    const mimeTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff'
    };
    
    const mimeType = mimeTypeMap[extension] || 'application/octet-stream';
    
    // Convert to base64 and create a data URL
    const base64Data = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    
    return {
      success: true,
      text: dataUrl, // This is the key value that the frontend is checking for
      isImage: true,
      format: extension.substring(1).toUpperCase()
    };
  } catch (error) {
    console.error('Image conversion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to convert image file'
    };
  }
}

// Main converter function that routes to the appropriate converter
export async function convertFileToText(filePath: string): Promise<any> {
  try {
    const fileType = detectFileType(filePath);
    const fileInfo = getFileInfo(filePath);
    let result;

    switch (fileType) {
      case 'pdf':
        result = await convertPDFToText(filePath);
        break;
      case 'word':
        result = await convertWordToText(filePath);
        break;
      case 'excel':
        result = convertExcelToText(filePath);
        break;
      case 'powerpoint':
        result = await convertPowerPointToText(filePath);
        break;
      case 'json':
        result = convertJSONToText(filePath);
        break;
      case 'markdown':
        result = convertMarkdownToText(filePath);
        break;
      case 'image':
        result = convertImageToDataURL(filePath); // Add this case
        break;
      case 'text':
      case 'programming':
      default:
        result = convertTextToText(filePath);
        break;
    }

    // Add file info to the result
    return {
      ...result,
      fileInfo
    };
  } catch (error) {
    console.error('Conversion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to convert file'
    };
  }
}

export {
  convertPDFToText,
  convertWordToText,
  convertExcelToText,
  convertPowerPointToText,
  convertTextToText,
  convertJSONToText,
  convertMarkdownToText,
  convertImageToDataURL,
  detectFileType,
  getFileInfo
};