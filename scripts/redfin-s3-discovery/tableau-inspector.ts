/**
 * Tableau Dashboard Inspector
 */

import type { TableauInfo } from './types';

/**
 * Inspect Tableau iframe for download options
 */
export async function inspectTableauDashboard(page: any): Promise<void> {
  console.log('\nChecking Redfin Data Center for Tableau dashboard download options...\n');

  try {
    await page.goto('https://www.redfin.com/news/data-center/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 10000));

    const iframes = await page.$$('iframe');
    let tableauFrame = null;

    for (const iframe of iframes) {
      const src = await iframe.evaluate((el: HTMLIFrameElement) => el.src);
      if (src && (src.includes('tableau') || src.includes('public.tableau.com'))) {
        console.log(`  Found Tableau iframe: ${src}`);
        tableauFrame = iframe;
        break;
      }
    }

    let tableauInfo: TableauInfo | null = null;

    if (tableauFrame) {
      const frame = await tableauFrame.contentFrame();
      if (frame) {
        tableauInfo = await frame.evaluate(extractTableauInfo);
      }
    }

    if (!tableauInfo) {
      tableauInfo = await page.evaluate(() => ({
        hasTableau: false,
        downloadButtons: [],
        metrics: [],
        geographicLevels: [],
        allButtons: []
      }));
    }

    logTableauInfo(tableauInfo);

    if (tableauFrame && tableauInfo?.downloadButtons?.length > 0) {
      await tryTableauDownload(tableauFrame, tableauInfo);
    }

  } catch (error: any) {
    console.warn(`  Error checking Tableau dashboard: ${error.message}`);
  }
}

/**
 * Extract info from Tableau iframe content
 */
function extractTableauInfo(): TableauInfo {
  const info: TableauInfo = {
    hasTableau: true,
    downloadButtons: [],
    metrics: [],
    geographicLevels: [],
    allButtons: []
  };

  const allButtons = document.querySelectorAll(
    'button, a, [role="button"], [class*="icon"], svg, [class*="toolbar"]'
  );

  allButtons.forEach((btn, index) => {
    const text = btn.textContent?.trim() || '';
    const ariaLabel = (btn as HTMLElement).getAttribute('aria-label') || '';
    const title = (btn as HTMLElement).getAttribute('title') || '';
    const className = btn.className || '';
    const classList = Array.from(btn.classList || []).join(' ');

    const rect = btn.getBoundingClientRect();
    const position = `x:${Math.round(rect.left)}, y:${Math.round(rect.top)}, width:${Math.round(rect.width)}, height:${Math.round(rect.height)}`;

    if (rect.width > 0 && rect.height > 0) {
      info.allButtons.push({
        text: text || ariaLabel || title || `Button ${index}`,
        position
      });
    }

    const downloadKeywords = ['download', 'export', 'data', 'csv', 'excel', 'tsv', 'save'];
    const hasDownloadKeyword = downloadKeywords.some(kw =>
      text.toLowerCase().includes(kw) ||
      ariaLabel.toLowerCase().includes(kw) ||
      title.toLowerCase().includes(kw) ||
      className.toLowerCase().includes(kw) ||
      classList.toLowerCase().includes(kw)
    );

    const isBottomRight = rect.top > window.innerHeight * 0.7 && rect.left > window.innerWidth * 0.7;

    if (hasDownloadKeyword || isBottomRight) {
      info.downloadButtons.push({
        text: text || ariaLabel || title || `Button ${index}`,
        selector: `${btn.tagName.toLowerCase()}${classList ? '.' + classList.split(' ').join('.') : ''}`,
        position,
        classList
      });
    }
  });

  // Look for metric dropdowns
  const selects = document.querySelectorAll(
    'select, [role="combobox"], [class*="metric"], [class*="dropdown"]'
  );

  selects.forEach(select => {
    const options = select.querySelectorAll('option');
    options.forEach(option => {
      const text = option.textContent?.trim();
      if (text && text.length > 0 && text.length < 100) {
        const selectName = (select as HTMLElement).getAttribute('name')?.toLowerCase() || '';
        const selectClass = select.className.toLowerCase();

        if (selectName.includes('metric') || selectClass.includes('metric')) {
          info.metrics.push(text);
        }
        if (selectName.includes('geographic') || selectClass.includes('geographic') || selectClass.includes('region')) {
          info.geographicLevels.push(text);
        }
      }
    });
  });

  return info;
}

/**
 * Log Tableau info to console
 */
function logTableauInfo(tableauInfo: TableauInfo): void {
  if (tableauInfo.hasTableau) {
    console.log(`  Found Tableau dashboard content`);
  }

  if (tableauInfo.allButtons?.length > 0) {
    console.log(`  Found ${tableauInfo.allButtons.length} total interactive elements in Tableau`);
    const bottomRightButtons = tableauInfo.allButtons.filter(btn => {
      const y = parseInt(btn.position.split('y:')[1].split(',')[0]);
      const x = parseInt(btn.position.split('x:')[1].split(',')[0]);
      return y > 400 && x > 800;
    });
    if (bottomRightButtons.length > 0) {
      console.log(`     Bottom-right area buttons (likely download icon):`);
      bottomRightButtons.forEach(btn => {
        console.log(`       - "${btn.text}" at ${btn.position}`);
      });
    }
  }

  if (tableauInfo.downloadButtons?.length > 0) {
    console.log(`  Found ${tableauInfo.downloadButtons.length} potential download button(s):`);
    tableauInfo.downloadButtons.forEach(btn => {
      console.log(`     - "${btn.text}" at position ${btn.position}`);
      console.log(`       Classes: ${btn.classList}`);
    });
  }

  if (tableauInfo.metrics.length > 0) {
    console.log(`  Found ${tableauInfo.metrics.length} available metrics:`);
    tableauInfo.metrics.forEach(metric => {
      console.log(`     - ${metric}`);
    });
  }

  if (tableauInfo.geographicLevels.length > 0) {
    console.log(`  Found ${tableauInfo.geographicLevels.length} geographic levels:`);
    tableauInfo.geographicLevels.forEach(level => {
      console.log(`     - ${level}`);
    });
  }
}

/**
 * Try to interact with Tableau download button
 */
async function tryTableauDownload(tableauFrame: any, tableauInfo: TableauInfo): Promise<void> {
  console.log(`\n  Attempting to interact with download button in iframe...`);

  const frame = await tableauFrame.contentFrame();
  if (!frame) return;

  const bottomRightButton = tableauInfo.downloadButtons.find(btn => {
    const y = parseInt(btn.position.split('y:')[1].split(',')[0]);
    const x = parseInt(btn.position.split('x:')[1].split(',')[0]);
    return y > 400 && x > 800;
  });

  if (!bottomRightButton) return;

  try {
    await frame.evaluate((selector: string) => {
      const btn = document.querySelector(selector);
      if (btn) {
        (btn as HTMLElement).click();
      }
    }, bottomRightButton.selector);

    await new Promise(resolve => setTimeout(resolve, 3000));

    const downloadOptions = await frame.evaluate(() => {
      const options: Array<{ text: string; href?: string }> = [];
      const menus = document.querySelectorAll(
        '[role="menu"], [class*="menu"], [class*="dropdown"], [class*="popup"], [class*="dialog"]'
      );
      menus.forEach((menu: Element) => {
        const items = menu.querySelectorAll('a, button, [role="menuitem"], [role="option"]');
        items.forEach((item: Element) => {
          const text = item.textContent?.trim();
          const href = (item as HTMLAnchorElement).href || '';
          if (text) {
            options.push({ text, href });
          }
        });
      });
      return options;
    });

    if (downloadOptions.length > 0) {
      console.log(`     Found ${downloadOptions.length} download format options:`);
      downloadOptions.forEach(opt => {
        console.log(`        - ${opt.text}${opt.href ? ` (${opt.href.substring(0, 80)})` : ''}`);
      });
    } else {
      console.log(`     Clicked button but no menu appeared (may need different approach)`);
    }
  } catch (error: any) {
    console.log(`     Could not interact with button: ${error.message}`);
  }
}
