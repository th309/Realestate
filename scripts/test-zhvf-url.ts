import axios from 'axios';

const urls = [
  'https://files.zillowstatic.com/research/public_csvs/zhvf_growth/Metro_zhvf_growth_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  'https://files.zillowstatic.com/research/public_csvs/zhvf_growth/Zip_zhvf_growth_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  'https://files.zillowstatic.com/research/public_csvs/zhvf_growth/State_zhvf_growth_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  'https://files.zillowstatic.com/research/public_csvs/zhvf_growth/County_zhvf_growth_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
];

async function testUrls() {
  for (const url of urls) {
    console.log(`\nTesting: ${url}`);
    try {
      const response = await axios.head(url, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
        maxRedirects: 5
      });
      console.log(`  Status: ${response.status}`);
      console.log(`  Content-Length: ${response.headers['content-length']}`);
    } catch (error: any) {
      console.log(`  Error: ${error.response?.status || error.message}`);
    }
  }
}

testUrls();
