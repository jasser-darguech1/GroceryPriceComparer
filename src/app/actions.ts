"use server"

import { searchKroger } from '@/lib/kroger';
import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function searchGroceriesAction(prevState: any, formData: FormData) {
    const query = formData.get('query') as string;
    const zip = formData.get('zip') as string;
    const radiusStr = formData.get('radius') as string;
    const radius = Number(radiusStr);

    if (!query || !zip) {
         return { success: false, error: "Missing query or zip", data: [] };
    }
    try {
        const results = await searchKroger(zip, radius > 0 ? radius : 10, query);
        return { success: true, data: results, error: null };
    } catch (e: any) {
        return { success: false, error: e.message, data: [] };
    }
}

export async function saveGrocery(item: any) {
    const { name, price, locationId, zip, imageUrl } = item;
    const { data, error } = await supabase
        .from('saved_groceries')
        .insert([{ name, price, location_id: locationId, zip, image_url: imageUrl }]);

    if (error) {
        console.error("Supabase insert error:", error);
        throw new Error(error.message);
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
