-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.merchants (
  id bigint NOT NULL DEFAULT nextval('merchants_id_seq'::regclass),
  owner_user_id bigint NOT NULL,
  name text NOT NULL,
  legal_name text,
  vat_number text,
  stripe_customer_id text,
  logo_url text,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  balance_cents integer NOT NULL DEFAULT 0,
  subscription_status text NOT NULL DEFAULT 'inactive'::text CHECK (subscription_status = ANY (ARRAY['active'::text, 'trialing'::text, 'past_due'::text, 'canceled'::text, 'inactive'::text])),
  subscription_valid_until timestamp with time zone,
  last_payment_at timestamp with time zone,
  subscription_id text,
  street text,
  city text,
  postal_code text,
  country text,
  CONSTRAINT merchants_pkey PRIMARY KEY (id),
  CONSTRAINT merchants_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id)
);

CREATE TABLE public.offer_claims (
  id bigint NOT NULL DEFAULT nextval('offer_claims_id_seq'::regclass),
  offer_id bigint NOT NULL,
  student_id bigint NOT NULL,
  status text NOT NULL DEFAULT 'activated'::text CHECK (status = ANY (ARRAY['activated'::text, 'proof_uploaded'::text, 'validated'::text, 'expired'::text, 'canceled'::text])),
  proof_image_url text,
  proof_verified boolean,
  qr_code text UNIQUE,
  qr_expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT offer_claims_pkey PRIMARY KEY (id),
  CONSTRAINT offer_claims_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers(id),
  CONSTRAINT offer_claims_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id)
);

CREATE TABLE public.offers (
  id bigint NOT NULL DEFAULT nextval('offers_id_seq'::regclass),
  merchant_id bigint NOT NULL,
  title text NOT NULL,
  description text,
  discount_type text NOT NULL CHECK (discount_type = ANY (ARRAY['percent'::text, 'coupon'::text])),
  discount_value integer NOT NULL,
  min_followers integer NOT NULL DEFAULT 0,
  start_at timestamp with time zone,
  end_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted boolean NOT NULL DEFAULT false,
  CONSTRAINT offers_pkey PRIMARY KEY (id),
  CONSTRAINT offers_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id)
);

CREATE TABLE public.redemptions (
  id bigint NOT NULL DEFAULT nextval('redemptions_id_seq'::regclass),
  claim_id bigint NOT NULL UNIQUE,
  redeemed_by_user_id bigint,
  redeemed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT redemptions_pkey PRIMARY KEY (id),
  CONSTRAINT redemptions_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.offer_claims(id),
  CONSTRAINT redemptions_redeemed_by_user_id_fkey FOREIGN KEY (redeemed_by_user_id) REFERENCES public.users(id)
);

CREATE TABLE public.reports (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  reporter_id bigint NOT NULL,
  reported_user_id bigint,
  reported_merchant_id bigint,
  reported_offer_id bigint,
  reported_claim_id bigint,
  category text NOT NULL CHECK (category = ANY (ARRAY['fraud'::text, 'spam'::text, 'inappropriate'::text, 'fake_profile'::text, 'other'::text])),
  description text,
  screenshot_url text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'in_review'::text, 'resolved'::text, 'rejected'::text])),
  reviewed_by bigint,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reports_pkey PRIMARY KEY (id),
  CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id),
  CONSTRAINT reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES public.users(id),
  CONSTRAINT reports_reported_merchant_id_fkey FOREIGN KEY (reported_merchant_id) REFERENCES public.merchants(id),
  CONSTRAINT reports_reported_offer_id_fkey FOREIGN KEY (reported_offer_id) REFERENCES public.offers(id),
  CONSTRAINT reports_reported_claim_id_fkey FOREIGN KEY (reported_claim_id) REFERENCES public.offer_claims(id),
  CONSTRAINT reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id)
);

CREATE TABLE public.student_profiles (
  user_id bigint NOT NULL,
  instagram_handle text NOT NULL UNIQUE,
  followers_count integer NOT NULL DEFAULT 0,
  verified_followers_count integer,
  last_verified_at timestamp with time zone,
  needs_human_verification boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT student_profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT student_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

CREATE TABLE public.users (
  id bigint NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  email text NOT NULL UNIQUE,
  password_hash text,
  role text NOT NULL CHECK (role = ANY (ARRAY['student'::text, 'merchant'::text, 'admin'::text])),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  auth_user_id uuid,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.verifications (
  id bigint NOT NULL DEFAULT nextval('verifications_id_seq'::regclass),
  user_id bigint NOT NULL,
  screenshot_url text,
  exif_created_at timestamp with time zone,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  freshness_ok boolean,
  self_owned_ui_ok boolean,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'auto_passed'::text, 'reviewed'::text, 'rejected'::text])),
  reviewed_by bigint,
  reviewed_at timestamp with time zone,
  CONSTRAINT verifications_pkey PRIMARY KEY (id),
  CONSTRAINT verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT verifications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id)
);

-- Function to get current user ID from auth
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid();
$$;

-- Enable RLS
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Merchants select own offers" ON public.offers;
DROP POLICY IF EXISTS "Merchants update own offers" ON public.offers;
DROP POLICY IF EXISTS "Merchants insert own offers" ON public.offers;
DROP POLICY IF EXISTS "Students see active offers" ON public.offers;

-- Policy 1: merchants can select their own offers (only non-deleted)
CREATE POLICY "Merchants select own offers"
ON public.offers
FOR SELECT
TO authenticated
USING (
  merchant_id IN (
    SELECT id FROM public.merchants
    WHERE owner_user_id = current_user_id()
  )
  AND deleted = false
);

-- Policy 2: merchants can update their own offers
-- (including title, description, and deleted flag)
CREATE POLICY "Merchants update own offers"
ON public.offers
FOR UPDATE
TO authenticated
USING (
  merchant_id IN (
    SELECT id FROM public.merchants
    WHERE owner_user_id = current_user_id()
  )
)
WITH CHECK (
  merchant_id IN (
    SELECT id FROM public.merchants
    WHERE owner_user_id = current_user_id()
  )
);

-- Policy 3: merchants can insert new offers
-- (including title and description, must belong to their own merchant_id, deleted must start false)
CREATE POLICY "Merchants insert own offers"
ON public.offers
FOR INSERT
TO authenticated
WITH CHECK (
  merchant_id IN (
    SELECT id FROM public.merchants
    WHERE owner_user_id = current_user_id()
  )
  AND deleted = false
);

-- Policy 4: students/other users can only see active & non-deleted offers
CREATE POLICY "Students see active offers"
ON public.offers
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND deleted = false
  AND start_at <= now()
  AND (end_at IS NULL OR end_at > now())
  AND merchant_id IN (
    SELECT id FROM public.merchants WHERE is_visible = true
  )
);