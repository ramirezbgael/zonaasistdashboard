/**
 * Photo Upload Service
 * Handles uploading equipment photos to Supabase Storage
 */

import { supabase } from '../supabase.js';

/**
 * Converts a base64 data URL to a Blob
 * @param {string} dataURL - Base64 data URL (e.g., "data:image/jpeg;base64,...")
 * @returns {Promise<Blob>} - Blob object
 */
export function dataURLtoBlob(dataURL) {
  return new Promise((resolve, reject) => {
    try {
      const arr = dataURL.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      
      resolve(new Blob([u8arr], { type: mime }));
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Uploads an equipment photo to Supabase Storage
 * @param {number} equipoId - ID of the equipment
 * @param {string} imageDataURL - Base64 data URL of the image
 * @param {string} userId - ID of the user uploading (optional)
 * @returns {Promise<{url: string, path: string}>} - Public URL and storage path
 */
export async function uploadEquipoPhoto(equipoId, imageDataURL, userId = null) {
  try {
    // Convert data URL to Blob
    const blob = await dataURLtoBlob(imageDataURL);
    
    // Generate filename with timestamp
    const timestamp = Date.now();
    const filename = `${timestamp}.jpg`;
    const path = `equipos/${equipoId}/${filename}`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('equipos')
      .upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: false // Don't overwrite existing files
      });
    
    if (uploadError) {
      throw new Error(`Error uploading photo: ${uploadError.message}`);
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('equipos')
      .getPublicUrl(path);
    
    // Save photo reference in database
    const { data: fotoData, error: dbError } = await supabase
      .from('equipo_fotos')
      .insert({
        equipo_id: equipoId,
        url: publicUrl,
        uploaded_by: userId || null
      })
      .select()
      .single();
    
    if (dbError) {
      // If database insert fails, try to delete the uploaded file
      await supabase.storage
        .from('equipos')
        .remove([path]);
      
      throw new Error(`Error saving photo reference: ${dbError.message}`);
    }
    
    return {
      url: publicUrl,
      path: path,
      id: fotoData.id
    };
  } catch (error) {
    console.error('Error in uploadEquipoPhoto:', error);
    throw error;
  }
}

/**
 * Fetches all photos for an equipment
 * @param {number} equipoId - ID of the equipment
 * @returns {Promise<Array>} - Array of photo objects
 */
export async function getEquipoPhotos(equipoId) {
  try {
    const { data, error } = await supabase
      .from('equipo_fotos')
      .select('*')
      .eq('equipo_id', equipoId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Error fetching photos: ${error.message}`);
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getEquipoPhotos:', error);
    throw error;
  }
}

/**
 * Deletes an equipment photo
 * @param {number} fotoId - ID of the photo record
 * @param {string} storagePath - Path in storage (optional, will be extracted from URL if not provided)
 * @returns {Promise<void>}
 */
export async function deleteEquipoPhoto(fotoId, storagePath = null) {
  try {
    // Get photo record to get the URL
    const { data: fotoData, error: fetchError } = await supabase
      .from('equipo_fotos')
      .select('url')
      .eq('id', fotoId)
      .single();
    
    if (fetchError) {
      throw new Error(`Error fetching photo: ${fetchError.message}`);
    }
    
    // Extract path from URL if not provided
    let path = storagePath;
    if (!path && fotoData.url) {
      // Extract path from public URL
      // URL format: https://[project].supabase.co/storage/v1/object/public/equipos/[path]
      const urlParts = fotoData.url.split('/equipos/');
      if (urlParts.length > 1) {
        path = `equipos/${urlParts[1]}`;
      }
    }
    
    // Delete from storage if path is available
    if (path) {
      const { error: storageError } = await supabase.storage
        .from('equipos')
        .remove([path]);
      
      if (storageError) {
        console.warn('Error deleting from storage (non-critical):', storageError);
      }
    }
    
    // Delete database record
    const { error: dbError } = await supabase
      .from('equipo_fotos')
      .delete()
      .eq('id', fotoId);
    
    if (dbError) {
      throw new Error(`Error deleting photo record: ${dbError.message}`);
    }
  } catch (error) {
    console.error('Error in deleteEquipoPhoto:', error);
    throw error;
  }
}
