-- =====================================================================
-- seed.sql: starter data that comes with PopSwap.
-- Safe to run more than once (it skips rows that already exist).
-- Run it after the migrations, in the Supabase SQL Editor.
-- =====================================================================

-- ---- Communities ------------------------------------------------------
insert into public.communities (slug, name, description) values
  ('blind-boxes', 'Blind Boxes',
   'Smiski, Sonny Angels, Pop Mart and every mystery figure in between. Swap your duplicates for the one you''re hunting.'),
  ('enamel-pins', 'Enamel Pins',
   'Artist pins, theme park pins, convention exclusives and more. Trade to complete your pin board or ita bag.'),
  ('keychains', 'Keychains',
   'Acrylic charms, plush keychains and bag charms. Show off your bag and find new hangers.'),
  ('pokemon-cards', 'Pokémon Cards',
   'Singles, promos and sealed packs. Trade fairly and check the condition before you swap.'),
  ('trading-cards', 'Trading Cards',
   'Photocards, sports cards, anime cards and other TCGs. Complete your set with fellow collectors.'),
  ('plushies', 'Plushies',
   'Squishmallows, Jellycats, crane-game prizes and handmade plush looking for new homes.')
on conflict (slug) do nothing;

-- ---- Events ------------------------------------------------------------
-- One of each event type in Blind Boxes, a few days from when you run this.
-- They have no host (created_by = null), so any member can start them.
insert into public.events (community_id, type, title, description, theme, starts_at, place, mini_activity)
select c.id, e.type::public.event_type, e.title, e.description, e.theme, now() + e.starts_in, e.place, e.mini_activity
from public.communities c
cross join (values
  ('swap_meet', 'Weekend Swap Meet',
   'Bring your duplicates to the shared table and trade live with everyone in the room.',
   null, interval '2 days', 'In the PopSwap room',
   'Trade Bingo: try to make trades for a sealed item, a secret, and something from another community.'),
  ('mystery_swap', 'Mystery Swap Night',
   'Put one item in the pool. When the host shuffles, everyone gets a surprise from someone else.',
   null, interval '3 days', 'In the PopSwap room',
   'Leave a note: add a caption to your item for whoever receives it.'),
  ('unboxing_party', 'Blind Box Unboxing Party',
   'Open your new blind boxes together and post what you pulled.',
   null, interval '5 days', 'In the PopSwap room',
   'Guess the Pull: post your box first and let others guess before you reveal.'),
  ('showcase_contest', 'Shelfie Showcase Contest',
   'Enter the item you''re proudest of. Everyone gets one vote; most votes wins.',
   'Best display', interval '7 days', 'In the PopSwap room',
   'One entry each, one vote each. The winner gets a crown on their entry.'),
  ('theme_day', 'Sanrio Saturday',
   'A themed trading day: only Sanrio items on the shelf.',
   'Sanrio', interval '9 days', 'In the PopSwap room',
   'Add your Sanrio items to the shelf and trade within the theme.')
) as e(type, title, description, theme, starts_in, place, mini_activity)
where c.slug = 'blind-boxes'
  and not exists (
    select 1 from public.events x where x.community_id = c.id and x.title = e.title
  );
