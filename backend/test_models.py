import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

models_to_test = [
    "gemini-3.5-flash",
    "gemini-pro-latest"
]

for m in models_to_test:
    try:
        response = client.models.generate_content(model=m, contents="hello")
        print(f"Model {m} SUCCESS: {response.text}")
    except Exception as e:
        print(f"Model {m} FAILED: {type(e).__name__} - {str(e)[:100]}")
