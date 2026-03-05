-- Upgrades all currently registered users to the Rebel Plan for free

INSERT INTO public.subscriptions (user_id, plan_tier, emails_sent_this_cycle, cycle_start_date, updated_at)
SELECT 
    id AS user_id, 
    'rebel_plan' AS plan_tier, 
    0 AS emails_sent_this_cycle, 
    now() AS cycle_start_date, 
    now() AS updated_at
FROM auth.users
ON CONFLICT (user_id) 
DO UPDATE SET 
    plan_tier = 'rebel_plan',
    updated_at = EXCLUDED.updated_at;
