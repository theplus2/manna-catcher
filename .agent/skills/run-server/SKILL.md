---
name: Run Server
description: Starts a local development server to test the web application and bypass CORS issues.
---

# Run Server Instructions

When the user asks to "run the server", "start server", or encounters CORS issues ensuring local files:

1.  **Execute Command**: Run the following Python command to start a simple HTTP server.
    ```powershell
    python -m http.server
    ```
2.  **Inform User**: Tell the user to open `http://localhost:8000` in their browser.

*Note: This requires Python to be installed on the user's system.*
