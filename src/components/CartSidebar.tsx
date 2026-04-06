"use client"

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, ShoppingCart } from "lucide-react";
import { deleteItem, clearAllItems } from '@/app/actions';

import { updateItemQuantity } from '@/app/actions';

export function CartSidebar({ savedItems }: { savedItems: any[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

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
                                        <p className="text-emerald-400 font-semibold">${item.price}</p>
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
            </SheetContent>
            </Sheet>
        </>
    );
}
