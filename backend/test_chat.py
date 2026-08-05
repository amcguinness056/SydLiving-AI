import asyncio
from agent import process_chat

async def main():
    try:
        res = await process_chat("Find me a 2 bedroom apartment in Coogee for under $1000", [])
        print("Success:", res)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
