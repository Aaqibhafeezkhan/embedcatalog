-- Owners may change project_id directly only for unpublished (draft/rejected) projects; other links go through moderation.
create or replace function public.guard_standalone_embed_project_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  target_status public.project_status;
  target_owner uuid;
begin
  if new.project_id is not distinct from old.project_id then
    return new;
  end if;

  -- Service role / internal calls and admins (moderation approval) bypass the check.
  if auth.uid() is null
     or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    return new;
  end if;

  target_id := coalesce(new.project_id, old.project_id);
  select status, owner_id into target_status, target_owner
    from public.projects where id = target_id;

  if target_status not in ('draft', 'rejected')
     or target_owner is distinct from auth.uid() then
    raise exception 'Linking to a published or pending project requires moderation'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_standalone_embed_project_link on public.standalone_embeds;
create trigger guard_standalone_embed_project_link
  before update of project_id on public.standalone_embeds
  for each row execute function public.guard_standalone_embed_project_link();
