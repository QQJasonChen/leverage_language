/**
 * Time utilities for YouGlish Extension
 * Centralizes all time/timestamp formatting logic
 */

export interface VideoTimestamp {
  seconds: number | null;
  formatted: string;
  url?: string;
}

export interface SavedReport {
  id: string;
  searchText: string;
  language: string;
  timestamp: number;
  videoSource?: {
    url?: string;
    title?: string;
    channel?: string;
    videoTimestamp?: number;
    timestamp?: number;
    learnedAt?: string;
  };
  analysisData?: any;
}

/**
 * Format seconds to MM:SS or H:MM:SS format
 */
export function formatVideoTimestamp(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds)) {
    return '';
  }
  
  const totalSecs = Math.floor(seconds);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

/**
 * Format a JavaScript timestamp to readable date
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Format a JavaScript timestamp to readable date and time
 */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Get button text based on video timestamp availability
 */
export function getVideoButtonText(videoTimestamp: number | null | undefined): string {
  const hasTimestamp = videoTimestamp !== null && videoTimestamp !== undefined && !isNaN(videoTimestamp);
  return hasTimestamp ? '⏰ 返回片段' : '📹 返回影片';
}

/**
 * Debug function to print timestamp information with detailed analysis
 */
export function debugTimestamp(params: any, result?: any): void {
  console.log('🔍 Timestamp Debug - Params:', params);
  
  // Debug timestamp extraction from params
  if (params) {
    const timestamp = params.timestamp || params.videoTimestamp;
    const videoSource = params.videoSource;
    
    console.log('🔍 Timestamp Debug - Analysis:', {
      hasTimestamp: timestamp !== null && timestamp !== undefined && !isNaN(timestamp),
      timestampValue: timestamp,
      timestampType: typeof timestamp,
      hasVideoSource: !!videoSource,
      videoSourceTimestamp: videoSource?.videoTimestamp,
      videoSourceTimestampType: typeof videoSource?.videoTimestamp
    });
  }
  
  if (result) {
    console.log('🔍 Timestamp Debug - Result:', result);
    
    if (result.videoSource) {
      console.log('🔍 Timestamp Debug - Result VideoSource:', {
        hasVideoTimestamp: result.videoSource.videoTimestamp !== null && 
                          result.videoSource.videoTimestamp !== undefined,
        videoTimestampValue: result.videoSource.videoTimestamp,
        formatted: formatVideoTimestamp(result.videoSource.videoTimestamp),
        buttonText: getVideoButtonText(result.videoSource.videoTimestamp)
      });
    }
  }
}

/**
 * Validate and ensure video source has proper timestamp structure
 */
export function validateVideoSource(videoSource: any): boolean {
  if (!videoSource) return false;
  
  const hasValidTimestamp = videoSource.videoTimestamp !== null && 
                           videoSource.videoTimestamp !== undefined && 
                           !isNaN(videoSource.videoTimestamp);
  
  if (!hasValidTimestamp) {
    console.warn('⚠️ Video source missing valid videoTimestamp:', videoSource);
    return false;
  }
  
  return true;
}

/**
 * Extract video timestamp from URL (e.g., youtube.com/watch?v=abc&t=123s)
 */
export function extractTimestampFromUrl(url: string): number | null {
  if (!url) return null;
  
  // Match YouTube timestamp patterns
  const patterns = [
    /[?&]t=(\d+)s?/,          // ?t=123s or ?t=123
    /#t=(\d+)s?/,             // #t=123s or #t=123
    /[?&]start=(\d+)/,        // ?start=123
    /youtu\.be\/[^?]+\?t=(\d+)/ // youtu.be/abc?t=123
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const timestamp = parseInt(match[1], 10);
      return isNaN(timestamp) ? null : timestamp;
    }
  }
  
  return null;
}

/**
 * Create YouTube URL with timestamp
 */
export function createTimestampedUrl(baseUrl: string, seconds: number): string {
  if (!baseUrl || isNaN(seconds) || seconds < 0) {
    return baseUrl;
  }
  
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}t=${Math.floor(seconds)}s`;
}