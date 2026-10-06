-- Expand Focus Lab from three trusted partners / four-person rooms
-- to five trusted partners / six-person rooms.

do $$
declare
  fn text;
  original text;
begin
  select pg_get_functiondef('private.lab_command(text,jsonb,uuid)'::regprocedure) into fn;
  original := fn;

  if position('if private.partner_count(u)>=3 then raise exception ''You already have three focus partners.''; end if;' in fn)=0 then
    raise exception 'Expected partner invite limit was not found.';
  end if;
  fn := replace(
    fn,
    'if private.partner_count(u)>=3 then raise exception ''You already have three focus partners.''; end if;',
    'if private.partner_count(u)>=5 then raise exception ''You already have five focus partners.''; end if;'
  );

  if position('if private.partner_count(u)>=3 or private.partner_count(inv.inviter_id)>=3 then raise exception ''One of you already has three focus partners.''; end if;' in fn)=0 then
    raise exception 'Expected partner acceptance limit was not found.';
  end if;
  fn := replace(
    fn,
    'if private.partner_count(u)>=3 or private.partner_count(inv.inviter_id)>=3 then raise exception ''One of you already has three focus partners.''; end if;',
    'if private.partner_count(u)>=5 or private.partner_count(inv.inviter_id)>=5 then raise exception ''One of you already has five focus partners.''; end if;'
  );

  if position('if target_count<1 or target_count>3 then raise exception ''Choose one to three focus partners.''; end if;' in fn)=0 then
    raise exception 'Expected shared-room partner limit was not found.';
  end if;
  fn := replace(
    fn,
    'if target_count<1 or target_count>3 then raise exception ''Choose one to three focus partners.''; end if;',
    'if target_count<1 or target_count>5 then raise exception ''Choose one to five focus partners.''; end if;'
  );

  if fn=original then
    raise exception 'No room-capacity changes were applied.';
  end if;

  execute fn;
end
$$;
