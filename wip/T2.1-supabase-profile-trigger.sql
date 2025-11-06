-- Creates a trigger function that inserts a new row into the public.profiles table
-- upon creation of a new user in the auth.users table.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public."Profile" (user_id, display_name)
  values (new.id, new.email);
  return new;
end;
$$;

-- Creates a trigger that fires the handle_new_user function
-- after a new user is created.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
