# StockCalc Pro - Product Specification

## 1. Concept Overview
**StockCalc Pro** is an intelligent, automated stock valuation and portfolio management application. Built on the core investing principles of legendary investor Peter Lynch, the app calculates a "Blended Fair Price" for global equities to help retail investors instantly determine if a stock is overvalued or undervalued. 

Beyond simple calculators, StockCalc Pro acts as an **Agentic Robo-Advisor**, dynamically grouping investments by international currencies, analyzing sector concentration risks, and surfacing actionable insights.

## 2. Product Specifications (V4)

### Core Features
- **Global Ticker Search:** Autocomplete search bar with region-specific filtering supporting markets in the US (🇺🇸), Canada (🇨🇦), UK (🇬🇧), India (🇮🇳), Australia (🇦🇺), and the European Union (🇪🇺).
- **Valuation Engine:** Calculates the "Ultimate Fair Value" using a weighted average of three distinct models:
  - *Peter Lynch Fair Value:* (EPS Growth Rate + Dividend Yield) * EPS
  - *EPS Growth Model:* Projects future EPS based on historical trends.
  - *Price-to-Book (P/B) Model:* Evaluates asset value relative to market price.
- **Interactive Charting:** Visualizes the 1-Year Price History against the calculated Fair Value Line using interactive, responsive line charts.
- **Multi-Currency Portfolio:** Watchlisted stocks with owned shares automatically generate a segmented portfolio dashboard. Portfolios are dynamically split by native currency (USD, CAD, GBp, INR, AUD, EUR) to prevent inaccurate FX blending.
- **Agentic Robo-Advisor:** A dynamic intelligence layer that provides contextual alerts (e.g., "Concentration Risk: Over 60% of your EUR portfolio is in Technology" or "Opportunity: XYZ is trading 20%+ below its Ultimate Fair Value!").
- **Watchlist Management:** Users can save stocks, input shares owned, and track their average cost basis. The app calculates total value and all-time return.
- **Shareable Reports:** Users can export their valuation screen as an image for sharing on social media or messaging platforms.

### UI/UX Design
- **Aesthetic:** Premium "Glassmorphism" dark theme with dynamic neon accents (Green for Undervalued, Red for Overvalued).
- **Responsiveness:** Fully responsive for Desktop, Tablet, and Mobile.
- **Mobile-First Enhancements:** Native haptic feedback triggers (vibrations) on mobile devices for key interactions (searching, saving, deleting).

## 3. Technical Specifications

### Architecture
- **Frontend Framework:** React (bootstrapped with Vite).
- **Styling:** Vanilla CSS (`index.css`) enforcing strict CSS variables for themes and glassmorphic panels.
- **Backend / API Routing:** Netlify Serverless Functions (`/netlify/functions/`).
- **Data Provider:** `yahoo-finance2` (Node.js library) for real-time and historical financial data.
- **Deployment:** Hosted on Netlify as a Progressive Web App (PWA).

### Key Dependencies
- `lucide-react`: SVG iconography.
- `recharts`: D3-based charting library for the 1-Year price history graphs.
- `html-to-image`: DOM-to-image conversion for the export feature.
- `vite-plugin-pwa`: Handles Service Worker generation and offline caching.

### PWA & Security Compliance
- The app is configured as a PWA but strictly adheres to Google Safe Browsing guidelines.
- **No aggressive PWA install prompts** (`beforeinstallprompt` intercepts).
- **No background push notification prompts** on load to prevent spam/phishing heuristics.

## 4. Development & Maintenance Guidelines

### Single Source of Truth
This document (`Productspec.md`) serves as the definitive source of truth for the app's current capabilities, UI architecture, and technical stack. 

### Token Optimization Protocol (STRICT)
**CRITICAL:** Any future enhancements, bug fixes, or troubleshooting sessions must strictly adhere to the `tokenoptimization.md` guidelines. 
- You must always consult the `tokenoptimization.md` file before generating or modifying code.
- Ensure that prompt responses, code generation blocks, and context windows are aggressively optimized for token efficiency.
- Do not hallucinate or rewrite entire files when a targeted `multi_replace_file_content` block will suffice.

## 5. Version History
- **V1:** Initial release. Basic US stock search and Peter Lynch calculation.
- **V2:** Implementation of Recharts graphs and Watchlist storage.
- **V3:** Agentic Robo-Advisor and Portfolio tracking (shares & average cost).
- **V4 (Current):** International Markets Update. Global autocomplete search, multi-currency dynamic portfolio splitting, native flag icons, cache-busting strict currency rendering, and Safe Browsing security compliance.
