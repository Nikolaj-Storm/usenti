require('dotenv').config();
const supabase = require('./config/supabase');

async function checkAccounts() {
    console.log("Checking email accounts...");
    const { data, error } = await supabase.from('email_accounts').select('*');
    if (error) {
        console.error("Error fetching accounts:", error);
    } else {
        console.log(`Found ${data.length} accounts`);
        data.forEach(acc => {
            console.log(`- ID: ${acc.id}, Email: ${acc.email_address}, User: ${acc.user_id}, Provider: ${acc.provider_type}`);
        });
    }
}

checkAccounts();
