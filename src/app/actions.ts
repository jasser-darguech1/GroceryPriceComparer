"use server"

import { searchKroger, getKrogerStores } from '@/lib/kroger';
import { readDb, writeDb, SavedGrocery } from '@/lib/localDb';
import { revalidatePath } from 'next/cache';
import { exec } from 'child_process';
import util from 'util';
import crypto from 'crypto';

const execPromise = util.promisify(exec);

export async function searchFoodLionAction(prevState: any, formData: FormData) {
    const query = formData.get('query') as string;
    const cookiesJson = formData.get('cookiesJson') as string;
    
    if (!query) {
         return { success: false, error: "Missing search query", data: [] };
    }
    
    try {
        const { stdout, stderr } = await execPromise(`python FoodLionScraper/foodLionScr.py`, {
            env: { ...process.env, SEARCH: query, FOOD_LION_COOKIES: cookiesJson }
        });
        
        const results = JSON.parse(stdout);
        
        // Match local DB state exactly like we did for Kroger
        const savedDb = await readDb();
        const savedMap = new Map();
        if (savedDb) {
            savedDb.forEach(s => savedMap.set(s.product_id, s.quantity));
        }

        const mappedResults = results.map((item: any) => ({
            ...item,
            isSaved: savedMap.has(item.productId),
            savedQuantity: savedMap.get(item.productId) || 0
        }));

        return { success: true, data: mappedResults, error: null };
        
    } catch (e: any) {
        console.error("Scraper exec error:", e);
        return { success: false, error: "Scraping failed: " + e.message, data: [] };
    }
}

export async function getStoresAction(zip: string, radius: number) {
    if (!zip) return { success: false, data: [] };
    const stores = await getKrogerStores(zip, radius);
    return { success: true, data: stores };
}

export async function searchGroceriesAction(prevState: any, formData: FormData) {
    const query = formData.get('query') as string;
    const locationId = formData.get('locationId') as string;
    const storeAddress = formData.get('storeAddress') as string;
    const zip = formData.get('zip') as string;

    if (!query || !locationId) {
         return { success: false, error: "Missing query or selected store", data: [] };
    }
    try {
        const results = await searchKroger(locationId, storeAddress, zip, query);
        
        // Grab currently saved logic to assign properties
        const savedDb = await readDb();
        const savedMap = new Map();
        if (savedDb) {
            savedDb.forEach(s => savedMap.set(s.product_id, s.quantity));
        }

        const mappedResults = results.map((item: any) => ({
            ...item,
            isSaved: savedMap.has(item.productId),
            savedQuantity: savedMap.get(item.productId) || 0
        }));

        return { success: true, data: mappedResults, error: null };
    } catch (e: any) {
        return { success: false, error: e.message, data: [] };
    }
}

export async function bulkKrogerCompareAction(searchPayloads: {query: string, targetBrand: string}[], locationId: string) {
    if (!searchPayloads.length || !locationId) {
        return { success: false, data: [] };
    }

    try {
        const comparisons = await Promise.allSettled(
            searchPayloads.map(async (payload) => {
                const results = await searchKroger(locationId, "Comparison Map", "Auto", payload.query, payload.targetBrand);
                // Return only the top match if it exists
                return results && results.length > 0 ? results[0] : null;
            })
        );

        // Map outcomes into a single unified array structure
        const data = comparisons.map((res: any, i) => {
            if (res.status === 'fulfilled' && res.value) {
                return { ...res.value, originalQuery: searchPayloads[i].query };
            }
            return { error: 'Not found', originalQuery: searchPayloads[i].query };
        });

        return { success: true, data };
    } catch (e: any) {
        console.error("Comparison execution error:", e);
        return { success: false, error: e.message, data: [] };
    }
}

export async function saveGrocery(item: any) {
    const { productId, name, price, locationId, zip, imageUrl, unit, brand } = item;
    
    try {
        const items = await readDb();
        const existing = items.find(i => i.product_id === productId);
        
        if (existing) {
            existing.quantity += 1;
        } else {
            const newItem: SavedGrocery = {
                id: crypto.randomUUID(),
                product_id: productId,
                name,
                price: Number(price),
                location_id: locationId,
                zip,
                image_url: imageUrl || null,
                quantity: 1,
                unit: unit || null,
                brand: brand || null,
                created_at: new Date().toISOString()
            };
            items.push(newItem);
        }
        
        await writeDb(items);
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error("Local storage save error:", error);
        throw new Error(error.message || "Failed to save item");
    }
}

export async function updateItemQuantity(productId: string, incrementBy: number) {
    try {
        const items = await readDb();
        const existingIndex = items.findIndex(i => i.product_id === productId);
        
        if (existingIndex !== -1) {
            const newQuantity = items[existingIndex].quantity + incrementBy;
            if (newQuantity <= 0) {
                items.splice(existingIndex, 1);
            } else {
                items[existingIndex].quantity = newQuantity;
            }
            await writeDb(items);
        }
        
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error("Local storage update quantity error:", error);
        return { success: false, error: error.message };
    }
}

export async function getSavedItems() {
    try {
        const items = await readDb();
        const sorted = [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return { success: true, data: sorted };
    } catch (error: any) {
        console.error("Local storage fetch error:", error);
        return { success: false, data: [] };
    }
}

export async function deleteItem(id: string) {
    try {
        let items = await readDb();
        items = items.filter(i => i.id !== id);
        await writeDb(items);
        
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error("Local storage delete error:", error);
        return { success: false, error: error.message };
    }
}

export async function clearAllItems() {
    try {
        await writeDb([]);
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error("Local storage clear error:", error);
        return { success: false, error: error.message };
    }
}

export async function fetchManualKrogerResultsAction(query: string, locationId: string) {
    if (!query || !locationId) {
        return { success: false, data: [] };
    }

    try {
        // Execute Kroger search bypassing strict tracking filters!
        const results = await searchKroger(locationId, "Comparison Map", "Auto", query, undefined, true);
        return { success: true, data: results || [] };
    } catch (e: any) {
        console.error("Manual comparison search error:", e);
        return { success: false, error: e.message, data: [] };
    }
}
