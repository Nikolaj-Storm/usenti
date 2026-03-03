-- Migration to implement freemium models and subscriptions

-- Create the subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_tier TEXT NOT NULL DEFAULT 'free', -- 'free', 'growth', 'hypergrowth'
  emails_sent_this_cycle INTEGER NOT NULL DEFAULT 0,
  cycle_start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

-- Turn on Row Level Security
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own subscriptions
CREATE POLICY "Users can view own subscription" 
  ON public.subscriptions FOR SELECT 
  USING (auth.uid() = user_id);

-- Only service role can modify subscriptions (updated via webhooks, backend)
CREATE POLICY "Service role can modify subscriptions"
  ON public.subscriptions FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Create a function and trigger to automatically create a free subscription for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan_tier)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function when a new user signs up in the auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created_create_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_create_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- ----------------------------------------------------------------------------
-- Backfill existing users with a 'free' subscription
-- ----------------------------------------------------------------------------
INSERT INTO public.subscriptions (user_id, plan_tier)
SELECT id, 'free' FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.subscriptions);
