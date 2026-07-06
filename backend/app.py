import os
import json
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Catify API", description="Backend service for the Catify Chrome Extension")

# Configure CORS to allow Chrome Extension (which can run on chrome-extension:// or any web page)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATS_FILE = os.path.join(os.path.dirname(__file__), "stats.json")

def load_stats():
    if os.path.exists(STATS_FILE):
        try:
            with open(STATS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {"catified_count": 0}

def save_stats(stats):
    try:
        with open(STATS_FILE, "w") as f:
            json.dump(stats, f)
    except Exception as e:
        print(f"Error saving stats: {e}")

class IncrementStatsRequest(BaseModel):
    increment: int

# Fallback cat images in case the external API is rate-limited or down
FALLBACK_CATS = [
    {"url": "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=500&auto=format&fit=crop"},
    {"url": "https://images.unsplash.com/photo-1519052537078-e6302a4968d4?w=500&auto=format&fit=crop"},
    {"url": "https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=500&auto=format&fit=crop"},
    {"url": "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=500&auto=format&fit=crop"},
    {"url": "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=500&auto=format&fit=crop"},
    {"url": "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=500&auto=format&fit=crop"},
    {"url": "https://images.unsplash.com/photo-1533743983669-94fa5c4338ec?w=500&auto=format&fit=crop"},
    {"url": "https://images.unsplash.com/photo-1501820488136-72669a482d14?w=500&auto=format&fit=crop"},
    {"url": "https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=500&auto=format&fit=crop"},
    {"url": "https://images.unsplash.com/photo-1561948955-570b270e7c36?w=500&auto=format&fit=crop"}
]

@app.get("/api/cats")
async def get_cats(limit: int = 20):
    """
    Fetches random cat images from The Cat API.
    If the external API fails, returns a set of curated fallback cat image URLs.
    """
    if limit <= 0 or limit > 50:
        limit = 20

    url = f"https://api.thecatapi.com/v1/images/search?limit={limit}"
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url)
            if response.status_code == 200:
                data = response.json()
                # Extract only urls
                cat_urls = [item["url"] for item in data if "url" in item]
                if cat_urls:
                    return {"success": True, "images": cat_urls}
    except Exception as e:
        print(f"Failed to fetch from Cat API: {e}")
        
    # Return fallback images if external API call failed
    import random
    selected = random.sample(FALLBACK_CATS, min(limit, len(FALLBACK_CATS)))
    return {"success": True, "images": [item["url"] for item in selected]}

@app.get("/api/stats")
async def get_stats():
    """
    Retrieves global catification statistics.
    """
    stats = load_stats()
    return stats

@app.post("/api/stats/increment")
async def increment_stats(req: IncrementStatsRequest):
    """
    Increments the count of catified images.
    """
    stats = load_stats()
    stats["catified_count"] += req.increment
    save_stats(stats)
    return stats

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
