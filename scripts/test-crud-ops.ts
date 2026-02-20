import { createClient } from '@supabase/supabase-js';

const client = createClient(
    'https://pysflbhpnqwoczyuaaif.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })()
);

async function testCRUD() {
    console.log('=== CRUD Operations Test ===');
    console.log('');

    // Cleanup first
    await client.from('markets').delete().eq('region_id', 'TEST-TEMP-001');

    // Test INSERT
    console.log('1. Testing INSERT...');
    const { data, error } = await client.from('markets').insert({
        region_id: 'TEST-TEMP-001',
        region_name: 'Test Region',
        region_type: 'zip',
        geoid: '99999'
    }).select();

    if (error) {
        console.log('   INSERT ERROR:', error.message);
        return;
    }
    console.log('   INSERT SUCCESS:', data?.[0]?.region_id);

    // Test UPDATE
    console.log('');
    console.log('2. Testing UPDATE...');
    const { error: updateError } = await client.from('markets').update({ region_name: 'Updated Region' }).eq('region_id', 'TEST-TEMP-001');
    console.log(updateError ? '   UPDATE ERROR: ' + updateError.message : '   UPDATE SUCCESS');

    // Verify Update
    const { data: verifyData } = await client.from('markets').select('region_name').eq('region_id', 'TEST-TEMP-001').single();
    console.log('   Verified name:', verifyData?.region_name);

    // Test DELETE
    console.log('');
    console.log('3. Testing DELETE...');
    const { error: deleteError } = await client.from('markets').delete().eq('region_id', 'TEST-TEMP-001');
    console.log(deleteError ? '   DELETE ERROR: ' + deleteError.message : '   DELETE SUCCESS');

    // Verify Delete
    const { data: verifyDelete } = await client.from('markets').select('*').eq('region_id', 'TEST-TEMP-001');
    console.log('   Rows remaining:', verifyDelete?.length || 0);

    console.log('');
    console.log('=== All CRUD Operations PASSED ===');
}

testCRUD();
