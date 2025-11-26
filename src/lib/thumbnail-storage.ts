/**
 * HeySalad QC - Vision Thumbnail Storage
 * 
 * Handles thumbnail storage in Cloudflare R2 for vision detection results.
 * Requirements: 4.1, 4.2
 */

/**
 * Uploads a thumbnail to R2 storage.
 * 
 * @param bucket - The R2 bucket instance (VISION_THUMBNAILS)
 * @param detectionId - The detection ID to use as the key
 * @param stationId - The station ID for organizing thumbnails
 * @param thumbnailData - The thumbnail image data as ArrayBuffer or Uint8Array
 * @returns Promise resolving to the storage key
 */
export async function uploadThumbnail(
  bucket: R2Bucket,
  detectionId: string,
  stationId: string,
  thumbnailData: ArrayBuffer | Uint8Array
): Promise<string> {
  const key = `thumbnails/${stationId}/${detectionId}.jpg`;
  
  await bucket.put(key, thumbnailData, {
    httpMetadata: {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=86400', // Cache for 24 hours
    },
    customMetadata: {
      detectionId,
      stationId,
      uploadedAt: new Date().toISOString(),
    },
  });
  
  return key;
}

/**
 * Gets a URL for accessing a thumbnail.
 * For public buckets, returns a direct URL.
 * For private buckets, the caller should use this key with a signed URL generator.
 * 
 * @param bucket - The R2 bucket instance
 * @param key - The thumbnail storage key
 * @param publicBaseUrl - Optional public base URL for the bucket
 * @returns Promise resolving to the URL or null if thumbnail doesn't exist
 */
export async function getThumbnailUrl(
  bucket: R2Bucket,
  key: string,
  publicBaseUrl?: string
): Promise<string | null> {
  // Check if the thumbnail exists
  const object = await bucket.head(key);
  if (!object) {
    return null;
  }
  
  // If a public base URL is provided, construct the full URL
  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }
  
  // Return the key for use with signed URL generation or direct R2 access
  return key;
}

/**
 * Deletes a thumbnail from R2 storage.
 * 
 * @param bucket - The R2 bucket instance
 * @param key - The thumbnail storage key to delete
 * @returns Promise resolving to true if deleted, false if not found
 */
export async function deleteThumbnail(
  bucket: R2Bucket,
  key: string
): Promise<boolean> {
  const object = await bucket.head(key);
  if (!object) {
    return false;
  }
  
  await bucket.delete(key);
  return true;
}

/**
 * Gets metadata for a stored thumbnail.
 * 
 * @param bucket - The R2 bucket instance
 * @param key - The thumbnail storage key
 * @returns Promise resolving to metadata or null if not found
 */
export async function getThumbnailMetadata(
  bucket: R2Bucket,
  key: string
): Promise<{
  size: number;
  uploaded: Date;
  etag: string;
  detectionId?: string;
  stationId?: string;
} | null> {
  const object = await bucket.head(key);
  if (!object) {
    return null;
  }
  
  return {
    size: object.size,
    uploaded: object.uploaded,
    etag: object.etag,
    detectionId: object.customMetadata?.detectionId,
    stationId: object.customMetadata?.stationId,
  };
}

/**
 * Lists all thumbnails for a specific station.
 * 
 * @param bucket - The R2 bucket instance
 * @param stationId - The station ID to list thumbnails for
 * @param limit - Maximum number of results (default: 100)
 * @returns Promise resolving to array of thumbnail keys
 */
export async function listStationThumbnails(
  bucket: R2Bucket,
  stationId: string,
  limit: number = 100
): Promise<string[]> {
  const listed = await bucket.list({
    prefix: `thumbnails/${stationId}/`,
    limit,
  });
  
  return listed.objects.map(obj => obj.key);
}

/**
 * Deletes all thumbnails for a specific station.
 * Useful for cleanup when a station is deleted.
 * 
 * @param bucket - The R2 bucket instance
 * @param stationId - The station ID to delete thumbnails for
 * @returns Promise resolving to the number of thumbnails deleted
 */
export async function deleteStationThumbnails(
  bucket: R2Bucket,
  stationId: string
): Promise<number> {
  const keys = await listStationThumbnails(bucket, stationId, 1000);
  
  if (keys.length === 0) {
    return 0;
  }
  
  // R2 supports batch delete
  await bucket.delete(keys);
  
  return keys.length;
}
