"use client"

import type React from "react"
import { useState, useRef } from "react"
import { StarIcon, ExternalLink, Sparkle, ChevronLeft, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader } from "../../ui/card"
import { Button } from "../../ui/button"
import { useView } from "../../components/parts/ViewContext"
import { motion } from "framer-motion"
import { Separator } from "../../ui/separator"
import { ShoppingCartSimple, Star } from "@phosphor-icons/react"

interface ProductPrice {
  raw: string
  value: number
  currency: string
}

interface ProductResult {
  title: string
  link: string
  product_link: string
  image: string
  price: ProductPrice
  rating: number | null
  reviews: number | null
  source: string
  description: string
  shipping: string
  extensions: string[]
}

interface ProductDisplayProps {
  products: ProductResult[]
  displayType: string
  analysis: {
    queryType: string
  }
}

const ProductCard = ({ product }: { product: ProductResult }) => {
  const { activeTabId, webviewRefs, updateTabState, activeTab } = useView()

  const handleProductClick = (url: string, e: React.MouseEvent) => {
    e.preventDefault()
    let processedUrl = url
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      processedUrl = `https://${url}`
    }

    const webview = webviewRefs.current.get(activeTabId)
    if (webview) {
      webview
        .loadURL(processedUrl)
        .then(() => {
          updateTabState(activeTabId, {
            url: processedUrl,
            navigationHistory: [...activeTab.navigationHistory.slice(0, activeTab.historyIndex + 1), processedUrl],
            historyIndex: activeTab.historyIndex + 1,
          })
        })
        .catch((error) => {
          console.error("Failed to load URL:", error)
        })
    }
  }

  const productUrl = product.product_link || product.link

  return (
    <Card
    className="h-full flex flex-col group cursor-pointer dark:bg-zinc-800 bg-zinc-300 transition-all shadow-none outline-none border-none"
    onClick={(e) => handleProductClick(productUrl, e)}
  >
    <CardHeader className="p-4">
      <div className="aspect-square w-full relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
        {product.image ? (
          <img
            src={product.image || "/placeholder.svg"}
            alt={product.title}
            className="object-cover w-full h-full transition-transform group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.src = "/placeholder.png"
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">No image available</div>
        )}
      </div>
    </CardHeader>
    <CardContent className="p-4 pt-0 flex-1 flex flex-col">
      <h3 className="font-semibold text-md leading-tight mb-2 line-clamp-2">{product.title}</h3>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-md font-bold">
          {product.price.raw || `$${product.price.value.toFixed(2)} ${product.price.currency}`}
        </span>
        {product.shipping && <span className="text-sm text-muted-foreground">{product.shipping}</span>}

        {product.extensions && product.extensions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.extensions.map((extension, index) => (
              <span
                key={index}
                className="text-[10px] font-medium bg-secondry/20 text-primary border border-primary/20 px-1 py-0.5 rounded-full inline-flex items-center"
              >
                {extension}
              </span>
            ))}
          </div>
        )}
      </div>

      {(product.rating || product.reviews) && (
        <div className="flex items-center gap-2 mb-2">
          {product.rating && (
            <div className="flex items-center">
              <StarIcon className="h-4 w-4 fill-amber-200 text-amber-200" />
              <span className="ml-1 text-sm">{product.rating}</span>
            </div>
          )}
          {product.reviews && (
            <span className="text-sm text-muted-foreground">({product.reviews.toLocaleString()} reviews)</span>
          )}
        </div>
      )}

{product.source && <div className="text-sm text-muted-foreground">From: {product.source}</div>}
    </CardContent>
  </Card>
  )
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
    },
  },
}

const fadeIn = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      duration: 0.5,
    },
  },
}

const ProductDisplay: React.FC<ProductDisplayProps> = ({ products, displayType, analysis }) => {
  const [currentPage, setCurrentPage] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)

  // Determine number of columns based on screen size (same as original)
  const columnsPerRow = 3 // For large screens

  // Always display single row
  const itemsPerPage = columnsPerRow

  if (!products || products.length === 0) {
    return (
      <div className="text-center p-4 border rounded-lg">
        <p className="text-muted-foreground">
          No products found for this search.
          {analysis.queryType === "specific-product" && " Try broadening your search or checking different keywords."}
        </p>
      </div>
    )
  }

  const sortedProducts =
    displayType === "product-comparison" ? [...products].sort((a, b) => a.price.value - b.price.value) : products

  // Calculate total pages
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage)

  // Get current products to display
  const startIndex = currentPage * itemsPerPage
  const displayProducts = sortedProducts.slice(startIndex, startIndex + itemsPerPage)

  const handleScrollLeft = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleScrollRight = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1)
    }
  }

  // Determine if scroll buttons should be visible
  const showLeftButton = currentPage > 0
  const showRightButton = currentPage < totalPages - 1

  return (
    <div>
      <div className="w-full overflow-hidden border-none outline-none">
        <div className="flex items-center justify-between px-6 pt-3">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="font-medium text-foreground">
                    Showing {startIndex + 1}-{Math.min(startIndex + displayProducts.length, products.length)} of{" "}
                    {products.length} products
              </span>
            </div>
          </div>
          
          {/* Scroll buttons - moved to top right */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: showLeftButton ? 1 : 0.5, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={handleScrollLeft}
                  disabled={!showLeftButton}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </motion.div>
              <span className="text-xs text-muted-foreground">
                {currentPage + 1} / {totalPages}
              </span>
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: showRightButton ? 1 : 0.5, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={handleScrollRight}
                  disabled={!showRightButton}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </motion.div>
            </div>
          )}
        </div>

        <div className="relative overflow-hidden p-4" ref={contentRef}>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="relative"
          >
            <motion.div variants={container} initial="hidden" animate="show" transition={{ staggerChildren: 0.05 }}>
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                key={`page-${currentPage}`}
                transition={{ duration: 0.4 }}
              >
                {displayProducts.map((product, index) => (
                  <motion.div
                    key={`${currentPage}-${index}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.4,
                      delay: index * 0.05,
                    }}
                  >
                    <ProductCard product={product} />
                  </motion.div>
                ))}
              </motion.div>

              {totalPages > 1 && (
                <motion.div
                  className="mt-4 text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="flex justify-center items-center gap-1 mt-2">
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i === currentPage 
                            ? "w-6 bg-primary" 
                            : "w-2 bg-primary/30 hover:bg-primary/50"
                        }`}
                        aria-label={`Go to page ${i + 1}`}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default ProductDisplay