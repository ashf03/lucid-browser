import {
  ArrowClockwise,
  ArrowLeft,
  ArrowRight,
  Camera,
  CaretLeft,
  CaretRight,
  DotsSixVertical,
  GlobeSimple,
  NavigationArrow,
  PencilSimple,
  User,
  X
} from '@phosphor-icons/react'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Panel } from './Editor/Panel'
import { Button } from '../ui/button'
import TextSelectionMenu from './Editor/TextSelectionMenu'
import TodoItem from './Editor/TodoItem'
import List, { ListItemData } from './Editor/List'
import 'katex/dist/katex.min.css'
import LaTeXComponent from './Editor/LaTeXComponent'
import CodeEditor from './Editor/CodeEditor'
import Minimap from './Editor/Minimap'

interface EditorProps {
  tabId: string
  updateTabState?: (tabId: string, updates: Partial<any>) => void
  addTab?: (url?: string, options?: { type?: 'standard' | 'tool'; toolType?: 'Asterisk' }) => void
  onOpenPictureInPictureFromUrl?: (url: string, title?: string) => void
  isSidebarHovering?: boolean // Add prop for sidebar hover state
}

interface SelectionRectangle {
  startX: number
  startY: number
  width: number
  height: number
}

interface TodoItem {
  id: string
  content: string
  checked: boolean
}

interface TextAreaItem {
  id: string
  content: string
  format: 'normal' | 'todoList' | 'bulletList' | 'numberedList' | 'code' | 'latex'
  position: { x: number; y: number }
  todoItems?: TodoItem[]
  listItems?: ListItemData[]
  language?: string
  isBlockLatex?: boolean
  zIndex?: number
  fontFamily?: string
}

interface WebViewItem {
  id: string
  url: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  zIndex: number
  resizeHandle?:
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'top'
    | 'right'
    | 'bottom'
    | 'left'
}

type ToolType = 'cursor' | 'hand'

type PlacementMode =
  | 'inactive'
  | 'normal'
  | 'todoList'
  | 'bulletList'
  | 'numberedList'
  | 'code'
  | 'latex'
  | 'browser'
  | 'image-upload'
  | 'video-upload'
  | 'audio-upload'
  | 'media-upload'
  | 'file-upload'

interface PlacementOptions {
  latexBlockMode?: boolean
  imageData?: {
    src: string
    width: number
    height: number
    naturalWidth: number
    naturalHeight: number
  }
  videoData?: {
    src: string
    width: number
    height: number
    filename: string
  }
  audioData?: {
    src: string
    width: number
    height: number
    filename: string
  }
  fileData?: {
    filename: string
    documentType: DocumentType
    documentData: DocumentData
    width: number
    height: number
    // Store all the processed data here, don't add to files array yet
    pdfUrl?: string
    slides?: Slide[]
    spreadsheetData?: SpreadsheetData
    documentContent?: string
  }
}

interface DrawPoint {
  x: number
  y: number
  pressure?: number // For pressure-sensitive drawing if supported
}

interface DrawPath {
  id: string
  points: DrawPoint[]
  color: string
  width: number
  type: 'pen' | 'shape' | 'arrow'
  shapeType?: 'rectangle' | 'circle' | 'triangle' // Add this new property
}

interface ImageItem {
  id: string
  src: string
  width: number
  height: number
  x: number
  y: number
  naturalWidth: number
  naturalHeight: number
  zIndex: number
}

interface VideoItem {
  id: string
  src: string
  filename: string
  width: number
  height: number
  x: number
  y: number
  zIndex: number
}

interface AudioItem {
  id: string
  src: string
  filename: string
  width: number
  height: number
  x: number
  y: number
  zIndex: number
}

interface DocumentData {
  data: string
  filename: string
  type: string
  path?: string
}

interface Slide {
  title: string
  content: string[]
  images?: string[]
}

interface SpreadsheetData {
  workbook: any
  currentSheet: any
  currentSheetName: string
  sheetNames: string[]
}

interface CapturedImageItem extends ImageItem {
  sourceUrl?: string
  sourceTitle?: string
  timestamp?: Date
}

type DocumentType =
  | 'pdf'
  | 'word'
  | 'presentation'
  | 'spreadsheet'
  | 'text'
  | 'json'
  | 'xml'
  | 'html'
  | 'code'

interface FileItem {
  id: string
  filename: string
  documentType: DocumentType
  documentData: DocumentData | null
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  pdfUrl?: string | null
  slides?: Slide[]
  currentSlideIndex?: number
  spreadsheetData?: SpreadsheetData | null
  documentContent?: string
  scale?: number
  loading?: boolean
  error?: string | null
  codeLanguage?: string
  isCodeEditMode?: boolean
  cursorPosition?: string
}

const languageMap: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  java: 'java',
  kt: 'kotlin',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  c: 'c',
  h: 'c',
  hpp: 'cpp',
  css: 'css',
  scss: 'css',
  sass: 'css',
  html: 'html',
  htm: 'html',
  php: 'php',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  swift: 'swift',
  dart: 'dart',
  vue: 'html',
  json: 'json',
  xml: 'xml',
  yml: 'yaml',
  yaml: 'yaml',
  md: 'markdown',
  markdown: 'markdown',
  sh: 'bash',
  bash: 'bash',
  bat: 'batch',
  ps1: 'powershell',
  sql: 'sql'
}

const codeFileExtensions = [
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'java',
  'kt',
  'cpp',
  'cc',
  'cxx',
  'c',
  'h',
  'hpp',
  'css',
  'scss',
  'sass',
  'html',
  'htm',
  'php',
  'rb',
  'go',
  'rs',
  'swift',
  'dart',
  'vue',
  'yml',
  'yaml',
  'md',
  'markdown',
  'sh',
  'bash',
  'bat',
  'ps1',
  'sql'
]
const Editor: React.FC<EditorProps> = ({
  tabId,
  updateTabState,
  addTab,
  onOpenPictureInPictureFromUrl,
  isSidebarHovering = false
}) => {
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionRect, setSelectionRect] = useState<SelectionRectangle | null>(null)
  // Initialize empty array for text areas - they'll be added on double-click
  const [textAreas, setTextAreas] = useState<TextAreaItem[]>([])
  const [focusedTextAreaId, setFocusedTextAreaId] = useState<string | null>(null)
  const [hoveredTextAreaId, setHoveredTextAreaId] = useState<string | null>(null)

  const [webViews, setWebViews] = useState<WebViewItem[]>([])
  const [draggedWebViewId, setDraggedWebViewId] = useState<string | null>(null)
  const [resizingWebViewId, setResizingWebViewId] = useState<string | null>(null)
  const webViewDragOffset = useRef<{ x: number; y: number } | null>(null)
  const webViewResizeStartPos = useRef<{ x: number; y: number } | null>(null)
  const webViewResizeStartSize = useRef<{ width: number; height: number } | null>(null)

  const [images, setImages] = useState<CapturedImageItem[]>([])
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([])
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null)
  const [resizingImageId, setResizingImageId] = useState<string | null>(null)
  const imageDragOffset = useRef<{ x: number; y: number } | null>(null)
  const imageResizeStartPos = useRef<{ x: number; y: number } | null>(null)
  const imageResizeStartSize = useRef<{ width: number; height: number } | null>(null)
  const imageResizeStartPosition = useRef<{ x: number; y: number } | null>(null)
  const [activeImageResizeHandle, setActiveImageResizeHandle] = useState<
    'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'right' | 'bottom' | 'left'
  >()

  const fileInputRef = useRef<HTMLInputElement>(null)

  // State for canvas offset (infinite canvas panning)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  const [activeTool, setActiveTool] = useState<ToolType>('cursor')
  const [isPanning, setIsPanning] = useState(false)
  const lastMousePos = useRef<{ x: number; y: number } | null>(null)

  // State for command menu
  const [showCommandMenu, setShowCommandMenu] = useState<boolean>(false)
  const [commandMenuTextAreaId, setCommandMenuTextAreaId] = useState<string | null>(null)

  // New state for text selection context menu
  const [selectedText, setSelectedText] = useState<string>('')
  const [isTextSelected, setIsTextSelected] = useState<boolean>(false)
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null)
  const [showSelectionMenu, setShowSelectionMenu] = useState<boolean>(false)
  const [currentTextAreaId, setCurrentTextAreaId] = useState<string | null>(null)

  const [openedFromPanel, setOpenedFromPanel] = useState(false)

  // New state for dragging text areas
  const [draggedTextAreaId, setDraggedTextAreaId] = useState<string | null>(null)
  const dragOffset = useRef<{ x: number; y: number } | null>(null)

  // New state for multi-selection
  const [selectedTextAreaIds, setSelectedTextAreaIds] = useState<string[]>([])
  const [clipboardContent, setClipboardContent] = useState<TextAreaItem[]>([])

  // New state for element placement
  const [placementMode, setPlacementMode] = useState<PlacementMode>('inactive')
  const [placementOptions, setPlacementOptions] = useState<PlacementOptions>({})

  const editorRef = useRef<HTMLDivElement>(null)
  const startPositionRef = useRef<{ x: number; y: number } | null>(null)

  const [drawingMode, setDrawingMode] = useState<'pen' | 'shape' | 'arrow' | 'none'>('none')
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentPath, setCurrentPath] = useState<DrawPoint[]>([])
  const [drawPaths, setDrawPaths] = useState<DrawPath[]>([])
  const [drawColor, setDrawColor] = useState('#000000')
  const [drawWidth, setDrawWidth] = useState(3)

  const [selectedDrawPathIds, setSelectedDrawPathIds] = useState<string[]>([])
  const [selectedDrawPathId, setSelectedDrawPathId] = useState<string | null>(null)
  const [draggedDrawPathId, setDraggedDrawPathId] = useState<string | null>(null)
  const pathDragOffset = useRef<{ x: number; y: number } | null>(null)

  const [currentShapeType, setCurrentShapeType] = useState<'rectangle' | 'circle' | 'triangle'>(
    'rectangle'
  )

  const [audios, setAudios] = useState<AudioItem[]>([])
  const [selectedAudioIds, setSelectedAudioIds] = useState<string[]>([])
  const [draggedAudioId, setDraggedAudioId] = useState<string | null>(null)
  const [resizingAudioId, setResizingAudioId] = useState<string | null>(null)
  const audioDragOffset = useRef<{ x: number; y: number } | null>(null)
  const audioResizeStartPos = useRef<{ x: number; y: number } | null>(null)
  const audioResizeStartSize = useRef<{ width: number; height: number } | null>(null)
  const audioResizeStartPosition = useRef<{ x: number; y: number } | null>(null)
  const [activeAudioResizeHandle, setActiveAudioResizeHandle] = useState<
    'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'right' | 'bottom' | 'left'
  >()
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())

  const [files, setFiles] = useState<FileItem[]>([])
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null)
  const [resizingFileId, setResizingFileId] = useState<string | null>(null)
  const fileDragOffset = useRef<{ x: number; y: number } | null>(null)
  const fileResizeStartPos = useRef<{ x: number; y: number } | null>(null)
  const fileResizeStartSize = useRef<{ width: number; height: number } | null>(null)
  const fileResizeStartPosition = useRef<{ x: number; y: number } | null>(null)
  const [activeFileResizeHandle, setActiveFileResizeHandle] = useState<
    'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'right' | 'bottom' | 'left'
  >()

  // Add this to your existing file input ref
  const universalFileInputRef = useRef<HTMLInputElement>(null)

  const codeFileInputRef = useRef<HTMLInputElement>(null)

  const getFileTypeFromName = (filename: string): DocumentType => {
    const ext = filename.toLowerCase().split('.').pop()

    if (ext === 'pdf') return 'pdf'
    if (['docx', 'doc'].includes(ext!)) return 'word'
    if (['pptx', 'ppt', 'odp'].includes(ext!)) return 'presentation'
    if (['xlsx', 'xls'].includes(ext!)) return 'spreadsheet'

    // CHECK FOR CODE FILES FIRST (before text)
    if (codeFileExtensions.includes(ext!)) return 'code'

    if (['txt', 'csv', 'log', 'rtf'].includes(ext!)) return 'text' // Removed 'md' from here since it's a code file
    if (ext === 'json') return 'json'
    if (ext === 'xml') return 'xml'
    if (['html', 'htm'].includes(ext!)) return 'code' // HTML is now a code file

    return 'text' // Default fallback
  }

  // Generate file ID
  const generateFileId = () => `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const openCodeFileUpload = () => {
    codeFileInputRef.current?.click()
  }

  const handleDrawPathClick = (e: React.MouseEvent, pathId: string) => {
    e.stopPropagation()

    // If we're in drawing mode, don't allow selection
    if (drawingMode !== 'none') return

    // Set both the single-selection and multi-selection states
    setSelectedDrawPathId(pathId)

    // Handle shift-click for multiple selection
    if (e.shiftKey) {
      setSelectedDrawPathIds(
        (prev) =>
          prev.includes(pathId)
            ? prev.filter((id) => id !== pathId) // Toggle off if already selected
            : [...prev, pathId] // Add to selection
      )
    } else {
      // Single-click selects only this drawing
      setSelectedDrawPathIds([pathId])
      setSelectedTextAreaIds([]) // Clear text area selections
    }
  }

  const loadPDF = async (data: DocumentData, fileId: string) => {
    try {
      const file = files.find((f) => f.id === fileId)
      if (!file) return

      if (file.pdfUrl) {
        URL.revokeObjectURL(file.pdfUrl)
      }

      const binaryString = atob(data.data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)

      setFiles((prev) => prev.map((item) => (item.id === fileId ? { ...item, pdfUrl: url } : item)))
    } catch (err) {
      console.error('PDF loading error:', err)
      throw new Error('Failed to load PDF document')
    }
  }

  // Word document loading
  const loadWordDocument = async (data: DocumentData, fileId: string) => {
    if (!(window as any).mammoth) {
      throw new Error('Mammoth not loaded')
    }

    const binaryString = atob(data.data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    const result = await (window as any).mammoth.convertToHtml({ arrayBuffer: bytes.buffer })

    setFiles((prev) =>
      prev.map((item) => (item.id === fileId ? { ...item, documentContent: result.value } : item))
    )
  }

  // Text document loading
  const loadTextDocument = async (data: DocumentData, fileId: string) => {
    let content = data.data

    if (data.type === 'json') {
      try {
        const parsed = JSON.parse(content)
        content = JSON.stringify(parsed, null, 2)
      } catch (e) {
        // Keep original if parsing fails
      }
    }

    setFiles((prev) =>
      prev.map((item) => (item.id === fileId ? { ...item, documentContent: content } : item))
    )
  }

  // Create fallback slides (matching vanilla version)
  const createFallbackSlides = (): Slide[] => {
    return [
      {
        title: 'Presentation Loaded',
        content: [
          'This is a PowerPoint presentation.',
          'Full parsing capabilities are being developed.',
          'Basic slide navigation is available.'
        ]
      },
      {
        title: 'Slide Navigation',
        content: [
          'Use the Previous/Next Slide buttons to navigate.',
          'Or use the slide number input.',
          'Press F for fullscreen mode.'
        ]
      },
      {
        title: 'Features',
        content: [
          '• Zoom in and out',
          '• Fullscreen presentation mode',
          '• Keyboard navigation',
          '• Modern interface'
        ]
      }
    ]
  }

  // Extract slides from PPTX (exactly matching vanilla approach)
  const extractSlidesFromPPTX = async (zip: any): Promise<Slide[]> => {
    const slides: Slide[] = []

    try {
      // Get slide files from the zip (same logic as vanilla)
      const slideFiles = Object.keys(zip.files).filter(
        (filename: string) => filename.startsWith('ppt/slides/slide') && filename.endsWith('.xml')
      )

      // Sort slides by number (same as vanilla)
      slideFiles.sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0')
        const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0')
        return numA - numB
      })

      // Extract content from each slide (same as vanilla)
      for (const slideFile of slideFiles) {
        try {
          const slideXml = await zip.files[slideFile].async('text')
          const slideContent = parseSlideXML(slideXml)
          slides.push(slideContent)
        } catch (slideErr) {
          console.warn(`Error parsing slide:`, slideErr)
          slides.push({
            title: 'Slide Content',
            content: ['Unable to parse slide content']
          })
        }
      }
    } catch (err) {
      console.error('Error extracting slides:', err)
    }

    return slides
  }

  // Parse slide XML (exactly matching vanilla version)
  const parseSlideXML = (xml: string): Slide => {
    const slide: Slide = {
      title: '',
      content: []
    }

    try {
      // Extract text content using regex (same approach as vanilla)
      const textMatches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g)
      if (textMatches) {
        const texts = textMatches
          .map((match) => {
            const text = match.replace(/<[^>]*>/g, '').trim()
            return text
          })
          .filter((text) => text.length > 0)

        if (texts.length > 0) {
          slide.title = texts[0]
          slide.content = texts.slice(1)
        }
      }

      if (slide.content.length === 0) {
        slide.title = 'Slide Content'
        slide.content = ['Unable to parse slide content']
      }
    } catch (err) {
      console.warn('Error parsing slide XML:', err)
      slide.title = 'Slide Content'
      slide.content = ['Unable to parse slide content']
    }

    return slide
  }

  useEffect(() => {
    const loadLibraries = async () => {
      const libraries = [
        'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      ]

      for (const lib of libraries) {
        if (!document.querySelector(`script[src="${lib}"]`)) {
          const script = document.createElement('script')
          script.src = lib
          document.head.appendChild(script)
        }
      }
    }

    loadLibraries()
  }, [])

  useEffect(() => {
    return () => {
      // Cleanup file URLs on unmount
      files.forEach((file) => {
        if (file.pdfUrl) {
          URL.revokeObjectURL(file.pdfUrl)
        }
      })
    }
  }, [files])

  const handleUniversalFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    console.log('Selected file:', {
      name: file.name,
      type: file.type,
      size: file.size
    })

    // Check if it's a media file first (images, videos, audio)
    const fileName = file.name.toLowerCase()
    const ext = fileName.substring(fileName.lastIndexOf('.'))

    if (file.type.startsWith('image/')) {
      // Handle image files
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        addImageToEditor(url, img.naturalWidth, img.naturalHeight)
      }
      img.src = url
      return
    } else if (videoExtensions.includes(ext)) {
      // Handle video files
      const url = URL.createObjectURL(file)
      addVideoToEditor(url, file.name)
      return
    } else if (audioExtensions.includes(ext)) {
      // Handle audio files
      const url = URL.createObjectURL(file)
      addAudioToEditor(url, file.name)
      return
    }

    // For non-media files, continue with document/code processing
    const fileType = getFileTypeFromName(file.name)
    console.log('Detected file type:', fileType)

    try {
      const data: DocumentData = {
        filename: file.name,
        type: fileType,
        data: '',
        path: undefined
      }

      // Read file data based on type
      if (['text', 'json', 'xml', 'html', 'code'].includes(fileType)) {
        // For text/code files, read directly as text
        console.log('Reading as text file...')
        data.data = await file.text()
        console.log('Text content read, length:', data.data.length)
      } else {
        // For binary files (PDF, Word, PowerPoint, Excel), convert to base64
        console.log('Reading as binary file...')
        const arrayBuffer = await file.arrayBuffer()
        const bytes = new Uint8Array(arrayBuffer)

        // Convert to base64 in chunks to avoid call stack overflow
        let binaryString = ''
        const chunkSize = 8192
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.slice(i, i + chunkSize)
          binaryString += String.fromCharCode.apply(null, Array.from(chunk))
        }
        data.data = btoa(binaryString)
        console.log('Binary data converted to base64, length:', data.data.length)
      }

      // Process the file and store ALL data in placement options
      const fileData: PlacementOptions['fileData'] = {
        filename: file.name,
        documentType: fileType,
        documentData: data,
        width: fileType === 'code' ? 800 : 600, // Wider for code files
        height: fileType === 'code' ? 600 : 400 // Taller for code files
      }

      console.log('Processing file type:', data.type)

      // Process file based on type and store results in fileData
      switch (data.type) {
        case 'pdf':
          console.log('Processing PDF...')
          try {
            const binaryString = atob(data.data)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
            const blob = new Blob([bytes], { type: 'application/pdf' })
            const url = URL.createObjectURL(blob)
            fileData.pdfUrl = url
            console.log('PDF blob URL created:', url)
          } catch (err) {
            console.error('PDF loading error:', err)
          }
          break

        case 'word':
          console.log('Processing Word document...')
          if ((window as any).mammoth) {
            try {
              const binaryString = atob(data.data)
              const bytes = new Uint8Array(binaryString.length)
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i)
              }
              const result = await (window as any).mammoth.convertToHtml({
                arrayBuffer: bytes.buffer
              })
              fileData.documentContent = result.value
              console.log('Word document converted, content length:', result.value.length)
            } catch (err) {
              console.error('Word loading error:', err)
              fileData.documentContent = `Error loading Word document: ${err}`
            }
          } else {
            console.warn('Mammoth library not loaded')
            fileData.documentContent =
              'Word document viewer not available. Please install mammoth library.'
          }
          break

        case 'presentation':
          console.log('Processing presentation...')
          try {
            if (data.filename.toLowerCase().endsWith('.pptx') && (window as any).JSZip) {
              const binaryString = atob(data.data)
              const bytes = new Uint8Array(binaryString.length)
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i)
              }
              const zip = await (window as any).JSZip.loadAsync(bytes.buffer)
              const extractedSlides = await extractSlidesFromPPTX(zip)
              fileData.slides =
                extractedSlides.length > 0 ? extractedSlides : createFallbackSlides()
              console.log('Presentation processed, slides:', fileData.slides.length)
            } else {
              fileData.slides = createFallbackSlides()
              console.log('Using fallback slides for presentation')
            }
          } catch (err) {
            console.error('Presentation loading error:', err)
            fileData.slides = [
              {
                title: 'Presentation Error',
                content: [
                  'Could not load presentation',
                  'Error: ' + (err instanceof Error ? err.message : String(err))
                ]
              }
            ]
          }
          break

        case 'spreadsheet':
          console.log('Processing spreadsheet...')
          if ((window as any).XLSX) {
            try {
              const binaryString = atob(data.data)
              const bytes = new Uint8Array(binaryString.length)
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i)
              }

              const workbook = (window as any).XLSX.read(bytes, {
                type: 'array',
                cellStyles: true,
                cellFormulas: true,
                cellDates: true
              })

              const sheetNames = workbook.SheetNames
              if (sheetNames.length > 0) {
                const firstSheet = workbook.Sheets[sheetNames[0]]

                fileData.spreadsheetData = {
                  workbook,
                  currentSheet: firstSheet,
                  currentSheetName: sheetNames[0],
                  sheetNames
                }
                console.log('Spreadsheet processed successfully, sheets:', sheetNames)
              } else {
                console.warn('No sheets found in spreadsheet')
                fileData.documentContent = 'No sheets found in this spreadsheet.'
              }
            } catch (err) {
              console.error('Spreadsheet loading error:', err)
              fileData.documentContent = `Error loading spreadsheet: ${err}`
            }
          } else {
            console.warn('XLSX library not loaded')
            fileData.documentContent =
              'Spreadsheet viewer not available. Please install XLSX library.'
          }
          break

        case 'code':
          console.log('Processing code file...')
          let codeContent = data.data

          // Debug logging
          console.log('Code file processing:', {
            filename: data.filename,
            type: data.type,
            contentLength: codeContent.length,
            firstChars: codeContent.substring(0, 100)
          })

          // Ensure content is not empty
          if (!codeContent || codeContent.trim().length === 0) {
            codeContent = `// Empty code file: ${data.filename}`
            console.warn('Code file appears to be empty, using placeholder content')
          }

          fileData.documentContent = codeContent
          console.log('Code file processed successfully')
          break

        case 'text':
        case 'json':
        case 'xml':
        case 'html':
          console.log('Processing text file...')
          let content = data.data

          console.log('Text file processing:', {
            filename: data.filename,
            type: data.type,
            contentLength: content.length,
            firstChars: content.substring(0, 100)
          })

          if (data.type === 'json') {
            try {
              const parsed = JSON.parse(content)
              content = JSON.stringify(parsed, null, 2)
              console.log('JSON formatted successfully')
            } catch (e) {
              console.warn('JSON parse failed, keeping original content:', e)
            }
          }

          if (!content || content.trim().length === 0) {
            content = `[Empty file: ${data.filename}]`
            console.warn('File appears to be empty, using placeholder content')
          }

          fileData.documentContent = content
          console.log('Final content set, length:', content.length)
          break

        default:
          console.log('Processing as default text file...')
          let defaultContent = data.data
          if (!defaultContent || defaultContent.trim().length === 0) {
            defaultContent = `[Unknown file type: ${data.filename}]`
          }
          fileData.documentContent = defaultContent
          console.log('Default content set, length:', defaultContent.length)
      }

      console.log('File processing complete, setting placement mode...')

      // Set placement mode with ALL the processed data
      setPlacementMode('file-upload')
      setPlacementOptions({ fileData })
      document.body.style.cursor = 'crosshair'
      console.log('Placement mode set to file-upload')
    } catch (err) {
      console.error('File loading error:', err)
      setPlacementMode('inactive')
      setPlacementOptions({})
      document.body.style.cursor = 'default'

      alert(`Error loading file: ${err instanceof Error ? err.message : String(err)}`)
    }

    // Clear the file input
    if (event.target) {
      event.target.value = ''
    }

    console.log('File selection handler complete')
  }

  const openUniversalFileUpload = () => {
    universalFileInputRef.current?.click()
  }

  const handleDrawPathDragStart = (e: React.MouseEvent, pathId: string) => {
    e.stopPropagation()

    // Only allow dragging if we're not in drawing mode
    if (drawingMode !== 'none') return

    setDraggedDrawPathId(pathId)

    const editorRect = editorRef.current?.getBoundingClientRect()
    if (!editorRect) return

    const mouseX = e.clientX - editorRect.left - canvasOffset.x
    const mouseY = e.clientY - editorRect.top - canvasOffset.y

    // Calculate the offset based on the first point of the path
    const path = drawPaths.find((p) => p.id === pathId)
    if (!path || path.points.length === 0) return

    // Use the first point as the reference for dragging
    pathDragOffset.current = {
      x: mouseX - path.points[0].x,
      y: mouseY - path.points[0].y
    }

    document.body.style.cursor = 'grabbing'
  }

  const handleDeleteDrawPath = () => {
    // Delete multiple drawings if selected
    if (selectedDrawPathIds.length > 0) {
      setDrawPaths((prev) => prev.filter((path) => !selectedDrawPathIds.includes(path.id)))
      setSelectedDrawPathIds([])
      setSelectedDrawPathId(null) // Also clear single-selection state
    }
    // Fallback to delete single drawing if only that is selected
    else if (selectedDrawPathId) {
      setDrawPaths((prev) => prev.filter((path) => path.id !== selectedDrawPathId))
      setSelectedDrawPathId(null)
    }
  }

  const handleDrawingModeChange = (mode: 'pen' | 'shape' | 'arrow' | 'none') => {
    setDrawingMode((prevMode) => (prevMode === mode ? 'none' : mode))

    // If entering drawing mode, set cursor style
    if (mode !== 'none') {
      document.body.style.cursor = 'crosshair' // Remove eraser-specific cursor logic
    } else {
      document.body.style.cursor = 'default'
    }
  }

  // Function to clear all drawings
  const handleClearDrawing = () => {
    setDrawPaths([])
  }

  const getHighestZIndex = () => {
    const textAreaHighest =
      textAreas.length > 0 ? Math.max(...textAreas.map((item) => item.zIndex || 0)) : 0

    const webViewHighest =
      webViews.length > 0 ? Math.max(...webViews.map((view) => view.zIndex)) : 0

    const imageHighest = images.length > 0 ? Math.max(...images.map((image) => image.zIndex)) : 0

    const videoHighest = videos.length > 0 ? Math.max(...videos.map((video) => video.zIndex)) : 0

    const audioHighest = audios.length > 0 ? Math.max(...audios.map((audio) => audio.zIndex)) : 0

    const fileHighest = files.length > 0 ? Math.max(...files.map((file) => file.zIndex)) : 0

    return Math.max(
      textAreaHighest,
      webViewHighest,
      imageHighest,
      videoHighest,
      audioHighest,
      fileHighest,
      0
    )
  }

  const handleAudioRef = useCallback((element: HTMLAudioElement | null, audioId: string) => {
    if (element) {
      audioRefs.current.set(audioId, element)
    } else {
      audioRefs.current.delete(audioId)
    }
  }, [])

  // Generate audio ID
  const generateAudioId = () => `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const addAudioToEditor = useCallback((src: string, filename: string) => {
    // Audio has a fixed size since it's just a player
    const width = 320
    const height = 60 // Compact audio player height

    setPlacementMode('audio-upload')
    setPlacementOptions({
      audioData: {
        src,
        width,
        height,
        filename
      }
    })
    document.body.style.cursor = 'crosshair'
  }, [])

  // Audio click handler for selection
  const handleAudioClick = (e: React.MouseEvent, audioId: string) => {
    e.stopPropagation()

    bringToFront(audioId, false, false, false, true) // isAudio = true

    if (e.shiftKey) {
      setSelectedAudioIds((prev) =>
        prev.includes(audioId) ? prev.filter((id) => id !== audioId) : [...prev, audioId]
      )
    } else {
      setSelectedAudioIds([audioId])
      setSelectedTextAreaIds([]) // Clear text area selections
      setSelectedImageIds([]) // Clear image selections
      setSelectedVideoIds([]) // Clear video selections
    }
  }

  // Audio drag start handler
  const handleAudioDragStart = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()

    bringToFront(id, false, false, false, true)

    setDraggedAudioId(id)

    const editorRect = editorRef.current?.getBoundingClientRect()
    if (!editorRect) return

    const mouseX = e.clientX - editorRect.left - canvasOffset.x
    const mouseY = e.clientY - editorRect.top - canvasOffset.y

    const audio = audios.find((item) => item.id === id)
    if (!audio) return

    audioDragOffset.current = {
      x: mouseX - audio.x,
      y: mouseY - audio.y
    }

    document.body.style.cursor = 'grabbing'
  }

  // Audio resize start handler (optional, for consistency)
  const handleAudioResizeStart = (
    id: string,
    e: React.MouseEvent,
    resizeHandle:
      | 'top-left'
      | 'top-right'
      | 'bottom-left'
      | 'bottom-right'
      | 'top'
      | 'right'
      | 'bottom'
      | 'left'
  ) => {
    e.stopPropagation()
    e.preventDefault()

    bringToFront(id, false, false, false, true)

    setResizingAudioId(id)

    audioResizeStartPos.current = { x: e.clientX, y: e.clientY }

    const audio = audios.find((item) => item.id === id)
    if (!audio) return

    audioResizeStartSize.current = { width: audio.width, height: audio.height }
    audioResizeStartPosition.current = { x: audio.x, y: audio.y }

    setActiveAudioResizeHandle(resizeHandle)

    // Set appropriate cursor based on the handle
    switch (resizeHandle) {
      case 'top-left':
      case 'bottom-right':
        document.body.style.cursor = 'nwse-resize'
        break
      case 'top-right':
      case 'bottom-left':
        document.body.style.cursor = 'nesw-resize'
        break
      case 'top':
      case 'bottom':
        document.body.style.cursor = 'ns-resize'
        break
      case 'left':
      case 'right':
        document.body.style.cursor = 'ew-resize'
        break
      default:
        document.body.style.cursor = 'nwse-resize'
    }
  }

  const handleRemoveAudio = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()

    // If we're currently resizing this audio, reset cursor and state
    if (resizingAudioId === id) {
      setResizingAudioId(null)
      audioResizeStartPos.current = null
      audioResizeStartSize.current = null
      audioResizeStartPosition.current = null
      setActiveAudioResizeHandle(undefined)
      document.body.style.cursor = 'auto'
    }

    // If we're currently dragging this audio, reset cursor and state
    if (draggedAudioId === id) {
      setDraggedAudioId(null)
      audioDragOffset.current = null
      document.body.style.cursor = 'auto'
    }

    // Clean up the audio URL
    const audio = audios.find((item) => item.id === id)
    if (audio) {
      URL.revokeObjectURL(audio.src)
    }

    setAudios((prev) => prev.filter((item) => item.id !== id))
    setSelectedAudioIds((prev) => prev.filter((audioId) => audioId !== id))
    audioRefs.current.delete(id)
  }

  const bringToFront = (
    id: string,
    isWebView: boolean = false,
    isImage: boolean = false,
    isVideo: boolean = false,
    isAudio: boolean = false,
    isFile: boolean = false
  ) => {
    const highestZIndex = getHighestZIndex()

    if (isFile) {
      const file = files.find((f) => f.id === id)
      if (file && file.zIndex < highestZIndex) {
        setFiles((prev) =>
          prev.map((item) => (item.id === id ? { ...item, zIndex: highestZIndex + 1 } : item))
        )
      }
    } else if (isAudio) {
      const audio = audios.find((aud) => aud.id === id)
      if (audio && audio.zIndex < highestZIndex) {
        setAudios((prev) =>
          prev.map((item) => (item.id === id ? { ...item, zIndex: highestZIndex + 1 } : item))
        )
      }
    } else if (isVideo) {
      const video = videos.find((vid) => vid.id === id)
      if (video && video.zIndex < highestZIndex) {
        setVideos((prev) =>
          prev.map((item) => (item.id === id ? { ...item, zIndex: highestZIndex + 1 } : item))
        )
      }
    } else if (isImage) {
      const image = images.find((img) => img.id === id)
      if (image && image.zIndex < highestZIndex) {
        setImages((prev) =>
          prev.map((item) => (item.id === id ? { ...item, zIndex: highestZIndex + 1 } : item))
        )
      }
    } else if (isWebView) {
      const webView = webViews.find((view) => view.id === id)
      if (webView && webView.zIndex < highestZIndex) {
        setWebViews((prev) =>
          prev.map((item) => (item.id === id ? { ...item, zIndex: highestZIndex + 1 } : item))
        )
      }
    } else {
      const textArea = textAreas.find((item) => item.id === id)
      if (textArea && (textArea.zIndex || 0) < highestZIndex) {
        setTextAreas((prev) =>
          prev.map((item) => (item.id === id ? { ...item, zIndex: highestZIndex + 1 } : item))
        )
      }
    }
  }

  // Get appropriate styles for text format
  const getTextStyles = (format: string) => {
    return 'text-base'
  }

  // WebView drag start handler
  const handleWebViewDragStart = (id: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering selection or canvas panning

    // Bring the webview to front
    bringToFront(id, true)

    // Set the dragged webview ID
    setDraggedWebViewId(id)

    // Calculate the offset between the mouse and the webview's position
    const editorRect = editorRef.current?.getBoundingClientRect()
    if (!editorRect) return

    const mouseX = e.clientX - editorRect.left - canvasOffset.x
    const mouseY = e.clientY - editorRect.top - canvasOffset.y

    // Find the webview being dragged
    const webView = webViews.find((item) => item.id === id)
    if (!webView) return

    webViewDragOffset.current = {
      x: mouseX - webView.position.x,
      y: mouseY - webView.position.y
    }

    // Set cursor to grabbing
    document.body.style.cursor = 'grabbing'
  }

  const handleWebViewResizeStart = (
    id: string,
    e: React.MouseEvent,
    resizeHandle: WebViewItem['resizeHandle']
  ) => {
    e.stopPropagation() // Prevent triggering canvas panning
    e.preventDefault()

    // Bring the webview to front
    bringToFront(id, true)

    // Set the resizing webview ID and handle position
    setResizingWebViewId(id)

    // Store the starting mouse position
    webViewResizeStartPos.current = { x: e.clientX, y: e.clientY }

    // Find the webview being resized
    const webView = webViews.find((item) => item.id === id)
    if (!webView) return

    // Store the starting size and position (we need position for some resize operations)
    webViewResizeStartSize.current = { ...webView.size }
    webViewResizeStartPosition.current = { ...webView.position }

    // Store which handle is being used
    setActiveResizeHandle(resizeHandle)

    // Set appropriate cursor based on the handle
    switch (resizeHandle) {
      case 'top-left':
      case 'bottom-right':
        document.body.style.cursor = 'nwse-resize'
        break
      case 'top-right':
      case 'bottom-left':
        document.body.style.cursor = 'nesw-resize'
        break
      case 'top':
      case 'bottom':
        document.body.style.cursor = 'ns-resize'
        break
      case 'left':
      case 'right':
        document.body.style.cursor = 'ew-resize'
        break
      default:
        document.body.style.cursor = 'nwse-resize'
    }
  }

  // Add these new refs to store starting position and active resize handle
  const webViewResizeStartPosition = useRef<{ x: number; y: number } | null>(null)
  const [activeResizeHandle, setActiveResizeHandle] = useState<WebViewItem['resizeHandle']>()

  // Remove webview handler
  const handleRemoveWebView = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setWebViews((prev) => prev.filter((item) => item.id !== id))
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Check if the click is on the canvas itself, not on a UI element
    // We need to check if the target is the editor div itself or a direct child that's not a UI element

    const target = e.target as HTMLElement

    // Skip creating new text area if double-clicked on existing UI elements
    if (
      // Skip if clicking on an existing textarea
      target.id.startsWith('textarea-') ||
      target.closest('[id^="textarea-"]') ||
      // Skip if clicking on a todo list
      target.id.startsWith('todolist-') ||
      target.closest('[id^="todolist-"]') ||
      // Skip if clicking on any button
      target.tagName === 'BUTTON' ||
      target.closest('button') ||
      // Skip if clicking on the selection menu
      target.closest('[role="menu"]') ||
      // Skip if clicking on panel components
      target.closest('.panel') ||
      target.closest('[contenteditable="true"]') ||
      // Skip if clicking on a LaTeX component
      target.id.startsWith('latex-') ||
      target.closest('[id^="latex-"]') ||
      target.classList.contains('latex-component') ||
      target.closest('.latex-component') ||
      // Skip if clicking on the command menu or AI response container
      (showCommandMenu && target.closest('.command-menu')) ||
      // ===== NEW WEBVIEW EXCLUSIONS =====
      // Skip if clicking on webview container
      target.closest('.webview-container') ||
      // Skip if clicking on webview content
      target.closest('.webview-content') ||
      // Skip if clicking on webview element itself
      target.tagName.toLowerCase() === 'webview' ||
      target.closest('webview') ||
      // Skip if clicking on webview navigation header
      target.closest('.webview-header') ||
      // Skip if clicking on any webview-related elements
      target.id.startsWith('webview-') ||
      target.closest('[id^="webview-"]') ||
      // Skip if clicking on image containers
      target.closest('.image-container') ||
      // Skip if clicking on video containers
      target.closest('.video-container') ||
      // Skip if clicking on audio containers
      target.closest('.audio-container') ||
      // Skip if clicking on file containers
      target.closest('.file-container') ||
      // Skip if clicking on any resize handles
      target.classList.contains('resize-handle') ||
      target.closest('.resize-handle')
    ) {
      return
    }

    // Get the editor's bounding rect to calculate relative positions
    const editorRect = editorRef.current?.getBoundingClientRect()
    if (!editorRect) return

    // Calculate position relative to the editor, accounting for canvas offset
    const x = e.clientX - editorRect.left - canvasOffset.x
    const y = e.clientY - editorRect.top - canvasOffset.y

    // Get highest z-index to ensure new element is on top
    const highestZIndex = getHighestZIndex()

    // Create a new textarea at this position
    const newTextArea = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      content: '',
      format: 'normal' as const,
      position: { x, y },
      zIndex: highestZIndex + 1
    }

    setTextAreas((prev) => [...prev, newTextArea])

    // Focus the new textarea
    setTimeout(() => {
      const textareaElement = document.getElementById(`textarea-${newTextArea.id}`)
      if (textareaElement) {
        textareaElement.focus()
      }
    }, 0)
  }

  // Update the mouse event handlers to support drawing
  // Replace your existing handleMouseDown with this:
  const handleMouseDown = (e: React.MouseEvent) => {
    if (placementMode !== 'inactive' && e.button !== 0) {
      setPlacementMode('inactive')
      setPlacementOptions({})
      document.body.style.cursor = 'default'

      // Clean up any temporary file URLs
      if (placementMode === 'file-upload' && placementOptions.fileData?.pdfUrl) {
        URL.revokeObjectURL(placementOptions.fileData.pdfUrl)
      }
      return
    }

    // If we're in drawing mode, start drawing
    if (drawingMode !== 'none') {
      e.preventDefault()
      e.stopPropagation()

      const editorRect = editorRef.current?.getBoundingClientRect()
      if (!editorRect) return

      const x = e.clientX - editorRect.left - canvasOffset.x
      const y = e.clientY - editorRect.top - canvasOffset.y

      setIsDrawing(true)
      setCurrentPath([{ x, y }])
      return
    }

    // Only initiate selection with left mouse button
    if (e.button !== 0) return

    // If we're currently dragging either a textarea or webview, don't start selection or panning
    if (draggedTextAreaId || draggedWebViewId || resizingWebViewId) return

    // Check if clicking on the empty canvas (not on a text area, webview or UI element)
    const target = e.target as HTMLElement
    const isClickingCanvas =
      target === editorRef.current ||
      target.classList.contains('flex-1') ||
      target.classList.contains('w-full') ||
      target.classList.contains('editor-container')

    // Don't count clicks on webview containers as canvas clicks
    if (target.closest('.webview-container')) {
      return
    }

    // If in placement mode, handle element creation
    if (placementMode !== 'inactive' && isClickingCanvas) {
      handleElementPlacement(e)
      return
    }

    if (isClickingCanvas && !e.shiftKey) {
      setSelectedTextAreaIds([])
      setSelectedImageIds([])
      setSelectedVideoIds([])
      setSelectedAudioIds([])
      setSelectedFileIds([])
      // ADD THESE TWO LINES:
      setSelectedDrawPathIds([])
      setSelectedDrawPathId(null)
    }

    if (activeTool === 'hand') {
      // Start panning
      setIsPanning(true)
      lastMousePos.current = { x: e.clientX, y: e.clientY }
      e.preventDefault()
      return
    }

    // Clear any existing selection first
    setSelectionRect(null)

    // Get the editor's bounding rect to calculate relative positions
    const editorRect = editorRef.current?.getBoundingClientRect()
    if (!editorRect) return

    // Calculate start position relative to the editor
    const startX = e.clientX - editorRect.left
    const startY = e.clientY - editorRect.top

    // Store the starting position
    startPositionRef.current = { x: startX, y: startY }

    // Initialize the selection rectangle
    setSelectionRect({
      startX,
      startY,
      width: 0,
      height: 0
    })

    setIsSelecting(true)
  }

  const generateImageId = () => Math.random().toString(36).substr(2, 9)

  const [resizingShapeId, setResizingShapeId] = useState<string | null>(null)
  const [resizingShapeHandle, setResizingShapeHandle] = useState<
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'top'
    | 'right'
    | 'bottom'
    | 'left'
    | null
  >(null)
  const shapeResizeStartPos = useRef<{ x: number; y: number } | null>(null)
  const shapeResizeOriginalPoints = useRef<DrawPoint[] | null>(null)

  const handleShapeResizeStart = (
    shapeId: string,
    handle:
      | 'top-left'
      | 'top-right'
      | 'bottom-left'
      | 'bottom-right'
      | 'top'
      | 'right'
      | 'bottom'
      | 'left',
    e: React.MouseEvent
  ) => {
    e.stopPropagation()
    e.preventDefault()

    // Only allow resizing if we're not in drawing mode
    if (drawingMode !== 'none') return

    setResizingShapeId(shapeId)
    setResizingShapeHandle(handle)

    // Store the starting mouse position
    shapeResizeStartPos.current = { x: e.clientX, y: e.clientY }

    // Find the shape being resized and store its original points
    const shape = drawPaths.find((path) => path.id === shapeId)
    if (!shape || !shape.points) return

    // Store original points for reference during resize
    shapeResizeOriginalPoints.current = [...shape.points]

    // Set cursor based on handle
    switch (handle) {
      case 'top-left':
      case 'bottom-right':
        document.body.style.cursor = 'nwse-resize'
        break
      case 'top-right':
      case 'bottom-left':
        document.body.style.cursor = 'nesw-resize'
        break
      case 'top':
      case 'bottom':
        document.body.style.cursor = 'ns-resize'
        break
      case 'left':
      case 'right':
        document.body.style.cursor = 'ew-resize'
        break
    }

    // Select this shape if not already selected
    if (!selectedDrawPathIds.includes(shapeId)) {
      setSelectedDrawPathIds([shapeId])
      setSelectedDrawPathId(shapeId)
    }
  }

  // Add image to editor (same logic as ImageEditor.tsx but adapted for editor)
  const addImageToEditor = useCallback(
    (src: string, naturalWidth: number, naturalHeight: number) => {
      const maxSize = 300
      let width = naturalWidth
      let height = naturalHeight

      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      // Instead of immediately adding the image, store it in placement options
      setPlacementMode('image-upload')
      setPlacementOptions({
        imageData: {
          src,
          width,
          height,
          naturalWidth,
          naturalHeight
        }
      })
      document.body.style.cursor = 'crosshair'
    },
    []
  )

  // Open file dialog (same as ImageEditor.tsx)
  const openImageUpload = () => {
    fileInputRef.current?.click()
  }

  const handleImageDragStart = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()

    // Bring the image to front
    bringToFront(id, false, true) // We'll need to modify bringToFront to handle images

    setDraggedImageId(id)

    const editorRect = editorRef.current?.getBoundingClientRect()
    if (!editorRect) return

    const mouseX = e.clientX - editorRect.left - canvasOffset.x
    const mouseY = e.clientY - editorRect.top - canvasOffset.y

    const image = images.find((item) => item.id === id)
    if (!image) return

    imageDragOffset.current = {
      x: mouseX - image.x,
      y: mouseY - image.y
    }

    document.body.style.cursor = 'grabbing'
  }

  // Image resize start handler (similar to webView resize logic)
  const handleImageResizeStart = (
    id: string,
    e: React.MouseEvent,
    resizeHandle:
      | 'top-left'
      | 'top-right'
      | 'bottom-left'
      | 'bottom-right'
      | 'top'
      | 'right'
      | 'bottom'
      | 'left'
  ) => {
    e.stopPropagation()
    e.preventDefault()

    bringToFront(id, false, true)

    setResizingImageId(id)

    imageResizeStartPos.current = { x: e.clientX, y: e.clientY }

    const image = images.find((item) => item.id === id)
    if (!image) return

    imageResizeStartSize.current = { width: image.width, height: image.height }
    imageResizeStartPosition.current = { x: image.x, y: image.y }

    setActiveImageResizeHandle(resizeHandle)

    // Set appropriate cursor based on the handle
    switch (resizeHandle) {
      case 'top-left':
      case 'bottom-right':
        document.body.style.cursor = 'nwse-resize'
        break
      case 'top-right':
      case 'bottom-left':
        document.body.style.cursor = 'nesw-resize'
        break
      case 'top':
      case 'bottom':
        document.body.style.cursor = 'ns-resize'
        break
      case 'left':
      case 'right':
        document.body.style.cursor = 'ew-resize'
        break
      default:
        document.body.style.cursor = 'nwse-resize'
    }
  }

  // Remove image handler
  const handleRemoveImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setImages((prev) => prev.filter((item) => item.id !== id))
    setSelectedImageIds((prev) => prev.filter((imageId) => imageId !== id))
  }

  // Image click handler for selection
  const handleImageClick = (e: React.MouseEvent, imageId: string) => {
    e.stopPropagation()

    bringToFront(imageId, false, true)

    if (e.shiftKey) {
      setSelectedImageIds((prev) =>
        prev.includes(imageId) ? prev.filter((id) => id !== imageId) : [...prev, imageId]
      )
    } else {
      setSelectedImageIds([imageId])
      setSelectedTextAreaIds([]) // Clear text area selections
    }
  }

  const handleCodeContentChange = (textAreaId: string, newContent: string) => {
    setTextAreas((prev) =>
      prev.map((item) => (item.id === textAreaId ? { ...item, content: newContent } : item))
    )
  }

  // Make sure handleCodeLanguageChange has this signature:
  const handleCodeLanguageChange = (textAreaId: string, language: string) => {
    setTextAreas((prev) => {
      return prev.map((item) => {
        if (item.id !== textAreaId || item.format !== 'code') return item
        return { ...item, language }
      })
    })
  }
  const handleElementPlacement = (e: React.MouseEvent) => {
    const editorRect = editorRef.current?.getBoundingClientRect()
    if (!editorRect) return

    // Calculate position relative to the editor, accounting for canvas offset
    const x = e.clientX - editorRect.left - canvasOffset.x
    const y = e.clientY - editorRect.top - canvasOffset.y

    // Get highest z-index to ensure new element is on top
    const highestZIndex = getHighestZIndex()

    if (placementMode === 'file-upload' && placementOptions.fileData) {
      const fileData = placementOptions.fileData
      const fileId = generateFileId()

      // Get the file extension for language detection
      const fileExtension = fileData.filename.split('.').pop()?.toLowerCase() || ''
      const detectedLanguage = languageMap[fileExtension] || 'plain'

      // Create the file item with all processed data
      const newFile: FileItem = {
        id: fileId,
        filename: fileData.filename,
        documentType: fileData.documentType,
        documentData: fileData.documentData,
        x,
        y,
        width: fileData.width,
        height: fileData.height,
        zIndex: highestZIndex + 1,
        scale: 1.2,
        loading: false,
        error: null,
        // Include all processed data
        pdfUrl: fileData.pdfUrl,
        slides: fileData.slides,
        currentSlideIndex: fileData.slides ? 0 : undefined,
        spreadsheetData: fileData.spreadsheetData,
        documentContent: fileData.documentContent,

        // ADD THESE FOR CODE FILES:
        codeLanguage: fileData.documentType === 'code' ? detectedLanguage : undefined,
        isCodeEditMode: false, // Start in view mode
        cursorPosition: 'Ln 1, Col 1'
      }

      // Add to files array
      setFiles((prev) => [...prev, newFile])
      setSelectedFileIds([fileId])
    } else if (placementMode === 'audio-upload' && placementOptions.audioData) {
      // Create a new audio at the clicked position
      const audioData = placementOptions.audioData

      const newAudio: AudioItem = {
        id: generateAudioId(),
        src: audioData.src,
        filename: audioData.filename,
        width: audioData.width,
        height: audioData.height,
        x,
        y,
        zIndex: highestZIndex + 1
      }

      setAudios((prev) => [...prev, newAudio])
      setSelectedAudioIds([newAudio.id])
    } else if (placementMode === 'video-upload' && placementOptions.videoData) {
      // Create a new video at the clicked position
      const videoData = placementOptions.videoData

      const newVideo: VideoItem = {
        id: generateVideoId(),
        src: videoData.src,
        filename: videoData.filename,
        width: videoData.width,
        height: videoData.height,
        x,
        y,
        zIndex: highestZIndex + 1
      }

      setVideos((prev) => [...prev, newVideo])
      setSelectedVideoIds([newVideo.id])
    } else if (placementMode === 'image-upload' && placementOptions.imageData) {
      // Create a new image at the clicked position
      const imageData = placementOptions.imageData
      const highestZIndex = getHighestZIndex()

      const newImage: ImageItem = {
        id: generateImageId(),
        src: imageData.src,
        width: imageData.width,
        height: imageData.height,
        x,
        y,
        naturalWidth: imageData.naturalWidth,
        naturalHeight: imageData.naturalHeight,
        zIndex: highestZIndex + 1
      }

      setImages((prev) => [...prev, newImage])
      setSelectedImageIds([newImage.id])
    } else if (placementMode === 'browser') {
      // Create a new webview
      const newWebView: WebViewItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        url: 'https://www.google.com',
        position: { x, y },
        size: { width: 600, height: 400 },
        zIndex: highestZIndex + 1
      }

      setWebViews((prev) => [...prev, newWebView])
    } else if (placementMode === 'latex') {
      // Create a new LaTeX component
      const newLatex: TextAreaItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        content: '',
        format: 'latex',
        position: { x, y },
        isBlockLatex: placementOptions.latexBlockMode ?? true,
        zIndex: highestZIndex + 1
      }

      setTextAreas((prev) => [...prev, newLatex])

      // Focus the new LaTeX component
      setTimeout(() => {
        const latexElement = document.getElementById(`latex-${newLatex.id}`)
        if (latexElement) {
          const editButton = latexElement.querySelector('button')
          if (editButton) {
            editButton.click()
          } else {
            latexElement.click()
          }
        }
      }, 10)
    } else if (placementMode === 'todoList') {
      // Create a todo list
      const newTodoList: TextAreaItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        content: '',
        format: 'todoList',
        position: { x, y },
        todoItems: [
          {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            content: '',
            checked: false
          }
        ],
        zIndex: highestZIndex + 1
      }

      setTextAreas((prev) => [...prev, newTodoList])

      // Focus the new list
      setTimeout(() => {
        const todoListElement = document.getElementById(`todolist-${newTodoList.id}`)
        if (todoListElement) {
          const todoInput = todoListElement.querySelector('[contenteditable="true"]')
          if (todoInput) {
            ;(todoInput as HTMLElement).focus()
          }
        }
      }, 0)
    } else if (placementMode === 'bulletList' || placementMode === 'numberedList') {
      // Create a bullet or numbered list
      const newList: TextAreaItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        content: '',
        format: placementMode,
        position: { x, y },
        listItems: [
          {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            content: ''
          }
        ],
        zIndex: highestZIndex + 1
      }

      setTextAreas((prev) => [...prev, newList])

      // Focus the new list
      setTimeout(() => {
        const listElement = document.getElementById(`list-${newList.id}`)
        if (listElement) {
          const listInput = listElement.querySelector('[contenteditable="true"]')
          if (listInput) {
            ;(listInput as HTMLElement).focus()
          }
        }
      }, 0)
    } else if (placementMode === 'code') {
      // Create a code editor
      const newCode: TextAreaItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        content: '',
        format: 'code',
        position: { x, y },
        language: 'javascript',
        zIndex: highestZIndex + 1
      }

      setTextAreas((prev) => [...prev, newCode])

      // Focus the new code editor
      setTimeout(() => {
        const codeEditorElement = document.getElementById(`code-${newCode.id}`)
        if (codeEditorElement) {
          const codeTextarea = codeEditorElement.querySelector('textarea')
          if (codeTextarea) {
            codeTextarea.focus()
          }
        }
      }, 0)
    } else {
      // Handle normal text, h1, h2, h3
      const newTextArea: TextAreaItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        content: '',
        format: placementMode as any,
        position: { x, y },
        zIndex: highestZIndex + 1
      }

      setTextAreas((prev) => [...prev, newTextArea])

      // Focus the new textarea
      setTimeout(() => {
        const textareaElement = document.getElementById(`textarea-${newTextArea.id}`)
        if (textareaElement) {
          textareaElement.focus()
        }
      }, 0)
    }

    // Reset placement mode
    setPlacementMode('inactive')
    document.body.style.cursor = 'default'
  }

  useEffect(() => {
    const handleCapturedImageInsertion = (event: CustomEvent) => {
      const { tabId, imageData } = event.detail

      // Check if this is the correct tab
      if (event.detail.tabId !== tabId) return // This should reference the current editor's tab ID

      // Create a temporary image to get natural dimensions
      const tempImg = new Image()
      tempImg.onload = () => {
        const maxSize = 400
        let width = tempImg.naturalWidth
        let height = tempImg.naturalHeight

        // Scale down if too large
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        // Get highest z-index
        const highestZIndex = getHighestZIndex()

        // Create new captured image
        const newCapturedImage: CapturedImageItem = {
          id: generateImageId(),
          src: imageData.src,
          width: width,
          height: height,
          x: 100, // Default position
          y: 100,
          naturalWidth: tempImg.naturalWidth,
          naturalHeight: tempImg.naturalHeight,
          zIndex: highestZIndex + 1,
          sourceUrl: imageData.sourceUrl,
          sourceTitle: imageData.sourceTitle,
          timestamp: imageData.timestamp
        }

        setImages((prev) => [...prev, newCapturedImage])
        setSelectedImageIds([newCapturedImage.id])
      }

      tempImg.src = imageData.src
    }

    window.addEventListener('insertCapturedImage', handleCapturedImageInsertion as EventListener)

    return () => {
      window.removeEventListener(
        'insertCapturedImage',
        handleCapturedImageInsertion as EventListener
      )
    }
  }, [tabId])

  const handleDragStart = (id: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering selection

    // Bring the text area to the front
    bringToFront(id)

    // If the clicked text area is not in the selection, make it the only selection
    // unless shift key is pressed
    if (!selectedTextAreaIds.includes(id)) {
      if (e.shiftKey) {
        // Add to selection if shift key is pressed
        setSelectedTextAreaIds((prev) => [...prev, id])
      } else {
        // Otherwise, make it the only selection
        setSelectedTextAreaIds([id])
      }
    }

    // Set the dragged textarea ID
    setDraggedTextAreaId(id)

    // Calculate the offset between the mouse and the textarea's position
    // This ensures the textarea doesn't jump to have its corner at the mouse position
    const editorRect = editorRef.current?.getBoundingClientRect()
    if (!editorRect) return

    const mouseX = e.clientX - editorRect.left - canvasOffset.x
    const mouseY = e.clientY - editorRect.top - canvasOffset.y

    // Find the textarea being dragged
    const textArea = textAreas.find((item) => item.id === id)
    if (!textArea) return

    dragOffset.current = {
      x: mouseX - textArea.position.x,
      y: mouseY - textArea.position.y
    }

    // Set cursor to grabbing for the whole document during drag
    document.body.style.cursor = 'grabbing'
  }

  const handleFileClick = (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation()

    bringToFront(fileId, false, false, false, false, true) // Add isFile parameter

    if (e.shiftKey) {
      setSelectedFileIds((prev) =>
        prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
      )
    } else {
      setSelectedFileIds([fileId])
      setSelectedTextAreaIds([]) // Clear other selections
      setSelectedImageIds([])
      setSelectedVideoIds([])
      setSelectedAudioIds([])
    }
  }

  const handleFileDragStart = (id: string, e: React.MouseEvent) => {
    console.log('Starting file drag for:', id)
    e.stopPropagation()
    e.preventDefault() // Add this to prevent any default drag behavior

    // Only allow left mouse button
    if (e.button !== 0) return

    bringToFront(id, false, false, false, false, true)

    setDraggedFileId(id)

    const editorRect = editorRef.current?.getBoundingClientRect()
    if (!editorRect) {
      console.error('Could not get editor rect')
      return
    }

    const mouseX = e.clientX - editorRect.left - canvasOffset.x
    const mouseY = e.clientY - editorRect.top - canvasOffset.y

    const file = files.find((item) => item.id === id)
    if (!file) {
      console.error('Could not find file with id:', id)
      return
    }

    fileDragOffset.current = {
      x: mouseX - file.x,
      y: mouseY - file.y
    }

    console.log('File drag setup complete:', {
      fileId: id,
      mouseX,
      mouseY,
      fileX: file.x,
      fileY: file.y,
      offset: fileDragOffset.current
    })

    document.body.style.cursor = 'grabbing'
  }

  // File resize start handler
  const handleFileResizeStart = (
    id: string,
    e: React.MouseEvent,
    resizeHandle:
      | 'top-left'
      | 'top-right'
      | 'bottom-left'
      | 'bottom-right'
      | 'top'
      | 'right'
      | 'bottom'
      | 'left'
  ) => {
    e.stopPropagation()
    e.preventDefault()

    bringToFront(id, false, false, false, false, true)

    setResizingFileId(id)

    fileResizeStartPos.current = { x: e.clientX, y: e.clientY }

    const file = files.find((item) => item.id === id)
    if (!file) return

    fileResizeStartSize.current = { width: file.width, height: file.height }
    fileResizeStartPosition.current = { x: file.x, y: file.y }

    setActiveFileResizeHandle(resizeHandle)

    // Set appropriate cursor based on the handle
    switch (resizeHandle) {
      case 'top-left':
      case 'bottom-right':
        document.body.style.cursor = 'nwse-resize'
        break
      case 'top-right':
      case 'bottom-left':
        document.body.style.cursor = 'nesw-resize'
        break
      case 'top':
      case 'bottom':
        document.body.style.cursor = 'ns-resize'
        break
      case 'left':
      case 'right':
        document.body.style.cursor = 'ew-resize'
        break
      default:
        document.body.style.cursor = 'nwse-resize'
    }
  }

  // Add this new handler function in the Editor component:
  const handleOpenWebViewInPiP = (webViewId: string) => {
    const webView = webViews.find((wv) => wv.id === webViewId)
    if (!webView || !onOpenPictureInPictureFromUrl) return

    // Get the current URL from the webview element
    const webviewElement = document.getElementById(`webview-${webViewId}`) as Electron.WebviewTag

    if (webviewElement) {
      try {
        // Try to get the current URL from the webview
        const currentUrl = webviewElement.getURL ? webviewElement.getURL() : webView.url

        // Get the title from the webview or use a default
        let title = 'Editor Webview'
        try {
          const webviewTitle = webviewElement.getTitle ? webviewElement.getTitle() : ''
          if (webviewTitle) {
            title = webviewTitle
          } else {
            // Fallback to hostname
            const url = new URL(currentUrl)
            title = url.hostname
          }
        } catch (error) {
          console.warn('Could not get webview title:', error)
        }

        // Open the URL in picture-in-picture
        onOpenPictureInPictureFromUrl(currentUrl, title)
      } catch (error) {
        console.error('Error getting webview URL for PiP:', error)
        // Fallback to the stored URL if we can't get the current one
        onOpenPictureInPictureFromUrl(webView.url, 'Editor Webview')
      }
    } else {
      // Fallback to the stored URL if element not found
      onOpenPictureInPictureFromUrl(webView.url, 'Editor Webview')
    }
  }

  // Remove file handler
  const handleRemoveFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()

    // If we're currently resizing this file, reset cursor and state
    if (resizingFileId === id) {
      setResizingFileId(null)
      fileResizeStartPos.current = null
      fileResizeStartSize.current = null
      fileResizeStartPosition.current = null
      setActiveFileResizeHandle(undefined)
      document.body.style.cursor = 'auto'
    }

    // If we're currently dragging this file, reset cursor and state
    if (draggedFileId === id) {
      setDraggedFileId(null)
      fileDragOffset.current = null
      document.body.style.cursor = 'auto'
    }

    // Clean up any blob URLs
    const file = files.find((item) => item.id === id)
    if (file && file.pdfUrl) {
      URL.revokeObjectURL(file.pdfUrl)
    }

    setFiles((prev) => prev.filter((item) => item.id !== id))
    setSelectedFileIds((prev) => prev.filter((fileId) => fileId !== id))
  }

  // File navigation handlers (for presentations)
  const handleFilePrevSlide = (fileId: string) => {
    setFiles((prev) =>
      prev.map((item) => {
        if (item.id !== fileId || !item.slides) return item
        const newIndex = Math.max(0, (item.currentSlideIndex || 0) - 1)
        return { ...item, currentSlideIndex: newIndex }
      })
    )
  }

  const handleFileNextSlide = (fileId: string) => {
    setFiles((prev) =>
      prev.map((item) => {
        if (item.id !== fileId || !item.slides) return item
        const newIndex = Math.min((item.slides?.length || 1) - 1, (item.currentSlideIndex || 0) + 1)
        return { ...item, currentSlideIndex: newIndex }
      })
    )
  }

  // File zoom handlers
  const handleFileZoomIn = (fileId: string) => {
    setFiles((prev) =>
      prev.map((item) => {
        if (item.id !== fileId) return item
        return { ...item, scale: Math.min((item.scale || 1.2) * 1.25, 5) }
      })
    )
  }

  const handleFileZoomOut = (fileId: string) => {
    setFiles((prev) =>
      prev.map((item) => {
        if (item.id !== fileId) return item
        return { ...item, scale: Math.max((item.scale || 1.2) / 1.25, 0.25) }
      })
    )
  }

  const handleFileResetZoom = (fileId: string) => {
    setFiles((prev) =>
      prev.map((item) => {
        if (item.id !== fileId) return item
        return { ...item, scale: 1.2 }
      })
    )
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (
      resizingArrowId &&
      resizingArrowHandle &&
      arrowResizeStartPos.current &&
      arrowResizeOriginalPoints.current
    ) {
      const deltaX = e.clientX - arrowResizeStartPos.current.x
      const deltaY = e.clientY - arrowResizeStartPos.current.y

      const editorRect = editorRef.current?.getBoundingClientRect()
      if (!editorRect) return

      // Calculate new position relative to editor with canvas offset
      const mouseX = e.clientX - editorRect.left - canvasOffset.x
      const mouseY = e.clientY - editorRect.top - canvasOffset.y

      setDrawPaths((prev) =>
        prev.map((path) => {
          if (path.id !== resizingArrowId || path.type !== 'arrow') return path

          const originalPoints = arrowResizeOriginalPoints.current
          if (!originalPoints || originalPoints.length < 2) return path

          let newPoints = [...originalPoints]

          if (resizingArrowHandle === 'start') {
            // Update the start point (first point)
            newPoints[0] = { x: mouseX, y: mouseY }
          } else if (resizingArrowHandle === 'end') {
            // Update the end point (last point)
            newPoints[newPoints.length - 1] = { x: mouseX, y: mouseY }
          }

          return {
            ...path,
            points: newPoints
          }
        })
      )

      return
    }
    if (
      resizingShapeId &&
      resizingShapeHandle &&
      shapeResizeStartPos.current &&
      shapeResizeOriginalPoints.current
    ) {
      const deltaX = e.clientX - shapeResizeStartPos.current.x
      const deltaY = e.clientY - shapeResizeStartPos.current.y

      const editorRect = editorRef.current?.getBoundingClientRect()
      if (!editorRect) return

      // Calculate new position relative to editor with canvas offset
      const mouseX = e.clientX - editorRect.left - canvasOffset.x
      const mouseY = e.clientY - editorRect.top - canvasOffset.y

      setDrawPaths((prev) =>
        prev.map((path) => {
          if (path.id !== resizingShapeId || path.type !== 'shape') return path

          const originalPoints = shapeResizeOriginalPoints.current
          if (!originalPoints || originalPoints.length < 2) return path

          const originalFirst = originalPoints[0]
          const originalLast = originalPoints[originalPoints.length - 1]

          // Calculate original bounds
          const origX = Math.min(originalFirst.x, originalLast.x)
          const origY = Math.min(originalFirst.y, originalLast.y)
          const origWidth = Math.abs(originalLast.x - originalFirst.x)
          const origHeight = Math.abs(originalLast.y - originalFirst.y)

          let newX = origX
          let newY = origY
          let newWidth = origWidth
          let newHeight = origHeight

          // Calculate new bounds based on handle
          switch (resizingShapeHandle) {
            case 'top-left':
              newX = mouseX
              newY = mouseY
              newWidth = origX + origWidth - mouseX
              newHeight = origY + origHeight - mouseY
              break
            case 'top-right':
              newY = mouseY
              newWidth = mouseX - origX
              newHeight = origY + origHeight - mouseY
              break
            case 'bottom-left':
              newX = mouseX
              newWidth = origX + origWidth - mouseX
              newHeight = mouseY - origY
              break
            case 'bottom-right':
              newWidth = mouseX - origX
              newHeight = mouseY - origY
              break
            case 'top':
              newY = mouseY
              newHeight = origY + origHeight - mouseY
              break
            case 'bottom':
              newHeight = mouseY - origY
              break
            case 'left':
              newX = mouseX
              newWidth = origX + origWidth - mouseX
              break
            case 'right':
              newWidth = mouseX - origX
              break
          }

          // Ensure minimum size
          const minSize = 10
          if (newWidth < minSize) {
            if (resizingShapeHandle?.includes('left')) {
              newX = origX + origWidth - minSize
            }
            newWidth = minSize
          }
          if (newHeight < minSize) {
            if (resizingShapeHandle?.includes('top')) {
              newY = origY + origHeight - minSize
            }
            newHeight = minSize
          }

          // Special handling for circle - maintain aspect ratio
          if (path.shapeType === 'circle') {
            const size = Math.min(Math.abs(newWidth), Math.abs(newHeight))
            newWidth = newWidth < 0 ? -size : size
            newHeight = newHeight < 0 ? -size : size
          }

          // Update points to reflect new bounds
          const newFirst = { x: newX, y: newY }
          const newLast = { x: newX + newWidth, y: newY + newHeight }

          return {
            ...path,
            points: [newFirst, newLast]
          }
        })
      )

      return
    }
    // Handle drawing if in drawing mode
    if (isDrawing && drawingMode !== 'none') {
      const editorRect = editorRef.current?.getBoundingClientRect()
      if (!editorRect) return

      const x = e.clientX - editorRect.left - canvasOffset.x
      const y = e.clientY - editorRect.top - canvasOffset.y

      setCurrentPath((prev) => [...prev, { x, y }])
      return
    }

    if (draggedAudioId && audioDragOffset.current) {
      const editorRect = editorRef.current?.getBoundingClientRect()
      if (!editorRect) return

      const newX = e.clientX - editorRect.left - canvasOffset.x - audioDragOffset.current.x
      const newY = e.clientY - editorRect.top - canvasOffset.y - audioDragOffset.current.y

      setAudios((prev) =>
        prev.map((item) => {
          if (item.id === draggedAudioId) {
            return {
              ...item,
              x: newX,
              y: newY
            }
          }
          return item
        })
      )

      return
    }

    if (draggedFileId && fileDragOffset.current) {
      const editorRect = editorRef.current?.getBoundingClientRect()
      if (!editorRect) return

      const newX = e.clientX - editorRect.left - canvasOffset.x - fileDragOffset.current.x
      const newY = e.clientY - editorRect.top - canvasOffset.y - fileDragOffset.current.y

      setFiles((prev) =>
        prev.map((item) => {
          if (item.id === draggedFileId) {
            return {
              ...item,
              x: newX,
              y: newY
            }
          }
          return item
        })
      )

      return // IMPORTANT: Return here to prevent other handlers
    }

    // FIXED: Handle file resizing - PRIORITIZE this before other elements
    if (
      resizingFileId &&
      fileResizeStartPos.current &&
      fileResizeStartSize.current &&
      fileResizeStartPosition.current
    ) {
      const deltaX = e.clientX - fileResizeStartPos.current.x
      const deltaY = e.clientY - fileResizeStartPos.current.y

      let newWidth = fileResizeStartSize.current.width
      let newHeight = fileResizeStartSize.current.height
      let newX = fileResizeStartPosition.current.x
      let newY = fileResizeStartPosition.current.y

      const MIN_WIDTH = 300
      const MIN_HEIGHT = 200

      switch (activeFileResizeHandle) {
        case 'bottom-right':
          newWidth = Math.max(MIN_WIDTH, fileResizeStartSize.current.width + deltaX)
          newHeight = Math.max(MIN_HEIGHT, fileResizeStartSize.current.height + deltaY)
          break
        case 'bottom-left':
          newWidth = Math.max(MIN_WIDTH, fileResizeStartSize.current.width - deltaX)
          newHeight = Math.max(MIN_HEIGHT, fileResizeStartSize.current.height + deltaY)
          newX = fileResizeStartPosition.current.x - (newWidth - fileResizeStartSize.current.width)
          break
        case 'top-right':
          newWidth = Math.max(MIN_WIDTH, fileResizeStartSize.current.width + deltaX)
          newHeight = Math.max(MIN_HEIGHT, fileResizeStartSize.current.height - deltaY)
          newY =
            fileResizeStartPosition.current.y - (newHeight - fileResizeStartSize.current.height)
          break
        case 'top-left':
          newWidth = Math.max(MIN_WIDTH, fileResizeStartSize.current.width - deltaX)
          newHeight = Math.max(MIN_HEIGHT, fileResizeStartSize.current.height - deltaY)
          newX = fileResizeStartPosition.current.x - (newWidth - fileResizeStartSize.current.width)
          newY =
            fileResizeStartPosition.current.y - (newHeight - fileResizeStartSize.current.height)
          break
        case 'top':
          newHeight = Math.max(MIN_HEIGHT, fileResizeStartSize.current.height - deltaY)
          newY =
            fileResizeStartPosition.current.y - (newHeight - fileResizeStartSize.current.height)
          break
        case 'right':
          newWidth = Math.max(MIN_WIDTH, fileResizeStartSize.current.width + deltaX)
          break
        case 'bottom':
          newHeight = Math.max(MIN_HEIGHT, fileResizeStartSize.current.height + deltaY)
          break
        case 'left':
          newWidth = Math.max(MIN_WIDTH, fileResizeStartSize.current.width - deltaX)
          newX = fileResizeStartPosition.current.x - (newWidth - fileResizeStartSize.current.width)
          break
      }

      setFiles((prev) =>
        prev.map((item) => {
          if (item.id === resizingFileId) {
            return {
              ...item,
              width: newWidth,
              height: newHeight,
              x: newX,
              y: newY
            }
          }
          return item
        })
      )

      return // IMPORTANT: Return here to prevent other handlers
    }

    if (draggedFileId) {
      setDraggedFileId(null)
      fileDragOffset.current = null
      document.body.style.cursor = 'auto' // FIXED: Reset cursor properly
      return
    }

    // End file resizing
    if (resizingFileId) {
      setResizingFileId(null)
      fileResizeStartPos.current = null
      fileResizeStartSize.current = null
      fileResizeStartPosition.current = null
      setActiveFileResizeHandle(undefined)
      document.body.style.cursor = 'auto' // FIXED: Reset cursor properly
      return
    }

    // ADD these to your existing handleEditorMouseLeave function:

    if (draggedFileId) {
      setDraggedFileId(null)
      fileDragOffset.current = null
      document.body.style.cursor = 'auto' // FIXED: Reset cursor properly
    }

    if (resizingFileId) {
      setResizingFileId(null)
      fileResizeStartPos.current = null
      fileResizeStartSize.current = null
      fileResizeStartPosition.current = null
      setActiveFileResizeHandle(undefined)
      document.body.style.cursor = 'auto' // FIXED: Reset cursor properly
    }

    // Handle audio resizing
    if (
      resizingAudioId &&
      audioResizeStartPos.current &&
      audioResizeStartSize.current &&
      audioResizeStartPosition.current
    ) {
      const deltaX = e.clientX - audioResizeStartPos.current.x
      const deltaY = e.clientY - audioResizeStartPos.current.y

      let newWidth = audioResizeStartSize.current.width
      let newHeight = audioResizeStartSize.current.height
      let newX = audioResizeStartPosition.current.x
      let newY = audioResizeStartPosition.current.y

      const MIN_WIDTH = 200
      const MIN_HEIGHT = 40

      switch (activeAudioResizeHandle) {
        case 'bottom-right':
          newWidth = Math.max(MIN_WIDTH, audioResizeStartSize.current.width + deltaX)
          newHeight = Math.max(MIN_HEIGHT, audioResizeStartSize.current.height + deltaY)
          break
        case 'bottom-left':
          newWidth = Math.max(MIN_WIDTH, audioResizeStartSize.current.width - deltaX)
          newHeight = Math.max(MIN_HEIGHT, audioResizeStartSize.current.height + deltaY)
          newX =
            audioResizeStartPosition.current.x - (newWidth - audioResizeStartSize.current.width)
          break
        case 'top-right':
          newWidth = Math.max(MIN_WIDTH, audioResizeStartSize.current.width + deltaX)
          newHeight = Math.max(MIN_HEIGHT, audioResizeStartSize.current.height - deltaY)
          newY =
            audioResizeStartPosition.current.y - (newHeight - audioResizeStartSize.current.height)
          break
        case 'top-left':
          newWidth = Math.max(MIN_WIDTH, audioResizeStartSize.current.width - deltaX)
          newHeight = Math.max(MIN_HEIGHT, audioResizeStartSize.current.height - deltaY)
          newX =
            audioResizeStartPosition.current.x - (newWidth - audioResizeStartSize.current.width)
          newY =
            audioResizeStartPosition.current.y - (newHeight - audioResizeStartSize.current.height)
          break
        case 'top':
          newHeight = Math.max(MIN_HEIGHT, audioResizeStartSize.current.height - deltaY)
          newY =
            audioResizeStartPosition.current.y - (newHeight - audioResizeStartSize.current.height)
          break
        case 'right':
          newWidth = Math.max(MIN_WIDTH, audioResizeStartSize.current.width + deltaX)
          break
        case 'bottom':
          newHeight = Math.max(MIN_HEIGHT, audioResizeStartSize.current.height + deltaY)
          break
        case 'left':
          newWidth = Math.max(MIN_WIDTH, audioResizeStartSize.current.width - deltaX)
          newX =
            audioResizeStartPosition.current.x - (newWidth - audioResizeStartSize.current.width)
          break
      }

      setAudios((prev) =>
        prev.map((item) => {
          if (item.id === resizingAudioId) {
            return {
              ...item,
              width: newWidth,
              height: newHeight,
              x: newX,
              y: newY
            }
          }
          return item
        })
      )

      return
    }

    if (draggedImageId && imageDragOffset.current) {
      const editorRect = editorRef.current?.getBoundingClientRect()
      if (!editorRect) return

      const newX = e.clientX - editorRect.left - canvasOffset.x - imageDragOffset.current.x
      const newY = e.clientY - editorRect.top - canvasOffset.y - imageDragOffset.current.y

      setImages((prev) =>
        prev.map((item) => {
          if (item.id === draggedImageId) {
            return {
              ...item,
              x: newX,
              y: newY
            }
          }
          return item
        })
      )

      return
    }

    if (draggedVideoId && videoDragOffset.current) {
      const editorRect = editorRef.current?.getBoundingClientRect()
      if (!editorRect) return

      const newX = e.clientX - editorRect.left - canvasOffset.x - videoDragOffset.current.x
      const newY = e.clientY - editorRect.top - canvasOffset.y - videoDragOffset.current.y

      setVideos((prev) =>
        prev.map((item) => {
          if (item.id === draggedVideoId) {
            return {
              ...item,
              x: newX,
              y: newY
            }
          }
          return item
        })
      )

      return
    }

    if (
      resizingVideoId &&
      videoResizeStartPos.current &&
      videoResizeStartSize.current &&
      videoResizeStartPosition.current
    ) {
      const deltaX = e.clientX - videoResizeStartPos.current.x
      const deltaY = e.clientY - videoResizeStartPos.current.y

      let newWidth = videoResizeStartSize.current.width
      let newHeight = videoResizeStartSize.current.height
      let newX = videoResizeStartPosition.current.x
      let newY = videoResizeStartPosition.current.y

      const MIN_WIDTH = 100
      const MIN_HEIGHT = 75

      switch (activeVideoResizeHandle) {
        case 'bottom-right':
          newWidth = Math.max(MIN_WIDTH, videoResizeStartSize.current.width + deltaX)
          newHeight = Math.max(MIN_HEIGHT, videoResizeStartSize.current.height + deltaY)
          break
        case 'bottom-left':
          newWidth = Math.max(MIN_WIDTH, videoResizeStartSize.current.width - deltaX)
          newHeight = Math.max(MIN_HEIGHT, videoResizeStartSize.current.height + deltaY)
          newX =
            videoResizeStartPosition.current.x - (newWidth - videoResizeStartSize.current.width)
          break
        case 'top-right':
          newWidth = Math.max(MIN_WIDTH, videoResizeStartSize.current.width + deltaX)
          newHeight = Math.max(MIN_HEIGHT, videoResizeStartSize.current.height - deltaY)
          newY =
            videoResizeStartPosition.current.y - (newHeight - videoResizeStartSize.current.height)
          break
        case 'top-left':
          newWidth = Math.max(MIN_WIDTH, videoResizeStartSize.current.width - deltaX)
          newHeight = Math.max(MIN_HEIGHT, videoResizeStartSize.current.height - deltaY)
          newX =
            videoResizeStartPosition.current.x - (newWidth - videoResizeStartSize.current.width)
          newY =
            videoResizeStartPosition.current.y - (newHeight - videoResizeStartSize.current.height)
          break
        case 'top':
          newHeight = Math.max(MIN_HEIGHT, videoResizeStartSize.current.height - deltaY)
          newY =
            videoResizeStartPosition.current.y - (newHeight - videoResizeStartSize.current.height)
          break
        case 'right':
          newWidth = Math.max(MIN_WIDTH, videoResizeStartSize.current.width + deltaX)
          break
        case 'bottom':
          newHeight = Math.max(MIN_HEIGHT, videoResizeStartSize.current.height + deltaY)
          break
        case 'left':
          newWidth = Math.max(MIN_WIDTH, videoResizeStartSize.current.width - deltaX)
          newX =
            videoResizeStartPosition.current.x - (newWidth - videoResizeStartSize.current.width)
          break
      }

      setVideos((prev) =>
        prev.map((item) => {
          if (item.id === resizingVideoId) {
            return {
              ...item,
              width: newWidth,
              height: newHeight,
              x: newX,
              y: newY
            }
          }
          return item
        })
      )

      return
    }

    if (draggedVideoId) {
      setDraggedVideoId(null)
      videoDragOffset.current = null
      document.body.style.cursor = 'auto'
      return
    }

    // End video resizing
    if (resizingVideoId) {
      setResizingVideoId(null)
      videoResizeStartPos.current = null
      videoResizeStartSize.current = null
      videoResizeStartPosition.current = null
      setActiveVideoResizeHandle(undefined)
      document.body.style.cursor = 'auto'
      return
    }

    // Add to handleEditorMouseLeave function:

    if (draggedVideoId) {
      setDraggedVideoId(null)
      videoDragOffset.current = null
      document.body.style.cursor = 'auto'
    }

    if (resizingVideoId) {
      setResizingVideoId(null)
      videoResizeStartPos.current = null
      videoResizeStartSize.current = null
      videoResizeStartPosition.current = null
      setActiveVideoResizeHandle(undefined)
      document.body.style.cursor = 'auto'
    }

    // Handle resizing image
    if (
      resizingImageId &&
      imageResizeStartPos.current &&
      imageResizeStartSize.current &&
      imageResizeStartPosition.current
    ) {
      const deltaX = e.clientX - imageResizeStartPos.current.x
      const deltaY = e.clientY - imageResizeStartPos.current.y

      let newWidth = imageResizeStartSize.current.width
      let newHeight = imageResizeStartSize.current.height
      let newX = imageResizeStartPosition.current.x
      let newY = imageResizeStartPosition.current.y

      const MIN_WIDTH = 50
      const MIN_HEIGHT = 50

      switch (activeImageResizeHandle) {
        case 'bottom-right':
          newWidth = Math.max(MIN_WIDTH, imageResizeStartSize.current.width + deltaX)
          newHeight = Math.max(MIN_HEIGHT, imageResizeStartSize.current.height + deltaY)
          break
        case 'bottom-left':
          newWidth = Math.max(MIN_WIDTH, imageResizeStartSize.current.width - deltaX)
          newHeight = Math.max(MIN_HEIGHT, imageResizeStartSize.current.height + deltaY)
          newX =
            imageResizeStartPosition.current.x - (newWidth - imageResizeStartSize.current.width)
          break
        case 'top-right':
          newWidth = Math.max(MIN_WIDTH, imageResizeStartSize.current.width + deltaX)
          newHeight = Math.max(MIN_HEIGHT, imageResizeStartSize.current.height - deltaY)
          newY =
            imageResizeStartPosition.current.y - (newHeight - imageResizeStartSize.current.height)
          break
        case 'top-left':
          newWidth = Math.max(MIN_WIDTH, imageResizeStartSize.current.width - deltaX)
          newHeight = Math.max(MIN_HEIGHT, imageResizeStartSize.current.height - deltaY)
          newX =
            imageResizeStartPosition.current.x - (newWidth - imageResizeStartSize.current.width)
          newY =
            imageResizeStartPosition.current.y - (newHeight - imageResizeStartSize.current.height)
          break
        case 'top':
          newHeight = Math.max(MIN_HEIGHT, imageResizeStartSize.current.height - deltaY)
          newY =
            imageResizeStartPosition.current.y - (newHeight - imageResizeStartSize.current.height)
          break
        case 'right':
          newWidth = Math.max(MIN_WIDTH, imageResizeStartSize.current.width + deltaX)
          break
        case 'bottom':
          newHeight = Math.max(MIN_HEIGHT, imageResizeStartSize.current.height + deltaY)
          break
        case 'left':
          newWidth = Math.max(MIN_WIDTH, imageResizeStartSize.current.width - deltaX)
          newX =
            imageResizeStartPosition.current.x - (newWidth - imageResizeStartSize.current.width)
          break
      }

      setImages((prev) =>
        prev.map((item) => {
          if (item.id === resizingImageId) {
            return {
              ...item,
              width: newWidth,
              height: newHeight,
              x: newX,
              y: newY
            }
          }
          return item
        })
      )

      return
    }

    // Handle dragging selected drawing path
    if (draggedDrawPathId && pathDragOffset.current) {
      const editorRect = editorRef.current?.getBoundingClientRect()
      if (!editorRect) return

      const mouseX = e.clientX - editorRect.left - canvasOffset.x
      const mouseY = e.clientY - editorRect.top - canvasOffset.y

      // Find the dragged path to calculate the delta movement
      const draggedPath = drawPaths.find((p) => p.id === draggedDrawPathId)
      if (!draggedPath || !draggedPath.points || draggedPath.points.length === 0) return

      // Make sure the first point exists and has valid coordinates
      const originalFirstPoint = draggedPath.points[0]
      if (
        !originalFirstPoint ||
        typeof originalFirstPoint.x !== 'number' ||
        typeof originalFirstPoint.y !== 'number'
      )
        return

      // Calculate the delta movement
      const targetX = mouseX - pathDragOffset.current.x
      const targetY = mouseY - pathDragOffset.current.y
      const deltaX = targetX - originalFirstPoint.x
      const deltaY = targetY - originalFirstPoint.y

      // Move all SELECTED paths by the same delta, not just the dragged one
      setDrawPaths((prev) =>
        prev.map((path) => {
          // If this path is not selected, leave it unchanged
          if (!selectedDrawPathIds.includes(path.id)) return path

          // Skip paths with no points or invalid data
          if (!path.points || path.points.length === 0) return path

          // Move all points in the selected path by the same delta
          return {
            ...path,
            points: path.points.map((point) => {
              // Skip invalid points
              if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return point

              return {
                ...point,
                x: point.x + deltaX,
                y: point.y + deltaY
              }
            })
          }
        })
      )

      return
    }

    // Handle dragging webview - prioritize this operation
    if (draggedWebViewId && webViewDragOffset.current) {
      const editorRect = editorRef.current?.getBoundingClientRect()
      if (!editorRect) return

      // Calculate new position
      const newX = e.clientX - editorRect.left - canvasOffset.x - webViewDragOffset.current.x
      const newY = e.clientY - editorRect.top - canvasOffset.y - webViewDragOffset.current.y

      // Update the webview position
      setWebViews((prev) =>
        prev.map((item) => {
          if (item.id === draggedWebViewId) {
            return {
              ...item,
              position: { x: newX, y: newY }
            }
          }
          return item
        })
      )

      return
    }

    // Handle resizing webview
    if (
      resizingWebViewId &&
      webViewResizeStartPos.current &&
      webViewResizeStartSize.current &&
      webViewResizeStartPosition.current
    ) {
      // Calculate the change in mouse position
      const deltaX = e.clientX - webViewResizeStartPos.current.x
      const deltaY = e.clientY - webViewResizeStartPos.current.y

      // Calculate new size and position based on which handle is being used
      let newWidth = webViewResizeStartSize.current.width
      let newHeight = webViewResizeStartSize.current.height
      let newX = webViewResizeStartPosition.current.x
      let newY = webViewResizeStartPosition.current.y

      const MIN_WIDTH = 200
      const MIN_HEIGHT = 150

      switch (activeResizeHandle) {
        case 'bottom-right':
          // Just resize width and height (original behavior)
          newWidth = Math.max(MIN_WIDTH, webViewResizeStartSize.current.width + deltaX)
          newHeight = Math.max(MIN_HEIGHT, webViewResizeStartSize.current.height + deltaY)
          break

        case 'bottom-left':
          // Resize width (negatively) and height, adjust x position
          newWidth = Math.max(MIN_WIDTH, webViewResizeStartSize.current.width - deltaX)
          newHeight = Math.max(MIN_HEIGHT, webViewResizeStartSize.current.height + deltaY)
          newX =
            webViewResizeStartPosition.current.x - (newWidth - webViewResizeStartSize.current.width)
          break

        case 'top-right':
          // Resize width and height (negatively), adjust y position
          newWidth = Math.max(MIN_WIDTH, webViewResizeStartSize.current.width + deltaX)
          newHeight = Math.max(MIN_HEIGHT, webViewResizeStartSize.current.height - deltaY)
          newY =
            webViewResizeStartPosition.current.y -
            (newHeight - webViewResizeStartSize.current.height)
          break

        case 'top-left':
          // Resize width and height (both negatively), adjust both positions
          newWidth = Math.max(MIN_WIDTH, webViewResizeStartSize.current.width - deltaX)
          newHeight = Math.max(MIN_HEIGHT, webViewResizeStartSize.current.height - deltaY)
          newX =
            webViewResizeStartPosition.current.x - (newWidth - webViewResizeStartSize.current.width)
          newY =
            webViewResizeStartPosition.current.y -
            (newHeight - webViewResizeStartSize.current.height)
          break

        case 'top':
          // Only resize height (negatively) and adjust y position
          newHeight = Math.max(MIN_HEIGHT, webViewResizeStartSize.current.height - deltaY)
          newY =
            webViewResizeStartPosition.current.y -
            (newHeight - webViewResizeStartSize.current.height)
          break

        case 'right':
          // Only resize width
          newWidth = Math.max(MIN_WIDTH, webViewResizeStartSize.current.width + deltaX)
          break

        case 'bottom':
          // Only resize height
          newHeight = Math.max(MIN_HEIGHT, webViewResizeStartSize.current.height + deltaY)
          break

        case 'left':
          // Resize width (negatively) and adjust x position
          newWidth = Math.max(MIN_WIDTH, webViewResizeStartSize.current.width - deltaX)
          newX =
            webViewResizeStartPosition.current.x - (newWidth - webViewResizeStartSize.current.width)
          break
      }

      // Update the webview size and position
      setWebViews((prev) =>
        prev.map((item) => {
          if (item.id === resizingWebViewId) {
            return {
              ...item,
              size: { width: newWidth, height: newHeight },
              position: { x: newX, y: newY }
            }
          }
          return item
        })
      )

      return
    }

    // Handle dragging textarea(s)
    if (draggedTextAreaId && dragOffset.current) {
      const editorRect = editorRef.current?.getBoundingClientRect()
      if (!editorRect) return

      // Calculate new position for the dragged text area
      const newX = e.clientX - editorRect.left - canvasOffset.x - dragOffset.current.x
      const newY = e.clientY - editorRect.top - canvasOffset.y - dragOffset.current.y

      // Get the original position of the dragged textarea
      const draggedTextArea = textAreas.find((item) => item.id === draggedTextAreaId)
      if (!draggedTextArea) return

      // Calculate the movement delta
      const deltaX = newX - draggedTextArea.position.x
      const deltaY = newY - draggedTextArea.position.y

      // Move all selected text areas by the same delta
      setTextAreas((prev) =>
        prev.map((item) => {
          if (selectedTextAreaIds.includes(item.id)) {
            return {
              ...item,
              position: {
                x: item.position.x + deltaX,
                y: item.position.y + deltaY
              }
            }
          }
          return item
        })
      )

      return
    }

    // Handle panning
    if (isPanning && lastMousePos.current) {
      const deltaX = e.clientX - lastMousePos.current.x
      const deltaY = e.clientY - lastMousePos.current.y

      setCanvasOffset((prev) => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }))

      lastMousePos.current = { x: e.clientX, y: e.clientY }
      return
    }

    if (!isSelecting || !startPositionRef.current) return

    const editorRect = editorRef.current?.getBoundingClientRect()
    if (!editorRect) return

    // Calculate current position relative to the editor
    const currentX = e.clientX - editorRect.left
    const currentY = e.clientY - editorRect.top

    // Calculate width and height
    const width = currentX - startPositionRef.current.x
    const height = currentY - startPositionRef.current.y

    // Update the selection rectangle
    setSelectionRect({
      startX: width >= 0 ? startPositionRef.current.x : currentX,
      startY: height >= 0 ? startPositionRef.current.y : currentY,
      width: Math.abs(width),
      height: Math.abs(height)
    })
  }

  const convertToListItems = (content: string): ListItemData[] => {
    if (!content.trim()) {
      // If empty, create a list with one empty item
      return [{ id: Date.now().toString() + Math.random().toString(36).substr(2, 9), content: '' }]
    }

    // Split by lines and create list items
    const lines = content.split(/\r?\n/)
    return lines
      .map((line) => {
        // Remove any existing bullet markers
        let cleanLine = line.trim().replace(/^[-•*]\s*/, '')

        // Remove numbered list markers
        cleanLine = cleanLine.replace(/^\d+\.\s*/, '')

        return {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          content: cleanLine
        }
      })
      .filter((item) => item.content !== '' || lines.length === 1)
  }

  // Add these functions to handle list operations
  const handleAddListItem = (textAreaId: string) => {
    setTextAreas((prev) => {
      return prev.map((item) => {
        if (
          item.id !== textAreaId ||
          (item.format !== 'bulletList' && item.format !== 'numberedList')
        )
          return item

        const newListItem: ListItemData = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          content: ''
        }

        return {
          ...item,
          listItems: [...(item.listItems || []), newListItem]
        }
      })
    })
  }

  const handleRemoveListItem = (textAreaId: string, listItemId: string) => {
    setTextAreas((prev) => {
      return prev.map((item) => {
        if (
          item.id !== textAreaId ||
          (item.format !== 'bulletList' && item.format !== 'numberedList')
        )
          return item

        // Remove the list item
        const updatedListItems = (item.listItems || []).filter(
          (listItem) => listItem.id !== listItemId
        )

        // If there are no list items left, convert back to normal text
        if (updatedListItems.length === 0) {
          return {
            ...item,
            format: 'normal' as const,
            content: '',
            listItems: undefined
          }
        }

        return {
          ...item,
          listItems: updatedListItems
        }
      })
    })
  }

  const handleUpdateListItemContent = (textAreaId: string, listItemId: string, content: string) => {
    setTextAreas((prev) => {
      return prev.map((item) => {
        if (
          item.id !== textAreaId ||
          (item.format !== 'bulletList' && item.format !== 'numberedList')
        )
          return item

        const updatedListItems = (item.listItems || []).map((listItem) => {
          if (listItem.id !== listItemId) return listItem
          return { ...listItem, content }
        })

        return {
          ...item,
          listItems: updatedListItems
        }
      })
    })
  }

  const [minimapVisible, setMinimapVisible] = useState(true)
  // Add this state for viewport tracking
  const [viewportDimensions, setViewportDimensions] = useState({ width: 0, height: 0 })

  // Add this useEffect to track viewport size
  useEffect(() => {
    const updateViewportSize = () => {
      if (editorRef.current) {
        const rect = editorRef.current.getBoundingClientRect()
        setViewportDimensions({ width: rect.width, height: rect.height })
      }
    }

    updateViewportSize()
    window.addEventListener('resize', updateViewportSize)
    return () => window.removeEventListener('resize', updateViewportSize)
  }, [])

  const handleMinimapNavigate = (newOffsetX: number, newOffsetY: number) => {
    setCanvasOffset({ x: newOffsetX, y: newOffsetY })
  }

  const handleListItemKeyDown = (
    e: React.KeyboardEvent,
    textAreaId: string,
    listItemId: string,
    index: number
  ) => {
    // Get the current text area
    const textArea = textAreas.find((item) => item.id === textAreaId)
    if (!textArea || !textArea.listItems) return

    // Get the current list item
    const listItem = textArea.listItems.find((item) => item.id === listItemId)
    if (!listItem) return

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault() // Prevent default Enter behavior

      // Add a new list item after the current one
      setTextAreas((prev) => {
        return prev.map((item) => {
          if (
            item.id !== textAreaId ||
            (item.format !== 'bulletList' && item.format !== 'numberedList')
          )
            return item

          const newListItem: ListItemData = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            content: ''
          }

          const updatedListItems = [...(item.listItems || [])]
          updatedListItems.splice(index + 1, 0, newListItem)

          return {
            ...item,
            listItems: updatedListItems
          }
        })
      })

      // Focus the new item after render
      setTimeout(() => {
        const listElement = document.getElementById(`list-${textAreaId}`)
        if (listElement) {
          const listInputs = listElement.querySelectorAll('[contenteditable="true"]')
          if (listInputs.length > index + 1) {
            ;(listInputs[index + 1] as HTMLElement).focus()
          }
        }
      }, 0)
    } else if (e.key === 'Backspace' && listItem.content === '') {
      e.preventDefault() // Prevent default Backspace behavior

      // If this is the only item, don't remove it
      if (textArea.listItems.length === 1) return

      // Remove the current list item
      handleRemoveListItem(textAreaId, listItemId)

      // Focus the previous item if it exists
      if (index > 0) {
        setTimeout(() => {
          const listElement = document.getElementById(`list-${textAreaId}`)
          if (listElement) {
            const listInputs = listElement.querySelectorAll('[contenteditable="true"]')
            if (listInputs.length >= index) {
              ;(listInputs[index - 1] as HTMLElement).focus()

              // Move cursor to end of text
              const range = document.createRange()
              const sel = window.getSelection()
              range.selectNodeContents(listInputs[index - 1])
              range.collapse(false)
              sel?.removeAllRanges()
              sel?.addRange(range)
            }
          }
        }, 0)
      }
    }
  }

  const handleListItemBlur = (textAreaId: string) => {
    // Find the text area
    const textArea = textAreas.find((item) => item.id === textAreaId)

    if (
      textArea &&
      (textArea.format === 'bulletList' || textArea.format === 'numberedList') &&
      textArea.listItems
    ) {
      // Check if there's only one list item and it's empty
      if (
        textArea.listItems.length === 1 &&
        (!textArea.listItems[0].content || !textArea.listItems[0].content.trim())
      ) {
        setTextAreas((prev) => prev.filter((item) => item.id !== textAreaId))
      }
    }
  }

  const handleMouseUp = () => {
    if (draggedDrawPathId) {
      setDraggedDrawPathId(null)
      pathDragOffset.current = null
      document.body.style.cursor = 'default'
      return
    }

    if (resizingShapeId) {
      setResizingShapeId(null)
      setResizingShapeHandle(null)
      shapeResizeStartPos.current = null
      shapeResizeOriginalPoints.current = null
      document.body.style.cursor = 'default'
      return
    }

    if (resizingArrowId) {
      setResizingArrowId(null)
      setResizingArrowHandle(null)
      arrowResizeStartPos.current = null
      arrowResizeOriginalPoints.current = null
      document.body.style.cursor = 'default'
      return
    }

    if (draggedFileId) {
      console.log('Ending file drag for:', draggedFileId)
      setDraggedFileId(null)
      fileDragOffset.current = null
      document.body.style.cursor = 'auto'
      return
    }

    // FIXED: End file resizing FIRST (highest priority)
    if (resizingFileId) {
      console.log('Ending file resize for:', resizingFileId)
      setResizingFileId(null)
      fileResizeStartPos.current = null
      fileResizeStartSize.current = null
      fileResizeStartPosition.current = null
      setActiveFileResizeHandle(undefined)
      document.body.style.cursor = 'auto'
      return
    }

    if (draggedAudioId) {
      setDraggedAudioId(null)
      audioDragOffset.current = null
      document.body.style.cursor = 'auto'
      return
    }

    // End audio resizing
    if (resizingAudioId) {
      setResizingAudioId(null)
      audioResizeStartPos.current = null
      audioResizeStartSize.current = null
      audioResizeStartPosition.current = null
      setActiveAudioResizeHandle(undefined)
      document.body.style.cursor = 'auto'
      return
    }

    // End image dragging
    if (draggedImageId) {
      setDraggedImageId(null)
      imageDragOffset.current = null
      document.body.style.cursor = 'auto'
      return
    }

    // End image resizing
    if (resizingImageId) {
      setResizingImageId(null)
      imageResizeStartPos.current = null
      imageResizeStartSize.current = null
      imageResizeStartPosition.current = null
      setActiveImageResizeHandle(undefined)
      document.body.style.cursor = 'auto'
      return
    }

    // End video dragging with proper cursor reset
    if (draggedVideoId) {
      setDraggedVideoId(null)
      videoDragOffset.current = null
      document.body.style.cursor = 'auto'
      return
    }

    // End video resizing with proper cursor reset
    if (resizingVideoId) {
      setResizingVideoId(null)
      videoResizeStartPos.current = null
      videoResizeStartSize.current = null
      videoResizeStartPosition.current = null
      setActiveVideoResizeHandle(undefined)
      document.body.style.cursor = 'auto'
      return
    }

    if (isDrawing && drawingMode !== 'none') {
      if (currentPath.length > 1) {
        // Create a new drawing path object
        const newPath: DrawPath = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          points: [...currentPath],
          color: drawColor,
          width: drawWidth,
          type: drawingMode,
          shapeType: drawingMode === 'shape' ? currentShapeType : undefined
        }

        // Add the new path to the permanent paths array
        setDrawPaths((prev) => [...prev, newPath])

        // Auto-select the newly drawn path
        setSelectedDrawPathIds([newPath.id])
        setSelectedDrawPathId(newPath.id)
      }

      // Clear the temporary drawing state
      setIsDrawing(false)
      setCurrentPath([])
      return
    }

    // End webview dragging
    if (draggedWebViewId) {
      setDraggedWebViewId(null)
      webViewDragOffset.current = null
      document.body.style.cursor = 'auto'
      return
    }

    // End webview resizing
    if (resizingWebViewId) {
      setResizingWebViewId(null)
      webViewResizeStartPos.current = null
      webViewResizeStartSize.current = null
      document.body.style.cursor = 'auto'
      return
    }

    // End textarea dragging
    if (draggedTextAreaId) {
      setDraggedTextAreaId(null)
      dragOffset.current = null
      document.body.style.cursor = 'auto'
      return
    }

    // End panning
    if (isPanning) {
      setIsPanning(false)
      lastMousePos.current = null
      return
    }

    if (!isSelecting) return

    setIsSelecting(false)

    // Only consider it a valid selection if it has some meaningful size
    if (selectionRect && (selectionRect.width > 5 || selectionRect.height > 5)) {
      // Log the selection data
      console.log('Selection complete:', selectionRect)

      // Select elements within the selection area
      simulateElementSelection(selectionRect)
    }

    // Clear the selection rectangle in all cases
    setTimeout(() => {
      setSelectionRect(null)
    }, 100) // Small delay so user can see what was selected
  }

  // Helper function to find the container element (paragraph or div)
  const findContainer = (node: Node): HTMLElement | null => {
    let current: Node | null = node

    while (current && current.nodeType !== Node.ELEMENT_NODE) {
      current = current.parentNode
    }

    if (!current) return null

    const element = current as HTMLElement

    // Find the closest contenteditable div or paragraph
    if (element.getAttribute('contenteditable') === 'true') {
      return element
    } else if (element.tagName === 'P') {
      return element
    } else {
      const closest = element.closest('[contenteditable="true"]') || element.closest('p')
      return (closest as HTMLElement) || null
    }
  }

  const simulateElementSelection = (rect: SelectionRectangle) => {
    const selectedAudioIds = audios
      .filter((audio) => {
        // Check if the audio intersects with the selection rectangle
        const audioLeft = audio.x
        const audioTop = audio.y
        const audioRight = audioLeft + audio.width
        const audioBottom = audioTop + audio.height

        return (
          rect.startX < audioRight &&
          rect.startX + rect.width > audioLeft &&
          rect.startY < audioBottom &&
          rect.startY + rect.height > audioTop
        )
      })
      .map((audio) => audio.id)

    const selectedVideoIds = videos
      .filter((video) => {
        // Check if the video intersects with the selection rectangle
        const videoLeft = video.x
        const videoTop = video.y
        const videoRight = videoLeft + video.width
        const videoBottom = videoTop + video.height

        return (
          rect.startX < videoRight &&
          rect.startX + rect.width > videoLeft &&
          rect.startY < videoBottom &&
          rect.startY + rect.height > videoTop
        )
      })
      .map((video) => video.id)

    const selectedImageIds = images
      .filter((image) => {
        // Check if the image intersects with the selection rectangle
        const imageLeft = image.x
        const imageTop = image.y
        const imageRight = imageLeft + image.width
        const imageBottom = imageTop + image.height

        return (
          rect.startX < imageRight &&
          rect.startX + rect.width > imageLeft &&
          rect.startY < imageBottom &&
          rect.startY + rect.height > imageTop
        )
      })
      .map((image) => image.id)

    // Find files that intersect with the selection rectangle
    const selectedFileIds = files
      .filter((file) => {
        // Check if the file intersects with the selection rectangle
        const fileLeft = file.x
        const fileTop = file.y
        const fileRight = fileLeft + file.width
        const fileBottom = fileTop + file.height

        return (
          rect.startX < fileRight &&
          rect.startX + rect.width > fileLeft &&
          rect.startY < fileBottom &&
          rect.startY + rect.height > fileTop
        )
      })
      .map((file) => file.id)

    // Find text areas that intersect with the selection rectangle
    const selectedTextIds = textAreas
      .filter((textArea) => {
        // Get the DOM element
        const element = document.getElementById(`textarea-row-${textArea.id}`)
        if (!element) return false

        // Get the element bounds relative to the editor
        const elementRect = element.getBoundingClientRect()
        const editorRect = editorRef.current?.getBoundingClientRect()
        if (!editorRect) return false

        // Convert coordinates to be relative to the editor with canvas offset
        const textAreaLeft = elementRect.left - editorRect.left - canvasOffset.x
        const textAreaTop = elementRect.top - editorRect.top - canvasOffset.y
        const textAreaRight = textAreaLeft + elementRect.width
        const textAreaBottom = textAreaTop + elementRect.height

        // Check if the text area intersects with the selection rectangle
        return (
          rect.startX < textAreaRight &&
          rect.startX + rect.width > textAreaLeft &&
          rect.startY < textAreaBottom &&
          rect.startY + rect.height > textAreaTop
        )
      })
      .map((textArea) => textArea.id)

    // Find drawing paths that intersect with the selection rectangle
    const selectedDrawIds = drawPaths
      .filter((path) => {
        // Skip paths with no points or invalid data
        if (!path || !path.points || !Array.isArray(path.points) || path.points.length === 0) {
          return false
        }

        // Safely calculate bounding box for each drawing path
        // Add null checks for every point access
        const xPoints = path.points
          .filter((p) => p && typeof p.x === 'number') // Filter out null or invalid points
          .map((p) => p.x)

        const yPoints = path.points
          .filter((p) => p && typeof p.y === 'number') // Filter out null or invalid points
          .map((p) => p.y)

        // If we don't have valid points after filtering, skip this path
        if (xPoints.length === 0 || yPoints.length === 0) {
          return false
        }

        const minX = Math.min(...xPoints)
        const minY = Math.min(...yPoints)
        const maxX = Math.max(...xPoints)
        const maxY = Math.max(...yPoints)

        // Check if the drawing path's bounding box intersects with the selection rectangle
        return (
          rect.startX < maxX &&
          rect.startX + rect.width > minX &&
          rect.startY < maxY &&
          rect.startY + rect.height > minY
        )
      })
      .map((path) => path.id)

    if (window.event && (window.event as KeyboardEvent).shiftKey) {
      setSelectedTextAreaIds((prev) => [...new Set([...prev, ...selectedTextIds])])
      setSelectedDrawPathIds((prev) => [...new Set([...prev, ...selectedDrawIds])])
      setSelectedImageIds((prev) => [...new Set([...prev, ...selectedImageIds])])
      setSelectedVideoIds((prev) => [...new Set([...prev, ...selectedVideoIds])])
      setSelectedAudioIds((prev) => [...new Set([...prev, ...selectedAudioIds])])
      setSelectedFileIds((prev) => [...new Set([...prev, ...selectedFileIds])])
    } else {
      setSelectedTextAreaIds(selectedTextIds)
      setSelectedDrawPathIds(selectedDrawIds)
      setSelectedImageIds(selectedImageIds)
      setSelectedVideoIds(selectedVideoIds)
      setSelectedAudioIds(selectedAudioIds)
      setSelectedFileIds(selectedFileIds)

      if (selectedDrawIds.length === 0) {
        setSelectedDrawPathId(null)
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    // Check if user is currently interacting with an interactive component
    const activeElement = document.activeElement
    const isInteracting =
      activeElement &&
      (activeElement.closest('.dcg-container') ||
        activeElement.closest('input') ||
        activeElement.closest('textarea') ||
        activeElement.closest('[contenteditable="true"]') ||
        activeElement.closest('iframe') ||
        activeElement.closest('webview') ||
        activeElement.closest('.code-editor-container') ||
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA')

    if (selectedDrawPathIds.length > 0 && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault()

      // Clean up shape resize state if deleting a resizing shape
      if (resizingShapeId && selectedDrawPathIds.includes(resizingShapeId)) {
        setResizingShapeId(null)
        setResizingShapeHandle(null)
        shapeResizeStartPos.current = null
        shapeResizeOriginalPoints.current = null
        document.body.style.cursor = 'auto'
      }

      handleDeleteDrawPath()
      return
    }

    if (selectedDrawPathIds.length > 0 && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault()

      // Clean up arrow resize state if deleting a resizing arrow
      if (resizingArrowId && selectedDrawPathIds.includes(resizingArrowId)) {
        setResizingArrowId(null)
        setResizingArrowHandle(null)
        arrowResizeStartPos.current = null
        arrowResizeOriginalPoints.current = null
        document.body.style.cursor = 'auto'
      }

      handleDeleteDrawPath()
      return
    }

    // Handle multiple selected drawing paths
    if (selectedDrawPathIds.length > 0 && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault()
      handleDeleteDrawPath()
      return
    }

    // Handle file deletion
    if (selectedFileIds.length > 0 && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault()

      // Check if any of the selected files are currently being resized or dragged
      const isResizingSelected = resizingFileId && selectedFileIds.includes(resizingFileId)
      const isDraggingSelected = draggedFileId && selectedFileIds.includes(draggedFileId)

      if (isResizingSelected) {
        setResizingFileId(null)
        fileResizeStartPos.current = null
        fileResizeStartSize.current = null
        fileResizeStartPosition.current = null
        setActiveFileResizeHandle(undefined)
        document.body.style.cursor = 'auto'
      }

      if (isDraggingSelected) {
        setDraggedFileId(null)
        fileDragOffset.current = null
        document.body.style.cursor = 'auto'
      }

      // Clean up file URLs
      selectedFileIds.forEach((id) => {
        const file = files.find((item) => item.id === id)
        if (file && file.pdfUrl) {
          URL.revokeObjectURL(file.pdfUrl)
        }
      })

      setFiles((prev) => prev.filter((item) => !selectedFileIds.includes(item.id)))
      setSelectedFileIds([])
      return
    }

    // Handle audio deletion
    if (selectedAudioIds.length > 0 && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault()

      // Check if any of the selected audios are currently being resized or dragged
      const isResizingSelected = resizingAudioId && selectedAudioIds.includes(resizingAudioId)
      const isDraggingSelected = draggedAudioId && selectedAudioIds.includes(draggedAudioId)

      if (isResizingSelected) {
        setResizingAudioId(null)
        audioResizeStartPos.current = null
        audioResizeStartSize.current = null
        audioResizeStartPosition.current = null
        setActiveAudioResizeHandle(undefined)
        document.body.style.cursor = 'auto'
      }

      if (isDraggingSelected) {
        setDraggedAudioId(null)
        audioDragOffset.current = null
        document.body.style.cursor = 'auto'
      }

      // Clean up audio URLs and refs
      selectedAudioIds.forEach((id) => {
        const audio = audios.find((item) => item.id === id)
        if (audio) {
          URL.revokeObjectURL(audio.src)
        }
        audioRefs.current.delete(id)
      })
      setAudios((prev) => prev.filter((item) => !selectedAudioIds.includes(item.id)))
      setSelectedAudioIds([])
      return
    }

    // Handle image deletion
    if (selectedImageIds.length > 0 && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault()
      setImages((prev) => prev.filter((item) => !selectedImageIds.includes(item.id)))
      setSelectedImageIds([])
      return
    }

    // Handle video deletion with proper cursor reset
    if (selectedVideoIds.length > 0 && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault()

      // Check if any of the selected videos are currently being resized or dragged
      const isResizingSelected = resizingVideoId && selectedVideoIds.includes(resizingVideoId)
      const isDraggingSelected = draggedVideoId && selectedVideoIds.includes(draggedVideoId)

      if (isResizingSelected) {
        setResizingVideoId(null)
        videoResizeStartPos.current = null
        videoResizeStartSize.current = null
        videoResizeStartPosition.current = null
        setActiveVideoResizeHandle(undefined)
        document.body.style.cursor = 'auto'
      }

      if (isDraggingSelected) {
        setDraggedVideoId(null)
        videoDragOffset.current = null
        document.body.style.cursor = 'auto'
      }

      selectedVideoIds.forEach((id) => videoRefs.current.delete(id))
      setVideos((prev) => prev.filter((item) => !selectedVideoIds.includes(item.id)))
      setSelectedVideoIds([])
      return
    }

    // Only handle keyboard shortcuts if we have selected text areas
    // and no textarea is focused (to avoid interfering with typing)
    if (selectedTextAreaIds.length > 0 && !focusedTextAreaId) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        setTextAreas((prev) => prev.filter((item) => !selectedTextAreaIds.includes(item.id)))
        setSelectedTextAreaIds([])
      }

      // Copy selected text areas
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault()
        const selectedItems = textAreas.filter((item) => selectedTextAreaIds.includes(item.id))
        setClipboardContent(selectedItems)
      }

      // Paste copied text areas
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault()
        if (clipboardContent.length > 0) {
          // Find the current mouse position or use the center of the viewport
          const editorRect = editorRef.current?.getBoundingClientRect()
          if (!editorRect) return

          // Calculate paste position - center of viewport if no items selected,
          // or next to selected items if some are selected
          let pasteX, pasteY

          if (selectedTextAreaIds.length > 0) {
            // Find the rightmost selected item
            const selectedItems = textAreas.filter((item) => selectedTextAreaIds.includes(item.id))
            const rightmostItem = selectedItems.reduce((prev, curr) =>
              prev.position.x > curr.position.x ? prev : curr
            )

            // Position new items to the right of selected items
            pasteX = rightmostItem.position.x + 220 // Approximate width
            pasteY = rightmostItem.position.y
          } else {
            // Position in the center of the viewport
            pasteX = editorRect.width / 2 - canvasOffset.x
            pasteY = editorRect.height / 2 - canvasOffset.y
          }

          // Get highest z-index to ensure pasted elements are on top
          const highestZIndex = getHighestZIndex()

          // Create new text areas with new IDs
          const newItems = clipboardContent.map((item, index) => {
            // Calculate the relative position from the first item in clipboard
            const relativeX = item.position.x - clipboardContent[0].position.x
            const relativeY = item.position.y - clipboardContent[0].position.y

            return {
              ...item,
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9) + index,
              position: {
                x: pasteX + relativeX,
                y: pasteY + relativeY
              },
              zIndex: highestZIndex + 1,
              // For todo lists, create new IDs for todo items to avoid duplicates
              todoItems: item.todoItems
                ? item.todoItems.map((todo) => ({
                    ...todo,
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
                  }))
                : undefined
            }
          })

          // Add new items to the canvas
          setTextAreas((prev) => [...prev, ...newItems])

          // Select newly pasted items
          setSelectedTextAreaIds(newItems.map((item) => item.id))
        }
      }
    }

    // Select all functionality
    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !focusedTextAreaId) {
      e.preventDefault()
      setSelectedTextAreaIds(textAreas.map((item) => item.id))
      setSelectedDrawPathIds(drawPaths.map((path) => path.id))
      setSelectedImageIds(images.map((image) => image.id))
      setSelectedVideoIds(videos.map((video) => video.id))
      setSelectedAudioIds(audios.map((audio) => audio.id))
      setSelectedFileIds(files.map((file) => file.id)) // Add file select all
    }

    if (e.key === 'Escape') {
      if (resizingArrowId) {
        setResizingArrowId(null)
        setResizingArrowHandle(null)
        arrowResizeStartPos.current = null
        arrowResizeOriginalPoints.current = null
        document.body.style.cursor = 'default'
      }
      if (resizingShapeId) {
        setResizingShapeId(null)
        setResizingShapeHandle(null)
        shapeResizeStartPos.current = null
        shapeResizeOriginalPoints.current = null
        document.body.style.cursor = 'default'
      }
      if (selectedDrawPathIds.length > 0) {
        setSelectedDrawPathIds([])
        setSelectedDrawPathId(null)
      }
      if (placementMode !== 'inactive') {
        setPlacementMode('inactive')
        setPlacementOptions({}) // Clear placement options
        document.body.style.cursor = 'default' // Reset cursor

        // Clean up any temporary file URLs if in file placement mode
        if (placementMode === 'file-upload' && placementOptions.fileData?.pdfUrl) {
          URL.revokeObjectURL(placementOptions.fileData.pdfUrl)
        }
      }

      if (selectedDrawPathIds.length > 0) {
        setSelectedDrawPathIds([])
      }

      if (selectedTextAreaIds.length > 0) {
        setSelectedTextAreaIds([])
      }

      if (selectedImageIds.length > 0) {
        setSelectedImageIds([])
      }

      if (selectedVideoIds.length > 0) {
        setSelectedVideoIds([])
      }

      if (selectedAudioIds.length > 0) {
        setSelectedAudioIds([])
      }

      if (selectedFileIds.length > 0) {
        setSelectedFileIds([])
      }
    }
  }

  // Add event listener for keyboard shortcuts
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    selectedTextAreaIds,
    textAreas,
    clipboardContent,
    focusedTextAreaId,
    canvasOffset,
    placementMode
  ])

  const handleEditorMouseLeave = () => {
    if (isSelecting) {
      setIsSelecting(false)
    }

    if (resizingShapeId) {
      setResizingShapeId(null)
      setResizingShapeHandle(null)
      shapeResizeStartPos.current = null
      shapeResizeOriginalPoints.current = null
      document.body.style.cursor = 'auto'
    }

    if (resizingArrowId) {
      setResizingArrowId(null)
      setResizingArrowHandle(null)
      arrowResizeStartPos.current = null
      arrowResizeOriginalPoints.current = null
      document.body.style.cursor = 'auto'
    }

    if (isPanning) {
      setIsPanning(false)
      lastMousePos.current = null
    }

    if (draggedAudioId) {
      setDraggedAudioId(null)
      audioDragOffset.current = null
      document.body.style.cursor = 'auto'
    }

    if (resizingAudioId) {
      setResizingAudioId(null)
      audioResizeStartPos.current = null
      audioResizeStartSize.current = null
      audioResizeStartPosition.current = null
      setActiveAudioResizeHandle(undefined)
      document.body.style.cursor = 'auto'
    }

    if (draggedTextAreaId) {
      setDraggedTextAreaId(null)
      dragOffset.current = null
      document.body.style.cursor = 'auto'
    }

    if (draggedWebViewId) {
      setDraggedWebViewId(null)
      webViewDragOffset.current = null
      document.body.style.cursor = 'auto'
    }

    if (resizingWebViewId) {
      setResizingWebViewId(null)
      webViewResizeStartPos.current = null
      webViewResizeStartSize.current = null
      document.body.style.cursor = 'auto'
    }

    if (draggedImageId) {
      setDraggedImageId(null)
      imageDragOffset.current = null
      document.body.style.cursor = 'auto'
    }

    if (resizingImageId) {
      setResizingImageId(null)
      imageResizeStartPos.current = null
      imageResizeStartSize.current = null
      imageResizeStartPosition.current = null
      setActiveImageResizeHandle(undefined)
      document.body.style.cursor = 'auto'
    }

    // Add video handling with proper cursor reset
    if (draggedVideoId) {
      setDraggedVideoId(null)
      videoDragOffset.current = null
      document.body.style.cursor = 'auto'
    }

    if (resizingVideoId) {
      setResizingVideoId(null)
      videoResizeStartPos.current = null
      videoResizeStartSize.current = null
      videoResizeStartPosition.current = null
      setActiveVideoResizeHandle(undefined)
      document.body.style.cursor = 'auto'
    }

    if (draggedFileId) {
      console.log('Cleaning up file drag on mouse leave:', draggedFileId)
      setDraggedFileId(null)
      fileDragOffset.current = null
      document.body.style.cursor = 'auto'
    }

    if (resizingFileId) {
      console.log('Cleaning up file resize on mouse leave:', resizingFileId)
      setResizingFileId(null)
      fileResizeStartPos.current = null
      fileResizeStartSize.current = null
      fileResizeStartPosition.current = null
      setActiveFileResizeHandle(undefined)
      document.body.style.cursor = 'auto'
    }
  }

  // Close command menu function
  const closeCommandMenu = () => {
    setShowCommandMenu(false)
    setCommandMenuTextAreaId(null)
  }

  // Close text selection menu
  const closeSelectionMenu = () => {
    setShowSelectionMenu(false)
  }

  const [videos, setVideos] = useState<VideoItem[]>([])
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([])
  const [draggedVideoId, setDraggedVideoId] = useState<string | null>(null)
  const [resizingVideoId, setResizingVideoId] = useState<string | null>(null)
  const videoDragOffset = useRef<{ x: number; y: number } | null>(null)
  const videoResizeStartPos = useRef<{ x: number; y: number } | null>(null)
  const videoResizeStartSize = useRef<{ width: number; height: number } | null>(null)
  const videoResizeStartPosition = useRef<{ x: number; y: number } | null>(null)
  const [activeVideoResizeHandle, setActiveVideoResizeHandle] = useState<
    'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'right' | 'bottom' | 'left'
  >()
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())

  // Video file extensions from VideoManipulator.tsx
  const videoExtensions = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v']

  const handleVideoRef = useCallback((element: HTMLVideoElement | null, videoId: string) => {
    if (element) {
      videoRefs.current.set(videoId, element)

      // Set up video event listeners
      const handleLoadedMetadata = () => {
        if (element.videoWidth && element.videoHeight) {
          const aspectRatio = element.videoWidth / element.videoHeight
          const newHeight = 320 / aspectRatio

          setVideos((prev) =>
            prev.map((video) =>
              video.id === videoId ? { ...video, width: 320, height: newHeight } : video
            )
          )
        }
      }

      element.addEventListener('loadedmetadata', handleLoadedMetadata)
    } else {
      videoRefs.current.delete(videoId)
    }
  }, [])

  // Generate video ID
  const generateVideoId = () => `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const addVideoToEditor = useCallback((src: string, filename: string) => {
    const maxSize = 320

    // Create a video element to get dimensions
    const video = document.createElement('video')
    video.src = src
    video.onloadedmetadata = () => {
      let width = video.videoWidth || maxSize
      let height = video.videoHeight || 240

      // Scale down if too large
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      setPlacementMode('video-upload')
      setPlacementOptions({
        videoData: {
          src,
          width,
          height,
          filename
        }
      })
      document.body.style.cursor = 'crosshair'
    }
  }, [])

  // Open media file dialog (both images and videos)
  const openMediaUpload = () => {
    fileInputRef.current?.click()
  }

  const audioExtensions = ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a', '.wma']

  // Video click handler for selection
  const handleVideoClick = (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation()

    bringToFront(videoId, false, false, true) // We'll need to modify bringToFront

    if (e.shiftKey) {
      setSelectedVideoIds((prev) =>
        prev.includes(videoId) ? prev.filter((id) => id !== videoId) : [...prev, videoId]
      )
    } else {
      setSelectedVideoIds([videoId])
      setSelectedTextAreaIds([]) // Clear text area selections
      setSelectedImageIds([]) // Clear image selections
    }
  }

  // Video drag start handler
  const handleVideoDragStart = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()

    bringToFront(id, false, false, true)

    setDraggedVideoId(id)

    const editorRect = editorRef.current?.getBoundingClientRect()
    if (!editorRect) return

    const mouseX = e.clientX - editorRect.left - canvasOffset.x
    const mouseY = e.clientY - editorRect.top - canvasOffset.y

    const video = videos.find((item) => item.id === id)
    if (!video) return

    videoDragOffset.current = {
      x: mouseX - video.x,
      y: mouseY - video.y
    }

    document.body.style.cursor = 'grabbing'
  }

  // Video resize start handler
  const handleVideoResizeStart = (
    id: string,
    e: React.MouseEvent,
    resizeHandle:
      | 'top-left'
      | 'top-right'
      | 'bottom-left'
      | 'bottom-right'
      | 'top'
      | 'right'
      | 'bottom'
      | 'left'
  ) => {
    e.stopPropagation()
    e.preventDefault()

    bringToFront(id, false, false, true)

    setResizingVideoId(id)

    videoResizeStartPos.current = { x: e.clientX, y: e.clientY }

    const video = videos.find((item) => item.id === id)
    if (!video) return

    videoResizeStartSize.current = { width: video.width, height: video.height }
    videoResizeStartPosition.current = { x: video.x, y: video.y }

    setActiveVideoResizeHandle(resizeHandle)

    // Set appropriate cursor based on the handle
    switch (resizeHandle) {
      case 'top-left':
      case 'bottom-right':
        document.body.style.cursor = 'nwse-resize'
        break
      case 'top-right':
      case 'bottom-left':
        document.body.style.cursor = 'nesw-resize'
        break
      case 'top':
      case 'bottom':
        document.body.style.cursor = 'ns-resize'
        break
      case 'left':
      case 'right':
        document.body.style.cursor = 'ew-resize'
        break
      default:
        document.body.style.cursor = 'nwse-resize'
    }
  }

  const handleRemoveVideo = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()

    // If we're currently resizing this video, reset cursor and state
    if (resizingVideoId === id) {
      setResizingVideoId(null)
      videoResizeStartPos.current = null
      videoResizeStartSize.current = null
      videoResizeStartPosition.current = null
      setActiveVideoResizeHandle(undefined)
      document.body.style.cursor = 'auto'
    }

    // If we're currently dragging this video, reset cursor and state
    if (draggedVideoId === id) {
      setDraggedVideoId(null)
      videoDragOffset.current = null
      document.body.style.cursor = 'auto'
    }

    setVideos((prev) => prev.filter((item) => item.id !== id))
    setSelectedVideoIds((prev) => prev.filter((videoId) => videoId !== id))
    videoRefs.current.delete(id)
  }

  // Helper function to convert content to todo list
  const convertToTodoList = (content: string): TodoItem[] => {
    if (!content.trim()) {
      // If empty, create a todo list with one empty item
      return [{ id: Date.now().toString(), content: '', checked: false }]
    }

    // Split by lines and create todo items
    const lines = content.split(/\r?\n/)
    return lines
      .map((line) => {
        // Remove any existing markers
        let cleanLine = line.trim().replace(/^[-•*]\s*/, '')

        // Remove numbered list markers
        cleanLine = cleanLine.replace(/^\d+\.\s*/, '')

        // Check if line starts with checkbox patterns like "[ ]" or "[x]"
        const isChecked = /^\[x\]/i.test(cleanLine)
        if (isChecked || /^\[ \]/.test(cleanLine)) {
          cleanLine = cleanLine.replace(/^\[[x\s]\]\s*/i, '')
        }

        return {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          content: cleanLine,
          checked: isChecked
        }
      })
      .filter((item) => item.content !== '' || lines.length === 1)
  }

  // Add these functions to handle todo list operations
  const handleAddTodoItem = (textAreaId: string) => {
    setTextAreas((prev) => {
      return prev.map((item) => {
        if (item.id !== textAreaId || item.format !== 'todoList') return item

        const newTodoItem: TodoItem = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          content: '',
          checked: false
        }

        return {
          ...item,
          todoItems: [...(item.todoItems || []), newTodoItem]
        }
      })
    })
  }

  const handleRemoveTodoItem = (textAreaId: string, todoItemId: string) => {
    setTextAreas((prev) => {
      return prev.map((item) => {
        if (item.id !== textAreaId || item.format !== 'todoList') return item

        // Remove the todo item
        const updatedTodoItems = (item.todoItems || []).filter(
          (todoItem) => todoItem.id !== todoItemId
        )

        // If there are no todo items left, convert back to normal text
        if (updatedTodoItems.length === 0) {
          return {
            ...item,
            format: 'normal' as const,
            content: '',
            todoItems: undefined
          }
        }

        return {
          ...item,
          todoItems: updatedTodoItems
        }
      })
    })
  }

  const handleToggleTodoItem = (textAreaId: string, todoItemId: string, checked: boolean) => {
    setTextAreas((prev) => {
      return prev.map((item) => {
        if (item.id !== textAreaId || item.format !== 'todoList') return item

        const updatedTodoItems = (item.todoItems || []).map((todoItem) => {
          if (todoItem.id !== todoItemId) return todoItem
          return { ...todoItem, checked }
        })

        return {
          ...item,
          todoItems: updatedTodoItems
        }
      })
    })
  }

  const handleUpdateTodoItemContent = (textAreaId: string, todoItemId: string, content: string) => {
    setTextAreas((prev) => {
      return prev.map((item) => {
        if (item.id !== textAreaId || item.format !== 'todoList') return item

        const updatedTodoItems = (item.todoItems || []).map((todoItem) => {
          if (todoItem.id !== todoItemId) return todoItem
          return { ...todoItem, content }
        })

        return {
          ...item,
          todoItems: updatedTodoItems
        }
      })
    })
  }

  const handleTodoItemKeyDown = (
    e: React.KeyboardEvent,
    textAreaId: string,
    todoItemId: string,
    index: number
  ) => {
    // Get the current text area
    const textArea = textAreas.find((item) => item.id === textAreaId)
    if (!textArea || !textArea.todoItems) return

    // Get the current todo item
    const todoItem = textArea.todoItems.find((item) => item.id === todoItemId)
    if (!todoItem) return

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault() // Prevent default Enter behavior

      // Add a new todo item after the current one
      setTextAreas((prev) => {
        return prev.map((item) => {
          if (item.id !== textAreaId || item.format !== 'todoList') return item

          const newTodoItem: TodoItem = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            content: '',
            checked: false
          }

          const updatedTodoItems = [...(item.todoItems || [])]
          updatedTodoItems.splice(index + 1, 0, newTodoItem)

          return {
            ...item,
            todoItems: updatedTodoItems
          }
        })
      })

      // Focus the new item after render
      setTimeout(() => {
        const todoListElement = document.getElementById(`todolist-${textAreaId}`)
        if (todoListElement) {
          const todoInputs = todoListElement.querySelectorAll('[contenteditable="true"]')
          if (todoInputs.length > index + 1) {
            ;(todoInputs[index + 1] as HTMLElement).focus()
          }
        }
      }, 0)
    } else if (e.key === 'Backspace' && todoItem.content === '') {
      e.preventDefault() // Prevent default Backspace behavior

      // If this is the only item, don't remove it
      if (textArea.todoItems.length === 1) return

      // Remove the current todo item
      handleRemoveTodoItem(textAreaId, todoItemId)

      // Focus the previous item if it exists
      if (index > 0) {
        setTimeout(() => {
          const todoListElement = document.getElementById(`todolist-${textAreaId}`)
          if (todoListElement) {
            const todoInputs = todoListElement.querySelectorAll('[contenteditable="true"]')
            if (todoInputs.length >= index) {
              ;(todoInputs[index - 1] as HTMLElement).focus()

              // Move cursor to end of text
              const range = document.createRange()
              const sel = window.getSelection()
              range.selectNodeContents(todoInputs[index - 1])
              range.collapse(false)
              sel?.removeAllRanges()
              sel?.addRange(range)
            }
          }
        }, 0)
      }
    }
  }

  const handleAutoFormatList = (id: string, element: HTMLElement) => {
    const content = element.textContent || ''
    let wasFormatted = false
    let listType: 'bulletList' | 'numberedList' | null = null

    // Check for bullet list pattern (- or * at start of line)
    if (content.match(/^[-*]\s/)) {
      listType = 'bulletList'
      wasFormatted = true
    }
    // Check for numbered list pattern (1. at start of line)
    else if (content.match(/^\d+\.\s/)) {
      listType = 'numberedList'
      wasFormatted = true
    }

    if (wasFormatted && listType) {
      // Get the textarea we're replacing
      const textArea = textAreas.find((item) => item.id === id)
      if (!textArea) return false

      // Convert the content to list items
      const listItems = convertToListItems(content)

      // Get highest z-index to ensure new element is on top (or keep current)
      const zIndex = textArea.zIndex || getHighestZIndex() + 1

      // Create a new textarea with the list format
      const newTextArea: TextAreaItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        content: '', // The content will be managed by listItems
        format: listType,
        position: {
          x: textArea.position.x,
          y: textArea.position.y
        },
        listItems: listItems,
        zIndex: zIndex
      }

      // Replace the old textarea with the new list
      setTextAreas((prev) => [...prev.filter((item) => item.id !== id), newTextArea])

      // Focus the new list after render
      setTimeout(() => {
        const newListElement = document.getElementById(`list-${newTextArea.id}`)
        if (newListElement) {
          const firstListInput = newListElement.querySelector('[contenteditable="true"]')
          if (firstListInput) {
            ;(firstListInput as HTMLElement).focus()
          }
        }
      }, 0)
    }

    return wasFormatted
  }

  // Handle keyboard events for lists
  const handleTextAreaKeyDown = (e: React.KeyboardEvent, id: string) => {
    const target = e.target as HTMLElement

    // Check if we're inside a list
    const isInList = !!target.closest('ul, ol')

    if (isInList && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault() // Prevent default Enter behavior

      // Handle enter key in lists - create a new list item
      const selection = window.getSelection()
      if (!selection) return

      const range = selection.getRangeAt(0)

      // Get the current list item
      const listItem =
        range.startContainer.nodeType === Node.TEXT_NODE
          ? range.startContainer.parentElement?.closest('li')
          : (range.startContainer as Element).closest('li')

      if (!listItem) return

      // Check if current list item is empty
      const isEmpty = !listItem.textContent?.trim()

      if (isEmpty) {
        // If the list item is empty, we should exit the list
        const list = listItem.parentElement

        if (!list) return

        // If it's the only item in the list, remove the entire list
        if (list.childElementCount === 1) {
          const parent = list.parentElement
          if (parent) {
            list.remove()
            // Create a line break
            parent.innerHTML += '<br>'

            // Position cursor after the break
            const range = document.createRange()
            range.setStartAfter(parent.lastChild as Node)
            selection.removeAllRanges()
            selection.addRange(range)

            // Update the state
            handleTextAreaChange(id, parent.innerHTML)
          }
        } else {
          // If there are other items, just remove this empty one
          // and add a new paragraph after the list
          const isLastItem = listItem === list.lastChild

          if (isLastItem) {
            listItem.remove()

            // Create a new paragraph after the list
            const newP = document.createElement('p')
            newP.innerHTML = '<br>'
            list.parentElement?.insertBefore(newP, list.nextSibling)

            // Position cursor in the new paragraph
            const range = document.createRange()
            range.selectNodeContents(newP)
            range.collapse(true)
            selection.removeAllRanges()
            selection.addRange(range)

            // Update the state
            handleTextAreaChange(id, target.innerHTML)
          } else {
            // If it's not the last item, just remove it
            listItem.remove()

            // Update the state
            handleTextAreaChange(id, target.innerHTML)
          }
        }
      } else {
        // Get the current list (ol or ul)
        const list = listItem.parentElement
        if (!list) return

        // Create a new list item
        const newItem = document.createElement('li')
        newItem.innerHTML = '<br>'

        // Split content if cursor is in the middle of text
        const endOfItemContent =
          range.endOffset === 0 || range.endContainer.nodeType !== Node.TEXT_NODE

        if (!endOfItemContent) {
          // Get the part of the text after the cursor
          const textNode = range.endContainer as Text
          const textAfterCursor = textNode.splitText(range.endOffset)

          // Move content after cursor to the new item
          newItem.innerHTML = ''
          newItem.appendChild(textAfterCursor.cloneNode(true))

          // Remove the split text node
          textAfterCursor.remove()
        }

        // Insert the new list item after the current one
        if (listItem.nextSibling) {
          list.insertBefore(newItem, listItem.nextSibling)
        } else {
          list.appendChild(newItem)
        }

        // Position cursor in the new list item
        const newRange = document.createRange()
        newRange.selectNodeContents(newItem)
        newRange.collapse(true)
        selection.removeAllRanges()
        selection.addRange(newRange)

        // Update the state
        handleTextAreaChange(id, target.innerHTML)
      }
    }
  }

  // Updated handleInput function to support auto-formatting of lists
  const handleInput = (e: React.FormEvent<HTMLDivElement>, id: string) => {
    const target = e.target as HTMLDivElement
    const value = target.innerHTML || ''

    // Try to auto-format lists
    const wasFormatted = handleAutoFormatList(id, target)

    // If no auto-formatting was applied, just update the content normally
    if (!wasFormatted) {
      handleTextAreaChange(id, value)
    }
  }

  const handleTextAreaChange = (id: string, value: string) => {
    // Check if the value is HTML content (from formatting) or plain text
    const isHtml = /<[^>]*>/g.test(value)

    // Simply update the content without checking for "/"
    setTextAreas((prev) =>
      prev.map((item) => (item.id === id ? { ...item, content: value } : item))
    )
  }

  // Handle focus on textarea
  const handleFocus = (id: string) => {
    setFocusedTextAreaId(id)
    // Bring the element to front when focused
    bringToFront(id)
  }

  const handleBlur = (id: string) => {
    // Check if the textarea is empty
    const textArea = textAreas.find((item) => item.id === id)

    if (textArea) {
      // Check for empty content - handling both plain text and HTML
      let isEmpty = false

      if (textArea.format === 'todoList') {
        // For todo lists, check if all items are empty
        isEmpty =
          !textArea.todoItems ||
          textArea.todoItems.length === 0 ||
          textArea.todoItems.every((item) => !item.content.trim())
      } else if (textArea.format === 'code') {
        // For code blocks, NEVER consider them empty
        // This allows empty code editors to exist
        isEmpty = false
      } else if (!textArea.content) {
        isEmpty = true
      } else {
        // For HTML content, create a temporary element to check if it's truly empty
        const temp = document.createElement('div')
        temp.innerHTML = textArea.content

        // Check if it contains only whitespace, line breaks or empty tags
        isEmpty = !temp.textContent?.trim()
      }

      if (isEmpty) {
        // If the text area is empty, remove it from the state
        setTextAreas((prev) => prev.filter((item) => item.id !== id))
        return // Exit early since we've removed this textarea
      }
    }

    // Only clear focus if moving to a non-textarea element
    setTimeout(() => {
      const activeElement = document.activeElement
      if (
        !activeElement ||
        (!activeElement.id.startsWith('textarea-') &&
          !activeElement.closest('[id^="todolist-"]') &&
          !activeElement.closest('[id^="code-"]'))
      ) {
        setFocusedTextAreaId(null)
      }
    }, 0)
  }

  // Handle hover on textarea row
  const handleMouseEnter = (id: string) => {
    setHoveredTextAreaId(id)
  }

  // Handle unhover on textarea row
  const handleMouseLeave = () => {
    setHoveredTextAreaId(null)
  }

  // Effect to update contenteditable content when state changes
  useEffect(() => {
    textAreas.forEach((textArea) => {
      // Skip code blocks - they're handled by the CodeEditor component
      if (textArea.format !== 'todoList' && textArea.format !== 'code') {
        const element = document.getElementById(`textarea-${textArea.id}`)
        if (element) {
          // Check if the content includes HTML tags
          if (/<[^>]*>/g.test(textArea.content)) {
            // If it's HTML content, set innerHTML
            if (element.innerHTML !== textArea.content) {
              element.innerHTML = textArea.content
            }
          } else {
            // Otherwise, set textContent
            if (element.textContent !== textArea.content) {
              element.textContent = textArea.content
            }
          }
        }
      }
    })
  }, [textAreas])

  const [isContentOutOfView, setIsContentOutOfView] = useState(false)

  useEffect(() => {
    // Check if content is out of view based on canvas offset
    // You can adjust these thresholds based on your needs
    const threshold = 300 // pixels
    if (Math.abs(canvasOffset.x) > threshold || Math.abs(canvasOffset.y) > threshold) {
      setIsContentOutOfView(true)
    } else {
      setIsContentOutOfView(false)
    }
  }, [canvasOffset])

  const scrollBackToContent = () => {
    // Get the current offset
    const startOffset = { ...canvasOffset }
    const targetOffset = { x: 0, y: 0 }
    const duration = 500 // animation duration in milliseconds
    const startTime = performance.now()

    // Easing function for smooth animation (easeOutCubic)
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Apply easing to progress
      const easedProgress = easeOutCubic(progress)

      // Calculate current position with easing
      const currentX = startOffset.x + (targetOffset.x - startOffset.x) * easedProgress
      const currentY = startOffset.y + (targetOffset.y - startOffset.y) * easedProgress

      setCanvasOffset({ x: currentX, y: currentY })

      // Continue animation if not complete
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }

  const handlePanelCommandSelect = (command: string) => {
    if (command === 'universal-file-upload') {
      openUniversalFileUpload()
      return
    }

    if (command === 'code-file-upload') {
      openCodeFileUpload()
      return
    }

    if (command === 'media-upload') {
      openMediaUpload() // Changed from openImageUpload
      return
    }

    if (command === 'image-upload') {
      openImageUpload()
      return
    }

    // Cancel any active placement mode first
    setPlacementMode('inactive')

    // Reset placement options
    setPlacementOptions({})

    // Handle browser command to add a webview
    if (command === 'browser') {
      setPlacementMode('browser')
      document.body.style.cursor = 'crosshair'
      return
    }

    // Handle the simple 'latex' command
    if (command === 'latex') {
      setPlacementMode('latex')
      setPlacementOptions({ latexBlockMode: true }) // Default to block LaTeX
      document.body.style.cursor = 'crosshair'
      return
    }

    if (command.startsWith('latex:')) {
      // Extract the LaTeX content and whether it's a block or inline equation
      const parts = command.split(':')

      if (parts.length >= 3) {
        const isBlock = parts[1] === 'block'
        // Rejoin in case the LaTeX itself contains colons
        const latexContent = parts.slice(2).join(':')

        setPlacementMode('latex')
        setPlacementOptions({
          latexBlockMode: isBlock
        })
        document.body.style.cursor = 'crosshair'
      }
      return
    }

    if (command === 'todoList') {
      // Set placement mode for todo list
      setPlacementMode('todoList')
      document.body.style.cursor = 'crosshair'
      return
    }

    if (command === 'bulletList' || command === 'numberedList') {
      // Set placement mode for lists
      setPlacementMode(command)
      document.body.style.cursor = 'crosshair'
      return
    }

    // Handle code format
    if (command === 'code') {
      setPlacementMode('code')
      document.body.style.cursor = 'crosshair'
      return
    }

    // For headings and other formats
    if (['normal'].includes(command)) {
      setPlacementMode(command as PlacementMode)
      document.body.style.cursor = 'crosshair'
      return
    }
  }

  useEffect(() => {
    const loadPrism = async () => {
      if (typeof window !== 'undefined' && !window.Prism) {
        // Load Prism CSS
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href =
          'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css'
        document.head.appendChild(link)

        // Load line numbers CSS
        const lineLink = document.createElement('link')
        lineLink.rel = 'stylesheet'
        lineLink.href =
          'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/line-numbers/prism-line-numbers.min.css'
        document.head.appendChild(lineLink)

        // Load Prism JS
        const script = document.createElement('script')
        script.src =
          'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js'
        script.onload = () => {
          // Load autoloader
          const autoloader = document.createElement('script')
          autoloader.src =
            'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js'
          document.head.appendChild(autoloader)

          // Load line numbers plugin
          const lineNumbers = document.createElement('script')
          lineNumbers.src =
            'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/line-numbers/prism-line-numbers.min.js'
          document.head.appendChild(lineNumbers)
        }
        document.head.appendChild(script)
      }
    }

    loadPrism()
  }, [])

  const handleUpdateLatex = (textAreaId: string, newLatex: string, isBlock: boolean) => {
    setTextAreas((prev) =>
      prev.map((item) =>
        item.id === textAreaId ? { ...item, content: newLatex, isBlockLatex: isBlock } : item
      )
    )
  }

  const [webViewInputValues, setWebViewInputValues] = useState<{ [key: string]: string }>({})

  // 2. Add handler for input changes
  const handleWebViewInputChange = (id: any, value: any) => {
    setWebViewInputValues((prev) => ({
      ...prev,
      [id]: value
    }))
  }

  // 3. Add handler for submitting URLs (when Enter is pressed)
  const handleWebViewInputSubmit = (id: string, e: { key: string; preventDefault: () => void }) => {
    if (e.key === 'Enter') {
      e.preventDefault()

      // Get the input value
      const url = webViewInputValues[id] || ''

      // Add http:// prefix if missing
      let fullUrl = url
      if (!/^https?:\/\//i.test(url)) {
        fullUrl = 'https://' + url
      }

      // Update the webview URL
      setWebViews((prev) => prev.map((item) => (item.id === id ? { ...item, url: fullUrl } : item)))

      // Update the webview element
      const webviewElement = document.getElementById(`webview-${id}`) as
        | (HTMLIFrameElement & { src?: string })
        | (Electron.WebviewTag & { src?: string })
      if (webviewElement && 'src' in webviewElement) {
        webviewElement.src = fullUrl
      }
    }
  }

  const [savedSelection, setSavedSelection] = useState<{
    range: Range
    textAreaId: string
  } | null>(null)

  // Updated handleTextSelection function
  const handleTextSelection = (e: React.MouseEvent, textAreaId: string) => {
    // Don't disrupt other operations
    if (isPanning || isSelecting) return

    // Small delay to ensure selection is complete
    setTimeout(() => {
      const selection = window.getSelection()

      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        // No text selected, hide the menu
        setIsTextSelected(false)
        setShowSelectionMenu(false)
        setSavedSelection(null)
        return
      }

      const selectedText = selection.toString().trim()

      if (selectedText.length > 0) {
        // Save the selection range for later use
        const range = selection.getRangeAt(0).cloneRange()
        setSavedSelection({
          range: range,
          textAreaId: textAreaId
        })

        // Text is selected, show the context menu
        setSelectedText(selectedText)
        setIsTextSelected(true)
        setCurrentTextAreaId(textAreaId)

        // Calculate position for the context menu
        // Get the selection rectangle positions relative to the viewport
        const rect = range.getBoundingClientRect()

        // Get the editor's bounding rectangle
        const editorRect = editorRef.current?.getBoundingClientRect()
        if (!editorRect) return

        // Calculate position relative to the editor
        setSelectionPosition({
          x: rect.left + rect.width / 2 - editorRect.left,
          y: rect.top - editorRect.top
        })

        setShowSelectionMenu(true)

        // Stop propagation to prevent other handlers
        e.stopPropagation()
      } else {
        setIsTextSelected(false)
        setShowSelectionMenu(false)
        setSavedSelection(null)
      }
    }, 10)
  }

  const handleFormatText = (formatType: string, value?: string) => {
    if (!currentTextAreaId || !selectedText) return

    // Handle LaTeX conversion
    if (formatType === 'convertToLatex') {
      // Get the current textarea
      const currentTextArea = textAreas.find((item) => item.id === currentTextAreaId)
      if (!currentTextArea) return

      // Get the highest z-index to ensure new element is on top
      const highestZIndex = getHighestZIndex()

      // Create a new LaTeX component with the selected text as content
      const newLatexTextArea: TextAreaItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        content: selectedText, // Use the selected text as LaTeX content
        format: 'latex',
        position: {
          x: currentTextArea.position.x,
          y: currentTextArea.position.y
        },
        isBlockLatex: true, // Default to block LaTeX
        zIndex: highestZIndex + 1
      }

      // Replace the current textarea with the new LaTeX component
      setTextAreas((prev) => [
        ...prev.filter((item) => item.id !== currentTextAreaId),
        newLatexTextArea
      ])

      // Clear selection states
      setShowSelectionMenu(false)
      setIsTextSelected(false)
      setSavedSelection(null)
      setSelectedText('')
      setCurrentTextAreaId(null)

      // Focus the new LaTeX component after a short delay
      setTimeout(() => {
        const latexElement = document.getElementById(`latex-${newLatexTextArea.id}`)
        if (latexElement) {
          const editButton = latexElement.querySelector('button')
          if (editButton) {
            editButton.click()
          }
        }
      }, 100)

      return
    }

    if (formatType === 'convertToTodoList') {
      // Get the current textarea
      const currentTextArea = textAreas.find((item) => item.id === currentTextAreaId)
      if (!currentTextArea) return

      // Get the highest z-index to ensure new element is on top
      const highestZIndex = getHighestZIndex()

      // Convert the selected text to todo items
      const todoItems = convertToTodoList(selectedText)

      // Create a new todo list component with the selected text converted to todo items
      const newTodoListTextArea: TextAreaItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        content: '', // Content is managed by todoItems
        format: 'todoList',
        position: {
          x: currentTextArea.position.x,
          y: currentTextArea.position.y
        },
        todoItems: todoItems,
        zIndex: highestZIndex + 1
      }

      // Replace the current textarea with the new todo list component
      setTextAreas((prev) => [
        ...prev.filter((item) => item.id !== currentTextAreaId),
        newTodoListTextArea
      ])

      // Clear selection states
      setShowSelectionMenu(false)
      setIsTextSelected(false)
      setSavedSelection(null)
      setSelectedText('')
      setCurrentTextAreaId(null)

      // Focus the new todo list component after a short delay
      setTimeout(() => {
        const todoListElement = document.getElementById(`todolist-${newTodoListTextArea.id}`)
        if (todoListElement) {
          const firstTodoInput = todoListElement.querySelector('[contenteditable="true"]')
          if (firstTodoInput) {
            ;(firstTodoInput as HTMLElement).focus()
          }
        }
      }, 100)

      return
    }

    // Use saved selection if available, otherwise try to get current selection
    let selection = window.getSelection()
    let range: Range | null = null

    if (savedSelection && savedSelection.textAreaId === currentTextAreaId) {
      // Restore the saved selection
      selection?.removeAllRanges()
      selection?.addRange(savedSelection.range)
      range = savedSelection.range
    } else if (selection && selection.rangeCount > 0) {
      range = selection.getRangeAt(0)
    }

    if (!selection || !range) {
      console.warn('No valid selection found for formatting')
      return
    }

    // Check if this is a color operation (text color)
    const isColorOperation = formatType === 'textColor'
    // Check if this is a highlight operation
    const isHighlightOperation = formatType === 'highlightColor'
    // Check if this is an alignment operation
    const isAlignOperation = ['alignLeft', 'alignCenter', 'alignRight', 'alignJustify'].includes(
      formatType
    )
    // Check if this is a font family operation
    const isFontFamilyOperation = formatType === 'fontFamily'

    if (isColorOperation && value) {
      // Handle text color change
      document.execCommand('foreColor', false, value)
    } else if (isHighlightOperation && value) {
      // Handle text highlighting - IMPROVED VERSION
      try {
        // Ensure we have a valid, non-collapsed selection
        if (range.collapsed) {
          console.warn('No text selected for highlighting')
          return
        }

        // Check if the selection is within our target textarea
        const textareaElement = document.getElementById(`textarea-${currentTextAreaId}`)
        if (!textareaElement) {
          console.warn('Target textarea not found')
          return
        }

        // Verify the selection is within the correct textarea
        const rangeContainer = range.commonAncestorContainer
        const isWithinTextarea =
          textareaElement.contains(rangeContainer) || textareaElement === rangeContainer

        if (!isWithinTextarea) {
          console.warn('Selection is not within the target textarea')
          return
        }

        // Create a fresh range to avoid any stale references
        const newRange = document.createRange()
        newRange.setStart(range.startContainer, range.startOffset)
        newRange.setEnd(range.endContainer, range.endOffset)

        // Create the highlight span
        const span = document.createElement('span')
        span.style.backgroundColor = value
        span.style.padding = '2px 1px'
        span.style.borderRadius = '2px'
        span.style.display = 'inline'

        try {
          // Extract the selected content
          const selectedContent = newRange.extractContents()

          // Add the content to our highlight span
          span.appendChild(selectedContent)

          // Insert the highlighted span
          newRange.insertNode(span)

          console.log('Highlight applied successfully')
        } catch (extractError) {
          console.warn('Content extraction failed, trying alternative approach:', extractError)

          // Alternative: Get text content and replace
          const selectedTextContent = newRange.toString()
          if (selectedTextContent) {
            const textNode = document.createTextNode(selectedTextContent)
            span.appendChild(textNode)

            newRange.deleteContents()
            newRange.insertNode(span)

            console.log('Highlight applied using alternative method')
          }
        }

        // Clear selections and saved state
        selection.removeAllRanges()
        setSavedSelection(null)
      } catch (error) {
        console.error('Error applying highlight:', error)

        // Fallback using execCommand
        try {
          const success =
            document.execCommand('hiliteColor', false, value) ||
            document.execCommand('backColor', false, value)

          if (success) {
            console.log('Highlight applied using execCommand fallback')
          } else {
            console.warn('All highlighting methods failed')
          }
        } catch (fallbackError) {
          console.error('Fallback highlighting also failed:', fallbackError)
        }
      }
    } else if (isFontFamilyOperation && value) {
      // Handle font family change (existing code)
      setTextAreas((prev) =>
        prev.map((item) => (item.id === currentTextAreaId ? { ...item, fontFamily: value } : item))
      )

      const span = document.createElement('span')
      span.style.fontFamily = value

      try {
        const selectedContent = range.extractContents()
        span.appendChild(selectedContent)
        range.insertNode(span)
        selection.removeAllRanges()
      } catch (error) {
        console.error('Error applying font family:', error)
        try {
          document.execCommand('fontName', false, value.split(',')[0])
        } catch (fallbackError) {
          console.error('Fallback font command also failed:', fallbackError)
        }
      }
    } else if (isAlignOperation) {
      // Handle text alignment (existing code)
      const container = findContainer(range.commonAncestorContainer)

      if (container) {
        container.style.textAlign = ''

        switch (formatType) {
          case 'alignLeft':
            container.style.textAlign = 'left'
            break
          case 'alignCenter':
            container.style.textAlign = 'center'
            break
          case 'alignRight':
            container.style.textAlign = 'right'
            break
          case 'alignJustify':
            container.style.textAlign = 'justify'
            break
          default:
            break
        }
      }
    } else {
      // Handle other formatting (existing code)
      const hasFormatting = checkIfTextHasFormatting(range, formatType)

      if (hasFormatting) {
        removeFormatting(range, formatType)
      } else {
        applyFormatting(range, formatType)
      }
    }

    // Update the content in state (only for non-LaTeX conversions)
    const textareaElement = document.getElementById(`textarea-${currentTextAreaId}`)
    if (textareaElement) {
      handleTextAreaChange(currentTextAreaId, textareaElement.innerHTML || '')
    }

    // Clear the selection menu after formatting (only for non-LaTeX conversions)
    setShowSelectionMenu(false)
    setIsTextSelected(false)
    setSavedSelection(null)
  }

  const handleConvertImageToWebview = (imageId: string) => {
    try {
      // Find the image
      const image = images.find((img) => img.id === imageId)
      if (!image) {
        throw new Error('Image not found')
      }

      // Check if it's a captured image with sourceUrl
      const capturedImage = image as CapturedImageItem
      if (!capturedImage.sourceUrl) {
        throw new Error('This image was not captured from a webpage')
      }

      // Validate URL format
      try {
        new URL(capturedImage.sourceUrl)
      } catch {
        throw new Error('Invalid URL format')
      }

      // Get highest z-index to ensure new webview is on top
      const highestZIndex = getHighestZIndex()

      // Create new webview with smart sizing
      const newWebView: WebViewItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        url: capturedImage.sourceUrl,
        position: {
          x: image.x,
          y: image.y
        },
        size: {
          // Smart sizing: 1.5x image size, with min/max constraints
          width: Math.max(Math.min(image.width * 1.5, 800), 400),
          height: Math.max(Math.min(image.height * 1.5, 600), 300)
        },
        zIndex: highestZIndex + 1
      }

      // Add the new webview
      setWebViews((prev) => [...prev, newWebView])

      // Remove the original image after successful conversion
      setTimeout(() => {
        setImages((prev) => prev.filter((img) => img.id !== imageId))
        setSelectedImageIds((prev) => prev.filter((id) => id !== imageId))
      }, 100)

      console.log('Successfully converted image to webview:', {
        imageUrl: capturedImage.sourceUrl,
        webviewId: newWebView.id
      })
    } catch (error) {
      console.error('Failed to convert image to webview:', error)
      // Optional: Add user notification here
      // alert('Failed to convert image: ' + (error as Error).message);
    }
  }

  // Helper function to check if selected text has specific formatting
  const checkIfTextHasFormatting = (range: Range, formatType: string): boolean => {
    const selection = window.getSelection()
    if (!selection) return false

    // Check for existing formatting using document.execCommand's queryCommandState
    // This is a more reliable way to check formatting states
    switch (formatType) {
      case 'bold':
        return document.queryCommandState('bold')
      case 'italic':
        return document.queryCommandState('italic')
      case 'underline':
        return document.queryCommandState('underline')
      case 'strikethrough':
        return document.queryCommandState('strikeThrough')
      default:
        return false
    }
  }
  // Helper function to remove formatting
  const removeFormatting = (range: Range, formatType: string) => {
    // The simplest way to toggle formatting is to use document.execCommand
    // which handles the complexity of nested formats and partial selections
    switch (formatType) {
      case 'bold':
        document.execCommand('bold', false)
        break
      case 'italic':
        document.execCommand('italic', false)
        break
      case 'underline':
        document.execCommand('underline', false)
        break
      case 'strikethrough':
        document.execCommand('strikeThrough', false)
        break
      case 'increaseFontSize':
      case 'decreaseFontSize':
        // For font size, we don't have a simple toggle - we'd need custom logic
        // but we'll skip that for now as it's not a toggle operation
        break
      default:
        break
    }
  }

  // Helper function to apply formatting
  const applyFormatting = (range: Range, formatType: string) => {
    switch (formatType) {
      case 'bold':
        document.execCommand('bold', false)
        break
      case 'italic':
        document.execCommand('italic', false)
        break
      case 'underline':
        document.execCommand('underline', false)
        break
      case 'strikethrough':
        document.execCommand('strikeThrough', false)
        break
      case 'increaseFontSize':
        // Get current font size or default to browser's default (usually 16px)
        const currentEl = range.commonAncestorContainer.parentElement
        let currentSize = currentEl ? window.getComputedStyle(currentEl).fontSize : '16px'
        let sizeValue = parseInt(currentSize)

        // Apply larger font size
        document.execCommand('fontSize', false, '7') // Maximum size

        const fonts = document.querySelectorAll('font[size="7"]')
        fonts.forEach((font) => {
          font.removeAttribute('size')
          ;(font as HTMLElement).style.fontSize = `${sizeValue + 3}px`
        })
        break
      case 'decreaseFontSize':
        // Get current font size
        const currentElement = range.commonAncestorContainer.parentElement
        let currSize = currentElement ? window.getComputedStyle(currentElement).fontSize : '16px'
        let currSizeValue = parseInt(currSize)

        // Apply smaller font size
        document.execCommand('fontSize', false, '1') // Minimum size

        // Find all font elements just created and adjust their size
        const smallFonts = document.querySelectorAll('font[size="1"]')
        smallFonts.forEach((font) => {
          font.removeAttribute('size')
          ;(font as HTMLElement).style.fontSize = `${Math.max(8, currSizeValue - 3)}px`
        })
        break
      default:
        break
    }
  }

  const handleTodoItemBlur = (textAreaId: string) => {
    // Find the text area
    const textArea = textAreas.find((item) => item.id === textAreaId)

    if (textArea && textArea.format === 'todoList' && textArea.todoItems) {
      // Check if there's only one todo item and it's empty
      if (
        textArea.todoItems.length === 1 &&
        (!textArea.todoItems[0].content || !textArea.todoItems[0].content.trim())
      ) {
        // Remove the entire text area, just like we do with empty contenteditable divs
        setTextAreas((prev) => prev.filter((item) => item.id !== textAreaId))
      }
    }
  }

  const [triggerLatexEdit, setTriggerLatexEdit] = useState<string | null>(null)
  const [webViewCanGoBack, setWebViewCanGoBack] = useState<{ [key: string]: boolean }>({})
  const [webViewCanGoForward, setWebViewCanGoForward] = useState<{ [key: string]: boolean }>({})

  useEffect(() => {
    webViews.forEach((webView) => {
      const webviewElement = document.getElementById(`webview-${webView.id}`) as Electron.WebviewTag

      if (webviewElement) {
        // Simple event listener to update state after navigation
        webviewElement.addEventListener('did-navigate', () => {
          setWebViewCanGoBack((prev) => ({
            ...prev,
            [webView.id]: webviewElement.canGoBack()
          }))
          setWebViewCanGoForward((prev) => ({
            ...prev,
            [webView.id]: webviewElement.canGoForward()
          }))
        })
      }
    })
  }, [webViews])

  const [focusedWebViewInputId, setFocusedWebViewInputId] = useState<string | null>(null)
  const [resizingArrowId, setResizingArrowId] = useState<string | null>(null)
  const [resizingArrowHandle, setResizingArrowHandle] = useState<'start' | 'end' | null>(null)
  const arrowResizeStartPos = useRef<{ x: number; y: number } | null>(null)
  const arrowResizeOriginalPoints = useRef<DrawPoint[] | null>(null)

  const handleArrowResizeStart = (
    arrowId: string,
    handle: 'start' | 'end',
    e: React.MouseEvent
  ) => {
    e.stopPropagation()
    e.preventDefault()

    // Only allow resizing if we're not in drawing mode
    if (drawingMode !== 'none') return

    setResizingArrowId(arrowId)
    setResizingArrowHandle(handle)

    // Store the starting mouse position
    arrowResizeStartPos.current = { x: e.clientX, y: e.clientY }

    // Find the arrow being resized and store its original points
    const arrow = drawPaths.find((path) => path.id === arrowId)
    if (!arrow || !arrow.points) return

    // Store original points for reference during resize
    arrowResizeOriginalPoints.current = [...arrow.points]

    // Set cursor based on handle
    document.body.style.cursor = 'grabbing'

    // Select this arrow if not already selected
    if (!selectedDrawPathIds.includes(arrowId)) {
      setSelectedDrawPathIds([arrowId])
      setSelectedDrawPathId(arrowId)
    }
  }

  const handleOpenWebViewInNewTab = (webViewId: string) => {
    const webView = webViews.find((wv) => wv.id === webViewId)
    if (!webView || !addTab) return

    // Get the current URL from the webview element
    const webviewElement = document.getElementById(`webview-${webViewId}`) as Electron.WebviewTag

    if (webviewElement) {
      try {
        // Try to get the current URL from the webview
        const currentUrl = webviewElement.getURL ? webviewElement.getURL() : webView.url

        // Open the URL in a new browser tab
        addTab(currentUrl)
      } catch (error) {
        console.error('Error getting webview URL:', error)
        // Fallback to the stored URL if we can't get the current one
        addTab(webView.url)
      }
    } else {
      // Fallback to the stored URL if element not found
      addTab(webView.url)
    }
  }

  useEffect(() => {
    const handleAddWebviewToEditor = (event: CustomEvent) => {
      const { url, tabId } = event.detail

      // Check if this event is for the current editor tab
      if (tabId !== tabId) return // Make sure this matches the current editor's tab ID

      console.log('Adding webview to editor canvas:', { url, tabId })

      // Validate URL format
      if (!url || typeof url !== 'string') {
        console.error('Invalid URL received for webview:', url)
        return
      }

      try {
        new URL(url) // Validate URL
      } catch (error) {
        console.error('Invalid URL format:', url)
        return
      }

      // Get highest z-index to ensure new webview is on top
      const highestZIndex = getHighestZIndex()

      // Create new webview positioned in the center of the visible area
      const editorRect = editorRef.current?.getBoundingClientRect()
      if (!editorRect) {
        console.error('Could not get editor bounds')
        return
      }

      // Calculate center position accounting for canvas offset
      const centerX = editorRect.width / 2 - canvasOffset.x - 300 // 300 is half of default webview width
      const centerY = editorRect.height / 2 - canvasOffset.y - 200 // 200 is half of default webview height

      const newWebView: WebViewItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        url: url,
        position: {
          x: Math.max(50, centerX), // Ensure it's not too close to the edge
          y: Math.max(50, centerY)
        },
        size: {
          width: 600,
          height: 400
        },
        zIndex: highestZIndex + 1
      }

      // Add the webview to the canvas
      setWebViews((prev) => [...prev, newWebView])

      // Optional: Bring the webview into focus/selection
      setTimeout(() => {
        bringToFront(newWebView.id, true)
      }, 100)

      console.log('Webview added successfully:', newWebView)
    }

    // Listen for the custom event
    document.addEventListener('add-webview-to-editor', handleAddWebviewToEditor as EventListener)

    return () => {
      document.removeEventListener(
        'add-webview-to-editor',
        handleAddWebviewToEditor as EventListener
      )
    }
  }, [tabId, canvasOffset, getHighestZIndex, setWebViews, bringToFront])

  const renderSpreadsheet = (file: FileItem) => {
    if (!file.spreadsheetData) {
      return (
        <div className="flex items-center justify-center h-full text-zinc-500 dark:text-zinc-400">
          <div className="text-center">
            <div className="text-4xl mb-4">📊</div>
            <p>No spreadsheet data available</p>
          </div>
        </div>
      )
    }

    const { currentSheet, workbook } = file.spreadsheetData

    if (!currentSheet || !currentSheet['!ref']) {
      return (
        <div className="flex items-center justify-center h-full text-zinc-500 dark:text-zinc-400">
          <div className="text-center">
            <div className="text-4xl mb-4">📄</div>
            <p>Sheet appears to be empty</p>
          </div>
        </div>
      )
    }

    const range = (window as any).XLSX.utils.decode_range(currentSheet['!ref'])
    const rowCount = range.e.r - range.s.r + 1
    const colCount = range.e.c - range.s.c + 1

    return (
      <div className="w-full h-full bg-white dark:bg-zinc-900 overflow-auto">
        {/* Info bar */}
        <div className="sticky top-0 z-20 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-medium">{file.spreadsheetData.currentSheetName}</span>
            <span>
              {rowCount} rows × {colCount} columns
            </span>
          </div>
          <span>{Math.round((file.scale || 1.2) * 100)}%</span>
        </div>

        {/* Spreadsheet table */}
        <div
          className="relative"
          style={{
            transform: `scale(${file.scale || 1.2})`,
            transformOrigin: 'top left',
            width: `${100 / (file.scale || 1.2)}%`,
            height: `${100 / (file.scale || 1.2)}%`
          }}
        >
          <table className="border-collapse w-full text-sm">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-30 w-12 h-8 bg-zinc-100 dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-xs font-semibold text-zinc-700 dark:text-zinc-300 text-center"></th>
                {Array.from({ length: colCount }, (_, i) => (
                  <th
                    key={i}
                    className="sticky top-0 z-20 h-8 min-w-[80px] max-w-[200px] bg-zinc-100 dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-xs font-semibold text-zinc-700 dark:text-zinc-300 text-center px-2"
                  >
                    {(window as any).XLSX.utils.encode_col(range.s.c + i)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.min(rowCount, 200) }, (_, rowIndex) => {
                const row = range.s.r + rowIndex
                return (
                  <tr key={row} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="sticky left-0 z-10 w-12 h-7 bg-zinc-100 dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-xs font-semibold text-zinc-700 dark:text-zinc-300 text-center">
                      {row + 1}
                    </td>
                    {Array.from({ length: colCount }, (_, colIndex) => {
                      const col = range.s.c + colIndex
                      const cellAddress = (window as any).XLSX.utils.encode_cell({ r: row, c: col })
                      const cell = currentSheet[cellAddress]
                      const cellValue = cell ? cell.w || cell.v || '' : ''

                      return (
                        <td
                          key={cellAddress}
                          className="h-7 min-w-[80px] max-w-[200px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 px-2 truncate hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                          title={`${cellAddress}: ${cellValue}`}
                        >
                          {String(cellValue)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Render current slide
  const renderSlide = (file: FileItem) => {
    if (!file.slides || !file.slides[file.currentSlideIndex || 0]) return null

    const slide = file.slides[file.currentSlideIndex || 0]
    return (
      <div
        className="presentation-slide bg-white rounded-lg p-8 flex flex-col justify-center items-center text-center"
        style={{ transform: `scale(${file.scale})` }}
      >
        <h1 className="text-3xl font-light text-gray-800 mb-6">{slide.title}</h1>
        {slide.content.length === 1 ? (
          <p className="text-xl text-gray-600 max-w-2xl leading-relaxed">{slide.content[0]}</p>
        ) : (
          <ul className="text-lg text-left max-w-xl">
            {slide.content.map((item, index) => (
              <li key={index} className="mb-3 leading-relaxed text-gray-600">
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col justify-center w-full h-full bg-zinc-100 dark:bg-zinc-900 relative overflow-y-auto sidebar-scrollbar">
      <div
        ref={editorRef}
        className={`flex items-start justify-center w-full h-full bg-zinc-100 dark:bg-zinc-900 relative overflow-y-auto sidebar-scrollbar ${
          activeTool === 'hand'
            ? 'cursor-grab active:cursor-grabbing'
            : placementMode !== 'inactive'
              ? 'cursor-crosshair'
              : ''
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleEditorMouseLeave}
        onDoubleClick={handleDoubleClick}
      >
        {/* Render textareas with absolute positioning */}
        <div
          className="w-full h-full z-10"
          style={{
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px)`,
            transition: isPanning ? 'none' : 'transform 0.1s ease-out',
            position: 'relative'
          }}
        >
          {textAreas.map((textArea, index) => (
            <div
              id={`textarea-row-${textArea.id}`}
              key={textArea.id}
              className={`flex items-start absolute ${
                showCommandMenu && commandMenuTextAreaId === textArea.id ? 'mb-40' : ''
              } ${
                selectedTextAreaIds.includes(textArea.id)
                  ? 'ring-2 ring-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                  : ''
              }`}
              style={{
                left: `${textArea.position.x}px`,
                top: `${textArea.position.y}px`,
                opacity: draggedTextAreaId === textArea.id ? 0.7 : 1,
                zIndex: textArea.zIndex || 0,
                padding: selectedTextAreaIds.includes(textArea.id) ? '4px' : '0',
                borderRadius: selectedTextAreaIds.includes(textArea.id) ? '4px' : '0'
              }}
              onMouseEnter={() => handleMouseEnter(textArea.id)}
              onMouseLeave={handleMouseLeave}
              onClick={(e) => {
                // Don't handle clicks during drag or selection operations
                if (isSelecting || isPanning) return

                // This click handler is for selecting the text area,
                // not for editing content
                e.stopPropagation()

                // If so, don't apply selection
                const target = e.target as HTMLElement
                if (
                  target.getAttribute('contenteditable') === 'true' ||
                  target.closest('[contenteditable="true"]') ||
                  target.closest('.code-editor-container') ||
                  target.closest('[id^="todolist-"]') ||
                  target.closest('[id^="list-"]') ||
                  target.closest('.dcg-container')
                ) {
                  return // Don't select the component when clicking to edit content
                }

                // Bring the text area to front when clicking on it
                bringToFront(textArea.id)

                // Handle shift-click for multiple selection
                if (e.shiftKey) {
                  setSelectedTextAreaIds(
                    (prev) =>
                      prev.includes(textArea.id)
                        ? prev.filter((id) => id !== textArea.id) // Toggle off if already selected
                        : [...prev, textArea.id] // Add to selection
                  )
                } else {
                  // Single-click selects only this text area
                  setSelectedTextAreaIds([textArea.id])
                }
              }}
            >
              <button
                type="button"
                className={`flex items-center justify-center w-8 h-8 mt-1 text-gray-500 dark:text-gray-300 transition-opacity rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700 ${
                  focusedTextAreaId === textArea.id ||
                  hoveredTextAreaId === textArea.id ||
                  selectedTextAreaIds.includes(textArea.id)
                    ? 'opacity-80'
                    : 'opacity-0'
                }`}
                style={{ cursor: draggedTextAreaId === textArea.id ? 'grabbing' : 'grab' }}
                onMouseDown={(e) => handleDragStart(textArea.id, e)}
              >
                <DotsSixVertical size={21} />
              </button>
              <div className="flex flex-col">
                {textArea.format === 'latex' ? (
                  <div
                    id={`latex-${textArea.id}`}
                    className="flex flex-col px-0 py-0 min-w-[200px] max-w-[800px] group relative"
                  >
                    <LaTeXComponent
                      initialLatex={textArea.content}
                      initialDisplayMode={textArea.isBlockLatex ?? true}
                      onUpdate={(newLatex, isBlock) =>
                        handleUpdateLatex(textArea.id, newLatex, isBlock)
                      }
                      className="bg-white dark:bg-zinc-800 rounded-md shadow-sm border border-zinc-200 dark:border-zinc-700"
                      externalEditTrigger={triggerLatexEdit === textArea.id}
                    />

                    {/* Edit button that only appears on hover using group-hover */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          // This will trigger the LaTeX component to enter edit mode
                          setTriggerLatexEdit(textArea.id)
                          // Reset it after a small delay so it can be triggered again
                          setTimeout(() => setTriggerLatexEdit(null), 100)
                        }}
                        className="p-1 rounded-md bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-600 dark:text-gray-300 text-xs flex items-center gap-1"
                      >
                        <PencilSimple size={14} />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>
                ) : textArea.format === 'todoList' ? (
                  <div
                    id={`todolist-${textArea.id}`}
                    className="px-4 py-2 border-none outline-none resize bg-transparent sidebar-scrollbar whitespace-pre-wrap break-words"
                    style={{
                      minHeight: '40px',
                      minWidth: '300px',
                      maxWidth: '800px'
                    }}
                  >
                    {textArea.todoItems &&
                      textArea.todoItems.map((todoItem, idx) => (
                        <TodoItem
                          key={todoItem.id}
                          content={todoItem.content}
                          checked={todoItem.checked}
                          onChange={(checked) =>
                            handleToggleTodoItem(textArea.id, todoItem.id, checked)
                          }
                          onContentChange={(content) =>
                            handleUpdateTodoItemContent(textArea.id, todoItem.id, content)
                          }
                          onKeyDown={(e) => handleTodoItemKeyDown(e, textArea.id, todoItem.id, idx)}
                          onBlur={() => handleTodoItemBlur(textArea.id)}
                          isOnlyItem={(textArea.todoItems ?? []).length === 1}
                        />
                      ))}
                    <button
                      className="mt-2 ml-7 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 text-sm flex items-center"
                      onClick={() => handleAddTodoItem(textArea.id)}
                    >
                      <span className="mr-1">+</span> Add item
                    </button>
                  </div>
                ) : textArea.format === 'bulletList' || textArea.format === 'numberedList' ? (
                  <div
                    id={`list-${textArea.id}`}
                    className="px-4 py-2 border-none outline-none resize bg-transparent sidebar-scrollbar whitespace-pre-wrap break-words"
                    style={{
                      minHeight: '40px',
                      minWidth: '300px',
                      maxWidth: '800px'
                    }}
                  >
                    <List
                      items={textArea.listItems || []}
                      onItemChange={(id, content) =>
                        handleUpdateListItemContent(textArea.id, id, content)
                      }
                      onItemRemove={(id) => handleRemoveListItem(textArea.id, id)}
                      onItemAdd={() => handleAddListItem(textArea.id)}
                      onKeyDown={(e, id, index) => handleListItemKeyDown(e, textArea.id, id, index)}
                      onBlur={() => handleListItemBlur(textArea.id)}
                      type={textArea.format === 'bulletList' ? 'bullet' : 'numbered'}
                    />
                  </div>
                ) : (
                  <div
                    id={`textarea-${textArea.id}`}
                    contentEditable
                    suppressContentEditableWarning
                    className={`px-4 py-2 border-none outline-none resize bg-transparent sidebar-scrollbar whitespace-pre-wrap break-words editor-content ${getTextStyles(textArea.format)} ${
                      !textArea.content && focusedTextAreaId === textArea.id
                        ? 'data-placeholder'
                        : ''
                    }`}
                    data-placeholder="Type anything..."
                    onInput={(e) => handleInput(e, textArea.id)}
                    onFocus={() => handleFocus(textArea.id)}
                    onBlur={() => handleBlur(textArea.id)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => handleTextSelection(e, textArea.id)}
                    onKeyDown={(e) => handleTextAreaKeyDown(e, textArea.id)}
                    style={{
                      minHeight: '40px',
                      minWidth: '200px',
                      maxWidth: '800px',
                      lineHeight: textArea.format === 'normal' ? '24px' : 'inherit',
                      fontFamily: textArea.fontFamily || 'inherit' // Add this line
                    }}
                  />
                )}
              </div>
            </div>
          ))}
          {webViews.map((webView) => (
            <div
              key={webView.id}
              className="webview-container absolute rounded-md gap-1 overflow-hidden flex flex-col group select-none"
              style={{
                left: `${webView.position.x}px`,
                top: `${webView.position.y}px`,
                width: `${webView.size.width}px`,
                height: `${webView.size.height}px`,
                zIndex: webView.zIndex
              }}
              onClick={() => bringToFront(webView.id, true)}
            >
              <div className="webview-content border rounded-lg bg-zinc-300 dark:bg-zinc-950 flex-1 p-1 overflow-hidden relative">
                <webview
                  id={`webview-${webView.id}`}
                  src={webView.url}
                  partition="persist:main"
                  className="w-full h-full border-none"
                  webpreferences="contextIsolation=yes, nodeIntegration=no"
                ></webview>

                <div
                  className={`webview-header absolute bottom-0 left-0 right-0 bg-white/95 dark:bg-zinc-900/90 backdrop-blur-sm border-t border-zinc-300 dark:border-zinc-600 shadow-lg transition-all duration-200 flex items-center justify-center gap-2 py-2 px-3 z-20 select-none rounded-b-lg ${
                    focusedWebViewInputId === webView.id
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-full group-hover:opacity-100 group-hover:translate-y-0'
                  }`}
                >
                  {/* Navigation Controls */}
                  <button
                    className={`text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors ${
                      webViewCanGoBack[webView.id]
                        ? 'hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        : 'opacity-50 cursor-not-allowed'
                    } p-1.5 rounded`}
                    onClick={(e) => {
                      e.stopPropagation()
                      const webviewElement = document.getElementById(
                        `webview-${webView.id}`
                      ) as Electron.WebviewTag
                      if (webviewElement && webviewElement.canGoBack()) {
                        webviewElement.goBack()
                      }
                    }}
                    disabled={!webViewCanGoBack[webView.id]}
                    title="Go back"
                  >
                    <CaretLeft size={16} />
                  </button>

                  <button
                    className={`text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors ${
                      webViewCanGoForward[webView.id]
                        ? 'hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        : 'opacity-50 cursor-not-allowed'
                    } p-1.5 rounded`}
                    onClick={(e) => {
                      e.stopPropagation()
                      const webviewElement = document.getElementById(
                        `webview-${webView.id}`
                      ) as Electron.WebviewTag
                      if (webviewElement && webviewElement.canGoForward()) {
                        webviewElement.goForward()
                      }
                    }}
                    disabled={!webViewCanGoForward[webView.id]}
                    title="Go forward"
                  >
                    <CaretRight size={16} />
                  </button>

                  {/* Reload Button - moved here beside navigation */}
                  <button
                    className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 p-1.5 rounded transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      const webviewElement = document.getElementById(`webview-${webView.id}`)
                      if (webviewElement) {
                        try {
                          ;(webviewElement as unknown as Electron.WebviewTag).reload()
                        } catch (error) {
                          ;(webviewElement as HTMLIFrameElement).src = webView.url
                        }

                        const button = e.currentTarget
                        button.classList.add('animate-spin')
                        setTimeout(() => button.classList.remove('animate-spin'), 500)
                      }
                    }}
                    title="Reload page"
                  >
                    <ArrowClockwise size={16} />
                  </button>

                  {/* URL Input */}
                  <input
                    type="text"
                    className="flex-1 bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 text-zinc-900 dark:text-zinc-200 text-xs outline-none focus:border-blue-500 dark:focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500/20 dark:focus:ring-zinc-400/20 placeholder-zinc-500 dark:placeholder-zinc-500 min-w-0 transition-all"
                    placeholder="Enter URL..."
                    value={webViewInputValues[webView.id] || webView.url}
                    onChange={(e) => handleWebViewInputChange(webView.id, e.target.value)}
                    onKeyDown={(e) => handleWebViewInputSubmit(webView.id, e)}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={() => setFocusedWebViewInputId(webView.id)}
                    onBlur={() => setFocusedWebViewInputId(null)}
                  />

                  {onOpenPictureInPictureFromUrl && (
                    <button
                      className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 p-1.5 rounded transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenWebViewInPiP(webView.id)
                      }}
                      title="Open in Picture-in-Picture"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                        <rect
                          x="14"
                          y="14"
                          width="6"
                          height="4"
                          rx="1"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          fill="none"
                        />
                      </svg>
                    </button>
                  )}

                  {/* New Navigation Arrow Button - 180 degree rotated */}
                  <button
                    className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 p-1.5 rounded transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      // Add your functionality here
                      console.log('Navigation arrow button clicked')
                    }}
                  >
                    <button
                      className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 p-1.5 rounded transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenWebViewInNewTab(webView.id)
                      }}
                      title="Open in new browser tab"
                    >
                      <div className="rotate-F0 hover:rotate-90 transition-transform duration-200">
                        <NavigationArrow size={16} />
                      </div>
                    </button>
                  </button>

                  {/* Close Button */}
                  <button
                    className="text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 p-1.5 rounded transition-colors"
                    onClick={(e) => handleRemoveWebView(webView.id, e)}
                    title="Close webview"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* BORDER DRAG HANDLES ONLY - No coverage of content area */}

              {/* Top border drag handle (except corners) */}
              <div
                className="absolute top-0 left-12 right-12 h-4 cursor-move bg-transparent "
                style={{ pointerEvents: 'auto', userSelect: 'none' }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleWebViewDragStart(webView.id, e)
                }}
              ></div>

              {/* Bottom border drag handle (except corners) */}
              <div
                className="absolute bottom-0 left-12 right-12 h-4 cursor-move bg-transparent "
                style={{ pointerEvents: 'auto', userSelect: 'none' }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleWebViewDragStart(webView.id, e)
                }}
              ></div>

              {/* Left border drag handle (except corners) */}
              <div
                className="absolute left-0 top-12 bottom-12 w-4 cursor-move bg-transparent "
                style={{ pointerEvents: 'auto', userSelect: 'none' }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleWebViewDragStart(webView.id, e)
                }}
              ></div>

              {/* Right border drag handle (except corners) */}
              <div
                className="absolute right-0 top-12 bottom-12 w-4 cursor-move bg-transparent "
                style={{ pointerEvents: 'auto', userSelect: 'none' }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleWebViewDragStart(webView.id, e)
                }}
              ></div>

              {/* Corner resize handles */}
              <div
                className="absolute bottom-0 right-0 w-12 h-12 cursor-nwse-resize bg-transparent "
                style={{ pointerEvents: 'auto', userSelect: 'none' }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleWebViewResizeStart(webView.id, e, 'bottom-right')
                }}
              ></div>

              <div
                className="absolute bottom-0 left-0 w-12 h-12 cursor-nesw-resize bg-transparent "
                style={{ pointerEvents: 'auto', userSelect: 'none' }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleWebViewResizeStart(webView.id, e, 'bottom-left')
                }}
              ></div>

              <div
                className="absolute top-0 right-0 w-12 h-12 cursor-nesw-resize bg-transparent "
                style={{ pointerEvents: 'auto', userSelect: 'none' }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleWebViewResizeStart(webView.id, e, 'top-right')
                }}
              ></div>

              <div
                className="absolute top-0 left-0 w-12 h-12 cursor-nwse-resize bg-transparent "
                style={{ pointerEvents: 'auto', userSelect: 'none' }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleWebViewResizeStart(webView.id, e, 'top-left')
                }}
              ></div>

              {/* Optional: Visual border indicator that appears on hover */}
              <div className="absolute inset-0 pointer-events-none border-2 border-transparent rounded-md transition-colors duration-200"></div>
            </div>
          ))}
          {images.map((image) => {
            const isSelected = selectedImageIds.includes(image.id)
            const isCapturedImage = 'sourceUrl' in image && image.sourceUrl

            return (
              <div
                key={image.id}
                className={`image-container absolute rounded-md overflow-hidden flex flex-col group select-none ${
                  isSelected ? 'ring-2 ring-yellow-500' : ''
                }`}
                style={{
                  left: `${image.x}px`,
                  top: `${image.y}px`,
                  width: `${image.width}px`,
                  height: `${image.height}px`,
                  zIndex: image.zIndex,
                  cursor: draggedImageId === image.id ? 'grabbing' : 'grab'
                }}
                onClick={(e) => handleImageClick(e, image.id)}
                onMouseDown={(e) => {
                  if (!(e.target as HTMLElement).classList.contains('resize-handle')) {
                    handleImageDragStart(image.id, e)
                  }
                }}
              >
                <div className="image-content border rounded-lg bg-white dark:bg-zinc-800 flex-1 overflow-hidden relative p-1">
                  <img
                    src={image.src}
                    alt="Uploaded"
                    className="w-full h-full object-contain pointer-events-none"
                    draggable={false}
                  />

                  {/* Source URL bar for captured images */}
                  {isCapturedImage && (
                    <div
                      className={`absolute bottom-0 left-0 right-0 bg-white/95 dark:bg-zinc-900/90 backdrop-blur-sm border-t border-zinc-300 dark:border-zinc-600 shadow-lg text-xs flex items-center justify-center gap-2 py-2 px-3 z-20 select-none rounded-b-lg transition-opacity duration-200 ${'opacity-0 group-hover:opacity-100'}`}
                    >
                      <button
                        className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 p-1.5 rounded transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Check if this is a captured image with a source URL
                          const capturedImage = image as CapturedImageItem
                          if (capturedImage.sourceUrl && addTab) {
                            addTab(capturedImage.sourceUrl)
                          }
                        }}
                        title="Open in new browser tab"
                      >
                        <div className="rotate-90 hover:rotate-0 transition-transform duration-200">
                          <NavigationArrow size={16} />
                        </div>
                      </button>

                      <input
                        type="text"
                        className="flex-1 bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 text-zinc-900 dark:text-zinc-200 text-xs outline-none focus:border-yellow-500 dark:focus:border-zinc-400 focus:bg-white dark:focus:bg-zinc-800 focus:ring-1 focus:ring-blue-500/20 dark:focus:ring-zinc-400/20 placeholder-zinc-500 dark:placeholder-zinc-500 transition-all"
                        placeholder="Enter URL..."
                        onClick={(e) => e.stopPropagation()}
                        onBlur={() => setFocusedWebViewInputId(null)}
                        value={(image as CapturedImageItem).sourceUrl}
                      />

                      <button
                        className={`text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 p-1.5 rounded transition-colors ${
                          !(image as CapturedImageItem).sourceUrl
                            ? 'opacity-50 cursor-not-allowed'
                            : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if ((image as CapturedImageItem).sourceUrl) {
                            handleConvertImageToWebview(image.id)
                          }
                        }}
                        title={
                          (image as CapturedImageItem).sourceUrl
                            ? 'Convert to webview'
                            : 'No source URL available'
                        }
                        disabled={!(image as CapturedImageItem).sourceUrl}
                      >
                        <GlobeSimple size={18} />
                      </button>

                      <button
                        className="text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 p-1.5 rounded transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveImage(image.id, e)
                        }}
                        title="Remove image"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {/* Control buttons */}
                  <div
                    className={`image-controls absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1`}
                  >
                    <button
                      className="w-6 h-6 rounded-full bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-300 flex items-center justify-center text-xs shadow-sm hover:bg-gray-100 dark:hover:bg-zinc-600"
                      onClick={(e) => handleRemoveImage(image.id, e)}
                      title="Remove image"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Resize handles (only show when selected) */}
                {isSelected && (
                  <>
                    {/* Corner resize handles */}
                    <div
                      className="resize-handle absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(50%, 50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleImageResizeStart(image.id, e, 'bottom-right')
                      }}
                    />

                    <div
                      className="resize-handle absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(-50%, 50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleImageResizeStart(image.id, e, 'bottom-left')
                      }}
                    />

                    <div
                      className="resize-handle absolute top-0 right-0 w-3 h-3 cursor-nesw-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleImageResizeStart(image.id, e, 'top-right')
                      }}
                    />

                    <div
                      className="resize-handle absolute top-0 left-0 w-3 h-3 cursor-nwse-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(-50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleImageResizeStart(image.id, e, 'top-left')
                      }}
                    />

                    {/* Edge resize handles */}
                    <div
                      className="resize-handle absolute top-0 left-1/2 w-3 h-3 cursor-ns-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(-50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleImageResizeStart(image.id, e, 'top')
                      }}
                    />

                    <div
                      className="resize-handle absolute right-0 top-1/2 w-3 h-3 cursor-ew-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleImageResizeStart(image.id, e, 'right')
                      }}
                    />

                    <div
                      className="resize-handle absolute bottom-0 left-1/2 w-3 h-3 cursor-ns-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(-50%, 50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleImageResizeStart(image.id, e, 'bottom')
                      }}
                    />

                    <div
                      className="resize-handle absolute left-0 top-1/2 w-3 h-3 cursor-ew-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(-50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleImageResizeStart(image.id, e, 'left')
                      }}
                    />
                  </>
                )}
              </div>
            )
          })}
          {videos.map((video) => {
            const isSelected = selectedVideoIds.includes(video.id)

            return (
              <div
                key={video.id}
                className={`video-container absolute rounded-md overflow-hidden flex flex-col group select-none ${
                  isSelected ? 'ring-2 ring-yellow-500' : ''
                }`}
                style={{
                  left: `${video.x}px`,
                  top: `${video.y}px`,
                  width: `${video.width}px`,
                  height: `${video.height}px`,
                  zIndex: video.zIndex,
                  cursor: draggedVideoId === video.id ? 'grabbing' : 'grab'
                }}
                onClick={(e) => handleVideoClick(e, video.id)}
                onMouseDown={(e) => {
                  // Only start drag if not clicking on resize handles or controls
                  if (
                    !(e.target as HTMLElement).classList.contains('resize-handle') &&
                    !(e.target as HTMLElement).closest('.video-controls')
                  ) {
                    handleVideoDragStart(video.id, e)
                  }
                }}
              >
                <div className="video-content border rounded-lg bg-black dark:bg-zinc-900 flex-1 overflow-hidden relative">
                  {/* Video Element - removed muted prop since HTML5 controls handle it */}
                  <video
                    ref={(el) => handleVideoRef(el, video.id)}
                    src={video.src}
                    controls
                    loop
                    width="100%"
                    height="100%"
                    className="object-contain"
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                  />

                  {/* Video Info Overlay */}
                  <div
                    className={`absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none`}
                  >
                    {video.filename}
                  </div>

                  {/* Simplified Video Controls - only remove button */}
                  <div
                    className={`video-controls absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
                  >
                    <button
                      className="w-7 h-7 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center text-xs shadow-sm"
                      onClick={(e) => handleRemoveVideo(video.id, e)}
                      title="Remove video"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Resize handles (only show when selected) - same as before */}
                {isSelected && (
                  <>
                    {/* Corner resize handles */}
                    <div
                      className="resize-handle absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(50%, 50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleVideoResizeStart(video.id, e, 'bottom-right')
                      }}
                    />

                    <div
                      className="resize-handle absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(-50%, 50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleVideoResizeStart(video.id, e, 'bottom-left')
                      }}
                    />

                    <div
                      className="resize-handle absolute top-0 right-0 w-3 h-3 cursor-nesw-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleVideoResizeStart(video.id, e, 'top-right')
                      }}
                    />

                    <div
                      className="resize-handle absolute top-0 left-0 w-3 h-3 cursor-nwse-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(-50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleVideoResizeStart(video.id, e, 'top-left')
                      }}
                    />

                    {/* Edge resize handles */}
                    <div
                      className="resize-handle absolute top-0 left-1/2 w-3 h-3 cursor-ns-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(-50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleVideoResizeStart(video.id, e, 'top')
                      }}
                    />

                    <div
                      className="resize-handle absolute right-0 top-1/2 w-3 h-3 cursor-ew-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleVideoResizeStart(video.id, e, 'right')
                      }}
                    />

                    <div
                      className="resize-handle absolute bottom-0 left-1/2 w-3 h-3 cursor-ns-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(-50%, 50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleVideoResizeStart(video.id, e, 'bottom')
                      }}
                    />

                    <div
                      className="resize-handle absolute left-0 top-1/2 w-3 h-3 cursor-ew-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(-50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleVideoResizeStart(video.id, e, 'left')
                      }}
                    />
                  </>
                )}
              </div>
            )
          })}
          {audios.map((audio) => {
            const isSelected = selectedAudioIds.includes(audio.id)

            return (
              <div
                key={audio.id}
                className={`audio-container absolute rounded-md overflow-hidden flex flex-col group select-none ${
                  isSelected ? 'ring-2 ring-yellow-500' : ''
                }`}
                style={{
                  left: `${audio.x}px`,
                  top: `${audio.y}px`,
                  width: `${audio.width}px`,
                  height: `${audio.height}px`,
                  zIndex: audio.zIndex,
                  cursor: draggedAudioId === audio.id ? 'grabbing' : 'grab'
                }}
                onClick={(e) => handleAudioClick(e, audio.id)}
                onMouseDown={(e) => {
                  // Only start drag if not clicking on resize handles or controls
                  if (
                    !(e.target as HTMLElement).classList.contains('resize-handle') &&
                    !(e.target as HTMLElement).closest('.audio-controls')
                  ) {
                    handleAudioDragStart(audio.id, e)
                  }
                }}
              >
                <div className="audio-content border rounded-lg bg-white dark:bg-zinc-800 flex-1 overflow-hidden relative p-2">
                  {/* Audio Info */}
                  <div className="audio-info mb-2">
                    <div
                      className={`text-xs text-gray-600 dark:text-gray-400 truncate`}
                      title={audio.filename}
                    >
                      {audio.filename}
                    </div>
                  </div>

                  {/* Audio Element */}
                  <audio
                    ref={(el) => handleAudioRef(el, audio.id)}
                    src={audio.src}
                    controls
                    className="w-full"
                    style={{ height: '64px' }}
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                  />

                  {/* Audio Controls - only remove button */}
                  <div
                    className={`audio-controls absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
                  >
                    <button
                      className="w-6 h-6 rounded-full bg-white dark:bg-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-600 text-gray-700 dark:text-gray-300 flex items-center justify-center text-xs shadow-sm border border-gray-200 dark:border-zinc-600"
                      onClick={(e) => handleRemoveAudio(audio.id, e)}
                      title="Remove audio"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Resize handles (only show when selected) */}
                {isSelected && (
                  <>
                    {/* Corner resize handles */}
                    <div
                      className="resize-handle absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(50%, 50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleAudioResizeStart(audio.id, e, 'bottom-right')
                      }}
                    />

                    <div
                      className="resize-handle absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(-50%, 50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleAudioResizeStart(audio.id, e, 'bottom-left')
                      }}
                    />

                    <div
                      className="resize-handle absolute top-0 right-0 w-3 h-3 cursor-nesw-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleAudioResizeStart(audio.id, e, 'top-right')
                      }}
                    />

                    <div
                      className="resize-handle absolute top-0 left-0 w-3 h-3 cursor-nwse-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(-50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleAudioResizeStart(audio.id, e, 'top-left')
                      }}
                    />

                    {/* Edge resize handles */}
                    <div
                      className="resize-handle absolute top-0 left-1/2 w-3 h-3 cursor-ns-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(-50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleAudioResizeStart(audio.id, e, 'top')
                      }}
                    />

                    <div
                      className="resize-handle absolute right-0 top-1/2 w-3 h-3 cursor-ew-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleAudioResizeStart(audio.id, e, 'right')
                      }}
                    />

                    <div
                      className="resize-handle absolute bottom-0 left-1/2 w-3 h-3 cursor-ns-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(-50%, 50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleAudioResizeStart(audio.id, e, 'bottom')
                      }}
                    />

                    <div
                      className="resize-handle absolute left-0 top-1/2 w-3 h-3 cursor-ew-resize bg-yellow-500 rounded-full border border-white shadow-sm"
                      style={{ transform: 'translate(-50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleAudioResizeStart(audio.id, e, 'left')
                      }}
                    />
                  </>
                )}
              </div>
            )
          })}
          {files.map((file) => {
            const isSelected = selectedFileIds.includes(file.id)

            return (
              <div
                key={file.id}
                className={`file-container absolute rounded-xl overflow-hidden flex flex-col group select-none shadow-2xl border transition-all duration-200 ${
                  isSelected
                    ? 'ring-2 ring-yellow-500 border-yellow-200 dark:border-yellow-700'
                    : 'border-zinc-200 dark:border-zinc-700'
                }`}
                style={{
                  left: `${file.x}px`,
                  top: `${file.y}px`,
                  width: `${file.width}px`,
                  height: `${file.height}px`,
                  zIndex: file.zIndex,
                  cursor: draggedFileId === file.id ? 'grabbing' : 'grab',
                  backdropFilter: 'blur(8px)'
                }}
                onClick={(e) => handleFileClick(e, file.id)}
                onMouseDown={(e) => {
                  console.log('File mousedown event triggered for:', file.id)

                  // Don't start drag if clicking on resize handles or controls
                  const target = e.target as HTMLElement
                  if (
                    target.classList.contains('resize-handle') ||
                    target.closest('.file-controls') ||
                    target.closest('button') ||
                    target.closest('iframe') ||
                    target.closest('input') ||
                    target.closest('.document-content')
                  ) {
                    console.log('Ignoring mousedown on control element')
                    return
                  }

                  // Only handle left mouse button
                  if (e.button !== 0) {
                    console.log('Ignoring non-left mouse button')
                    return
                  }

                  console.log('Starting file drag...')
                  handleFileDragStart(file.id, e)
                }}
              >
                <div className="file-content bg-white/95 dark:bg-zinc-900/95 flex flex-col h-full overflow-hidden rounded-xl">
                  {/* Modern File Header */}
                  <div className="file-header text-foreground p-3 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate" title={file.filename}>
                          {file.filename}
                        </div>
                        <div className="text-xs uppercase tracking-wide">{file.documentType}</div>
                      </div>
                    </div>

                    {/* Modern File Controls */}
                    <div className="file-controls flex items-center gap-1">
                      {/* Zoom controls */}
                      <div className="flex items-center gap-1 bg-background/60 text-foreground rounded-lg p-1">
                        <button
                          className="w-7 h-7 rounded-md flex items-center justify-center text-sm transition-all duration-150"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleFileZoomOut(file.id)
                          }}
                          title="Zoom out"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M20 12H4"
                            />
                          </svg>
                        </button>
                        <span className="text-xs min-w-[40px] text-center">
                          {Math.round((file.scale || 1.2) * 100)}%
                        </span>
                        <button
                          className="w-7 h-7 rounded-md flex items-center justify-center text-sm transition-all duration-150"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleFileZoomIn(file.id)
                          }}
                          title="Zoom in"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                        </button>
                        <button
                          className="w-7 h-7 rounded-md flex items-center justify-center text-sm transition-all duration-150"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleFileResetZoom(file.id)
                          }}
                          title="Reset zoom"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                        </button>
                      </div>

                      {/* Presentation controls */}
                      {file.documentType === 'presentation' && file.slides && (
                        <div className="flex items-center gap-1 bg-background/60 text-foreground rounded-lg p-1 ml-1">
                          <button
                            className="w-7 h-7 rounded-md flex items-center justify-center text-sm transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleFilePrevSlide(file.id)
                            }}
                            disabled={(file.currentSlideIndex || 0) <= 0}
                            title="Previous slide"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 19l-7-7 7-7"
                              />
                            </svg>
                          </button>
                          <span className="text-xs min-w-[35px] text-center">
                            {(file.currentSlideIndex || 0) + 1}/{file.slides.length}
                          </span>
                          <button
                            className="w-7 h-7 rounded-md flex items-center justify-center text-sm transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleFileNextSlide(file.id)
                            }}
                            disabled={(file.currentSlideIndex || 0) >= file.slides.length - 1}
                            title="Next slide"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </button>
                        </div>
                      )}

                      {/* Close button */}
                      <button
                        className="w-8 h-8 rounded-lg bg-background text-foreground flex items-center justify-center ml-2 transition-all duration-150"
                        onClick={(e) => handleRemoveFile(file.id, e)}
                        title="Remove file"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Modern File Content Body */}
                  <div className="file-body flex-1 min-h-0 overflow-hidden bg-zinc-50/50 dark:bg-zinc-800/50">
                    {file.loading && (
                      <div className="flex flex-col items-center justify-center h-full text-zinc-500 dark:text-zinc-400">
                        <div className="relative">
                          <div className="w-12 h-12 border-4 border-zinc-200 dark:border-zinc-700 border-t-yellow-500 rounded-full animate-spin"></div>
                          <div
                            className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-yellow-400 rounded-full animate-spin"
                            style={{ animationDelay: '0.15s', animationDuration: '1.2s' }}
                          ></div>
                        </div>
                        <p className="mt-4 text-sm font-medium">Loading document...</p>
                      </div>
                    )}

                    {file.error && (
                      <div className="flex flex-col items-center justify-center h-full text-red-500 dark:text-red-400">
                        <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
                          <svg
                            className="w-8 h-8"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                            />
                          </svg>
                        </div>
                        <p className="text-center px-4 text-sm">{file.error}</p>
                      </div>
                    )}

                    {!file.loading && !file.error && (
                      <>
                        {/* PDF Display */}
                        {file.documentType === 'pdf' && file.pdfUrl && (
                          <div className="h-full p-2">
                            <iframe
                              src={file.pdfUrl}
                              width="100%"
                              height="100%"
                              className="border-none rounded-lg shadow-inner"
                              title="PDF Viewer"
                            />
                          </div>
                        )}

                        {/* Modern Text-based Documents */}
                        {['word', 'text', 'json', 'xml', 'html'].includes(file.documentType!) &&
                          file.documentContent && (
                            <div
                              className="document-content h-full overflow-y-auto overflow-x-hidden custom-scrollbar"
                              style={{
                                scrollbarWidth: 'thin',
                                scrollbarColor: '#a1a1aa #f4f4f5'
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <div
                                className="p-6"
                                style={{
                                  fontSize: `${(file.scale || 1.2) * 16}px`,
                                  lineHeight: 1.7
                                }}
                              >
                                {file.documentType === 'word' ? (
                                  <div
                                    dangerouslySetInnerHTML={{ __html: file.documentContent }}
                                    className="prose prose-lg max-w-none dark:prose-invert prose-zinc"
                                  />
                                ) : (
                                  <div
                                    className={`whitespace-pre-wrap break-words ${
                                      file.documentType === 'json'
                                        ? 'font-mono p-4'
                                        : file.documentType === 'xml'
                                          ? 'font-mono p-4'
                                          : file.filename.toLowerCase().endsWith('.md') ||
                                              file.filename.toLowerCase().endsWith('.markdown')
                                            ? 'prose prose-lg max-w-none dark:prose-invert prose-zinc font-serif leading-relaxed'
                                            : 'font-mono text-zinc-700 dark:text-zinc-300 leading-relaxed'
                                    }`}
                                  >
                                    {file.documentContent}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                        {/* Modern Presentation Display */}
                        {file.documentType === 'presentation' && (
                          <div className="presentation-container w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 overflow-hidden">
                            <div className="w-full h-full flex items-center justify-center p-4">
                              {renderSlide(file)}
                            </div>
                          </div>
                        )}

                        {file.documentType === 'spreadsheet' && (
                          <div className="w-full h-full bg-white dark:bg-zinc-900 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
                            {/* Sheet selector if multiple sheets */}
                            {file.spreadsheetData?.sheetNames &&
                              file.spreadsheetData.sheetNames.length > 1 && (
                                <div className="p-3 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-zinc-50 to-zinc-100 dark:from-zinc-800 dark:to-zinc-700">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                      Sheet:
                                    </span>
                                    <select
                                      className="text-xs bg-white dark:bg-zinc-600 border border-zinc-300 dark:border-zinc-500 rounded-md px-2 py-1 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                      value={file.spreadsheetData.currentSheetName}
                                      onChange={(e) => {
                                        const sheetName = e.target.value
                                        setFiles((prev) =>
                                          prev.map((item) => {
                                            if (item.id !== file.id) return item
                                            return {
                                              ...item,
                                              spreadsheetData: {
                                                ...item.spreadsheetData!,
                                                currentSheetName: sheetName,
                                                currentSheet:
                                                  item.spreadsheetData!.workbook.Sheets[sheetName]
                                              }
                                            }
                                          })
                                        )
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {file.spreadsheetData.sheetNames.map((name) => (
                                        <option key={name} value={name}>
                                          {name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              )}

                            {/* Spreadsheet content */}
                            <div className="flex-1 overflow-hidden">
                              {file.spreadsheetData ? (
                                renderSpreadsheet(file)
                              ) : (
                                <div className="flex items-center justify-center h-full text-zinc-500 dark:text-zinc-400">
                                  <div className="text-center">
                                    <div className="text-4xl mb-4">⚠️</div>
                                    <p>Unable to load spreadsheet</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {file.documentType === 'code' && file.documentContent && (
                          <CodeEditor
                            id={file.id}
                            content={file.documentContent}
                            language={file.codeLanguage || 'javascript'}
                            onContentChange={(_, newContent) => {
                              setFiles((prev) =>
                                prev.map((item) => {
                                  if (item.id !== file.id || item.documentType !== 'code')
                                    return item
                                  return {
                                    ...item,
                                    documentContent: newContent,
                                    documentData: item.documentData
                                      ? {
                                          ...item.documentData,
                                          data: newContent
                                        }
                                      : null
                                  }
                                })
                              )
                            }}
                            onLanguageChange={(_, newLanguage) => {
                              setFiles((prev) =>
                                prev.map((item) =>
                                  item.id === file.id
                                    ? { ...item, codeLanguage: newLanguage }
                                    : item
                                )
                              )
                            }}
                            filename={file.filename}
                            width={file.width}
                            height={file.height - 120} // Account for file container padding
                            scale={file.scale || 1.2}
                            showLanguageSelector={false} // Hide since filename shows language
                            showSaveButton={true}
                            className="w-full h-full"
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Modern Resize handles */}
                {isSelected && (
                  <>
                    {/* Corner resize handles */}
                    <div
                      className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-yellow-500 hover:bg-yellow-600 rounded-full border-2 border-white dark:border-zinc-800 shadow-lg transition-all duration-150 hover:scale-110"
                      style={{ transform: 'translate(50%, 50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleFileResizeStart(file.id, e, 'bottom-right')
                      }}
                    />

                    <div
                      className="resize-handle absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize bg-yellow-500 hover:bg-yellow-600 rounded-full border-2 border-white dark:border-zinc-800 shadow-lg transition-all duration-150 hover:scale-110"
                      style={{ transform: 'translate(-50%, 50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleFileResizeStart(file.id, e, 'bottom-left')
                      }}
                    />

                    <div
                      className="resize-handle absolute top-0 right-0 w-4 h-4 cursor-nesw-resize bg-yellow-500 hover:bg-yellow-600 rounded-full border-2 border-white dark:border-zinc-800 shadow-lg transition-all duration-150 hover:scale-110"
                      style={{ transform: 'translate(50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleFileResizeStart(file.id, e, 'top-right')
                      }}
                    />

                    <div
                      className="resize-handle absolute top-0 left-0 w-4 h-4 cursor-nwse-resize bg-yellow-500 hover:bg-yellow-600 rounded-full border-2 border-white dark:border-zinc-800 shadow-lg transition-all duration-150 hover:scale-110"
                      style={{ transform: 'translate(-50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleFileResizeStart(file.id, e, 'top-left')
                      }}
                    />

                    {/* Edge resize handles */}
                    <div
                      className="resize-handle absolute top-0 left-1/2 w-4 h-4 cursor-ns-resize bg-yellow-500 hover:bg-yellow-600 rounded-full border-2 border-white dark:border-zinc-800 shadow-lg transition-all duration-150 hover:scale-110"
                      style={{ transform: 'translate(-50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleFileResizeStart(file.id, e, 'top')
                      }}
                    />

                    <div
                      className="resize-handle absolute right-0 top-1/2 w-4 h-4 cursor-ew-resize bg-yellow-500 hover:bg-yellow-600 rounded-full border-2 border-white dark:border-zinc-800 shadow-lg transition-all duration-150 hover:scale-110"
                      style={{ transform: 'translate(50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleFileResizeStart(file.id, e, 'right')
                      }}
                    />

                    <div
                      className="resize-handle absolute bottom-0 left-1/2 w-4 h-4 cursor-ns-resize bg-yellow-500 hover:bg-yellow-600 rounded-full border-2 border-white dark:border-zinc-800 shadow-lg transition-all duration-150 hover:scale-110"
                      style={{ transform: 'translate(-50%, 50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleFileResizeStart(file.id, e, 'bottom')
                      }}
                    />

                    <div
                      className="resize-handle absolute left-0 top-1/2 w-4 h-4 cursor-ew-resize bg-yellow-500 hover:bg-yellow-600 rounded-full border-2 border-white dark:border-zinc-800 shadow-lg transition-all duration-150 hover:scale-110"
                      style={{ transform: 'translate(-50%, -50%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleFileResizeStart(file.id, e, 'left')
                      }}
                    />
                  </>
                )}
              </div>
            )
          })}
        </div>
        <svg
          className="absolute top-0 left-0 w-full h-full z-30 pointer-events-none"
          style={{
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px)`,
            transition: isPanning ? 'none' : 'transform 0.1s ease-out'
          }}
        >
          {/* Render completed paths */}
          {drawPaths
            .filter((path) => path && path.points && Array.isArray(path.points))
            .map((path) => {
              const isSelected = selectedDrawPathIds.includes(path.id)

              if (path.type === 'pen') {
                // Filter out any null or invalid points
                const validPoints = path.points.filter(
                  (point) => point && typeof point.x === 'number' && typeof point.y === 'number'
                )

                // Skip drawing if no valid points
                if (validPoints.length === 0) return null

                // Create SVG path for pen strokes with null checks
                const pathData = validPoints.reduce((acc, point, i) => {
                  if (i === 0) return `M ${point.x} ${point.y}`
                  return `${acc} L ${point.x} ${point.y}`
                }, '')

                // Calculate bounding box for selection indicator with valid points
                const xPoints = validPoints.map((p) => p.x)
                const yPoints = validPoints.map((p) => p.y)
                const minX = Math.min(...xPoints)
                const minY = Math.min(...yPoints)
                const maxX = Math.max(...xPoints)
                const maxY = Math.max(...yPoints)

                return (
                  <g key={path.id}>
                    <path
                      d={pathData}
                      stroke={path.color}
                      strokeWidth={path.width}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        cursor: drawingMode === 'none' ? 'pointer' : 'default'
                      }}
                      onClick={(e) => handleDrawPathClick(e, path.id)}
                      onMouseDown={(e) => handleDrawPathDragStart(e, path.id)}
                      // Only make drawing elements interactive when in selection mode
                      pointerEvents={drawingMode === 'none' ? 'all' : 'none'}
                    />

                    {isSelected && (
                      <rect
                        x={minX - 5}
                        y={minY - 5}
                        width={maxX - minX + 10}
                        height={maxY - minY + 10}
                        fill="none"
                        stroke="#fde047"
                        strokeWidth={1.5}
                        strokeDasharray="5,5"
                        pointerEvents="none"
                      />
                    )}
                  </g>
                )
              } else if (path.type === 'shape') {
                // For a shape, use the first and last points to define it
                if (!path.points || path.points.length < 2) return null

                const first = path.points[0]
                const last = path.points[path.points.length - 1]

                // Add null checks for first and last points
                if (
                  !first ||
                  !last ||
                  typeof first.x !== 'number' ||
                  typeof first.y !== 'number' ||
                  typeof last.x !== 'number' ||
                  typeof last.y !== 'number'
                ) {
                  return null
                }

                const x = Math.min(first.x, last.x)
                const y = Math.min(first.y, last.y)
                const width = Math.abs(last.x - first.x)
                const height = Math.abs(last.y - first.y)

                // Calculate center for circle and triangle
                const centerX = (first.x + last.x) / 2
                const centerY = (first.y + last.y) / 2

                // Get the shape type (default to rectangle if not specified)
                const shapeType = path.shapeType || 'rectangle'

                return (
                  <g key={path.id}>
                    {shapeType === 'rectangle' && (
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        stroke={path.color}
                        strokeWidth={path.width}
                        fill="none"
                        style={{
                          cursor: drawingMode === 'none' ? 'pointer' : 'default'
                        }}
                        onClick={(e) => handleDrawPathClick(e, path.id)}
                        onMouseDown={(e) => {
                          // Only allow drag if not clicking on resize handles
                          if (!(e.target as SVGElement).classList.contains('shape-resize-handle')) {
                            handleDrawPathDragStart(e, path.id)
                          }
                        }}
                        pointerEvents={drawingMode === 'none' ? 'all' : 'none'}
                      />
                    )}

                    {shapeType === 'circle' && (
                      <circle
                        cx={centerX}
                        cy={centerY}
                        r={Math.min(width, height) / 2}
                        stroke={path.color}
                        strokeWidth={path.width}
                        fill="none"
                        style={{
                          cursor: drawingMode === 'none' ? 'pointer' : 'default'
                        }}
                        onClick={(e) => handleDrawPathClick(e, path.id)}
                        onMouseDown={(e) => {
                          if (!(e.target as SVGElement).classList.contains('shape-resize-handle')) {
                            handleDrawPathDragStart(e, path.id)
                          }
                        }}
                        pointerEvents={drawingMode === 'none' ? 'all' : 'none'}
                      />
                    )}

                    {shapeType === 'triangle' && (
                      <polygon
                        points={`${centerX},${y} ${x + width},${y + height} ${x},${y + height}`}
                        stroke={path.color}
                        strokeWidth={path.width}
                        fill="none"
                        style={{
                          cursor: drawingMode === 'none' ? 'pointer' : 'default'
                        }}
                        onClick={(e) => handleDrawPathClick(e, path.id)}
                        onMouseDown={(e) => {
                          if (!(e.target as SVGElement).classList.contains('shape-resize-handle')) {
                            handleDrawPathDragStart(e, path.id)
                          }
                        }}
                        pointerEvents={drawingMode === 'none' ? 'all' : 'none'}
                      />
                    )}

                    {/* Selection indicator */}
                    {isSelected && (
                      <rect
                        x={x - 5}
                        y={y - 5}
                        width={width + 10}
                        height={height + 10}
                        fill="none"
                        stroke="#fde047"
                        strokeWidth={1.5}
                        strokeDasharray="5,5"
                        pointerEvents="none"
                      />
                    )}

                    {/* Resize handles - only show when selected and not in drawing mode */}
                    {isSelected && drawingMode === 'none' && (
                      <>
                        {/* Corner resize handles */}
                        <circle
                          className="shape-resize-handle"
                          cx={x}
                          cy={y}
                          r={6}
                          fill="#fde047"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          style={{ cursor: 'nwse-resize' }}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleShapeResizeStart(path.id, 'top-left', e)
                          }}
                          pointerEvents="all"
                        />

                        <circle
                          className="shape-resize-handle"
                          cx={x + width}
                          cy={y}
                          r={6}
                          fill="#fde047"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          style={{ cursor: 'nesw-resize' }}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleShapeResizeStart(path.id, 'top-right', e)
                          }}
                          pointerEvents="all"
                        />

                        <circle
                          className="shape-resize-handle"
                          cx={x}
                          cy={y + height}
                          r={6}
                          fill="#fde047"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          style={{ cursor: 'nesw-resize' }}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleShapeResizeStart(path.id, 'bottom-left', e)
                          }}
                          pointerEvents="all"
                        />

                        <circle
                          className="shape-resize-handle"
                          cx={x + width}
                          cy={y + height}
                          r={6}
                          fill="#fde047"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          style={{ cursor: 'nwse-resize' }}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleShapeResizeStart(path.id, 'bottom-right', e)
                          }}
                          pointerEvents="all"
                        />

                        {/* Edge resize handles - only for rectangle (not for circle/square to maintain aspect ratio) */}
                        {shapeType === 'rectangle' && (
                          <>
                            <circle
                              className="shape-resize-handle"
                              cx={centerX}
                              cy={y}
                              r={6}
                              fill="#fde047"
                              stroke="#f59e0b"
                              strokeWidth={2}
                              style={{ cursor: 'ns-resize' }}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleShapeResizeStart(path.id, 'top', e)
                              }}
                              pointerEvents="all"
                            />

                            <circle
                              className="shape-resize-handle"
                              cx={x + width}
                              cy={centerY}
                              r={6}
                              fill="#fde047"
                              stroke="#f59e0b"
                              strokeWidth={2}
                              style={{ cursor: 'ew-resize' }}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleShapeResizeStart(path.id, 'right', e)
                              }}
                              pointerEvents="all"
                            />

                            <circle
                              className="shape-resize-handle"
                              cx={centerX}
                              cy={y + height}
                              r={6}
                              fill="#fde047"
                              stroke="#f59e0b"
                              strokeWidth={2}
                              style={{ cursor: 'ns-resize' }}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleShapeResizeStart(path.id, 'bottom', e)
                              }}
                              pointerEvents="all"
                            />

                            <circle
                              className="shape-resize-handle"
                              cx={x}
                              cy={centerY}
                              r={6}
                              fill="#fde047"
                              stroke="#f59e0b"
                              strokeWidth={2}
                              style={{ cursor: 'ew-resize' }}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleShapeResizeStart(path.id, 'left', e)
                              }}
                              pointerEvents="all"
                            />
                          </>
                        )}

                        {/* Visual indicators for the handles */}
                        <circle cx={x} cy={y} r={3} fill="white" pointerEvents="none" />
                        <circle cx={x + width} cy={y} r={3} fill="white" pointerEvents="none" />
                        <circle cx={x} cy={y + height} r={3} fill="white" pointerEvents="none" />
                        <circle
                          cx={x + width}
                          cy={y + height}
                          r={3}
                          fill="white"
                          pointerEvents="none"
                        />

                        {shapeType === 'rectangle' && (
                          <>
                            <circle cx={centerX} cy={y} r={3} fill="white" pointerEvents="none" />
                            <circle
                              cx={x + width}
                              cy={centerY}
                              r={3}
                              fill="white"
                              pointerEvents="none"
                            />
                            <circle
                              cx={centerX}
                              cy={y + height}
                              r={3}
                              fill="white"
                              pointerEvents="none"
                            />
                            <circle cx={x} cy={centerY} r={3} fill="white" pointerEvents="none" />
                          </>
                        )}
                      </>
                    )}
                  </g>
                )
              } else if (path.type === 'arrow') {
                // For an arrow, draw a line with an arrowhead
                if (!path.points || path.points.length < 2) return null

                const first = path.points[0]
                const last = path.points[path.points.length - 1]

                // Add null checks for first and last points
                if (
                  !first ||
                  !last ||
                  typeof first.x !== 'number' ||
                  typeof first.y !== 'number' ||
                  typeof last.x !== 'number' ||
                  typeof last.y !== 'number'
                ) {
                  return null
                }

                // Calculate the angle for the arrowhead
                const angle = Math.atan2(last.y - first.y, last.x - first.x)
                const arrowLength = 20

                // Calculate arrowhead points
                const arrowPoint1X = last.x - arrowLength * Math.cos(angle - Math.PI / 6)
                const arrowPoint1Y = last.y - arrowLength * Math.sin(angle - Math.PI / 6)
                const arrowPoint2X = last.x - arrowLength * Math.cos(angle + Math.PI / 6)
                const arrowPoint2Y = last.y - arrowLength * Math.sin(angle + Math.PI / 6)

                // Calculate bounding box for selection indicator
                const xPoints = [first.x, last.x, arrowPoint1X, arrowPoint2X]
                const yPoints = [first.y, last.y, arrowPoint1Y, arrowPoint2Y]
                const minX = Math.min(...xPoints)
                const minY = Math.min(...yPoints)
                const maxX = Math.max(...xPoints)
                const maxY = Math.max(...yPoints)

                return (
                  <g key={path.id}>
                    <g
                      style={{
                        cursor: drawingMode === 'none' ? 'pointer' : 'default'
                      }}
                      onClick={(e) => handleDrawPathClick(e, path.id)}
                      onMouseDown={(e) => {
                        // Only allow drag if not clicking on resize handles
                        if (!(e.target as SVGElement).classList.contains('arrow-resize-handle')) {
                          handleDrawPathDragStart(e, path.id)
                        }
                      }}
                      pointerEvents={drawingMode === 'none' ? 'all' : 'none'}
                    >
                      <line
                        x1={first.x}
                        y1={first.y}
                        x2={last.x}
                        y2={last.y}
                        stroke={path.color}
                        strokeWidth={path.width}
                      />
                      <line
                        x1={last.x}
                        y1={last.y}
                        x2={arrowPoint1X}
                        y2={arrowPoint1Y}
                        stroke={path.color}
                        strokeWidth={path.width}
                      />
                      <line
                        x1={last.x}
                        y1={last.y}
                        x2={arrowPoint2X}
                        y2={arrowPoint2Y}
                        stroke={path.color}
                        strokeWidth={path.width}
                      />
                    </g>

                    {/* Selection indicator */}
                    {isSelected && (
                      <rect
                        x={minX - 5}
                        y={minY - 5}
                        width={maxX - minX + 10}
                        height={maxY - minY + 10}
                        fill="none"
                        stroke="#fde047"
                        strokeWidth={1.5}
                        strokeDasharray="5,5"
                        pointerEvents="none"
                      />
                    )}

                    {/* Resize handles - only show when selected and not in drawing mode */}
                    {isSelected && drawingMode === 'none' && (
                      <>
                        {/* Start point resize handle */}
                        <circle
                          className="arrow-resize-handle"
                          cx={first.x}
                          cy={first.y}
                          r={6}
                          fill="#fde047"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          style={{ cursor: 'grab' }}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleArrowResizeStart(path.id, 'start', e)
                          }}
                          pointerEvents="all"
                        />

                        {/* End point resize handle */}
                        <circle
                          className="arrow-resize-handle"
                          cx={last.x}
                          cy={last.y}
                          r={6}
                          fill="#fde047"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          style={{ cursor: 'grab' }}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleArrowResizeStart(path.id, 'end', e)
                          }}
                          pointerEvents="all"
                        />

                        {/* Optional: Visual indicators for the handles */}
                        <circle cx={first.x} cy={first.y} r={3} fill="white" pointerEvents="none" />
                        <circle cx={last.x} cy={last.y} r={3} fill="white" pointerEvents="none" />
                      </>
                    )}
                  </g>
                )
              }

              return null
            })}

          {/* Render the current path being drawn with null checks */}
          {isDrawing && currentPath && currentPath.length > 0 && (
            <>
              {drawingMode === 'pen'
                ? // Filter out any null or invalid points in current path
                  currentPath.some(
                    (point) => point && typeof point.x === 'number' && typeof point.y === 'number'
                  ) && (
                    <path
                      d={currentPath
                        .filter(
                          (point) =>
                            point && typeof point.x === 'number' && typeof point.y === 'number'
                        )
                        .reduce((acc, point, i) => {
                          if (i === 0) return `M ${point.x} ${point.y}`
                          return `${acc} L ${point.x} ${point.y}`
                        }, '')}
                      stroke={drawColor}
                      strokeWidth={drawWidth}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      pointerEvents="none"
                    />
                  )
                : drawingMode === 'shape' && currentPath.length > 1
                  ? // Add null checks for first and last points of shape
                    currentPath[0] &&
                    currentPath[currentPath.length - 1] &&
                    typeof currentPath[0].x === 'number' &&
                    typeof currentPath[0].y === 'number' &&
                    typeof currentPath[currentPath.length - 1].x === 'number' &&
                    typeof currentPath[currentPath.length - 1].y === 'number' && (
                      <>
                        {(() => {
                          const first = currentPath[0]
                          const last = currentPath[currentPath.length - 1]

                          const x = Math.min(first.x, last.x)
                          const y = Math.min(first.y, last.y)
                          const width = Math.abs(last.x - first.x)
                          const height = Math.abs(last.y - first.y)

                          // Calculate center for circle and triangle
                          const centerX = (first.x + last.x) / 2
                          const centerY = (first.y + last.y) / 2

                          switch (currentShapeType) {
                            case 'rectangle':
                              return (
                                <rect
                                  x={x}
                                  y={y}
                                  width={width}
                                  height={height}
                                  stroke={drawColor}
                                  strokeWidth={drawWidth}
                                  fill="none"
                                  pointerEvents="none"
                                />
                              )
                            case 'circle':
                              return (
                                <circle
                                  cx={centerX}
                                  cy={centerY}
                                  r={Math.min(width, height) / 2}
                                  stroke={drawColor}
                                  strokeWidth={drawWidth}
                                  fill="none"
                                  pointerEvents="none"
                                />
                              )
                            case 'triangle':
                              return (
                                <polygon
                                  points={`${centerX},${y} ${x + width},${y + height} ${x},${y + height}`}
                                  stroke={drawColor}
                                  strokeWidth={drawWidth}
                                  fill="none"
                                  pointerEvents="none"
                                />
                              )
                            default:
                              return null
                          }
                        })()}
                      </>
                    )
                  : drawingMode === 'arrow' && currentPath.length > 1
                    ? // Add null checks for arrow points
                      currentPath[0] &&
                      currentPath[currentPath.length - 1] &&
                      typeof currentPath[0].x === 'number' &&
                      typeof currentPath[0].y === 'number' &&
                      typeof currentPath[currentPath.length - 1].x === 'number' &&
                      typeof currentPath[currentPath.length - 1].y === 'number' && (
                        <g pointerEvents="none">
                          <line
                            x1={currentPath[0].x}
                            y1={currentPath[0].y}
                            x2={currentPath[currentPath.length - 1].x}
                            y2={currentPath[currentPath.length - 1].y}
                            stroke={drawColor}
                            strokeWidth={drawWidth}
                          />
                          {(() => {
                            const first = currentPath[0]
                            const last = currentPath[currentPath.length - 1]
                            const angle = Math.atan2(last.y - first.y, last.x - first.x)
                            const arrowLength = 20

                            const arrowPoint1X =
                              last.x - arrowLength * Math.cos(angle - Math.PI / 6)
                            const arrowPoint1Y =
                              last.y - arrowLength * Math.sin(angle - Math.PI / 6)
                            const arrowPoint2X =
                              last.x - arrowLength * Math.cos(angle + Math.PI / 6)
                            const arrowPoint2Y =
                              last.y - arrowLength * Math.sin(angle + Math.PI / 6)

                            return (
                              <>
                                <line
                                  x1={last.x}
                                  y1={last.y}
                                  x2={arrowPoint1X}
                                  y2={arrowPoint1Y}
                                  stroke={drawColor}
                                  strokeWidth={drawWidth}
                                />
                                <line
                                  x1={last.x}
                                  y1={last.y}
                                  x2={arrowPoint2X}
                                  y2={arrowPoint2Y}
                                  stroke={drawColor}
                                  strokeWidth={drawWidth}
                                />
                              </>
                            )
                          })()}
                        </g>
                      )
                    : null}
            </>
          )}

          {/* Show delete button for selected drawings */}
          {(selectedDrawPathIds.length > 0 || selectedDrawPathId) && drawingMode === 'none' && (
            <foreignObject x="20" y="20" width="40" height="40" style={{ pointerEvents: 'auto' }}>
              <button
                className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center"
                onClick={handleDeleteDrawPath}
              >
                <X size={20} />
              </button>
            </foreignObject>
          )}
        </svg>
        <TextSelectionMenu
          position={selectionPosition}
          isVisible={showSelectionMenu}
          onFormatText={(formatType: string, value?: string) => handleFormatText(formatType, value)}
          onOutsideClick={closeSelectionMenu}
        />

        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20">
          <Panel
            activeTool={activeTool}
            onToolChange={setActiveTool}
            onCommandSelect={handlePanelCommandSelect}
            onTextCommandSelect={handlePanelCommandSelect}
            onDrawingModeChange={handleDrawingModeChange}
            activeDrawingMode={drawingMode}
            onColorChange={setDrawColor}
            onWidthChange={setDrawWidth}
            onClearDrawing={handleClearDrawing}
            onShapeTypeChange={setCurrentShapeType}
            currentColor={drawColor}
            currentWidth={drawWidth}
            currentShapeType={currentShapeType}
          />
        </div>

        {isContentOutOfView && (
          <Button
            onClick={scrollBackToContent}
            className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-30 
              px-4 py-2 bg-zinc-800 text-white rounded-lg shadow-lg 
              hover:bg-zinc-700 transition-all duration-200 ease-in-out
              dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300
              flex items-center gap-2"
          >
            Scroll back to content
          </Button>
        )}

        {(selectedTextAreaIds.length > 0 ||
          selectedImageIds.length > 0 ||
          selectedVideoIds.length > 0 ||
          selectedAudioIds.length > 0 ||
          selectedFileIds.length > 0) && (
          <div
            className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-30
                bg-white dark:bg-zinc-800 rounded-lg shadow-lg px-4 py-2
                text-sm flex items-center gap-4"
          >
            <span>
              {(() => {
                const totalSelected =
                  selectedTextAreaIds.length +
                  selectedImageIds.length +
                  selectedVideoIds.length +
                  selectedAudioIds.length +
                  selectedFileIds.length
                return `${totalSelected} item${totalSelected !== 1 ? 's' : ''} selected`
              })()}
            </span>
            <div className="flex items-center gap-3">
              <button
                className="text-gray-700 dark:text-gray-300 hover:text-yellow-600 dark:hover:text-yellow-400"
                onClick={() => {
                  // Delete selected items (text areas, images, videos, audios, and files)
                  setTextAreas((prev) =>
                    prev.filter((item) => !selectedTextAreaIds.includes(item.id))
                  )
                  setImages((prev) => prev.filter((item) => !selectedImageIds.includes(item.id)))
                  selectedVideoIds.forEach((id) => videoRefs.current.delete(id))
                  setVideos((prev) => prev.filter((item) => !selectedVideoIds.includes(item.id)))
                  // Clean up audio URLs and refs
                  selectedAudioIds.forEach((id) => {
                    const audio = audios.find((item) => item.id === id)
                    if (audio) {
                      URL.revokeObjectURL(audio.src)
                    }
                    audioRefs.current.delete(id)
                  })
                  setAudios((prev) => prev.filter((item) => !selectedAudioIds.includes(item.id)))
                  // Clean up file URLs
                  selectedFileIds.forEach((id) => {
                    const file = files.find((item) => item.id === id)
                    if (file && file.pdfUrl) {
                      URL.revokeObjectURL(file.pdfUrl)
                    }
                  })
                  setFiles((prev) => prev.filter((item) => !selectedFileIds.includes(item.id)))
                  setSelectedTextAreaIds([])
                  setSelectedImageIds([])
                  setSelectedVideoIds([])
                  setSelectedAudioIds([])
                  setSelectedFileIds([])
                }}
              >
                Delete
              </button>
              <button
                className="text-gray-700 dark:text-gray-300 hover:text-yellow-600 dark:hover:text-yellow-400"
                onClick={() => {
                  // Copy selected text areas to clipboard (images, videos, audios, and files can't be copied easily)
                  const selectedItems = textAreas.filter((item) =>
                    selectedTextAreaIds.includes(item.id)
                  )
                  setClipboardContent(selectedItems)
                }}
              >
                Copy
              </button>
              {clipboardContent.length > 0 && (
                <button
                  className="text-gray-700 dark:text-gray-300 hover:text-yellow-600 dark:hover:text-yellow-400"
                  onClick={() => {
                    // Trigger paste operation
                    const e = new KeyboardEvent('keydown', {
                      key: 'v',
                      ctrlKey: true,
                      bubbles: true
                    })
                    window.dispatchEvent(e)
                  }}
                >
                  Paste
                </button>
              )}
            </div>
          </div>
        )}

        {/* Display placement mode info */}
        {placementMode !== 'inactive' && (
          <div
            className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-30 
                      bg-white dark:bg-zinc-800 rounded-lg shadow-lg px-4 py-2
                      text-sm flex items-center gap-2"
          >
            <span className="font-semibold">Click anywhere to place</span>
            <span className="capitalize">{placementMode}</span>
            <button
              className="ml-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              onClick={() => {
                setPlacementMode('inactive')
                document.body.style.cursor = 'default'
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Render the selection rectangle */}
        {selectionRect && activeTool === 'cursor' && (
          <div
            className="absolute border-2 border-yellow-500/70 bg-yellow-500/10 pointer-events-none"
            style={{
              left: `${selectionRect.startX}px`,
              top: `${selectionRect.startY}px`,
              width: `${selectionRect.width}px`,
              height: `${selectionRect.height}px`
            }}
          />
        )}

        <Minimap
          textAreas={textAreas}
          images={images}
          videos={videos}
          audios={audios}
          files={files}
          drawPaths={drawPaths}
          canvasOffset={canvasOffset}
          viewportWidth={viewportDimensions.width}
          viewportHeight={viewportDimensions.height}
          onNavigate={handleMinimapNavigate}
          isVisible={minimapVisible}
          onToggleVisibility={() => setMinimapVisible(!minimapVisible)}
          isSidebarHovering={isSidebarHovering}
        />
      </div>
      <input
        ref={universalFileInputRef}
        type="file"
        style={{ display: 'none' }}
        accept="*"
        onChange={handleUniversalFileSelect}
      />
    </div>
  )
}

export default Editor
