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
-- Added in Phase 5.
