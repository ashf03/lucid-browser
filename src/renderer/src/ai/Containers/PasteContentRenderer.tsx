import React from 'react';

interface PasteContentRendererProps {
  content: string;
  startMarker: string;
  endMarker: string;
  renderContent: (text: string) => React.ReactNode;
  renderPaste: (
    pasteContent: string, 
    index: number, 
    metadata?: {
      isFile?: boolean;
      fileInfo?: {
        name: string;
        type?: string;
        extension?: string;
        size?: string;
      }
    }
  ) => React.ReactNode;
  isGenerating?: boolean;
  isUserMessage?: boolean;
}

export const PasteContentRenderer: React.FC<PasteContentRendererProps> = ({
  content,
  startMarker,
  endMarker,
  renderContent,
  renderPaste,
  isGenerating = false,
  isUserMessage = false
}) => {
  // Split the content by start markers
  const parts = content.split(startMarker);
  
  // If no markers found, render normally
  if (parts.length === 1) {
    return <span className='text-xl'>{renderContent(content)}</span>;
  }
  
  return (
    <div className="flex flex-col w-full gap-1">
      {/* Render all paste/file boxes in a horizontal scrollable container FIRST */}
      <div className="w-full overflow-x-auto sidebar-scrollbar">
        <div className="flex flex-row gap-2 pb-1">
          {parts.slice(1).map((part, index) => {
            // Get the paste content (everything before the end marker)
            const [pasteContent] = part.split(endMarker, 1);
            
            // Check if this is a file upload (starts with FILE:)
            if (pasteContent.startsWith('FILE:')) {
              try {
                // The proper way to parse FILE: prefix with JSON content
                // Format is: FILE:{json-object}:file-content
                
                // First, find the second colon after FILE:
                let jsonStr = '';
                let fileContent = '';
                let jsonStarted = false;
                let jsonEnded = false;
                let bracketCount = 0;
                
                // Skip the first 5 characters (FILE:)
                for (let i = 5; i < pasteContent.length; i++) {
                  const char = pasteContent[i];
                  
                  if (!jsonStarted && char === '{') {
                    jsonStarted = true;
                    bracketCount = 1;
                    jsonStr += char;
                  } else if (jsonStarted && !jsonEnded) {
                    jsonStr += char;
                    
                    if (char === '{') bracketCount++;
                    if (char === '}') bracketCount--;
                    
                    // When we've closed all brackets, the JSON is complete
                    if (bracketCount === 0) {
                      jsonEnded = true;
                      // The next character should be the colon separator
                      if (i + 1 < pasteContent.length && pasteContent[i + 1] === ':') {
                        // Skip the separator colon
                        fileContent = pasteContent.substring(i + 2);
                      } else {
                        // If no colon, just take the rest as content
                        fileContent = pasteContent.substring(i + 1);
                      }
                      break;
                    }
                  }
                }
                
                if (jsonStarted && jsonEnded) {
                  try {
                    const fileInfo = JSON.parse(jsonStr);
                    
                    return (
                      <div key={`paste-${index}`} className="flex-shrink-0">
                        {renderPaste(fileContent, index, {
                          isFile: true,
                          fileInfo
                        })}
                      </div>
                    );
                  } catch (error) {
                    console.error('Error parsing file info JSON:', error);
                    console.error('Attempted to parse:', jsonStr);
                  }
                }
              } catch (error) {
                console.error('Error processing file paste:', error);
              }
            }
            
            // Regular paste or fallback for file parsing errors
            return (
              <div key={`paste-${index}`} className="flex-shrink-0">
                {renderPaste(pasteContent, index)}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Render all text content SECOND (below the paste containers) */}
      <div className="w-full">
        {/* First part (before any markers) */}
        {parts[0] && renderContent(parts[0])}
        
        {/* Process remaining parts to get text after each paste */}
        {parts.slice(1).map((part, index) => {
          // Split each part by end marker
          const [, remainingText] = part.split(endMarker, 2);
          
          return remainingText ? (
            <React.Fragment key={`text-${index}`}>
              <span className='text-xl'>
              {renderContent(remainingText)}
              </span>
            </React.Fragment>
          ) : null;
        })}
      </div>
    </div>
  );
};