import requests
from bs4 import BeautifulSoup
import os

url = "https://docs.meshy.ai/en/api/animation-library"  # ← change this

response = requests.get(url)
soup = BeautifulSoup(response.text, "html.parser")

gif_urls = []

for img in soup.find_all("img"):
    src = img.get("src")
    if src and ".gif" in src.lower():
        if not src.startswith("http"):
            src = url + src  # fix relative URL
        gif_urls.append(src)

print("GIFs found:", gif_urls)

# Download them with numeric names (0.gif, 1.gif, ...)
os.makedirs("gifs", exist_ok=True)

for index, gif in enumerate(gif_urls):
    data = requests.get(gif).content
    file_path = f"gifs/{index}.gif"
    with open(file_path, "wb") as f:
        f.write(data)
        print(f"Downloaded: {file_path}")

