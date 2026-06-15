-- ============================================================================
-- 0004_signup_link_only.sql — harden new-user handling
--
-- A new auth user is now linked ONLY to a pre-provisioned profile (matched by
-- email). Self-signups with no matching profile get NO profile row, so every
-- profile-scoped RLS policy denies them — they can see and do nothing. This is
-- defense-in-depth alongside disabling public sign-ups in the dashboard:
-- access is invite-only (an admin creates the profile first).
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set user_id = new.id,
         updated_at = now()
   where user_id is null
     and lower(email) = lower(coalesce(new.email, ''));
  return new;
end;
$$;
