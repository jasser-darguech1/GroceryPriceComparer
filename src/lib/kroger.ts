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

export function getNormalizedSize(sizeStr: string): { value: number | null, unit: string | null } {
    if (!sizeStr) return { value: null, unit: null };
    let str = sizeStr.toLowerCase().trim();
    
    // Fraction Parser
    str = str.replace(/(\d+)\/(\d+)/g, (match, p1, p2) => {
        return (parseFloat(p1) / parseFloat(p2)).toString();
    });

    let targetStr = str;
    if (str.includes('/')) {
        const parts = str.split('/');
        for (const p of parts) {
            if (/oz|lb|gal|qt|gallon|pound|quart|fl|fo/.test(p)) {
                targetStr = p;
                break;
            }
        }
    } else {
        const parts = str.match(/[\d.]+\s*[a-z\s]+/g);
        if (parts && parts.length > 1) {
            for (const p of parts) {
                if (/oz|lb|gal|qt|gallon|pound|quart|fl|fo/.test(p)) {
                    targetStr = p;
                    break;
                }
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
}

function calculateSimilarityScore(target: string, resultName: string, querySize?: string, resultSize?: string, targetBrand?: string, resultBrand?: string): number {
    let score = 0;
    const targetWords = target.toLowerCase().split(/\s+/);
    const resultWords = resultName.toLowerCase().split(/\s+/);

    // Name Matching
    let matches = 0;
    for (const w of targetWords) {
        if (resultWords.includes(w) || resultWords.some(r => r.includes(w) || w.includes(r))) {
            matches++;
        }
    }
    score += (matches / targetWords.length) * 100;

    // Keyword Bonus
    for (const w of targetWords) {
        if (w.length > 3 && resultName.toLowerCase().includes(w)) {
             score += 40; // Exact long word match bonus (e.g. "Energy", "Enhancer")
        }
    }

    // Keyword-First Priority (Title-based brand detection)
    if (targetBrand) {
        const tbLow = targetBrand.toLowerCase();
        
        // Massive boost if the Brand is physically in the Kroger title
        if (resultName.toLowerCase().includes(tbLow)) {
            score += 500;
        } else {
            // Essential Noun Penalty: If the primary brand/noun is completely missing, heavily penalize it!
            score -= 1000;
        }

        // Relaxed Brand Field: Bonus info, not a hard filter
        if (resultBrand) {
            const rbLow = resultBrand.toLowerCase();
            if (tbLow === rbLow) score += 50;
            else if (rbLow.includes(tbLow) || tbLow.includes(rbLow)) score += 20;
        }
    } else {
        // Essential Noun Rule Fallback (if no brand provided, use first major word)
        if (targetWords.length > 0) {
            const essentialNoun = targetWords[0];
            if (!resultName.toLowerCase().includes(essentialNoun)) {
                score -= 1000;
            }
        }
    }

    // Mathematical Size Tolerance Matching
    if (querySize && resultSize) {
        const qNorm = getNormalizedSize(querySize);
        const rNorm = getNormalizedSize(resultSize);

        if (qNorm.unit && rNorm.unit && qNorm.unit === rNorm.unit && qNorm.value !== null && rNorm.value !== null) {
            const diff = Math.abs(qNorm.value - rNorm.value);
            const tolerance = qNorm.value * 0.10; // 10% tolerance

            if (diff <= tolerance) {
                const accuracy = 1 - (diff / qNorm.value);
                const sizeScore = 50 + (50 * accuracy); // Max 100
                score += sizeScore;
                console.log(`[Size Math] ${resultName.substring(0, 15)}... | FL: ${qNorm.value}${qNorm.unit} | KR Match: ${rNorm.value}${rNorm.unit} (Within ${diff.toFixed(2)} / ${tolerance.toFixed(2)} Tol) | Result: MATCH (+${sizeScore.toFixed(0)}pts)`);
            } else {
                console.log(`[Size Math] ${resultName.substring(0, 15)}... | FL: ${qNorm.value}${qNorm.unit} | KR Match: ${rNorm.value}${rNorm.unit} | Result: FAIL (Diff ${diff.toFixed(2)} > ${tolerance.toFixed(2)})`);
            }
        } else if (qNorm.unit === rNorm.unit && qNorm.unit !== null) {
             score += 10;
        }
    }

    return score;
}

export async function searchKroger(locationId: string, locationAddress: string, zip: string, query: string, targetBrand?: string) {
    const token = await getAccessToken();
    const BASE_URL = 'https://api.kroger.com/v1';

    let results = [];
    
    // Extract size patterns to build a pure query
    const sizePattern = /\b(\d+(\.\d+)?)\s*(ct|count|doz|oz|lb|gal|fl oz)\b/gi;
    const extractedSizes = query.match(sizePattern) || [];
    const sizeStr = extractedSizes.length > 0 ? extractedSizes[0] : undefined;
    const baseQuery = query.replace(sizePattern, '').trim();

    try {
        let prodRes;
        const fetchItems = async (term: string) => {
            console.log(`[KROGER API] Final URL: ${BASE_URL}/products?filter.term=${encodeURIComponent(term)}&filter.locationId=${locationId}&filter.limit=15`);
            const res = await axios.get(`${BASE_URL}/products`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: {
                    'filter.term': term,
                    'filter.locationId': locationId,
                    'filter.limit': 15
                }
            });
            const data = res.data.data || [];
            if (data.length > 0) {
                 console.log(`[KROGER RAW RESPONSE (top 3)]:`, JSON.stringify(data.slice(0,3).map((d: any) => ({ desc: d.description, productId: d.productId })), null, 2));
            }
            return data;
        };

        let products = await fetchItems(query);
        
        // Fallback Strategy
        if (products.length === 0 && sizeStr) {
            console.log(`[KROGER] Failed exact size match, falling back to base term: ${baseQuery}`);
            products = await fetchItems(baseQuery);
        }

        if (baseQuery.toLowerCase().includes('mio') || (targetBrand && targetBrand.toLowerCase().includes('mio'))) {
            console.log('DEBUG MIO:', { 
                targetBrand, query, baseQuery, sizeStr, 
                krResults: products.slice(0, 3).map((p: any) => ({ name: p.description, brand: p.brand, items: p.items }))
            });
        }

        // Fuzzy Scoring & Formatting
        let scoredProducts = products.map((product: any) => {
            const items = product.items || [];
            if (items.length === 0) return null;
            
            const item = items[0];
            const price = item.price?.regular || item.price?.promo || null;
            if (!price) return null;
            
            const itemSize = item.size || 'unknown';
            const resultBrand = product.brand || '';
            const similarity = calculateSimilarityScore(baseQuery, product.description, sizeStr, itemSize, targetBrand, resultBrand);

            let imageUrl = null;
            if (product.images && product.images.length > 0) {
                const frontImage = product.images.find((img: any) => img.perspective === 'front') || product.images[0];
                const largeSize = frontImage.sizes?.find((s: any) => s.size === 'large' || s.size === 'medium');
                imageUrl = largeSize ? largeSize.url : null;
            }

            return {
                productId: product.productId,
                name: product.description,
                brand: resultBrand,
                price,
                unit: itemSize,
                locationId: locationId,
                storeAddress: locationAddress,
                zip: zip,
                imageUrl,
                similarity
            };
        }).filter(Boolean);

        // Strict 15% Unit Filter Validation & Sorting
        let validMatches: any[] = [];
        let hasSizeFilter = false;

        if (sizeStr) {
            const queryNorm = getNormalizedSize(sizeStr);
            if (queryNorm.value !== null && queryNorm.unit) {
                hasSizeFilter = true;
                
                for (const p of scoredProducts) {
                    const rNorm = getNormalizedSize(p.unit);
                    // Match units strictly
                    if (rNorm.unit === queryNorm.unit && rNorm.value !== null) {
                        const diffPercent = Math.abs(queryNorm.value - rNorm.value) / queryNorm.value;
                        if (diffPercent <= 0.15) {
                            p.sizeDiffPercent = diffPercent;
                            validMatches.push(p);
                        } else {
                            console.log(`[Size Math] FL: ${sizeStr} -> ${queryNorm.value} ${queryNorm.unit} | KR: ${p.unit} -> ${rNorm.value} ${rNorm.unit} | Difference: ${(diffPercent * 100).toFixed(0)}% | Result: REJECTED (Size out of range)`);
                        }
                    } else {
                        // Log mismatched units to debug Ghost Rejections
                        console.log(`[Size Math] FL: ${sizeStr} -> ${queryNorm.unit} | KR: ${p.unit} -> ${rNorm.unit} | Result: REJECTED (Unit Mismatch)`);
                    }
                }
                
                if (validMatches.length > 0) {
                     // Sort by primary similarity, then by smallest numerical difference
                     validMatches.sort((a, b) => {
                         if (Math.abs(b.similarity - a.similarity) > 10) {
                             return b.similarity - a.similarity; 
                         }
                         // Tie-breaker or close similarity: pick closest size mathematically
                         return a.sizeDiffPercent - b.sizeDiffPercent;
                     });

                     if (baseQuery.toLowerCase().includes('mio') || (targetBrand && targetBrand.toLowerCase().includes('mio'))) {
                         const top3 = validMatches.slice(0, 3).map(m => `[Score: ${m.similarity.toFixed(0)}] ${m.name}`).join(' | ');
                         console.log(`[DEBUG MIO WINNERS] ${top3}`);
                     }
                     
                     const winner = validMatches[0];
                     const wNorm = getNormalizedSize(winner.unit);
                     console.log(`[Size Math] FL: ${sizeStr} -> ${queryNorm.value} ${queryNorm.unit} | KR: ${winner.unit} -> ${wNorm.value} ${wNorm.unit} | Difference: ${(winner.sizeDiffPercent * 100).toFixed(0)}% | Result: MATCH ACCEPTED - VALID.`);
                     
                     scoredProducts = validMatches;
                } else {
                     console.log(`[Mismatch] No items found within 15% tolerance of ${queryNorm.value}${queryNorm.unit}.`);
                     scoredProducts = []; // Discard explicitly to force "Not Found" error mapping
                }
            }
        }
        
        if (!hasSizeFilter) {
            // Sort by similarity score descending if no size bounds were strictly detected
            scoredProducts.sort((a: any, b: any) => b.similarity - a.similarity);
        }
        
        results = scoredProducts; // We map the top results for UI return
    } catch (e: any) {
        console.error("Store search error:", e.response?.data || e.message);
    }

    return results;
}
