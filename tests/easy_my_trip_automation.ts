// Importing necessary modules and types from Playwright
import { test, expect, Page, Locator, BrowserContext } from '@playwright/test';

// Locators: Defining all XPath or selector strings for elements on the webpage
const locators = {
    flightTab: '//*[@id="homepagemenuUL"]/li[1]/a', // Locator for the Flights tab
    fromCity: '//*[@id="FromSector_show"]', // Locator for the "From City" input field
    from_city_dropdown: '//*[@id="a_FromSector_show"]', // Dropdown for "From City"
    from_autofill: '//*[@id="fromautoFill"]', // Autofill for "From City"
    toCity: '//*[@id="a_Editbox13_show"]', // Locator for the "To City" input field
    to_city_dropdown: '//*[@id="a_Editbox13_show"]', // Dropdown for "To City"
    to_autofill: '//*[@id="toautoFill"]', // Autofill for "To City"
    searchButton: '//*[@id="divSearchFlight"]', // Locator for the Search button
    firstflight: '//*[@id="ResultDiv"]/div/div/div[4]/div[2]/div[1]/div[1]/div[6]/button[1]', // Locator for the "Book Now" button of the first flight
    discount: '//*[@id="spnCouponDst"]', // Locator for the discount amount
    price: '//*[@id="divFareSummary"]/div[1]/div[2]/span', // Locator for the base price
    taxes: '//*[@id="divFareSummary"]/div[2]/div[3]/span', // Locator for the taxes
    promocode: '//*[@id="txtCouponCode"]', // Locator for the promo code input field
    clear_promocode: '//*[@id="divCouponApplied"]/div[2]/div', // Locator to clear the applied promo code
    apply: '//*[@id="divCouponCodeApply"]/div[2]/div', // Locator for the Apply button for promo code
};

// HomePage class: Encapsulates methods for interacting with the homepage of the website
class HomePage {
    private page: Page; // Page object from Playwright
    private context: BrowserContext; // Browser context for additional permissions

    constructor(page: Page) {
        this.page = page; // Initialize the page object
        this.context = page.context(); // Set the context for the page
    }

    // Navigate to the homepage and grant necessary permissions
    async navigateToHomePage() {
        await this.context.grantPermissions(['geolocation']); // Grant geolocation permissions
        await this.page.goto('https://www.easemytrip.com/', { waitUntil: 'load' }); // Navigate to the homepage
    }

    // Select the Flights tab on the homepage
    async selectFlightsTab() {
        await this.page.click(locators.flightTab); // Click the Flights tab
    }

    // Enter the "From" and "To" cities for flight search
    async enterCities(from: string, to: string) {
        // Enter the "From City"
        await this.page.locator(locators.fromCity).click(); // Click the "From City" input
        await this.page.locator(locators.from_city_dropdown).fill(from); // Fill the "From City" field
        await this.page.locator(locators.from_autofill).waitFor({ state: 'visible' }); // Wait for autofill suggestions
        await this.page.locator(`text=${from}`).first().click(); // Select the correct city from suggestions

        // Enter the "To City"
        await this.page.locator(locators.toCity).click(); // Click the "To City" input
        await this.page.locator(locators.to_city_dropdown).fill(to); // Fill the "To City" field
        await this.page.locator(locators.to_autofill).waitFor({ state: 'visible' }); // Wait for autofill suggestions
        await this.page.locator(`#toautoFill >> text=${to}`).click(); // Select the correct city from suggestions
    }

    // Select the cheapest date for the flight
    async selectCheapestDate(): Promise<number> {
        const dateElements = await this.page.locator('.box .days ul li'); // Locate all date elements
        let cheapestPrice = Infinity; // Initialize cheapest price as Infinity
        let cheapestDateId: string | null = null; // Initialize ID of the cheapest date

        for (let i = 0; i < await dateElements.count(); i++) {
            const dateElement = dateElements.nth(i); // Get the nth date element
            const priceText = await dateElement.locator('span').textContent(); // Get the price text for the date
            const dateId = await dateElement.locator('span').getAttribute('id'); // Get the ID of the date
            const price = priceText ? parseInt(priceText.replace(/[^\d]/g, ''), 10) : Infinity; // Parse the price

            // Update the cheapest price and date ID if this date is cheaper
            if (price < cheapestPrice) {
                cheapestPrice = price;
                cheapestDateId = dateId;
            }
        }

        // Click the cheapest date if found
        if (cheapestDateId) {
            await this.page.locator(`[id="${cheapestDateId}"]`).click();
            return cheapestPrice; // Return the cheapest price
        }
        return cheapestPrice; // Return Infinity if no valid dates are found
    }

    // Click the Search button
    async clickSearchButton() {
        await this.page.locator(locators.searchButton).click(); // Click the Search button
    }
}

// Page2 class: Encapsulates methods for interacting with the flight results page
class Page2 {
    private page: Page; // Page object from Playwright

    constructor(page: Page) {
        this.page = page; // Initialize the page object
    }

    // Wait for the flight list to load
    async waitForFlightListToLoad() {
        await this.page.locator('//*[@id="ResultDiv"]/div/div/div[4]/div[2]').waitFor({ state: 'visible' }); // Wait for the flight list to become visible
    }

    // Click the "Book Now" button for the first flight
    async clickBookNowButton() {
        await this.page.locator(locators.firstflight).click(); // Click the first flight's "Book Now" button
    }

    // Apply a promo code and verify its effect on the total price
    async applyPromoCodeAndVerify(code: string, price: number) {
        await this.page.locator(locators.clear_promocode).click(); // Clear any previously applied promo code
        await this.page.locator(locators.promocode).fill(code); // Enter the promo code
        await this.page.locator(locators.apply).click(); // Click the Apply button

        const promoMessage = await this.page.locator('#easeFareDetails1_promodiv').textContent(); // Get the promo message
        const grandTotalText = await this.page.locator('#spnGrndTotal').textContent(); // Get the total price after applying the promo
        const grandTotal = parseFloat(grandTotalText?.replace(/[^0-9.]/g, '') || '0'); // Parse the total price

        // Verify the price based on the promo code validity
        if (promoMessage?.includes("Invalid Coupon")) {
            if (grandTotal !== price) throw new Error('Price mismatch for invalid coupon'); // Check for price mismatch
        } else if (promoMessage?.includes("Congratulations")) {
            const discountText = await this.page.locator(locators.discount).textContent(); // Get the discount text
            const discount = parseFloat(discountText?.replace(/[^0-9.]/g, '') || '0'); // Parse the discount amount
            if (grandTotal !== price - discount) throw new Error('Discount calculation error'); // Check for calculation errors
        }
    }
}

// Test suite for flight booking automation
test.describe('Flight Booking Automation', () => {
    // Test case for verifying the flight booking flow
    test('Verify flight booking flow', async ({ page }) => {
        const homePage = new HomePage(page); // Initialize the HomePage object
        const page2 = new Page2(page); // Initialize the Page2 object

        await homePage.navigateToHomePage(); // Navigate to the homepage
        await homePage.selectFlightsTab(); // Select the Flights tab
        await homePage.enterCities('Delhi', 'Mumbai'); // Enter the "From" and "To" cities
        const cheapestPrice = await homePage.selectCheapestDate(); // Select the cheapest date
        await homePage.clickSearchButton(); // Click the Search button

        await page2.waitForFlightListToLoad(); // Wait for the flight list to load
        await page2.clickBookNowButton(); // Click the "Book Now" button for the first flight

        // Verify the promo code application with invalid and valid codes
        await page2.applyPromoCodeAndVerify('INVALID', cheapestPrice); 
        await page2.applyPromoCodeAndVerify('VALIDCODE', cheapestPrice);
    });
});
