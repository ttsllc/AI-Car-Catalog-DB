import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { CatalogRecord } from './types';
import { uploadImagesToStorage } from './services/storageService';

const COLLECTION_NAME = 'catalogs';

export const initDB = (): Promise<boolean> => {
  // Firestore doesn't require explicit initialization
  // Just return true to maintain compatibility with existing code
  return Promise.resolve(true);
};

export const saveCatalog = async (catalog: Omit<CatalogRecord, 'id'>): Promise<CatalogRecord> => {
  try {
    const catalogsRef = collection(db, COLLECTION_NAME);

    // Generate a unique catalog ID
    const catalogId = `catalog-${Date.now()}`;

    // Upload images to Firebase Storage if they exist
    let imageUrls: string[] = [];
    if (catalog.images && catalog.images.length > 0) {
      imageUrls = await uploadImagesToStorage(catalog.images, catalogId);
    }

    // Convert Date to Firestore Timestamp and replace base64 images with URLs
    const catalogData = {
      ...catalog,
      images: imageUrls, // Replace base64 images with Storage URLs
      createdAt: Timestamp.fromDate(catalog.createdAt),
    };

    const docRef = await addDoc(catalogsRef, catalogData);

    return {
      ...catalog,
      images: imageUrls,
      id: docRef.id as any, // Firestore uses string IDs, but we'll keep the type compatible
    };
  } catch (error) {
    console.error('Error saving catalog to Firestore:', error);
    throw error;
  }
};

export const getAllCatalogs = async (): Promise<CatalogRecord[]> => {
  try {
    const catalogsRef = collection(db, COLLECTION_NAME);
    const q = query(catalogsRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    const catalogs: CatalogRecord[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      catalogs.push({
        ...data,
        id: doc.id as any, // Use Firestore document ID
        createdAt: data.createdAt.toDate(), // Convert Timestamp back to Date
      } as CatalogRecord);
    });

    return catalogs;
  } catch (error) {
    console.error('Error getting catalogs from Firestore:', error);
    throw error;
  }
};

export const deleteCatalog = async (id: number | string): Promise<void> => {
  try {
    const catalogRef = doc(db, COLLECTION_NAME, String(id));
    await deleteDoc(catalogRef);
  } catch (error) {
    console.error('Error deleting catalog from Firestore:', error);
    throw error;
  }
};

export const updateCatalog = async (catalog: CatalogRecord): Promise<CatalogRecord> => {
  try {
    const catalogRef = doc(db, COLLECTION_NAME, String(catalog.id));

    // Convert Date to Firestore Timestamp
    const catalogData = {
      ...catalog,
      createdAt: Timestamp.fromDate(catalog.createdAt),
    };

    // Remove the id field before updating (Firestore doesn't store the document ID in the document)
    const { id, ...dataToUpdate } = catalogData;

    await updateDoc(catalogRef, dataToUpdate);

    return catalog;
  } catch (error) {
    console.error('Error updating catalog in Firestore:', error);
    throw error;
  }
};
