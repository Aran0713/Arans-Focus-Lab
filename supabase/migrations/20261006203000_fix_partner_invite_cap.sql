-- Keep the dedicated invite-link RPC aligned with the five-partner product limit.

create or replace function public.create_partner_invite()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  u uuid:=auth.uid();
  inv public.partner_invites;
  connected integer;
  pending integer;
begin
  if u is null then raise exception 'Please sign in.'; end if;

  connected:=private.partner_count(u);
  if connected>=5 then
    raise exception 'You already have five focus partners.';
  end if;

  select count(*)::integer into pending
  from public.partner_invites i
  where i.inviter_id=u
    and i.accepted_at is null
    and i.expires_at>clock_timestamp();

  if pending >= 5-connected then
    raise exception 'You already have enough active invitation links for your remaining partner spots.';
  end if;

  insert into public.partner_invites(inviter_id)
  values(u)
  returning * into inv;

  return jsonb_build_object('token',inv.token,'expires_at',inv.expires_at);
end
$function$;
