"use client"

import { useActionState, useTransition } from 'react';
import Image from 'next/image';
import { searchFoodLionAction, saveGrocery, updateItemQuantity } from '@/app/actions';
import { Search, MapPin, Plus, Store, Minus, ShoppingBag } from 'lucide-react';

const initialState = { success: false, error: null as string | null, data: [] as any[] };

export default function FoodLionClient({ savedItems }: { savedItems: any[] }) {
    const [state, formAction, isPending] = useActionState<any, FormData>(searchFoodLionAction, initialState);
    const [isSaving, startSaving] = useTransition();

    const handleSave = async (item: any) => {
        startSaving(async () => {
            try {
                await saveGrocery(item);
            } catch (e: any) {
                alert("Failed to save: " + e.message);
            }
        });
    };

    const handleQuantityChange = async (productId: string, amount: number) => {
        startSaving(async () => {
            await updateItemQuantity(productId, amount);
        });
    };

    return (
        <div className="w-full" suppressHydrationWarning>
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl shadow-2xl" suppressHydrationWarning>
                {state.error && <div className="text-red-500 mb-4 font-bold">{state.error}</div>}
                <form action={formAction} className="space-y-6" suppressHydrationWarning>
                    <div className="relative">
                        <Search className="absolute left-4 top-4 h-6 w-6 text-neutral-500" />
                        <input 
                            name="query"
                            type="text"
                            required
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-4 pl-14 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition text-white text-lg font-medium shadow-inner"
                            placeholder="Search Food Lion for Milk, Eggs, Bread..."
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={isPending || isSaving}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl transition duration-300 disabled:opacity-50 text-lg shadow-lg flex items-center justify-center gap-2"
                    >
                        <ShoppingBag className="h-5 w-5" />
                        {isPending ? "Scraping Prices..." : "Compare Food Lion"}
                    </button>
                </form>
            </div>

            {/* Search Results */}
            {state.data && state.data.length > 0 && (
                <div className="grid grid-cols-1 gap-4 mt-12" suppressHydrationWarning>
                    {state.data.map((item: any, i: number) => {
                        const dbItem = savedItems.find(s => s.product_id === item.productId);
                        const isSavedLocally = !!dbItem;
                        const qty = dbItem ? dbItem.quantity : 0;

                        return (
                            <div key={i} className="flex flex-col md:flex-row justify-between items-center bg-neutral-900 border border-blue-900/40 p-5 rounded-2xl hover:border-blue-700/50 transition gap-4" suppressHydrationWarning>
                                {item.imageUrl && (
                                    <div className="flex-shrink-0 bg-white p-2 text-center rounded-xl overflow-hidden shadow-inner flex items-center justify-center w-20 h-20">
                                        <Image src={item.imageUrl} alt={item.name} width={80} height={80} className="object-contain" unoptimized />
                                    </div>
                                )}
                                <div className="flex-1 space-y-1 text-center md:text-left mb-4 md:mb-0">
                                    <h3 className="text-xl font-bold text-white">{item.name}</h3>
                                    <p className="text-neutral-400">{item.unit}</p>
                                    <p className="text-sm text-neutral-500 flex items-center justify-center md:justify-start gap-1 mt-2">
                                        <Store className="h-4 w-4" />
                                        {item.storeAddress}
                                    </p>
                                </div>
                                <div className="flex items-center gap-6 mt-2 md:mt-0">
                                    <span className="text-3xl font-extrabold text-blue-400">${item.price}</span>
                                    
                                    {isSavedLocally ? (
                                        <div className="flex items-center bg-neutral-800 rounded-xl overflow-hidden shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                                            <button 
                                                onClick={() => handleQuantityChange(item.productId, -1)}
                                                disabled={isSaving}
                                                className="px-4 py-2.5 text-white hover:bg-neutral-700 transition font-bold disabled:opacity-50"
                                            >
                                                <Minus className="h-4 w-4" />
                                            </button>
                                            <span className="px-2 font-extrabold text-emerald-400 min-w-[2ch] text-center">
                                                {qty}
                                            </span>
                                            <button 
                                                onClick={() => handleQuantityChange(item.productId, 1)}
                                                disabled={isSaving}
                                                className="px-4 py-2.5 text-white hover:bg-neutral-700 transition font-bold disabled:opacity-50"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleSave(item)}
                                            disabled={isSaving}
                                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_15px_rgba(255,255,255,0.1)] disabled:opacity-50"
                                        >
                                            <Plus className="h-4 w-4" /> Add
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
