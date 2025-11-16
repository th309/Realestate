// Generate Report Edge Function
// Creates market intelligence reports based on GEOIDs

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create } from "https://deno.land/x/pdf@0.2.0/mod.ts";

import {
  GenerateReportRequest,
  GenerateReportResponse,
  MasterMarketIntelligence,
  SubscriberReport,
} from "../_shared/database-types.ts";

import {
  supabaseServiceClient,
  uploadToStorage,
} from "../_shared/supabase-client.ts";

import {
  corsHeaders,
  handleCors,
  jsonResponse,
  errorResponse,
  validateMethod,
  parseJsonBody,
  getAuthenticatedUser,
  logRequest,
  logError,
} from "../_shared/cors.ts";

// Report templates
const REPORT_TEMPLATES = {
  market_analysis: {
    title: 'Market Analysis Report',
    sections: ['overview', 'demographics', 'housing', 'economics', 'trends'],
  },
  comparative: {
    title: 'Comparative Market Report',
    sections: ['overview', 'comparison_table', 'charts', 'insights'],
  },
  trend: {
    title: 'Market Trend Report',
    sections: ['overview', 'historical_trends', 'projections', 'key_indicators'],
  },
  custom: {
    title: 'Custom Market Report',
    sections: ['overview'],
  },
};

// Fetch market data for given GEOIDs
async function fetchMarketData(
  geoids: string[]
): Promise<MasterMarketIntelligence[]> {
  const { data, error } = await supabaseServiceClient
    .from('master_market_intelligence')
    .select('*')
    .in('geoid', geoids);

  if (error) {
    throw new Error(`Failed to fetch market data: ${error.message}`);
  }

  return data || [];
}

// Generate report summary
function generateSummary(
  marketData: MasterMarketIntelligence[],
  reportType: string
): string {
  if (marketData.length === 0) {
    return 'No data available for the selected markets.';
  }

  const avgPopulation = marketData.reduce((sum, d) => sum + (d.population || 0), 0) / marketData.length;
  const avgMedianIncome = marketData.reduce((sum, d) => sum + (d.median_income || 0), 0) / marketData.length;
  const avgHomeValue = marketData.reduce((sum, d) => sum + (d.median_home_value || 0), 0) / marketData.length;

  switch (reportType) {
    case 'market_analysis':
      return `Analysis of ${marketData.length} market(s) with average population of ${Math.round(avgPopulation).toLocaleString()}, median income of $${Math.round(avgMedianIncome).toLocaleString()}, and median home value of $${Math.round(avgHomeValue).toLocaleString()}.`;
    
    case 'comparative':
      return `Comparing ${marketData.length} markets across key metrics including demographics, housing, and economic indicators.`;
    
    case 'trend':
      return `Trend analysis for ${marketData.length} market(s) showing historical patterns and growth projections.`;
    
    default:
      return `Custom report for ${marketData.length} selected market(s).`;
  }
}

// Generate key metrics
function generateKeyMetrics(
  marketData: MasterMarketIntelligence[],
  options: any
): Record<string, any> {
  const metrics: Record<string, any> = {};

  if (options.include_demographics !== false) {
    metrics.demographics = {
      total_population: marketData.reduce((sum, d) => sum + (d.population || 0), 0),
      avg_median_age: marketData.reduce((sum, d) => sum + (d.median_age || 0), 0) / marketData.length,
      avg_college_educated: marketData.reduce((sum, d) => sum + (d.college_educated_pct || 0), 0) / marketData.length,
    };
  }

  if (options.include_housing !== false) {
    metrics.housing = {
      avg_median_home_value: marketData.reduce((sum, d) => sum + (d.median_home_value || 0), 0) / marketData.length,
      avg_median_rent: marketData.reduce((sum, d) => sum + (d.median_rent || 0), 0) / marketData.length,
      avg_owner_occupied: marketData.reduce((sum, d) => sum + (d.owner_occupied_pct || 0), 0) / marketData.length,
      avg_vacancy_rate: marketData.reduce((sum, d) => sum + (d.vacancy_rate || 0), 0) / marketData.length,
    };
  }

  if (options.include_economics !== false) {
    metrics.economics = {
      avg_median_income: marketData.reduce((sum, d) => sum + (d.median_income || 0), 0) / marketData.length,
      avg_unemployment: marketData.reduce((sum, d) => sum + (d.unemployment_rate || 0), 0) / marketData.length,
      avg_poverty_rate: marketData.reduce((sum, d) => sum + (d.poverty_rate || 0), 0) / marketData.length,
    };
  }

  if (options.include_trends !== false) {
    metrics.trends = {
      avg_population_growth_1yr: marketData.reduce((sum, d) => sum + (d.population_growth_1yr || 0), 0) / marketData.length,
      avg_population_growth_5yr: marketData.reduce((sum, d) => sum + (d.population_growth_5yr || 0), 0) / marketData.length,
      avg_home_value_growth_1yr: marketData.reduce((sum, d) => sum + (d.home_value_growth_1yr || 0), 0) / marketData.length,
      avg_home_value_growth_5yr: marketData.reduce((sum, d) => sum + (d.home_value_growth_5yr || 0), 0) / marketData.length,
    };
  }

  return metrics;
}

// Generate full report data
function generateFullReport(
  marketData: MasterMarketIntelligence[],
  reportType: string,
  options: any
): Record<string, any> {
  const template = REPORT_TEMPLATES[reportType] || REPORT_TEMPLATES.custom;
  
  const report: Record<string, any> = {
    metadata: {
      generated_at: new Date().toISOString(),
      report_type: reportType,
      market_count: marketData.length,
      options,
    },
    title: template.title,
    sections: {},
  };

  // Generate sections based on template
  for (const section of template.sections) {
    switch (section) {
      case 'overview':
        report.sections.overview = {
          markets: marketData.map(m => ({
            geoid: m.geoid,
            name: m.geography_name,
            state: m.state_code,
            county: m.county_name,
            cbsa: m.cbsa_name,
          })),
          summary: generateSummary(marketData, reportType),
          key_metrics: generateKeyMetrics(marketData, options),
        };
        break;

      case 'demographics':
        report.sections.demographics = marketData.map(m => ({
          geoid: m.geoid,
          name: m.geography_name,
          population: m.population,
          households: m.households,
          median_age: m.median_age,
          college_educated_pct: m.college_educated_pct,
          population_growth_1yr: m.population_growth_1yr,
          population_growth_5yr: m.population_growth_5yr,
        }));
        break;

      case 'housing':
        report.sections.housing = marketData.map(m => ({
          geoid: m.geoid,
          name: m.geography_name,
          median_home_value: m.median_home_value,
          median_rent: m.median_rent,
          owner_occupied_pct: m.owner_occupied_pct,
          renter_occupied_pct: m.renter_occupied_pct,
          vacancy_rate: m.vacancy_rate,
          home_value_growth_1yr: m.home_value_growth_1yr,
          home_value_growth_5yr: m.home_value_growth_5yr,
          rent_growth_1yr: m.rent_growth_1yr,
          rent_growth_5yr: m.rent_growth_5yr,
        }));
        break;

      case 'economics':
        report.sections.economics = marketData.map(m => ({
          geoid: m.geoid,
          name: m.geography_name,
          median_income: m.median_income,
          unemployment_rate: m.unemployment_rate,
          poverty_rate: m.poverty_rate,
          employment_growth_1yr: m.employment_growth_1yr,
          employment_growth_5yr: m.employment_growth_5yr,
        }));
        break;

      case 'trends':
        report.sections.trends = {
          population: marketData.map(m => ({
            geoid: m.geoid,
            name: m.geography_name,
            growth_1yr: m.population_growth_1yr,
            growth_5yr: m.population_growth_5yr,
          })),
          home_values: marketData.map(m => ({
            geoid: m.geoid,
            name: m.geography_name,
            growth_1yr: m.home_value_growth_1yr,
            growth_5yr: m.home_value_growth_5yr,
          })),
          rent: marketData.map(m => ({
            geoid: m.geoid,
            name: m.geography_name,
            growth_1yr: m.rent_growth_1yr,
            growth_5yr: m.rent_growth_5yr,
          })),
          employment: marketData.map(m => ({
            geoid: m.geoid,
            name: m.geography_name,
            growth_1yr: m.employment_growth_1yr,
            growth_5yr: m.employment_growth_5yr,
          })),
        };
        break;

      case 'comparison_table':
        report.sections.comparison_table = {
          headers: ['Market', 'Population', 'Median Income', 'Median Home Value', 'Unemployment', 'Growth (5yr)'],
          rows: marketData.map(m => [
            m.geography_name,
            m.population?.toLocaleString() || 'N/A',
            m.median_income ? `$${m.median_income.toLocaleString()}` : 'N/A',
            m.median_home_value ? `$${m.median_home_value.toLocaleString()}` : 'N/A',
            m.unemployment_rate ? `${m.unemployment_rate.toFixed(1)}%` : 'N/A',
            m.population_growth_5yr ? `${m.population_growth_5yr.toFixed(1)}%` : 'N/A',
          ]),
        };
        break;

      case 'charts':
        // Chart data for visualization
        report.sections.charts = {
          population_chart: {
            type: 'bar',
            labels: marketData.map(m => m.geography_name),
            data: marketData.map(m => m.population || 0),
          },
          income_chart: {
            type: 'bar',
            labels: marketData.map(m => m.geography_name),
            data: marketData.map(m => m.median_income || 0),
          },
          growth_chart: {
            type: 'line',
            labels: marketData.map(m => m.geography_name),
            datasets: [
              {
                label: 'Population Growth (5yr)',
                data: marketData.map(m => m.population_growth_5yr || 0),
              },
              {
                label: 'Home Value Growth (5yr)',
                data: marketData.map(m => m.home_value_growth_5yr || 0),
              },
            ],
          },
        };
        break;

      case 'insights':
        // Generate insights based on data
        const insights = [];
        
        // Find best performing market
        const bestGrowth = marketData.reduce((best, m) => 
          (m.population_growth_5yr || 0) > (best.population_growth_5yr || 0) ? m : best
        );
        if (bestGrowth.population_growth_5yr) {
          insights.push(`${bestGrowth.geography_name} shows the highest population growth at ${bestGrowth.population_growth_5yr.toFixed(1)}% over 5 years.`);
        }
        
        // Find most affordable market
        const mostAffordable = marketData.reduce((best, m) => 
          (m.median_home_value || Infinity) < (best.median_home_value || Infinity) ? m : best
        );
        if (mostAffordable.median_home_value) {
          insights.push(`${mostAffordable.geography_name} is the most affordable market with median home value of $${mostAffordable.median_home_value.toLocaleString()}.`);
        }
        
        // Find highest income market
        const highestIncome = marketData.reduce((best, m) => 
          (m.median_income || 0) > (best.median_income || 0) ? m : best
        );
        if (highestIncome.median_income) {
          insights.push(`${highestIncome.geography_name} has the highest median income at $${highestIncome.median_income.toLocaleString()}.`);
        }
        
        report.sections.insights = insights;
        break;
    }
  }

  return report;
}

// Generate PDF report (simplified version)
async function generatePDF(
  reportData: Record<string, any>
): Promise<Uint8Array> {
  // Note: This is a simplified PDF generation
  // In production, you might want to use a more sophisticated PDF library
  
  const pdfContent = `
${reportData.title}
Generated: ${new Date().toLocaleDateString()}

${reportData.sections.overview?.summary || ''}

Key Metrics:
${JSON.stringify(reportData.sections.overview?.key_metrics, null, 2)}

Markets Analyzed:
${reportData.sections.overview?.markets?.map((m: any) => `- ${m.name}, ${m.state}`).join('\n') || ''}
  `;

  // Convert to Uint8Array
  const encoder = new TextEncoder();
  return encoder.encode(pdfContent);
}

// Generate Excel report (CSV format as simplified version)
function generateExcel(
  reportData: Record<string, any>
): string {
  const rows = [];
  
  // Headers
  rows.push(['Market Report', reportData.title]);
  rows.push(['Generated', new Date().toISOString()]);
  rows.push([]);
  
  // Add comparison table if available
  if (reportData.sections.comparison_table) {
    rows.push(reportData.sections.comparison_table.headers);
    rows.push(...reportData.sections.comparison_table.rows);
  }
  
  // Convert to CSV
  return rows.map(row => row.map(cell => 
    typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
  ).join(',')).join('\n');
}

// Main handler
serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Validate method
  const methodError = validateMethod(req, ['POST']);
  if (methodError) return methodError;

  // Log request
  logRequest(req);

  try {
    // Authenticate user
    const { user, error: authError } = await getAuthenticatedUser(req, supabaseServiceClient);
    if (authError) return authError;

    // Parse request body
    const { data: body, error: parseError } = await parseJsonBody<GenerateReportRequest>(req);
    if (parseError) return parseError;

    // Validate request
    if (!body?.report_type) {
      return errorResponse('Missing required field: report_type');
    }

    if (!body?.geoids || !Array.isArray(body.geoids) || body.geoids.length === 0) {
      return errorResponse('Missing or empty geoids array');
    }

    if (body.geoids.length > 100) {
      return errorResponse('Too many GEOIDs. Maximum 100 allowed per report');
    }

    // Validate report type
    const validTypes = ['market_analysis', 'comparative', 'trend', 'custom'];
    if (!validTypes.includes(body.report_type)) {
      return errorResponse(`Invalid report type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Fetch market data
    console.log(`Fetching data for ${body.geoids.length} GEOIDs`);
    const marketData = await fetchMarketData(body.geoids);
    
    if (marketData.length === 0) {
      return errorResponse('No data found for the provided GEOIDs', 404);
    }

    console.log(`Found data for ${marketData.length} markets`);

    // Generate report
    const fullReport = generateFullReport(
      marketData,
      body.report_type,
      body.options || {}
    );

    // Generate report name
    const reportName = `${body.report_type}_${Date.now()}`;

    // Generate file based on format
    let downloadUrl: string | undefined;
    const format = body.options?.format || 'json';

    if (format === 'pdf') {
      const pdfData = await generatePDF(fullReport);
      const path = await uploadToStorage(
        'reports',
        `${user.id}/${reportName}.pdf`,
        new Blob([pdfData]),
        'application/pdf'
      );
      
      const { data: urlData } = supabaseServiceClient.storage
        .from('reports')
        .getPublicUrl(path);
      
      downloadUrl = urlData?.publicUrl;
    } else if (format === 'excel') {
      const csvData = generateExcel(fullReport);
      const path = await uploadToStorage(
        'reports',
        `${user.id}/${reportName}.csv`,
        new Blob([csvData]),
        'text/csv'
      );
      
      const { data: urlData } = supabaseServiceClient.storage
        .from('reports')
        .getPublicUrl(path);
      
      downloadUrl = urlData?.publicUrl;
    }

    // Save report to database
    const reportRecord: Partial<SubscriberReport> = {
      user_id: user.id,
      report_name: reportName,
      report_type: body.report_type,
      full_data: fullReport,
    };

    const { data: savedReport, error: saveError } = await supabaseServiceClient
      .from('subscriber_reports')
      .insert(reportRecord)
      .select('id')
      .single();

    if (saveError) {
      console.error('Failed to save report:', saveError);
      // Continue anyway - report is generated
    }

    // Generate preview
    const preview = {
      title: fullReport.title,
      summary: fullReport.sections.overview?.summary || '',
      key_metrics: fullReport.sections.overview?.key_metrics || {},
    };

    // Return response
    const response: GenerateReportResponse = {
      report_id: savedReport?.id || reportName,
      preview,
      download_url: downloadUrl,
    };

    return jsonResponse(response);

  } catch (error) {
    logError(error, { function: 'generate-report' });
    
    return errorResponse(
      'Internal server error',
      500,
      { error: error.message }
    );
  }
});
