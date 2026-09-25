#!/usr/bin/env bash
set -euo pipefail

# update_screenshots.sh
# Automates capturing the three canonical screenshots for the README and documentation.
# Required by project policy whenever UI changes are made.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SCREENSHOTS_DIR="$ROOT_DIR/docs/screenshots"
mkdir -p "$SCREENSHOTS_DIR"

export PATH="/Users/aaronmcguinness/.nvm/versions/node/v24.18.1/bin:$PATH"

echo "📸 Checking frontend server availability at http://127.0.0.1:5173..."
if ! curl -s -o /dev/null http://127.0.0.1:5173; then
  echo "❌ Frontend server is not responding at http://127.0.0.1:5173. Please ensure 'npm run dev' is running."
  exit 1
fi

echo "🚀 Launching Playwright CLI session..."
playwright-cli open "http://127.0.0.1:5173"
playwright-cli resize 1440 900

# Ensure dark mode is active
playwright-cli eval "() => { localStorage.setItem('sydliving_theme', 'dark'); document.documentElement.classList.add('dark'); }"
playwright-cli reload

echo "📸 1/3 Capturing dark_mode_commute_map.png (Overview & Kai Concierge Capsule)..."
playwright-cli eval "() => new Promise(r => setTimeout(r, 3500))"
playwright-cli screenshot --filename="$SCREENSHOTS_DIR/dark_mode_commute_map.png"

echo "📸 2/3 Capturing shortlist_compare_modal.png (Shortlist Comparison & Ask Kai)..."
playwright-cli eval "() => { localStorage.setItem('sydliving_shortlist', JSON.stringify(['e2c7332b-6a3f-4bad-a97f-7a714ddbedeb', 'eeec36d4-c490-44c6-8d60-f9ecb39a57c5', '2b5af441-19e1-4b1a-94ee-079e2e93d4e9'])); }"
playwright-cli reload
playwright-cli eval "() => new Promise(r => setTimeout(r, 2000))"
playwright-cli click "button:has-text('Shortlist')"
playwright-cli eval "() => new Promise(r => setTimeout(r, 1000))"
playwright-cli screenshot --filename="$SCREENSHOTS_DIR/shortlist_compare_modal.png"

echo "📸 3/3 Capturing kai_ai_concierge_chat.png (Live Multi-Agent Chat & Property Links)..."
playwright-cli reload
playwright-cli eval "() => new Promise(r => setTimeout(r, 2000))"
playwright-cli click "button:has-text('Fast commute to Barangaroo')"
playwright-cli eval "() => new Promise(r => setTimeout(r, 8000))"
playwright-cli screenshot --filename="$SCREENSHOTS_DIR/kai_ai_concierge_chat.png"

playwright-cli close

echo "✅ All 3 screenshots captured and updated successfully in $SCREENSHOTS_DIR:"
ls -lh "$SCREENSHOTS_DIR"
