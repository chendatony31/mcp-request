# mcp-request

A Model Context Protocol (MCP) server for making HTTP requests to different services.

## Why mcp-request?

When working with multiple APIs in an MCP environment, creating individual MCP servers for each API can be:

- Time-consuming
- Resource-intensive
- Unnecessary in many cases

This tool allows you to:

- Quickly expose any HTTP API through MCP
- Reuse existing HTTP APIs without additional server setup
- Maintain a single MCP server for multiple APIs

## Installation

```json
{
  "mcpServers": {
    "wallet-mcp": {
      "command": "npx",
      "args": ["mcp-request"]
    }
  }
}
```

## Usage

## Tools

- registerApi
- deleteApi
- beforeRequest
- request

### registerApi: register custom HTTP requests

- For example, adding a weather query API:

`Add a weather query interface to mcp-request https://wttr.in/Tokyo?format=j1 where Tokyo is the city's name`

After added, you can query weather information of different cities

- Or directly send the JSON definition

```
`Register this request: {
    "id": "sui_rpc",
    "name": "Sui RPC",
    "description": "Make RPC calls to Sui mainnet node",
    "params": {
      "method": {
        "type": "string",
        "description": "RPC method name",
        "example": "suix_getBalance"
      },
      "params": {
        "type": "array",
        "description": "Parameters for the RPC method",
        "example": [
          "0x317b2a1385c9f7115f4c227b512293e6a632762c7c4e79728b3ad743f656b8fe",
          "0x2::sui::SUI"
        ]
      }
    },
    "api": {
      "url": "https://wallet-rpc.mainnet.sui.io/",
      "method": "POST",
      "headers": {
        "Content-Type": "application/json"
      },
      "params": {
        "jsonrpc": "2.0",
        "id": 1
      }
    }
  }`
```

`Query the balance of 0x317b2a1385c9f7115f4c227b512293e6a632762c7c4e79728b3ad743f656b8fe` // ai knows which methods and params they need to use.

## deleteApi

`delete sui_rpc api`

`delete sui related api`

## beforeRequest

It will find if there are any api available to use before you query something.

You can also list all the apis you already registered

`list all my api in request mcp` or `list my apis`

## request

Http request happens here.

## TODO

- [ ] Optimize data structure for easier API addition
- [ ] Support single HTTP request without registration
- [ ] Support remote API registration
- [ ] Support API key configuration and management
- [ ] ...
