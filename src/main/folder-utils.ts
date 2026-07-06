import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { convertFileToText } from './file-converters';

// Type definitions for folder structure
export interface FileNode {
  name: string;
  type: 'file';
  path: string;
  extension: string;
  size: string;
  content?: string;
  converted: boolean;
}

export interface FolderNode {
  name: string;
  type: 'folder';
  path: string;
  size: string;
  children: (FileNode | FolderNode)[];
}

export type TreeNode = FileNode | FolderNode;

// Format file size in a human-readable format
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get file extension
export function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

// Check if a file is supported for conversion
export function isSupportedFile(filePath: string): boolean {
  const extension = getFileExtension(filePath);
  const supportedExtensions = [
    '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.txt',
    '.js', '.py', '.java', '.json', '.md', '.c', '.cpp', '.cs', '.html',
    '.css', '.rb', '.go', '.swift', '.ts', '.rs'
  ];
  
  return supportedExtensions.includes(extension);
}

// Process a folder recursively and build a tree structure
export async function processFolderRecursively(folderPath: string): Promise<FolderNode> {
  const folderName = path.basename(folderPath);
  const stats = fs.statSync(folderPath);
  
  const children: TreeNode[] = [];
  const folderNode: FolderNode = {
    name: folderName,
    type: 'folder',
    path: folderPath,
    size: formatFileSize(stats.size),
    children: children
  };
  
  const items = fs.readdirSync(folderPath);
  
  for (const item of items) {
    const itemPath = path.join(folderPath, item);
    const itemStats = fs.statSync(itemPath);
    
    if (itemStats.isDirectory()) {
      // Recursively process subfolder
      const subFolder = await processFolderRecursively(itemPath);
      children.push(subFolder);
    } else {
      // Process file
      const extension = getFileExtension(itemPath);
      const fileNode: FileNode = {
        name: item,
        type: 'file',
        path: itemPath,
        extension: extension,
        size: formatFileSize(itemStats.size),
        converted: false
      };
      
      // If the file is supported, convert it to text
      if (isSupportedFile(itemPath)) {
        try {
          const result = await convertFileToText(itemPath);
          if (result.success) {
            fileNode.content = result.text;
            fileNode.converted = true;
          }
        } catch (error) {
          console.error(`Error converting file ${itemPath}:`, error);
        }
      } else {
        // For unsupported files, store a message
        fileNode.content = `[File type ${extension} is not supported for text conversion]`;
      }
      
      children.push(fileNode);
    }
  }
  
  return folderNode;
}

// Process a ZIP file and extract its contents
export async function processZipFile(zipFilePath: string): Promise<FolderNode> {
  const zipFileName = path.basename(zipFilePath, path.extname(zipFilePath));
  const tempFolderPath = path.join(require('os').tmpdir(), `zip-extract-${Date.now()}-${zipFileName}`);
  
  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempFolderPath)) {
    fs.mkdirSync(tempFolderPath, { recursive: true });
  }
  
  // Extract ZIP file
  const zip = new AdmZip(zipFilePath);
  zip.extractAllTo(tempFolderPath, true);
  
  // Process the extracted folder
  const result = await processFolderRecursively(tempFolderPath);
  
  // Rename the root folder to match the ZIP file name
  result.name = zipFileName;
  result.path = zipFilePath;
  
  return result;
}

// Generate a combined text representation of the folder structure
export function generateFolderTextContent(node: TreeNode, level: number = 0): string {
  const indent = '  '.repeat(level);
  
  if (node.type === 'file') {
    return `${indent}📄 ${node.name}${node.content ? '\n' + indent + '  ' + node.content.split('\n').join('\n' + indent + '  ').substring(0, 500) + (node.content.length > 500 ? '...' : '') : ''}`;
  } else {
    let result = `${indent}📁 ${node.name}/\n`;
    
    for (const child of node.children) {
      result += generateFolderTextContent(child, level + 1) + '\n';
    }
    
    return result;
  }
}

// Convert a folder structure to a flat object for storage in the file box
export function flattenFolderStructure(node: TreeNode): {
  name: string;
  type: string;
  size: string;
  fileCount: number;
  folderCount: number;
  textContent: string;
} {
  let fileCount = 0;
  let folderCount = 0;
  const textContent = generateFolderTextContent(node);
  
  // Count files and folders
  function countNodes(node: TreeNode) {
    if (node.type === 'file') {
      fileCount++;
    } else {
      folderCount++;
      for (const child of node.children) {
        countNodes(child);
      }
    }
  }
  
  countNodes(node);
  
  // For the root node (which is a folder), subtract 1 from folderCount
  // as we don't want to count the root itself
  if (node.type === 'folder') {
    folderCount--;
  }
  
  return {
    name: node.name,
    type: node.type === 'folder' ? 'folder' : path.extname(node.name).substring(1) || 'file',
    size: node.size,
    fileCount,
    folderCount,
    textContent
  };
}