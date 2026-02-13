const supabase = require('./config/supabase');

async function debugCampaignSteps() {
    console.log('Fetching recent campaigns...');
    const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('id, name, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching campaigns:', error);
        return;
    }

    for (const campaign of campaigns) {
        console.log(`\nCampaign: ${campaign.name} (${campaign.id})`);
        const { data: steps, error: stepsError } = await supabase
            .from('campaign_steps')
            .select('id, step_type, step_order, branch, parent_id, subject')
            .eq('campaign_id', campaign.id)
            .order('step_order');

        if (stepsError) {
            console.error('Error fetching steps:', stepsError);
            continue;
        }

        steps.forEach(step => {
            const branchInfo = step.branch ? `[Branch: ${step.branch}]` : '';
            const parentInfo = step.parent_id ? `(Parent: ${step.parent_id})` : '';
            console.log(`  Step ${step.step_order}: ${step.step_type} ${branchInfo} ${parentInfo} - ${step.subject || ''}`);
        });
    }
}

debugCampaignSteps();
