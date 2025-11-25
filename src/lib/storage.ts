/**
 * HeySalad QC - R2 Storage Integration
 * 
 * Handles PDF file storage in Cloudflare R2.
 * Requirements: 7.4
 */

/**
 * Uploads a PDF file to R2 storage and returns the download URL.
 * 
 * @param bucket - The R2 bucket instance
 * @param filename - The filename to store the PDF as
 * @param pdfData - The PDF data as ArrayBuffer
 * @param publicUrl - The public URL base for the R2 bucket
 * @returns Promise resolving to the download URL
 */
export async function uploadPDFToR2(
  bucket: R2Bucket,
  filename: string,
  pdfData: ArrayBuffer,
  publicUrl?: string
): Promise<string> {
  // Generate a unique key with timestamp to avoid collisions
  const timestamp = Date.now();
  const key = `mats/${timestamp}-${filename}`;
  
  // Upload to R2 with appropriate content type
  await bucket.put(key, pdfData, {
    httpMetadata: {
      contentType: 'application/pdf',
      contentDisposition: `attachment; filename="${filename}"`,
    },
    customMetadata: {
      uploadedAt: new Date().toISOString(),
    },
  });
  
  // Return the download URL
  // If a public URL is configured, use it; otherwise return the key for signed URL generation
  if (publicUrl) {
    return `${publicUrl}/${key}`;
  }
  
  // Return the key - caller can generate a signed URL if needed
  return key;
}

/**
 * Generates a signed URL for downloading a PDF from R2.
 * Note: This requires the R2 bucket to have public access or signed URL support.
 * 
 * @param bucket - The R2 bucket instance
 * @param key - The object key in R2
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Promise resolving to the signed URL or null if object doesn't exist
 */
export async function getSignedDownloadUrl(
  bucket: R2Bucket,
  key: string,
  _expiresIn: number = 3600
): Promise<string | null> {
  // Check if object exists
  const object = await bucket.head(key);
  if (!object) {
    return null;
  }
  
  // For now, return a direct URL pattern
  // In production, you'd use R2's signed URL feature or a public bucket with _expiresIn
  // This is a placeholder that works with public R2 buckets
  return key;
}

/**
 * Deletes a PDF from R2 storage.
 * 
 * @param bucket - The R2 bucket instance
 * @param key - The object key to delete
 * @returns Promise resolving to true if deleted, false if not found
 */
export async function deletePDFFromR2(
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
 * Lists all mat PDFs in R2 storage.
 * 
 * @param bucket - The R2 bucket instance
 * @param limit - Maximum number of results (default: 100)
 * @returns Promise resolving to array of object keys
 */
export async function listMatPDFs(
  bucket: R2Bucket,
  limit: number = 100
): Promise<string[]> {
  const listed = await bucket.list({
    prefix: 'mats/',
    limit,
  });
  
  return listed.objects.map(obj => obj.key);
}

/**
 * Gets metadata for a stored PDF.
 * 
 * @param bucket - The R2 bucket instance
 * @param key - The object key
 * @returns Promise resolving to metadata or null if not found
 */
export async function getPDFMetadata(
  bucket: R2Bucket,
  key: string
): Promise<{
  size: number;
  uploaded: Date;
  etag: string;
  contentType: string | undefined;
} | null> {
  const object = await bucket.head(key);
  if (!object) {
    return null;
  }
  
  return {
    size: object.size,
    uploaded: object.uploaded,
    etag: object.etag,
    contentType: object.httpMetadata?.contentType,
  };
}
