-- Migration to add invite codes and plan expiration

CREATE TABLE IF NOT EXISTS public.invite_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT false,
    used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own used codes (optional, but good for history)
CREATE POLICY "Users can view codes they used" 
    ON public.invite_codes FOR SELECT 
    USING (auth.uid() = used_by);

-- Service role has full access
CREATE POLICY "Service role can manage invite codes"
    ON public.invite_codes FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Allow public to select by code to verify validity
CREATE POLICY "Public can verify unused codes"
    ON public.invite_codes FOR SELECT
    USING (is_used = false);

-- Update subscriptions table
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP WITH TIME ZONE;

-- Insert 50 generated codes
INSERT INTO public.invite_codes (code) VALUES
    ('8A094261'),
    ('1A6591B5'),
    ('E91CAAC2'),
    ('0D4523D4'),
    ('3C04A2FF'),
    ('13D95199'),
    ('6355FA3B'),
    ('0E03E513'),
    ('AB2AAF51'),
    ('01D61419'),
    ('14F639A7'),
    ('5F04D5EA'),
    ('AB4FB95E'),
    ('D3D85886'),
    ('1E2D69C8'),
    ('7FD8EAC9'),
    ('E2631220'),
    ('1DC229AB'),
    ('71C63177'),
    ('CCC41184'),
    ('4795FAE9'),
    ('81605FAA'),
    ('889A1508'),
    ('EE912C95'),
    ('4342DA0A'),
    ('275BAFA4'),
    ('04B8E6AB'),
    ('7819BB0D'),
    ('7CC982F8'),
    ('AA083888'),
    ('38F39008'),
    ('BE382234'),
    ('D04BD83F'),
    ('65583867'),
    ('4E89EAF1'),
    ('40DC8234'),
    ('9DF09209'),
    ('6C76CC4C'),
    ('7C2E1556'),
    ('70C3E1C7'),
    ('73F640B5'),
    ('0A9AF97A'),
    ('6F858235'),
    ('C56C8539'),
    ('0C9118B6'),
    ('2911248F'),
    ('D8F15F37'),
    ('7162765C'),
    ('3188A5E4'),
    ('77962D97');

