// src/renderer/services/PrintService.ts
// This service handles communication with Electron's print API

// Function to generate PDF preview from a webview
export const generateWebViewPDFPreview = async (
  webContentsId: number
): Promise<string> => {
  try {
    // Generate PDF preview using Electron's printToPDF API
    const pdfData = await window.electronAPI.print.generatePDFPreview(webContentsId);
    
    // Return the base64 data URL
    return `data:application/pdf;base64,${pdfData}`;
  } catch (error) {
    console.error('Failed to generate web preview:', error);
    throw error;
  }
};

// Function to print a webview using the system print dialog
export const printWebContents = async (webContentsId: number): Promise<void> => {
  return window.electronAPI.print.printWebContents(webContentsId);
};

// Function to open system print dialog for a PDF data URL
export const printDataUrl = async (dataUrl: string): Promise<void> => {
  return window.electronAPI.print.printDataUrl(dataUrl);
};