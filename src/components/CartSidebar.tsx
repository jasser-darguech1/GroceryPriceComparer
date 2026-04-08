"use client"

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSearchParams } from 'next/navigation';
import { Trash2, ShoppingCart, Repeat, Store, MapPin } from "lucide-react";
import { deleteItem, clearAllItems, getStoresAction, bulkKrogerCompareAction } from '@/app/actions';

import { updateItemQuantity } from '@/app/actions';

export function CartSidebar({ savedItems }: { savedItems: any[] }) {
    const searchParams = useSearchParams();
    const urlLocationId = searchParams.get('locationId');

    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [isComparing, startComparison] = useTransition();

    // Comparison Logic State
    const [comparisonResults, setComparisonResults] = useState<any[]>([]);
    
    // Store Dialog State
    const [storeModalOpen, setStoreModalOpen] = useState(false);
    const [fetchedStores, setFetchedStores] = useState<any[]>([]);
    const [zipInput, setZipInput] = useState("10001");
    const [isFetchingStores, startFetchingStores] = useTransition();

    const getNormalizedSize = (sizeStr: string): { value: number | null, unit: string | null } => {
        if (!sizeStr) return { value: null, unit: null };
        let str = sizeStr.toLowerCase().trim();
        
        // Fraction Parser
        str = str.replace(/(\d+)\/(\d+)/g, (match, p1, p2) => {
            return (parseFloat(p1) / parseFloat(p2)).toString();
        });

        let targetStr = str;
        const segments = str.match(/[\d.]+\s*[a-z]+/g);
        if (segments && segments.length > 1) {
            for (const seg of segments) {
                if (/oz|lb|gal|qt|gallon|pound|quart|fo|fl/.test(seg)) {
                    targetStr = seg;
                    break;
                }
            }
        }
        
        const valMatch = targetStr.match(/[\d.]+/);
        let value = valMatch ? parseFloat(valMatch[0]) : null;
        
        let unitRaw = targetStr.replace(/[\d.]+/g, '').replace(/[^a-z#]/g, '').trim();

        if (value !== null && unitRaw === '') {
            unitRaw = 'lb';
        }

        let baseUnit: string | null = null;
        if (/gallon|gal|gl/.test(unitRaw)) {
             baseUnit = 'oz';
             value = value ? value * 128 : null;
        } else if (/ounce|oz|floz|fl|fo/.test(unitRaw)) {
             baseUnit = 'oz';
        } else if (/pound|lb|#/.test(unitRaw)) {
             baseUnit = 'oz';
             value = value ? value * 16 : null;
        } else if (/quart|qt/.test(unitRaw)) {
             baseUnit = 'oz';
             value = value ? value * 32 : null;
        } else if (/count|ct/.test(unitRaw)) {
             baseUnit = 'ct';
        } else if (/doz/.test(unitRaw)) {
             baseUnit = 'ct';
             value = value ? value * 12 : 12;
        } else if (/liter|l/.test(unitRaw)) {
             baseUnit = 'l';
        } else {
             baseUnit = unitRaw || null;
        }
        
        return { value, unit: baseUnit };
    };

    const prepareKrogerSearchTerm = (itemName: string, itemSize: string, itemBrand?: string) => {
        const inputName = itemName;
        let adjustedBrand = (itemBrand || '').trim();
        
        const flBrands = ['food lion', 'foodlion', 'home 360', 'taste of inspirations', "nature's promise"];
        if (flBrands.includes(adjustedBrand.toLowerCase())) {
            adjustedBrand = 'Kroger';
        }

        let nameBase = itemName.replace(/Food Lion|Home 360|Taste of Inspirations|Nature's Promise/gi, '');
        if (adjustedBrand && adjustedBrand !== 'Kroger') {
            const bRegex = new RegExp(adjustedBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            nameBase = nameBase.replace(bRegex, '');
        }

        nameBase = (adjustedBrand ? `${adjustedBrand} ` : '') + nameBase.trim();

        const normSize = getNormalizedSize(itemSize);
        let size = '';
        if (normSize.value !== null && normSize.unit) {
             size = `${normSize.value} ${normSize.unit}`;
        }

        let words = nameBase.split(/\s+/).filter(Boolean);
        const sizeWords = size.split(/\s+/).filter(Boolean);
        const targetBrandWord = adjustedBrand ? adjustedBrand.split(/\s+/)[0].toLowerCase() : '';

        while (words.length + sizeWords.length > 8) {
            let removed = false;
            for (let i = words.length - 1; i >= 0; i--) {
                const w = words[i].toLowerCase();
                
                if (targetBrandWord && w === targetBrandWord) {
                    if (i + 2 < words.length) {
                        words.splice(i + 1, 1);
                        removed = true;
                    }
                    break;
                }
                
                words.splice(i, 1);
                removed = true;
                break;
            }
            if (!removed) {
                words.pop();
            }
        }
        
        const finalQuery = `${words.join(' ')} ${sizeWords.join(' ')}`.trim();
        console.log(`[Search Optimizer] Input: "${inputName} | ${itemSize}" [Brand: ${itemBrand}] -> Normalized Size: ${size} | Optimized: "${finalQuery}"`);
        
        return { query: finalQuery, targetBrand: adjustedBrand };
    };

    const handleCompareClick = () => {
        if (!urlLocationId) {
            setStoreModalOpen(true);
            return;
        }
        executeComparison(urlLocationId);
    };

    const executeComparison = (locationId: string) => {
        setComparisonResults([]); // Flush legacy array visually immediately
        startComparison(async () => {
             const searchPayloads = savedItems.map(s => prepareKrogerSearchTerm(s.name, s.unit || s.size || "1 ct", s.brand));
             const res = await bulkKrogerCompareAction(searchPayloads, locationId);
             if (res.success) {
                 setComparisonResults(res.data);
             }
        });
    };

    const handleSearchStores = async (e: React.FormEvent) => {
        e.preventDefault();
        startFetchingStores(async () => {
            const res = await getStoresAction(zipInput, 15);
            if (res.success) {
                setFetchedStores(res.data);
            }
        });
    };

    const handleQuantity = (productId: string, amount: number) => {
        startTransition(async () => {
            await updateItemQuantity(productId, amount);
        });
    };

    const handleClearAll = () => {
        startTransition(async () => {
            await clearAllItems();
            setIsOpen(false);
        });
    };

    return (
        <>
            <Button 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-8 right-8 h-16 rounded-full px-6 shadow-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-3 z-50"
            >
                <ShoppingCart className="h-6 w-6" />
                <span className="text-lg">Grocery List</span>
                {savedItems.length > 0 && (
                    <Badge variant="secondary" className="bg-white text-emerald-700 font-extrabold text-sm ml-2">
                        {savedItems.length}
                    </Badge>
                )}
            </Button>

            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetContent className="w-full sm:max-w-md bg-neutral-950 border-l-neutral-800 text-white overflow-y-auto">
                <SheetHeader className="mb-6 space-y-2">
                    <SheetTitle className="text-2xl font-bold text-white">Your Grocery List</SheetTitle>
                    <SheetDescription className="text-neutral-400">
                        Total items: {savedItems.length}
                    </SheetDescription>
                </SheetHeader>

                {savedItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-neutral-500 space-y-4">
                        <ShoppingCart className="h-12 w-12 opacity-50" />
                        <p>Your list is empty. Go find some deals!</p>
                        <Button variant="outline" className="mt-4 text-black bg-white hover:bg-neutral-200" onClick={() => setIsOpen(false)}>
                            Back to Search
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-emerald-400 font-bold text-lg">
                                Total: ${savedItems.reduce((acc, item) => acc + ((Number(item.price) || 0) * item.quantity), 0).toFixed(2)}
                            </span>
                            <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={handleClearAll}
                                disabled={isPending}
                            >
                                Clear All
                            </Button>
                        </div>
                        
                        <div className="space-y-4">
                            {savedItems.map((item) => (
                                <div key={item.id} className="flex items-center gap-4 bg-neutral-900 border border-neutral-800 p-4 rounded-xl">
                                    {item.image_url ? (
                                        <div className="flex-shrink-0 bg-white p-1 rounded-md overflow-hidden text-center flex items-center justify-center h-12 w-12">
                                            <Image src={item.image_url} alt={item.name} width={48} height={48} className="object-contain" unoptimized />
                                        </div>
                                    ) : (
                                        <div className="h-12 w-12 flex-shrink-0 bg-neutral-800 rounded-md flex items-center justify-center">
                                            <ShoppingCart className="h-6 w-6 text-neutral-600" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{item.name}</p>
                                        <p className="text-xs text-neutral-400 capitalize">{item.unit || item.size || "1 ct"}</p>
                                        <p className="text-emerald-400 font-semibold mt-0.5">${item.price}</p>
                                    </div>
                                    <div className="flex items-center bg-neutral-950 rounded-lg border border-neutral-800 overflow-hidden shrink-0">
                                            <button 
                                                onClick={() => handleQuantity(item.product_id, -1)}
                                                disabled={isPending}
                                                className="px-2.5 py-1 text-white hover:bg-neutral-800 transition disabled:opacity-50"
                                            >
                                                -
                                            </button>
                                            <span className="px-1 text-sm font-extrabold text-emerald-400 text-center min-w-[2ch]">
                                                {item.quantity}
                                            </span>
                                            <button 
                                                onClick={() => handleQuantity(item.product_id, 1)}
                                                disabled={isPending}
                                                className="px-2.5 py-1 text-white hover:bg-neutral-800 transition disabled:opacity-50"
                                            >
                                                +
                                            </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {savedItems.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-neutral-800">
                        <Button 
                            onClick={handleCompareClick}
                            disabled={isComparing}
                            className={`w-full font-bold py-6 rounded-xl flex items-center justify-center gap-2 text-lg shadow-lg disabled:opacity-50 transition duration-300 ${comparisonResults.length > 0 ? "bg-neutral-800 hover:bg-neutral-700 text-indigo-400 border border-indigo-900" : "bg-indigo-600 hover:bg-indigo-500 text-white"}`}
                        >
                            <Repeat className={`h-5 w-5 ${isComparing ? 'animate-spin text-white' : ''}`} /> 
                            {isComparing ? "Analyzing Pricing Engines..." : comparisonResults.length > 0 ? "Refresh Comparison" : "Compare Prices with Kroger"}
                        </Button>
                    </div>
                )}

                {comparisonResults.length > 0 && (
                    <div className="mt-10 pt-6 border-t border-neutral-800">
                        <div className="flex justify-between items-end mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Store className="h-6 w-6 text-indigo-400" />
                                Kroger Matches
                            </h3>
                            <span className="text-indigo-400 font-extrabold text-xl">
                                ${comparisonResults.reduce((acc, item, i) => {
                                    if (item.error) return acc;
                                    return acc + (Number(item.price) * (savedItems[i]?.quantity || 1));
                                }, 0).toFixed(2)}
                            </span>
                        </div>

                        <div className="space-y-6">
                            {savedItems.map((foodLionItem, i) => {
                                const krog = comparisonResults[i];
                                const hasMatch = !!krog && !krog.error && krog.price !== undefined;
                                
                                // Basic cheap detection with defensive checks
                                const flPrice = foodLionItem?.price !== undefined ? Number(foodLionItem.price) : Infinity;
                                const krPrice = hasMatch ? Number(krog.price) : Infinity;
                                const isKrogerCheaper = hasMatch && (krPrice < flPrice);
                                const isFlCheaper = hasMatch && (flPrice < krPrice);

                                return (
                                    <div key={`comp-${foodLionItem.id}`} className="bg-neutral-900 border border-indigo-900/30 rounded-xl overflow-hidden grid grid-cols-2 divide-x divide-neutral-800">
                                        
                                        {/* Food Lion Side */}
                                        <div className={`p-4 flex flex-col justify-between ${isFlCheaper ? "bg-emerald-950/20" : ""}`}>
                                            <div className="space-y-1 mb-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Food Lion</span>
                                                    {foodLionItem.brand && <span className="text-[10px] bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded truncate">{foodLionItem.brand}</span>}
                                                </div>
                                                <p className="text-sm font-semibold text-neutral-300 line-clamp-2">{foodLionItem.name}</p>
                                            </div>
                                            <div className="flex justify-between items-end mt-auto">
                                                <span className="text-xs text-neutral-500 capitalize">{foodLionItem.unit || foodLionItem.size || "1 ct"} <span className="opacity-60">(x{foodLionItem.quantity})</span></span>
                                                <span className={`text-lg tracking-tight ${isFlCheaper ? "text-emerald-400 font-bold" : "text-neutral-400 font-semibold"}`}>
                                                    ${(flPrice * foodLionItem.quantity).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Kroger Side */}
                                        {!hasMatch ? (
                                            <div className="p-4 flex flex-col justify-center items-center bg-neutral-950/50 text-center">
                                                <span className="text-sm text-red-500 font-medium mb-1">Not Found</span>
                                                <span className="text-[10px] text-neutral-600 truncate max-w-full italic px-2">~ {krog?.originalQuery}</span>
                                            </div>
                                        ) : (
                                            <div className={`p-4 flex flex-col justify-between ${isKrogerCheaper ? "bg-emerald-950/30" : ""}`}>
                                                <div className="space-y-1 mb-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Kroger</span>
                                                        {krog.brand && <span className="text-[10px] bg-indigo-950/50 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-900/30 truncate">{krog.brand}</span>}
                                                    </div>
                                                    <p className={`text-sm font-bold line-clamp-2 ${isKrogerCheaper ? "text-white" : "text-indigo-200"}`}>
                                                        {krog.name}
                                                    </p>
                                                </div>
                                                <div className="flex justify-between items-end mt-auto">
                                                    <span className="text-xs text-indigo-900/70">{krog.unit || ""}</span>
                                                    <span className={`text-lg tracking-tight ${isKrogerCheaper ? "text-emerald-400 font-bold" : "text-indigo-400 font-semibold"}`}>
                                                        ${(krPrice * foodLionItem.quantity).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-8 flex justify-between gap-4">
                            <div className="flex-1 text-center bg-neutral-900 border border-neutral-800 p-4 rounded-xl">
                                <p className="text-neutral-400 text-sm mb-1">Food Lion</p>
                                <p className="text-2xl font-bold text-white">
                                    ${savedItems.reduce((acc, item) => acc + ((Number(item.price) || 0) * item.quantity), 0).toFixed(2)}
                                </p>
                            </div>
                            <div className="flex-1 text-center bg-indigo-950/30 border border-indigo-900/50 p-4 rounded-xl">
                                <p className="text-indigo-300 text-sm mb-1">Kroger</p>
                                <p className="text-2xl font-bold text-indigo-400">
                                    ${comparisonResults.reduce((acc, item, i) => {
                                        if (item.error) return acc + ((Number(savedItems[i].price) || 0) * savedItems[i].quantity); // fallback to original price if missing
                                        return acc + (Number(item.price) * (savedItems[i]?.quantity || 1));
                                    }, 0).toFixed(2)}
                                </p>
                            </div>
                        </div>
                        <p className="text-xs text-center text-neutral-500 mt-4 italic">
                            * Missing Kroger items default to original cart price in totals
                        </p>
                    </div>
                )}
            </SheetContent>
            </Sheet>

            {/* Kroger Store Selection Dialog */}
            <Dialog open={storeModalOpen} onOpenChange={setStoreModalOpen}>
                <DialogContent className="sm:max-w-md bg-neutral-900 border-neutral-800 text-white shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            <Store className="h-6 w-6 text-indigo-400" /> Ensure Kroger Store
                        </DialogTitle>
                        <DialogDescription className="text-neutral-400">
                            You must select a Kroger location to map comparisons against.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <form onSubmit={handleSearchStores} className="flex items-center gap-3 bg-neutral-950 p-2 rounded-xl border border-neutral-800 mt-4">
                        <MapPin className="h-5 w-5 text-neutral-500 ml-2" />
                        <input 
                            type="text"
                            required
                            value={zipInput}
                            onChange={(e) => setZipInput(e.target.value)}
                            className="bg-transparent border-none outline-none text-white flex-1 focus:ring-0"
                            placeholder="Zip Code"
                        />
                        <button 
                            type="submit" 
                            disabled={isFetchingStores}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-6 rounded-lg transition disabled:opacity-50"
                        >
                            {isFetchingStores ? "Searching..." : "Find Stores"}
                        </button>
                    </form>

                    {fetchedStores.length > 0 && (
                        <div className="grid gap-3 mt-4 max-h-64 overflow-y-auto pr-2">
                            {fetchedStores.map((store: any) => (
                                <button 
                                    key={store.locationId}
                                    onClick={() => {
                                        setStoreModalOpen(false);
                                        executeComparison(store.locationId);
                                    }}
                                    className="flex flex-col text-left p-3 rounded-xl border border-neutral-700 bg-neutral-800 hover:border-indigo-500 transition"
                                >
                                    <span className="font-bold text-indigo-400">{store.name}</span>
                                    <span className="text-neutral-300 text-sm">{store.address}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
