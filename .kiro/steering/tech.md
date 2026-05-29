# Technology Stack & Rules

- **Framework:** React (Vite scaffolding).
- **Styling:** Tailwind CSS.
- **Card Data:** Strict reliance on the external Scryfall API.
- **Data Schema:** Every card object must conform to: `name`, `setCode`, `collectorNumber`, `imageURI`, `typeLine`, `oracleText`.
- **State Management:** Local React state with strict persistence. Absolutely no full-page browser refreshes allowed. Use a "Soft Reset" function to clear state without breaking active window capture.