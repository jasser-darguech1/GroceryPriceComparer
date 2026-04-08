import { getSavedItems } from '@/app/actions';
import ShoppingTripClient from '@/components/ShoppingTripClient';
import { CartSidebar } from '@/components/CartSidebar';

export default async function Page() {
    // Top-level server-side data extraction before rendering the boundary
    const { data: savedItems } = await getSavedItems();
    
    return (
        <>
           <ShoppingTripClient totalSavedItems={savedItems?.length || 0} savedItems={savedItems || []} />
           <CartSidebar savedItems={savedItems || []} />
        </>
    );
}
