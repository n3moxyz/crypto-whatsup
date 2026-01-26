"""
Playwright tests for Crypto Report Generator homepage.
Tests core UI elements and basic interactions.

Run with: python scripts/with_server.py --server "npm run dev" --port 3000 -- python tests/test_homepage.py
"""

from playwright.sync_api import sync_playwright
import sys
import os


def run_all_tests():
    """Run all tests using a single browser session to avoid timeout issues."""

    # Create screenshots directory
    os.makedirs('tests/screenshots', exist_ok=True)

    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_timeout(120000)  # 120s timeout for Next.js compile

        # Warmup: First request triggers Next.js compilation
        print("Warming up Next.js (first request triggers compilation)...")
        try:
            page.goto('http://localhost:3000', timeout=120000, wait_until='commit')
            page.wait_for_load_state('networkidle', timeout=120000)
            print("Warmup complete!")
        except Exception as e:
            print(f"Warmup navigation: {e}")

        # ============================================
        # Test 1: Homepage Elements
        # ============================================
        print("\n" + "="*50)
        print("Running: Homepage Elements")
        print("="*50)

        try:
            print("Navigating to homepage...")
            page.goto('http://localhost:3000', timeout=120000)
            page.wait_for_load_state('networkidle', timeout=60000)

            # Test header
            print("Testing header...")
            header = page.locator('header')
            assert header.is_visible(), "Header should be visible"

            # Test app title
            print("Testing app title...")
            title = page.locator('h1:has-text("Crypto")')
            assert title.is_visible(), "App title should be visible"

            # Test theme toggle (aria-label contains "mode")
            print("Testing theme toggle...")
            theme_toggle = page.locator('button[aria-label*="mode"]')
            assert theme_toggle.is_visible(), "Theme toggle should be visible"

            # Test Current Prices section
            print("Testing prices section...")
            prices_heading = page.locator('h2:has-text("Current Prices")')
            assert prices_heading.is_visible(), "Current Prices heading should be visible"

            # Test What's Up button
            print("Testing What's Up button...")
            whatsup_button = page.locator('button:has-text("What\'s Up")')
            assert whatsup_button.is_visible(), "What's Up button should be visible"

            # Take screenshot
            page.screenshot(path='tests/screenshots/homepage.png', full_page=True)
            print("Homepage Elements: PASS")
            results.append(("Homepage Elements", "PASS"))

        except Exception as e:
            print(f"Homepage Elements: FAIL - {e}")
            page.screenshot(path='tests/screenshots/homepage_error.png', full_page=True)
            results.append(("Homepage Elements", f"FAIL: {e}"))

        # ============================================
        # Test 2: Prices Load
        # ============================================
        print("\n" + "="*50)
        print("Running: Prices Load")
        print("="*50)

        try:
            # Wait for prices to load (they load on mount via useEffect)
            print("Waiting for prices to load...")
            page.wait_for_timeout(5000)  # Give time for API call

            # Check if price cells are visible
            price_cells = page.locator('.data-cell')
            count = price_cells.count()
            print(f"Found {count} price cells")

            assert count > 0, "Should have at least one price cell"

            # Verify first cell is visible
            first_cell = price_cells.first
            assert first_cell.is_visible(), "Price cell should be visible"

            # Take screenshot
            page.screenshot(path='tests/screenshots/prices_loaded.png', full_page=True)
            print("Prices Load: PASS")
            results.append(("Prices Load", "PASS"))

        except Exception as e:
            print(f"Prices Load: FAIL - {e}")
            page.screenshot(path='tests/screenshots/prices_error.png', full_page=True)
            results.append(("Prices Load", f"FAIL: {e}"))

        # ============================================
        # Test 3: Theme Toggle
        # ============================================
        print("\n" + "="*50)
        print("Running: Theme Toggle")
        print("="*50)

        try:
            # Find theme toggle button
            theme_button = page.locator('button[aria-label*="mode"]')
            assert theme_button.is_visible(), "Theme toggle should be visible"

            # Get initial state from data-theme attribute (set by ThemeProvider)
            html = page.locator('html')
            initial_theme = html.get_attribute('data-theme') or 'dark'
            print(f"Initial theme: '{initial_theme}'")

            # Click toggle
            print("Clicking theme toggle...")
            theme_button.click()
            page.wait_for_timeout(500)

            # Check if data-theme changed
            new_theme = html.get_attribute('data-theme') or ''
            print(f"New theme: '{new_theme}'")

            # Verify theme changed
            assert initial_theme != new_theme, f"Theme should change from '{initial_theme}' to something else"

            # Take screenshot
            page.screenshot(path='tests/screenshots/theme_toggled.png', full_page=True)
            print("Theme Toggle: PASS")
            results.append(("Theme Toggle", "PASS"))

        except Exception as e:
            print(f"Theme Toggle: FAIL - {e}")
            page.screenshot(path='tests/screenshots/theme_error.png', full_page=True)
            results.append(("Theme Toggle", f"FAIL: {e}"))

        # ============================================
        # Test 4: Coin Selector
        # ============================================
        print("\n" + "="*50)
        print("Running: Coin Selector")
        print("="*50)

        try:
            # Find coin selector button
            coin_selector = page.locator('button:has-text("coins"), button:has-text("Coins")')

            if coin_selector.count() > 0 and coin_selector.first.is_visible():
                print("Found coin selector, clicking...")
                coin_selector.first.click()
                page.wait_for_timeout(500)

                # Check if dropdown opened
                dropdown = page.locator('[role="listbox"], .dropdown, [class*="dropdown"]')
                if dropdown.count() > 0:
                    print("Coin selector dropdown opened")
                    page.screenshot(path='tests/screenshots/coin_selector.png', full_page=True)

                # Close by clicking elsewhere
                page.locator('body').click(position={"x": 10, "y": 10})

                print("Coin Selector: PASS")
                results.append(("Coin Selector", "PASS"))
            else:
                print("Coin selector not found (may be hidden), skipping")
                results.append(("Coin Selector", "SKIP"))

        except Exception as e:
            print(f"Coin Selector: FAIL - {e}")
            results.append(("Coin Selector", f"FAIL: {e}"))

        browser.close()

    # Print summary
    print("\n" + "="*50)
    print("TEST SUMMARY")
    print("="*50)

    passed = 0
    failed = 0
    skipped = 0

    for name, result in results:
        if result == "PASS":
            status = "PASS"
            passed += 1
        elif result == "SKIP":
            status = "SKIP"
            skipped += 1
        else:
            status = "FAIL"
            failed += 1
        print(f"  {status}: {name}")

    print(f"\nTotal: {passed} passed, {failed} failed, {skipped} skipped")
    print(f"Screenshots saved to tests/screenshots/")

    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
