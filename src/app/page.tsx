import Link from 'next/link';
import { Store, ShoppingBag } from 'lucide-react';
import FoodLionClient from '@/components/FoodLionClient';
import { getSavedItems } from '@/app/actions';
import { CartSidebar } from '@/components/CartSidebar';

export default async function Home() {
    const { data: savedItems } = await getSavedItems();
    
    return (
        <main className="min-h-screen bg-neutral-950 text-white p-8 flex flex-col items-center font-sans space-y-12">
            <header className="text-center space-y-4 w-full max-w-4xl flex items-center justify-between pb-8 border-b border-neutral-800">
                <div className="text-left">
                    <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-2">
                        Food Lion Scraper
                    </h1>
                    <p className="text-neutral-400 text-lg">
                        Direct Python engine integration.
                    </p>
                </div>
                
                <Link href="/kroger" className="group">
                    <div className="bg-neutral-900 border border-neutral-800 hover:border-emerald-500 rounded-xl px-6 py-3 flex items-center gap-3 transition">
                        <Store className="h-5 w-5 text-emerald-400" />
                        <span className="font-bold text-white group-hover:text-emerald-400 transition">Switch to Kroger</span>
                    </div>
                </Link>
            </header>

            <div className="w-full max-w-4xl">
                 <FoodLionClient savedItems={savedItems || []} />
                 <CartSidebar savedItems={savedItems || []} />
            </div>
        </main>
    );
}
