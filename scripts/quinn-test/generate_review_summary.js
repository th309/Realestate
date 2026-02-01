
const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, 'deepseek-full-run.json');
const outputPath = path.join(__dirname, 'review_summary.md');

try {
    const data = fs.readFileSync(jsonPath, 'utf8');
    const results = JSON.parse(data);

    let mdContent = '# Quinn Test Results Review\n\n';
    mdContent += `**Total Tests:** ${results.length}\n`;

    const passed = results.filter(r => r.success).length;
    mdContent += `**Passed:** ${passed}\n`;
    mdContent += `**Failed:** ${results.length - passed}\n\n`;

    results.forEach((result, index) => {
        mdContent += `## ${index + 1}. ${result.prompt}\n\n`;

        if (result.success) {
            mdContent += `**Status:** ✅ PASS (${result.durationMs}ms)\n`;
            mdContent += `**Tools Used:** ${result.toolsUsed.join(', ') || 'None'}\n\n`;
            mdContent += `**Response:**\n> ${result.responseText.replace(/\n/g, '\n> ')}\n\n`;

            if (result.structuredData) {
                // summarize structured data if present
                const keys = Object.keys(result.structuredData);
                mdContent += `**Structured Data:** Present (${keys.join(', ')})\n`;
                if (result.structuredData.rankings) {
                    mdContent += `- Rankings: ${result.structuredData.rankings.title} (${result.structuredData.rankings.items.length} items)\n`;
                }
            }
        } else {
            mdContent += `**Status:** ❌ FAIL\n`;
            mdContent += `**Error:** ${result.error || 'Unknown error'}\n`;
        }

        mdContent += '\n---\n\n';
    });

    fs.writeFileSync(outputPath, mdContent);
    console.log(`Successfully generated review summary at ${outputPath}`);

} catch (err) {
    console.error('Error generating summary:', err);
}
