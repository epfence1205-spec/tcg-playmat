---
inclusion: manual
---

# AgentCore Memory Token Refresh

When the AgentCore Memory MCP server returns `ExpiredTokenException`, run:

```
ada credentials update --account=377426330998 --provider=conduit --role=IibsAdminAccess-DO-NOT-DELETE --once
```

The MCP server picks up fresh credentials automatically — no restart needed.
