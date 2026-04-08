"use server"

import { searchKroger, getKrogerStores } from '@/lib/kroger';
import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export async function searchFoodLionAction(prevState: any, formData: FormData) {
    const query = formData.get('query') as string;
    
    if (!query) {
         return { success: false, error: "Missing search query", data: [] };
    }
    
    try {
        const { stdout, stderr } = await execPromise(`python FoodLionScraper/foodLionScr.py`, {
            env: { ...process.env, SEARCH: query }
        });
        
        const results = JSON.parse(stdout);
        
        // Match Supabase state exactly like we did for Kroger
        const { data: savedDb } = await supabase.from('saved_groceries').select('product_id, quantity');
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
        const { data: savedDb } = await supabase.from('saved_groceries').select('product_id, quantity');
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
    
    // Check if exists for quantity incrementing vs creating new one
    const { data: existing } = await supabase.from('saved_groceries').select('id, quantity').eq('product_id', productId).single();
    
    let error;
    if (existing) {
        const { error: updateError } = await supabase.from('saved_groceries').update({ quantity: existing.quantity + 1 }).eq('id', existing.id);
        error = updateError;
    } else {
        const { error: insertError } = await supabase.from('saved_groceries').insert([{ product_id: productId, name, price, location_id: locationId, zip, image_url: imageUrl, quantity: 1, unit, brand }]);
        error = insertError;
    }

    if (error) {
        console.error("Supabase insert/update error:", error);
        throw new Error(error.message);
    }
    
    revalidatePath('/');
    return { success: true };
}

export async function updateItemQuantity(productId: string, incrementBy: number) {
    const { data: existing } = await supabase.from('saved_groceries').select('id, quantity').eq('product_id', productId).single();
    
    if (existing) {
        const newQuantity = existing.quantity + incrementBy;
        if (newQuantity <= 0) {
            await supabase.from('saved_groceries').delete().eq('id', existing.id);
        } else {
            await supabase.from('saved_groceries').update({ quantity: newQuantity }).eq('id', existing.id);
        }
    }
    
    revalidatePath('/');
    return { success: true };
}

export async function getSavedItems() {
    const { data, error } = await supabase
        .from('saved_groceries')
        .select('*')
        .order('created_at', { ascending: false });
        
    if (error) {
        console.error("Supabase fetch error:", error);
        return { success: false, data: [] };
    }
    return { success: true, data };
}

export async function deleteItem(id: string) {
    const { error } = await supabase
        .from('saved_groceries')
        .delete()
        .eq('id', id);
        
    if (error) return { success: false, error: error.message };
    
    revalidatePath('/');
    return { success: true };
}

export async function clearAllItems() {
    const { error } = await supabase
        .from('saved_groceries')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
        
    if (error) return { success: false, error: error.message };
    
    revalidatePath('/');
    return { success: true };
}
