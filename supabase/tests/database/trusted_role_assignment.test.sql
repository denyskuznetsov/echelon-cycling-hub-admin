BEGIN;

SELECT plan(9);

CREATE OR REPLACE FUNCTION pg_temp.become(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated', 'aud', 'authenticated')::text,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.create_auth_user(p_id uuid, p_metadata jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
  ) VALUES (
    p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    p_id::text || '@example.test', 'x', now(), '{"provider":"email","providers":["email"]}',
    p_metadata, now(), now(), false, false
  );
END;
$$;

SELECT pg_temp.create_auth_user(
  '10000000-0000-0000-0000-000000000001',
  '{"first_name":"Pending","last_name":"Invite","role":"admin","partner_id":"forged"}'::jsonb
);

SELECT is(
  (SELECT role FROM public.profiles WHERE id = '10000000-0000-0000-0000-000000000001'),
  NULL::public.user_role,
  'Auth insertion creates a pending profile even with forged admin metadata'
);
SELECT is(
  (SELECT partner_id FROM public.profiles WHERE id = '10000000-0000-0000-0000-000000000001'),
  NULL::uuid,
  'Auth insertion ignores forged partner metadata'
);
SELECT is(
  (SELECT first_name FROM public.profiles WHERE id = '10000000-0000-0000-0000-000000000001'),
  'Pending',
  'safe name metadata is retained'
);

SELECT pg_temp.create_auth_user(
  '10000000-0000-0000-0000-000000000002',
  '{"role":["partner"],"partner_id":false}'::jsonb
);
SELECT is(
  (SELECT role FROM public.profiles WHERE id = '10000000-0000-0000-0000-000000000002'),
  NULL::public.user_role,
  'malformed metadata does not raise an enum cast or grant a role'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.profiles', 'insert,update,delete'),
  'authenticated users have no profile write privilege'
);

UPDATE public.profiles
SET role = 'partner'
WHERE id = '10000000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT role FROM public.profiles WHERE id = '10000000-0000-0000-0000-000000000001'),
  'partner'::public.user_role,
  'trusted dashboard-style assignment activates the intended existing profile'
);

INSERT INTO public.partners (id, name, slug)
VALUES ('20000000-0000-0000-0000-000000000001', 'Trusted test partner', '/trusted-role-test');
UPDATE public.profiles
SET role = NULL, partner_id = '20000000-0000-0000-0000-000000000001'
WHERE id = '10000000-0000-0000-0000-000000000002';

SELECT pg_temp.become('10000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;
SELECT is_empty(
  'SELECT id FROM public.partners WHERE id = ''20000000-0000-0000-0000-000000000001''',
  'a pending profile with an association cannot read partner business data'
);
RESET ROLE;

SELECT pg_temp.become('10000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  'SELECT public.acknowledge_onboarding()',
  '42501',
  'Account pending activation',
  'pending users cannot invoke the onboarding SECURITY DEFINER mutation'
);
RESET ROLE;

SELECT is(
  (SELECT role FROM public.profiles WHERE id = '10000000-0000-0000-0000-000000000001'),
  'partner'::public.user_role,
  'trusted assignment survives later unrelated Auth metadata cases'
);

SELECT * FROM finish();
ROLLBACK;
