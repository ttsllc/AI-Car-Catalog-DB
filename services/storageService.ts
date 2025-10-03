import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Uploads an array of base64 images to Firebase Storage
 * @param images Array of base64 encoded images
 * @param catalogId Unique identifier for this catalog
 * @returns Array of download URLs
 */
export async function uploadImagesToStorage(
  images: string[],
  catalogId: string
): Promise<string[]> {
  const uploadPromises = images.map(async (base64Image, index) => {
    const imagePath = `catalogs/${catalogId}/page-${index + 1}.jpg`;
    const imageRef = ref(storage, imagePath);

    // Upload the base64 image
    await uploadString(imageRef, base64Image, 'data_url');

    // Get the download URL
    const downloadURL = await getDownloadURL(imageRef);
    return downloadURL;
  });

  return Promise.all(uploadPromises);
}

/**
 * Uploads a single base64 image to Firebase Storage
 * @param base64Image Base64 encoded image
 * @param path Storage path for the image
 * @returns Download URL
 */
export async function uploadImageToStorage(
  base64Image: string,
  path: string
): Promise<string> {
  const imageRef = ref(storage, path);
  await uploadString(imageRef, base64Image, 'data_url');
  return getDownloadURL(imageRef);
}
