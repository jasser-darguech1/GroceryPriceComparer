import sys
from curl_cffi import requests
import json
import os
from datetime import datetime

SEARCH = os.environ.get("SEARCH", "eggs large")

def load_cookies(cookie_file="FoodLionScraper/cookies.json"):
    # Fix the path loading strictly relative to the main project running folder boundary
    path = cookie_file if os.path.exists(cookie_file) else "cookies.json"
    with open(path, "r") as f:
        cookies = json.load(f)
    for cookie in cookies:
        if cookie["name"] == "datadome":
            expires = datetime.fromtimestamp(cookie["expirationDate"])
            days_left = (expires - datetime.now()).days
            print(f"datadome cookie expires: {expires.strftime('%Y-%m-%d')} ({days_left} days from now)", file=sys.stderr)
    return {cookie["name"]: cookie["value"] for cookie in cookies}

cookies = load_cookies()

url = "https://foodlion.com/api/v6.0/products/382429261/50002071"

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
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://foodlion.com/",
    "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "Connection": "keep-alive",
}

response = requests.get(url, params=params, headers=headers, cookies=cookies, impersonate="chrome")

if response.status_code == 403:
    print("Cookie revoked or expired — export fresh cookies from your browser and replace cookies.json", file=sys.stderr)
    exit(1)

response.raise_for_status()

products = response.json()["response"]["products"]

results = []
if products:
    for p in products:
        results.append({
            "productId": str(p.get("prodId", p.get("upc", ""))),
            "name": p.get("name", "Unknown Product"),
            "price": p.get("price", 0.0),
            "unit": p.get("size", "unknown"),
            "locationId": "FoodLion",
            "storeAddress": "Food Lion Scraper",
            "zip": "Default",
            "imageUrl": p.get("image", {}).get("large", p.get("image", {}).get("medium", ""))
        })

print(json.dumps(results))