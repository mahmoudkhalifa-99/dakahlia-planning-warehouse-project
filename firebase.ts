
import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, setDoc, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import firebaseConfig from './firebase-applet-config.json';
import { MasterData, TransportRecord, Release, FactoryBalance } from './types';
import { handleFirestoreError, OperationType } from './src/utils/firestoreError';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize App Check with Debug Token support for this environment
/*
if (typeof window !== 'undefined') {
  // @ts-ignore
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true; 
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6Lc7eI0qAAAAAFX_YqJ-X-tX-XXXXXXXXX'), // Placeholder, using Debug Token instead
    isTokenAutoRefreshEnabled: true
  });
}
*/

// Force local persistence to ensure session is saved correctly in iframes
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.error("Auth Persistence Error:", err);
});

// Use initializeFirestore to enable long polling which helps in restrictive proxy environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId || "(default)");

async function testConnection() {
  try {
    // Attempt a silent background check as required by Firebase setup instructions
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase Connection Successful");
  } catch (error: any) {
    if (error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or internet connection.");
    } else if (error.code !== 'permission-denied') {
      console.error("Firebase Connection Error:", error.message);
    }
  }
}
testConnection();

const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxRewj4W7S8gEM2XN5tNfZZZsVHxvcEAgtrTQr6h3nqENzw__J4UBKRta7qQ7IH0jRrqw/exec";

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 30000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms`);
    }
    throw error;
  }
}

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, backoff = 2000): Promise<Response> {
  try {
    return await fetchWithTimeout(url, options);
  } catch (error: any) {
    if (retries > 0) {
      console.warn(`Retrying fetch for ${url}. ${retries} attempts left. Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
}

export const transportService = {
  async getAllData(): Promise<{ transports: TransportRecord[], releases: Release[], factoryBalances: FactoryBalance[], masterData: MasterData }> {
    try {
      // Fetch everything in one request to avoid rate limits and sequential overhead
      const response = await fetchWithRetry(`${GOOGLE_SHEETS_URL}?action=getAllData`, { 
        method: 'GET', 
        cache: 'no-store' 
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} returned from server`);
      }

      const text = await response.text();
      
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        throw new Error("Received HTML instead of JSON (likely Apps Script error or login page)");
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error("Invalid JSON response from server");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const masterDataRaw = data.masterData || {};
      const masterData: MasterData = {
        drivers: masterDataRaw.drivers || [],
        cars: masterDataRaw.cars || [],
        loadingSites: masterDataRaw.loadingSites || [],
        unloadingSites: masterDataRaw.unloadingSites || [],
        goodsTypes: masterDataRaw.goodsTypes || [],
        orderNumbers: masterDataRaw.orderNumbers || [],
        contractors: masterDataRaw.contractors || [],
        users: masterDataRaw.users || [],
        items: masterDataRaw.items || []
      };

      const safeStore = (key: string, value: any) => {
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
          console.warn(`Cache quota exceeded for ${key}`);
        }
      };

      safeStore('records_cache', data.transports || []);
      safeStore('releases_cache', data.releases || []);
      safeStore('factoryBalances_cache', data.factoryBalances || []);
      safeStore('masterData_cache', masterData);

      return {
        transports: data.transports || [],
        releases: data.releases || [],
        factoryBalances: data.factoryBalances || [],
        masterData
      };
    } catch (error: any) {
      // Improved error logging for debugging
      const isOffline = error.message.includes('Failed to fetch') || error.message.includes('NetworkError');
      console.warn(isOffline ? "App is currently offline, using cached data." : "Sync Error, using cache:", error.message);
      
      const cachedRecords = localStorage.getItem('records_cache');
      const cachedReleases = localStorage.getItem('releases_cache');
      const cachedFactory = localStorage.getItem('factoryBalances_cache');
      const cachedMaster = localStorage.getItem('masterData_cache');
      
      return {
        transports: cachedRecords ? JSON.parse(cachedRecords) : [],
        releases: cachedReleases ? JSON.parse(cachedReleases) : [],
        factoryBalances: cachedFactory ? JSON.parse(cachedFactory) : [],
        masterData: cachedMaster ? JSON.parse(cachedMaster) : { 
          drivers: [], cars: [], loadingSites: [], unloadingSites: [], 
          goodsTypes: [], orderNumbers: [], contractors: [], users: [], items: [] 
        }
      };
    }
  },

  async addRecord(record: TransportRecord, skipSheets = false): Promise<void> {
    // Sync to Firestore
    const path = `transports/${record.autoId}`;
    try {
      const docRef = doc(db, 'transports', record.autoId);
      const cleanData = JSON.parse(JSON.stringify(record));
      await setDoc(docRef, cleanData);
    } catch (fsError) {
      handleFirestoreError(fsError, OperationType.WRITE, path);
    }

    if (skipSheets) return;

    await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'addRecord', record })
    });
  },

  async updateRecord(record: TransportRecord, skipSheets = false): Promise<void> {
    // Sync to Firestore
    const path = `transports/${record.autoId}`;
    try {
      const docRef = doc(db, 'transports', record.autoId);
      const cleanData = JSON.parse(JSON.stringify(record));
      await setDoc(docRef, cleanData);
    } catch (fsError) {
      handleFirestoreError(fsError, OperationType.WRITE, path);
    }

    if (skipSheets) return;

    await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'updateRecord', record })
    });
  },

  async deleteRecord(autoId: string, goodsType: string, skipSheets = false): Promise<void> {
    // Delete from Firestore
    const path = `transports/${autoId}`;
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'transports', autoId));
    } catch (fsError) {
      handleFirestoreError(fsError, OperationType.DELETE, path);
    }

    if (skipSheets) return;

    await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'deleteRecord', autoId, goodsType })
    });
  },

  async saveMasterData(data: MasterData): Promise<void> {
    await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'saveMasterData', data })
    });
  },

  async addReleasesBulk(header: any, distributions: any[]): Promise<void> {
    await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'addReleasesBulk', header, distributions })
    });
  },

  async updateRelease(release: any): Promise<void> {
    await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'updateRelease', release })
    });
  },

  async deleteRelease(id: string, goodsType: string): Promise<void> {
    await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'deleteRelease', id, goodsType })
    });
  },

  async updateFactoryBalance(balance: FactoryBalance): Promise<void> {
    // 1. Update Firestore for real-time app sync
    const path = `factoryBalances/${balance.id}`;
    try {
      const docRef = doc(db, 'factoryBalances', balance.id);
      const cleanData = JSON.parse(JSON.stringify(balance)); // Remove any undefined fields
      await setDoc(docRef, cleanData);
    } catch (fsError) {
      handleFirestoreError(fsError, OperationType.WRITE, path);
    }

    // 2. Update Google Sheet
    await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'updateFactoryBalance', balance })
    });
  }
};
