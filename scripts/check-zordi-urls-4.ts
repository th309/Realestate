
import fetch from 'node-fetch';

const base = 'https://files.zillowstatic.com/research/public_csvs/zordi';
const files = [
    'Metro_zordi_uc_sfrcondomfr_month.csv',
    'Metro_zordi_uc_sfr_month.csv',
    'Metro_zordi_uc_mfr_month.csv',
    'County_zordi_uc_sfrcondomfr_month.csv', // Just to check
    'Zip_zordi_uc_sfrcondomfr_month.csv'     // Just to check
];

async function check() {
    for (const f of files) {
        const url = `${base}/${f}`;
        try {
            const res = await fetch(url, { method: 'HEAD' });
            console.log(`${f}: ${res.status}`);
        } catch (e) {
            console.log(`${f}: Error`);
        }
    }
}
check();
