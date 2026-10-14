-- Puts the shared tester account on the real team, so testers see the same games, clips,
-- bookmarks and plays as the coaches (team scoping is by profiles.team_id, see 0001).
--
-- Testers don't have individual logins. The sign-in page asks for one "tester code", which
-- the app uses as the password of this single shared account.
--
-- Run this in the Supabase SQL Editor AFTER creating the tester user in the dashboard:
--   Authentication -> Users -> Add user -> Create new user
--     Email:    bantamb@testers.example.com   (must match app/src/auth/testerLogin.ts)
--     Password: the tester code, typed ALL LOWERCASE (e.g. bantamb). The app lowercases
--               whatever testers type, so "BantamB" and "bantamb" both work, but only if
--               the stored password is lowercase.
--     Tick "Auto Confirm User"
-- To change the code later: Authentication -> Users -> the tester user -> reset password.
-- The on_auth_user_created trigger from 0001 creates the profile row automatically; this
-- script only attaches it to the team. No email is ever sent to that address.
--
-- To revoke tester access later: Authentication -> Users -> delete the tester user.
-- Not run by the app or by Claude.

update profiles
set team_id = (select id from teams where join_code = 'BANTAM-B7X2'),  -- change if you changed the join code
    display_name = 'Tester'
where id = (select id from auth.users where email = 'bantamb@testers.example.com');

-- Sanity check: should return one row with a non-null team_id.
select p.id, p.display_name, p.team_id, t.name as team_name
from profiles p
left join teams t on t.id = p.team_id
where p.id = (select id from auth.users where email = 'bantamb@testers.example.com');
