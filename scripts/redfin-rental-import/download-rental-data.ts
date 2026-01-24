
import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const DOWNLOAD_DIR = path.resolve(__dirname, '../../data/raw/redfin_rental');
const DASHBOARD_URL = 'https://public.tableau.com/views/RentalMarket-Public/RentalMarket?:embed=y&:toolbar=yes&:showVizHome=no';

// Ensure download directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

async function downloadTableauData() {
    console.log('🚀 Starting Redfin Rental Data Download via Playwright');
    console.log(`📂 Output directory: ${DOWNLOAD_DIR}`);

    const browser = await chromium.launch({
        headless: false, // Set to false to see what's happening (optional, but good for debugging)
        args: ['--start-maximized'] // Start maximized to ensure all elements are visible
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        acceptDownloads: true
    });

    const page = await context.newPage();

    try {
        console.log(`🌐 Navigating to ${DASHBOARD_URL}`);
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle' });

        // Wait for the specific Tableau loading spinner to disappear
        // Note: Tableau selectors are tricky. We often rely on text or role.
        console.log('⏳ Waiting for dashboard to load...');
        await page.waitForTimeout(5000); // Initial buffer

        // Try to find the "Data Table" tab/sheet
        // The previous analysis showed "Data Table" as a tab at the top
        console.log('🔍 Switching to "Data Table" view...');

        // Selectors for Tableau tabs can be obscure. We try clicking by text.
        await page.getByText('Data Table', { exact: true }).click();
        await page.waitForTimeout(5000); // Wait for table to render

        // Now we need to trigger the download
        // Tableau toolbar is usually at the bottom.
        console.log('⬇️ Initiating Download...');

        // Click the Download button (icon) in the toolbar
        // Usually has ID 'download-ToolbarButton' or similar, or assume it's the download icon
        // We'll try a generic accessible role first
        await page.getByRole('button', { name: 'Download' }).click();
        await page.waitForTimeout(2000);

        // In the download dialog, select "Crosstab"
        console.log('   Selecting "Crosstab"...');
        await page.getByText('Crosstab').click();
        await page.waitForTimeout(2000);

        // In Crosstab dialog, we might need to select the sheet "Data Table"
        // and format "CSV"
        console.log('   Configuring export options...');

        // Check if there's a sheet selector. If "Data Table" is already active, it might be pre-selected.
        // Ensure "CSV" is selected
        const csvOption = page.getByText('CSV');
        if (await csvOption.isVisible()) {
            await csvOption.click();
        }

        // Click the final "Download" button in the dialog
        console.log('   Confirming download...');
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download', exact: true }).click();

        const download = await downloadPromise;
        const recommendedFilename = download.suggestedFilename();
        const savePath = path.join(DOWNLOAD_DIR, `redfin_rental_full_${new Date().toISOString().split('T')[0]}.csv`);

        console.log(`   ✅ Download started: ${recommendedFilename}`);
        await download.saveAs(savePath);
        console.log(`   💾 Saved to: ${savePath}`);

    } catch (error) {
        console.error('❌ Error during download process:', error);

        // Take a screenshot for debugging
        const errorScreenshot = path.join(DOWNLOAD_DIR, 'error_screenshot.png');
        await page.screenshot({ path: errorScreenshot });
        console.log(`   📸 Error screenshot saved to: ${errorScreenshot}`);

    } finally {
        console.log('👋 Closing browser...');
        await browser.close();
    }
}

downloadTableauData().catch(console.error);
