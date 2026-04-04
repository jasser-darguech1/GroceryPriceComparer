"use client"

import { useState, useActionState } from 'react';
import Image from 'next/image';
import { searchGroceriesAction, saveGrocery } from './actions';
import { Search, MapPin, Plus, Save } from 'lucide-react';

const initialState = { success: false, error: null as string | null, data: [] as any[] };

export default function ShoppingTrip() {
    const [state, formAction, isPending] = useActionState<any, FormData>(searchGroceriesAction, initialState);
    
    const [radius, setRadius] = useState(10);
    const [saved, setSaved] = useState<Record<number, boolean>>({});

    const handleSave = async (item: any, index: number) => {
        try {
            await saveGrocery(item);
            setSaved(prev => ({ ...prev, [index]: true }));
        } catch (e: any) {
            alert("Failed to save: " + e.message);
        }
    }

    return (
        <main className="min-h-screen bg-neutral-950 text-white p-8 font-sans" suppressHydrationWarning>
            <div className="max-w-4xl mx-auto space-y-8" suppressHydrationWarning>
                <header className="text-center space-y-4" suppressHydrationWarning>
                    <h1 className="text-5xl font-extrabold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                        Shopping Trip
                    </h1>
                    <p className="text-neutral-400 text-lg">
                        Find the best prices at Kroger within your radius.
                    </p>
                </header>

                <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl shadow-2xl" suppressHydrationWarning>
                    {state.error && <div className="text-red-500 mb-4">{state.error}</div>}
                    <form action={formAction} className="space-y-6" suppressHydrationWarning>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-400">Search Item</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 h-5 w-5 text-neutral-500" />
                                    <input 
                                        name="query"
                                        type="text"
                                        required
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-2 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition text-white"
                                        placeholder="e.g. Milk, Eggs..."
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-400">Zip Code</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-neutral-500" />
                                    <input 
                                        name="zip"
                                        type="text"
                                        required
                                        defaultValue="10001"
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-2 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition text-white"
                                        placeholder="10001"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm font-medium text-neutral-400">
                                <label>Search Radius</label>
                                <span>{radius} miles</span>
                            </div>
                            <input 
                                name="radius"
                                type="range" 
                                min="1" 
                                max="50" 
                                value={radius}
                                onChange={e => setRadius(Number(e.target.value))}
                                className="w-full accent-blue-500"
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={isPending}
                            className="w-full bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold py-3 rounded-xl transition duration-300 disabled:opacity-50"
                        >
                            {isPending ? "Searching..." : "Find Best Prices"}
                        </button>
                    </form>
                </div>

                {state.data && state.data.length > 0 && (
                    <div className="grid grid-cols-1 gap-4" suppressHydrationWarning>
                        {state.data.map((item: any, i: number) => (
                            <div key={i} className="flex flex-col md:flex-row justify-between items-center bg-neutral-900 border border-neutral-800 p-5 rounded-2xl hover:border-neutral-700 transition gap-4" suppressHydrationWarning>
                                {item.imageUrl && (
                                    <div className="flex-shrink-0 bg-white p-2 text-center rounded-xl overflow-hidden shadow-inner flex items-center justify-center w-20 h-20">
                                        <Image src={item.imageUrl} alt={item.name} width={80} height={80} className="object-contain" unoptimized />
                                    </div>
                                )}
                                <div className="flex-1 space-y-1 text-center md:text-left mb-4 md:mb-0">
                                    <h3 className="text-xl font-bold text-white">{item.name}</h3>
                                    <p className="text-neutral-400">{item.unit}</p>
                                    <p className="text-sm text-neutral-500 flex items-center justify-center md:justify-start gap-1 mt-2">
                                        <MapPin className="h-4 w-4" />
                                        {item.storeAddress}
                                    </p>
                                </div>
                                <div className="flex items-center gap-6 mt-2 md:mt-0">
                                    <span className="text-3xl font-extrabold text-emerald-400">${item.price}</span>
                                    <button
                                        onClick={() => handleSave(item, i)}
                                        disabled={saved[i]}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition ${saved[i] ? 'bg-neutral-800 text-emerald-500 cursor-not-allowed' : 'bg-white text-black hover:bg-neutral-200 shadow-[0_0_15px_rgba(255,255,255,0.1)]'}`}
                                    >
                                        {saved[i] ? <><Save className="h-4 w-4" /> Saved</> : <><Plus className="h-4 w-4" /> Add</>}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
