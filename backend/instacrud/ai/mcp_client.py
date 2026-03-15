from typing import List, Dict, Any, Optional
import httpx
from pydantic import BaseModel


class McpTool(BaseModel):
    name: str
    description: str
    input_schema: Dict[str, Any]


class McpResource(BaseModel):
    uri: str
    name: str
    description: Optional[str] = None
    mime_type: Optional[str] = None


class McpClient:

    def __init__(self, server_url: str, api_key: Optional[str] = None):
        self.server_url = server_url.rstrip('/')
        self.api_key = api_key
        self.client = httpx.AsyncClient(
            headers={"Authorization": f"Bearer {api_key}"} if api_key else {}
        )

    async def list_tools(self) -> List[McpTool]:
        response = await self.client.post(
            f"{self.server_url}/tools/list",
            json={}
        )
        response.raise_for_status()
        data = response.json()
        return [McpTool(**tool) for tool in data.get("tools", [])]

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        response = await self.client.post(
            f"{self.server_url}/tools/call",
            json={
                "name": tool_name,
                "arguments": arguments
            }
        )
        response.raise_for_status()
        data = response.json()
        return data.get("content", [])

    async def list_resources(self) -> List[McpResource]:
        response = await self.client.post(
            f"{self.server_url}/resources/list",
            json={}
        )
        response.raise_for_status()
        data = response.json()
        return [McpResource(**resource) for resource in data.get("resources", [])]

    async def read_resource(self, uri: str) -> Dict[str, Any]:
        response = await self.client.post(
            f"{self.server_url}/resources/read",
            json={"uri": uri}
        )
        response.raise_for_status()
        return response.json()

    async def close(self):
        await self.client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
