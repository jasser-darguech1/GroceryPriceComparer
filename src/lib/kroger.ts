import axios from 'axios';

let cachedToken: string | null = null;
let tokenExpiresAt: number | null = null;

export async function getAccessToken() {
    if (cachedToken && tokenExpiresAt && tokenExpiresAt > Date.now() + 60000) {
        return cachedToken;
    }

    const clientId = process.env.KROGER_CLIENT_ID;
    const clientSecret = process.env.KROGER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("Missing Kroger API credentials.");
    }

    const base64Auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const data = new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'product.compact'
    });

    const response = await axios.post('https://api.kroger.com/v1/connect/oauth2/token', data, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${base64Auth}` // Standard OAuth basic auth 
        }
    });

    cachedToken = response.data.access_token;
    tokenExpiresAt = Date.now() + (response.data.expires_in * 1000);
    return cachedToken;
}

export async function getKrogerStores(zip: string, radius: number) {
    const token = await getAccessToken();
    const BASE_URL = 'https://api.kroger.com/v1';

    try {
        const locRes = await axios.get(`${BASE_URL}/locations`, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: {
                'filter.zipCode.near': zip,
                'filter.radiusInMiles': radius,
                'filter.limit': 10
            }
        });

        const locations = locRes.data.data;
        if (!locations || locations.length === 0) return [];
        
        return locations.map((loc: any) => ({
            locationId: loc.locationId,
            name: loc.name,
            address: `${loc.address.addressLine1}, ${loc.address.city}, ${loc.address.state} ${loc.address.zipCode}`,
            phone: loc.phone
        }));
    } catch (e) {
        console.error("Store Fetch error");
        return [];
    }
}

export async function searchKroger(locationId: string, locationAddress: string, zip: string, query: string) {
    const token = await getAccessToken();
    const BASE_URL = 'https://api.kroger.com/v1';

    const results = [];
    
    try {
        const prodRes = await axios.get(`${BASE_URL}/products`, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: {
                'filter.term': query,
                'filter.locationId': locationId,
                'filter.limit': 15
            }
        });

        const products = prodRes.data.data || [];
        for (const product of products) {
            const items = product.items || [];
            if (items.length > 0) {
                const item = items[0];
                const price = item.price?.regular || item.price?.promo || null;
                
                let imageUrl = null;
                if (product.images && product.images.length > 0) {
                    const frontImage = product.images.find((img: any) => img.perspective === 'front') || product.images[0];
                    const largeSize = frontImage.sizes?.find((s: any) => s.size === 'large' || s.size === 'medium');
                    imageUrl = largeSize ? largeSize.url : null;
                }

                if (price) {
                    results.push({
                        productId: product.productId,
                        name: product.description,
                        price,
                        unit: item.size || 'unknown',
                        locationId: locationId,
                        storeAddress: locationAddress,
                        zip: zip,
                        imageUrl
                    });
                }
            }
        }
    } catch (e) {
        console.error("Store search skipped");
    }

    return results;
}
