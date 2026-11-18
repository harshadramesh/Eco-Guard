# ECOGUARD – Smart Campus Intelligence

A frontend-only hackathon prototype built with HTML, CSS and JavaScript. All campus readings, predictions, alerts, points and maintenance actions are simulated and stored in the browser using LocalStorage.

## Project files

- `index.html` – page structure and navigation
- `style.css` – responsive design and feature styles
- `script.js` – all JavaScript in one file, including the original dashboard and every added feature

## Run on Windows with VS Code

1. Extract the ZIP file to a normal folder (do not edit files inside the ZIP).
2. Open Visual Studio Code.
3. Select **File → Open Folder** and choose the extracted `ECOGUARD_HACKATHON` folder.
4. In Extensions, search for **Live Server** by Ritwick Dey and install it.
5. Open `index.html` in the Explorer panel.
6. Right-click `index.html` and choose **Open with Live Server**.
7. The website should open in your browser at a local address such as `http://127.0.0.1:5500`.

Chart.js and Google Fonts are loaded from CDNs, so an internet connection is needed for charts and remote fonts. The core pages and calculations run locally.

## Included features

1. Carbon footprint calculator – multiplies electricity kWh by the India national grid weighted-average factor of 0.675 kg CO2/kWh for FY 2025–26 (CEA CO2 Baseline Database v22.0). Use the factor that matches the financial year of the electricity data. This is an estimate, not a direct measurement or a Tamil Nadu-specific factor.
2. Green leaderboard – Block vs Block and Stream vs Stream team competition. No individual student ranking.
3. Predictive consumption – a transparent least-squares linear trend using the latest seven simulated readings to estimate the next 30 days.
4. Campus sustainability assistant – rule-based answers generated from the current browser's simulated campus data. It is not connected to an external generative AI service.
5. Adaptive anomaly detection – compares current readings with recent historical averages and standard deviations. When at least four timestamped samples are available for the same hour, it uses that hour-of-day baseline; otherwise it falls back to recent history. It avoids the old fixed 20% alert rule.
6. Maintenance dispatch – create tickets manually or dispatch a flagged anomaly directly to an electrical, plumbing or facilities team.
7. Inspection verification – staff record the actual outcome and notes. Confirmed faults make future detection more sensitive for that zone/resource; a no-fault finding makes it more conservative. This feedback adjusts a bounded statistical z-score threshold.
7. Existing dashboard, live monitoring, alert centre and recommendations.

## Demo notes and limitations

- No real sensors, IoT devices, external database or backend are connected.
- LocalStorage is specific to the browser and computer. Data will not automatically sync to teammates' devices.
- The maintenance workflow records inspection findings but does not contact real staff, send notifications or verify physical repairs. It is a browser-only demonstration.
- Inspection feedback is a simple demo learning rule: confirmed findings lower the zone/resource z-score limit, while no-fault findings raise it, within a bounded range. It is not a trained machine-learning model.
- Savings shown in the demo are only calculated from readings already present; recording an inspection does not automatically alter resource readings.
- Predictions are based on only a short simulated history and are not guaranteed forecasts.
- The local assistant uses simple rules. For a real AI assistant, create a secure backend and call an AI service from the server. Never place private API keys in browser-side JavaScript.
- Eco-points, challenge progress and stream assignments are demo values and should be configured to match the actual college.

## Carbon factor source

Central Electricity Authority (CEA), CDM–CO2 Baseline Database, Version 22.0: https://cea.nic.in/cdm-co2-baseline-view?lang=en&mappingId=234

For FY 2025–26 the India national weighted-average grid factor is 0.675 tCO2/MWh (= 0.675 kg CO2/kWh). For a different reporting year, use that year's factor from the applicable CEA database version.

## Reset demo data

Use the existing **Reset demo data** control in the About page. It resets both the original dashboard data and the added feature demo data for that browser.
