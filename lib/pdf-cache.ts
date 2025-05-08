/**
 * Simple cache implementation for CV PDF to reduce server load
 * Stores the last generated PDF and its associated timestamp
 */

interface PDFCache {
  buffer: Buffer | null;
  timestamp: string | null;
  lastModified: string | null;
}

// In-memory cache object
const pdfCache: PDFCache = {
  buffer: null,
  timestamp: null,
  lastModified: null,
};

/**
 * Get cached PDF if available and still valid
 * @param lastModified The current last modified timestamp of the CV
 * @returns The cached PDF buffer if valid, null otherwise
 */
export function getCachedPDF(lastModified: string): Buffer | null {
  // If no cache exists or timestamps don't match, return null
  if (!pdfCache.buffer || !pdfCache.lastModified || pdfCache.lastModified !== lastModified) {
    return null;
  }
  
  return pdfCache.buffer;
}

/**
 * Save a newly generated PDF to the cache
 * @param buffer The PDF buffer to cache
 * @param lastModified The last modified timestamp of the CV
 */
export function cachePDF(buffer: Buffer, lastModified: string): void {
  pdfCache.buffer = buffer;
  pdfCache.timestamp = new Date().toISOString();
  pdfCache.lastModified = lastModified;
}

/**
 * Get the current cache status information
 * @returns Information about the current cache state
 */
export function getCacheInfo(): Omit<PDFCache, 'buffer'> & { hasCache: boolean } {
  return {
    timestamp: pdfCache.timestamp,
    lastModified: pdfCache.lastModified,
    hasCache: pdfCache.buffer !== null,
  };
}
