import sys
from curl_cffi import requests
import json
import os
from datetime import datetime

SEARCH = os.environ.get("SEARCH", "eggs large")

def load_cookies(cookie_file="FoodLionScraper/cookies.json"):
    env_cookies = os.environ.get("FOOD_LION_COOKIES", "").strip()
    
    cookies_dict = {}
    if env_cookies:
        if env_cookies.startswith("["):
            print("Using dynamically injected cookies.json Array from UI", file=sys.stderr)
            try:
                cookies_list = json.loads(env_cookies)
                for cookie in cookies_list:
                    cookies_dict[cookie["name"]] = cookie["value"]
            except Exception as e:
                print(f"Error parsing cookies JSON: {e}", file=sys.stderr)
        else:
            print("Parsing dynamically injected raw cookie string from UI", file=sys.stderr)
            # Parse raw semicolon-separated cookies (e.g. from copy-pasting the Cookie header)
            for item in env_cookies.split(';'):
                if '=' in item:
                    k, v = item.strip().split('=', 1)
                    cookies_dict[k] = v
    else:
        path = cookie_file if os.path.exists(cookie_file) else "cookies.json"
        if os.path.exists(path):
            with open(path, "r") as f:
                try:
                    cookies_list = json.load(f)
                    for cookie in cookies_list:
                        cookies_dict[cookie["name"]] = cookie["value"]
                except Exception as e:
                    print(f"Error reading cookies.json: {e}", file=sys.stderr)
                    
    return cookies_dict

cookies = load_cookies()

url = "https://foodlion.com/api/v6.0/products/2/50002071"

params = {
    "sort": "bestMatch asc",
    "filter": "",
    "start": 0,
    "flags": "true",
    "keywords": SEARCH,
    "nutrition": "false",
    "facetExcludeFilter": "true",
    "semanticSearch": "false",
    "platform": "web",
    "includeSponsoredProducts": "true",
    "adPositions": "0,2,3,6,8,10,12,16,18,20",
    "facet": "categories,brands,nutrition,sustainability,specials,newArrivals,privateLabel",
}

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://foodlion.com/product-search/milk?searchRef=&semanticSearch=false",
    "sec-ch-ua": '"Microsoft Edge";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "Connection": "keep-alive",
}

response = requests.get(url, params=params, headers=headers, cookies=cookies, impersonate="edge")

if response.status_code in (403, 409):
    print("Cookie revoked, expired, or blocked by DataDome — export fresh cookies from your browser and replace cookies.json", file=sys.stderr)
    exit(1)

response.raise_for_status()

products = response.json()["response"]["products"]

results = []
if products:
    for p in products:
        results.append({
            "productId": str(p.get("prodId", p.get("upc", ""))),
            "name": p.get("name", "Unknown Product"),
            "brand": p.get("brand", ""),
            "price": p.get("price", 0.0),
            "unit": p.get("size", "unknown"),
            "locationId": "FoodLion",
            "storeAddress": "Food Lion Scraper",
            "zip": "Default",
            "imageUrl": p.get("image", {}).get("large", p.get("image", {}).get("medium", ""))
        })

print(json.dumps(results))