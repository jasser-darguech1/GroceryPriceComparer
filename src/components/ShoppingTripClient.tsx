"use client"

import { useState, useActionState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { searchGroceriesAction, saveGrocery, updateItemQuantity, clearAllItems, getStoresAction } from '@/app/actions';
import { Search, MapPin, Plus, Store, Minus, AlertTriangle } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from '@/components/ui/button';

const initialState = { success: false, error: null as string | null, data: [] as any[] };

export default function ShoppingTripClient({ totalSavedItems, savedItems }: { totalSavedItems: number, savedItems: any[] }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    
    // URL Persistence States
    const urlLocationId = searchParams.get('locationId');
    const urlStoreName = searchParams.get('storeName');
    const urlZip = searchParams.get('zip') || '10001';

    const [state, formAction, isPending] = useActionState<any, FormData>(searchGroceriesAction, initialState);
    
    const [isSaving, startSaving] = useTransition();
    const [isFetchingStores, startFetchingStores] = useTransition();

    // Store Selection States
    const [headerZipInput, setHeaderZipInput] = useState(urlZip);
    const [fetchedStores, setFetchedStores] = useState<any[]>([]);
    const [storeModalOpen, setStoreModalOpen] = useState(false);
    
    // Warning States
    const [showWarning, setShowWarning] = useState(false);
    const [pendingStoreSelect, setPendingStoreSelect] = useState<any>(null);

    const handleSearchStores = async (e: React.FormEvent) => {
        e.preventDefault();
        startFetchingStores(async () => {
            const res = await getStoresAction(headerZipInput, 15);
            if (res.success) {
                setFetchedStores(res.data);
                setStoreModalOpen(true);
            }
        });
    };

    const handleStoreSelectAttempt = (store: any) => {
        if (totalSavedItems > 0 && store.locationId !== urlLocationId) {
            setPendingStoreSelect(store);
            setShowWarning(true);
        } else {
            commitStoreSelection(store);
        }
    };

    const commitStoreSelection = async (store: any) => {
        if (totalSavedItems > 0 && store.locationId !== urlLocationId) {
            await clearAllItems();
        }
        
        const params = new URLSearchParams(searchParams.toString());
        params.set('locationId', store.locationId);
        params.set('storeName', store.name);
        params.set('zip', headerZipInput);
        
        router.push(pathname + '?' + params.toString(), { scroll: false });
        
        setShowWarning(false);
        setStoreModalOpen(false);
        setPendingStoreSelect(null);
    };

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
        <main className="min-h-screen bg-neutral-950 text-white p-8 font-sans" suppressHydrationWarning>
            {/* Warning Dialog */}
            <Dialog open={showWarning} onOpenChange={setShowWarning}>
                <DialogContent className="sm:max-w-md bg-neutral-900 border-neutral-800 text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-500">
                            <AlertTriangle className="h-5 w-5" />
                            Warning: Change Location
                        </DialogTitle>
                        <DialogDescription className="text-neutral-400">
                            You are changing your active store. Prices vary by location, so your current Grocery List will be permanently cleared. Are you sure you want to proceed?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="sm:justify-end gap-2 mt-4">
                        <Button type="button" variant="outline" className="text-black bg-white hover:bg-neutral-200" onClick={() => setShowWarning(false)}>
                            Cancel
                        </Button>
                        <Button type="button" variant="destructive" onClick={() => commitStoreSelection(pendingStoreSelect)}>
                            Clear List & Change Store
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Store Selection Dialog */}
            <Dialog open={storeModalOpen} onOpenChange={setStoreModalOpen}>
                <DialogContent className="sm:max-w-2xl bg-neutral-900 border-neutral-800 text-white max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">Select a Store</DialogTitle>
                        <DialogDescription className="text-neutral-400">
                            Found {fetchedStores.length} locations near {headerZipInput}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 mt-4">
                        {fetchedStores.map((store: any) => (
                            <button 
                                key={store.locationId}
                                onClick={() => handleStoreSelectAttempt(store)}
                                className="flex flex-col text-left p-4 rounded-xl border border-neutral-700 bg-neutral-800 hover:border-emerald-500 hover:bg-neutral-800 transition"
                            >
                                <span className="font-bold text-lg text-emerald-400">{store.name}</span>
                                <span className="text-neutral-300">{store.address}</span>
                                <span className="text-neutral-500 text-sm mt-1">{store.phone}</span>
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            <div className="max-w-5xl mx-auto space-y-12" suppressHydrationWarning>
                
                {/* Header Section */}
                <header className="flex flex-col md:flex-row justify-between items-center bg-neutral-900 border border-neutral-800 p-6 rounded-2xl shadow-xl gap-6" suppressHydrationWarning>
                    <div className="flex-1">
                        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mb-2">
                            Shopping Trip
                        </h1>
                        <div className="flex items-center gap-2 text-neutral-400">
                            <Store className="h-5 w-5 text-emerald-500" />
                            <span className="font-medium text-lg">
                                {urlLocationId ? urlStoreName : "No Store Selected"}
                            </span>
                        </div>
                    </div>
                    
                    <form onSubmit={handleSearchStores} className="flex w-full md:w-auto items-center gap-3 bg-neutral-950 p-2 rounded-xl border border-neutral-800">
                        <MapPin className="h-5 w-5 text-neutral-500 ml-2" />
                        <input 
                            type="text"
                            required
                            value={headerZipInput}
                            onChange={(e) => setHeaderZipInput(e.target.value)}
                            className="bg-transparent border-none outline-none text-white w-32 focus:ring-0"
                            placeholder="Zip Code"
                        />
                        <button 
                            type="submit" 
                            disabled={isFetchingStores}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-6 rounded-lg transition disabled:opacity-50"
                        >
                            {isFetchingStores ? "Locating..." : "Find Stores"}
                        </button>
                    </form>
                </header>

                {/* Main Search Section */}
                <div className={`transition duration-500 ${!urlLocationId ? "opacity-50 pointer-events-none" : ""}`}>
                    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl shadow-2xl" suppressHydrationWarning>
                        {state.error && <div className="text-red-500 mb-4">{state.error}</div>}
                        {!urlLocationId && <div className="text-amber-500 mb-4 font-semibold text-center">Please select a store from the header above to begin searching.</div>}
                        
                        <form action={formAction} className="space-y-6" suppressHydrationWarning>
                            <input type="hidden" name="locationId" value={urlLocationId || ''} />
                            <input type="hidden" name="storeAddress" value={urlStoreName || ''} />
                            <input type="hidden" name="zip" value={urlZip || ''} />
                            
                            <div className="relative">
                                <Search className="absolute left-4 top-4 h-6 w-6 text-neutral-500" />
                                <input 
                                    name="query"
                                    type="text"
                                    required
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-4 pl-14 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition text-white text-lg font-medium shadow-inner"
                                    placeholder="Search for Milk, Eggs, Bread..."
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={isPending || isSaving || !urlLocationId}
                                className="w-full bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold py-4 rounded-xl transition duration-300 disabled:opacity-50 text-lg shadow-lg"
                            >
                                {isPending ? "Searching Prices..." : "Compare Selected Store"}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Search Results */}
                {state.data && state.data.length > 0 && (
                    <div className="grid grid-cols-1 gap-4" suppressHydrationWarning>
                        {state.data.map((item: any, i: number) => {
                            const dbItem = savedItems.find(s => s.product_id === item.productId);
                            const isSavedLocally = !!dbItem;
                            const qty = dbItem ? dbItem.quantity : 0;

                            return (
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
                                            <Store className="h-4 w-4" />
                                            {item.storeAddress}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-6 mt-2 md:mt-0">
                                        <span className="text-3xl font-extrabold text-emerald-400">${item.price}</span>
                                        
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
                                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition bg-white text-black hover:bg-neutral-200 shadow-[0_0_15px_rgba(255,255,255,0.1)] disabled:opacity-50"
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
        </main>
    );
}
