#main.py

import uvicorn

def run():
    uvicorn.run("instacrud.app:app", host="0.0.0.0", port=8000, reload=True)