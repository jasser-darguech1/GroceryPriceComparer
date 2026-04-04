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

export async function searchKroger(zip: string, radius: number, query: string) {
    const token = await getAccessToken();
    const BASE_URL = 'https://api.kroger.com/v1';

    // Get locations by radius based on exa research
    const locRes = await axios.get(`${BASE_URL}/locations`, {
        headers: { 'Authorization': `Bearer ${token}` },
        params: {
            'filter.zipCode.near': zip,
            'filter.radiusInMiles': radius,
            'filter.limit': 5
        }
    });

    const locations = locRes.data.data;
    if (!locations || locations.length === 0) return [];

    const results = [];
    
    // Check top matching stores
    for (let i = 0; i < Math.min(locations.length, 3); i++) {
        const location = locations[i];
        const address = `${location.address.addressLine1}, ${location.address.city}, ${location.address.state} ${location.address.zipCode}`;

        try {
            const prodRes = await axios.get(`${BASE_URL}/products`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: {
                    'filter.term': query,
                    'filter.locationId': location.locationId,
                    'filter.limit': 10
                }
            });

            console.log(`Raw Kroger Products Response for store ${location.locationId}:`, JSON.stringify(prodRes.data, null, 2));

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
                            name: product.description,
                            price,
                            unit: item.size || 'unknown',
                            locationId: location.locationId,
                            storeAddress: address,
                            zip,
                            imageUrl
                        });
                    }
                }
            }
        } catch (e) {
            console.error("Store search skipped");
        }
    }

    return results;
}
