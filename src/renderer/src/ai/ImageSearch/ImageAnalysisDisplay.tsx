import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Separator } from '../../ui/separator';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../ui/collapsible';
import { ImageSquare, MagnifyingGlass } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import ImageGallery from '../Gallery/ImageGallery';
import { ImageAnalysisResult } from './ImageAnalyzer';
import { cn } from '../../lib/utils';
import { MessageFormatter } from '../Containers/MessageFormat';
import ReverseImageGallery from './ReverseImageGallery';

interface ImageAnalysisDisplayProps {
  displayType: 'image-analysis';
  searchQuery: string;
  analysis: ImageAnalysisResult;
  imageResults?: any[];
  imageData: string;
  imageName: string;
}

const ImageAnalysisDisplay: React.FC<ImageAnalysisDisplayProps> = ({
  analysis,
  imageResults,
  imageData,
  searchQuery,
  imageName
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [showSimilarImages, setShowSimilarImages] = useState(false);

  return (
    <div className="w-full p-3 max-w-[545px]">
      <div className={"w-full overflow-hidden bg-transparent shadow-none border-none outline-none "}>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <MessageFormatter message={{ content: analysis.userAnalysis, role: 'assistant' }} />
              </div>
            </div>
          </div>

        <div className="flex flex-col pb-2">
        {imageResults && imageResults.length > 0 && (
            <ReverseImageGallery images={imageResults} />
        )}
        </div>
      </div>
    </div>
  );
};

export default ImageAnalysisDisplay;