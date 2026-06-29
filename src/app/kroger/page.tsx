import { Suspense } from 'react';
import { getSavedItems } from '@/app/actions';
import ShoppingTripClient from '@/components/ShoppingTripClient';
import { CartSidebar } from '@/components/CartSidebar';

export default async function Page() {
    // Top-level server-side data extraction before rendering the boundary
    const { data: savedItems } = await getSavedItems();
    
    return (
        <Suspense fallback={<div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">Loading comparison tool...</div>}>
           <ShoppingTripClient totalSavedItems={savedItems?.length || 0} savedItems={savedItems || []} />
           <CartSidebar savedItems={savedItems || []} />
        </Suspense>
    );
}
