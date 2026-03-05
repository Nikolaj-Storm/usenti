require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
    process.exit(1);
}

// We MUST use the service_role key to access auth.admin
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function upgradeUsers() {
    console.log('Fetching all users...');

    // Get all users from Supabase Auth
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
        console.error('Error fetching users:', authError);
        return;
    }

    if (!users || users.length === 0) {
        console.log('No users found in the database.');
        return;
    }

    console.log(`Found ${users.length} existing users. Upgrading them to rebel_plan...`);

    let successCount = 0;
    for (const user of users) {
        const { error: upsertError } = await supabase
            .from('subscriptions')
            .upsert({
                user_id: user.id,
                plan_tier: 'rebel_plan',
                emails_sent_this_cycle: 0,
                cycle_start_date: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (upsertError) {
            console.error(`Failed to upgrade user ${user.id}:`, upsertError);
        } else {
            successCount++;
        }
    }

    console.log(`Successfully upgraded ${successCount}/${users.length} users to the Rebel Plan.`);
}

upgradeUsers();
