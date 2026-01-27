-- Seed file for Content Planning
-- Creates test users for each role for local development
-- All users have the same password: password123

-- ============================================
-- USERS
-- ============================================

-- Admin user (admin@hearingtracker.com / password123)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  role, aud, confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, reauthentication_token,
  is_sso_user, is_anonymous
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'admin@hearingtracker.com',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"full_name": "Admin User"}'::jsonb,
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  now(), now(), 'authenticated', 'authenticated',
  '', '', '', '', '', '', false, false
);

INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'admin@hearingtracker.com',
  'email',
  '{"sub": "00000000-0000-0000-0000-000000000001", "email": "admin@hearingtracker.com", "email_verified": true, "phone_verified": false}'::jsonb,
  now(), now(), now()
);

-- Editor user (editor@hearingtracker.com / password123)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  role, aud, confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, reauthentication_token,
  is_sso_user, is_anonymous
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'editor@hearingtracker.com',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"full_name": "Editor User"}'::jsonb,
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  now(), now(), 'authenticated', 'authenticated',
  '', '', '', '', '', '', false, false
);

INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  'editor@hearingtracker.com',
  'email',
  '{"sub": "00000000-0000-0000-0000-000000000002", "email": "editor@hearingtracker.com", "email_verified": true, "phone_verified": false}'::jsonb,
  now(), now(), now()
);

-- Author user (author@hearingtracker.com / password123)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  role, aud, confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, reauthentication_token,
  is_sso_user, is_anonymous
) VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'author@hearingtracker.com',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"full_name": "Author User"}'::jsonb,
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  now(), now(), 'authenticated', 'authenticated',
  '', '', '', '', '', '', false, false
);

INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000003',
  'author@hearingtracker.com',
  'email',
  '{"sub": "00000000-0000-0000-0000-000000000003", "email": "author@hearingtracker.com", "email_verified": true, "phone_verified": false}'::jsonb,
  now(), now(), now()
);

-- ============================================
-- USER ROLES
-- (Trigger auto-creates roles, so we update to correct values)
-- ============================================

UPDATE public.user_roles SET role = 'admin' WHERE user_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.user_roles SET role = 'editor' WHERE user_id = '00000000-0000-0000-0000-000000000002';
UPDATE public.user_roles SET role = 'author' WHERE user_id = '00000000-0000-0000-0000-000000000003';
