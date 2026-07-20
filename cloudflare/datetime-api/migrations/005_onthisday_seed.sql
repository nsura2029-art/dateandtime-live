-- ============================================================
-- Phase 4: onthisday seed (curated events)
-- Reference: docs/architecture/SHARED-DB-PLAN.md
-- ============================================================
--
-- ~50 famous events (historical, scientific, cultural, political).
-- Recurring/annual events (New Year, Christmas) are also here for
-- completeness even though they appear in the holidays table too.

INSERT OR REPLACE INTO onthisday
  (month, day, year, title, description, category, localized_titles, source, confidence)
VALUES
  -- January
  (1, 1, NULL, 'New Year''s Day', 'First day of the Gregorian calendar', 'cultural', '{"en":"New Year''s Day"}', 'wikipedia', 1.0),
  (1, 4, 2010, 'Burj Khalifa opens', 'Tallest building in the world opens in Dubai', 'cultural', NULL, 'wikipedia', 1.0),
  (1, 24, 1984, 'Apple Macintosh introduced', 'Apple Computer launches the Macintosh personal computer', 'scientific', NULL, 'wikipedia', 1.0),
  (1, 27, 1945, 'Soviet forces liberate Auschwitz', 'End of the deadliest Nazi concentration camp', 'historical', NULL, 'wikipedia', 1.0),
  (1, 28, 1986, 'Space Shuttle Challenger disaster', 'NASA STS-51-L mission ends 73 seconds after launch', 'historical', NULL, 'wikipedia', 1.0),

  -- February
  (2, 2, NULL, 'Groundhog Day', 'American tradition in Punxsutawney, PA', 'cultural', NULL, 'wikipedia', 1.0),
  (2, 14, NULL, 'Valentine''s Day', 'Day of love and romance', 'cultural', NULL, 'wikipedia', 1.0),
  (2, 24, 2022, 'Russia invades Ukraine', 'Start of the full-scale Russo-Ukrainian War', 'political', NULL, 'wikipedia', 1.0),

  -- March
  (3, 8, NULL, 'International Women''s Day', 'Celebrates women''s achievements', 'cultural', NULL, 'wikipedia', 1.0),
  (3, 14, NULL, 'Pi Day', 'Celebration of the mathematical constant π (3/14)', 'scientific', NULL, 'wikipedia', 1.0),
  (3, 17, NULL, 'St. Patrick''s Day', 'Irish cultural and religious celebration', 'cultural', NULL, 'wikipedia', 1.0),
  (3, 20, 2003, 'Iraq War begins', 'United States-led invasion of Iraq', 'political', NULL, 'wikipedia', 1.0),
  (3, 21, NULL, 'Nowruz (Persian New Year)', 'Day of the spring equinox, celebrated across Iran and Central Asia', 'cultural', NULL, 'wikipedia', 1.0),

  -- April
  (4, 1, NULL, 'April Fools'' Day', 'Day of practical jokes', 'cultural', NULL, 'wikipedia', 1.0),
  (4, 12, 1961, 'Yuri Gagarin first human in space', 'Soviet cosmonaut orbits Earth aboard Vostok 1', 'scientific', NULL, 'wikipedia', 1.0),
  (4, 15, 1912, 'Titanic sinks', 'RMS Titanic strikes an iceberg and sinks in the North Atlantic', 'historical', NULL, 'wikipedia', 1.0),
  (4, 22, NULL, 'Earth Day', 'Day of environmental awareness and action', 'cultural', NULL, 'wikipedia', 1.0),
  (4, 23, NULL, 'Shakespeare Day', 'Birthday of William Shakespeare', 'cultural', NULL, 'wikipedia', 1.0),

  -- May
  (5, 1, NULL, 'International Workers'' Day', 'Labour day celebrated in many countries', 'cultural', NULL, 'wikipedia', 1.0),
  (5, 6, 1954, 'Roger Bannister breaks 4-minute mile', 'First human to run a sub-4-minute mile', 'sports', NULL, 'wikipedia', 1.0),
  (5, 8, 1945, 'VE Day', 'Allied victory in Europe ends WWII in Europe', 'historical', NULL, 'wikipedia', 1.0),
  (5, 11, NULL, 'National Technology Day (India)', 'Commemorates the Pokhran-II nuclear tests', 'cultural', NULL, 'wikipedia', 1.0),
  (5, 19, 2019, 'First AI-generated portrait sold at auction', 'Christie''s sells an AI artwork for $432,500', 'cultural', NULL, 'wikipedia', 1.0),

  -- June
  (6, 6, 1944, 'D-Day', 'Allied forces land at Normandy in WWII', 'historical', NULL, 'wikipedia', 1.0),
  (6, 21, NULL, 'Summer Solstice', 'Longest day in the Northern Hemisphere', 'cultural', NULL, 'wikipedia', 1.0),
  (6, 23, 2016, 'Brexit referendum', 'United Kingdom votes to leave the European Union', 'political', NULL, 'wikipedia', 1.0),

  -- July
  (7, 4, 1776, 'US Independence Day', 'Declaration of Independence signed', 'political', NULL, 'wikipedia', 1.0),
  (7, 14, 1789, 'Storming of the Bastille', 'French Revolution begins', 'historical', NULL, 'wikipedia', 1.0),
  (7, 20, 1969, 'Apollo 11 Moon landing', 'Neil Armstrong and Buzz Aldrin become first humans on the Moon', 'scientific', NULL, 'wikipedia', 1.0),

  -- August
  (8, 6, 1945, 'Hiroshima atomic bombing', 'Atomic bomb dropped on Hiroshima, Japan', 'historical', NULL, 'wikipedia', 1.0),
  (8, 9, 1945, 'Nagasaki atomic bombing', 'Second atomic bomb dropped on Nagasaki, Japan', 'historical', NULL, 'wikipedia', 1.0),
  (8, 15, 1947, 'Indian Independence Day', 'India gains independence from British rule', 'political', NULL, 'wikipedia', 1.0),
  (8, 21, 1991, 'Latvia declares independence', 'Start of the Baltic independence chain', 'political', NULL, 'wikipedia', 1.0),

  -- September
  (9, 11, 2001, 'September 11 attacks', 'Terrorist attacks on the World Trade Center and Pentagon', 'historical', NULL, 'wikipedia', 1.0),
  (9, 16, 1810, 'Mexican Independence Day', 'Cry of Dolores triggers Mexican War of Independence', 'political', NULL, 'wikipedia', 1.0),
  (9, 21, NULL, 'International Day of Peace', 'UN-observed day of ceasefire and non-violence', 'cultural', NULL, 'wikipedia', 1.0),

  -- October
  (10, 1, 1949, 'Founding of the People''s Republic of China', 'Chairman Mao proclaims the PRC', 'political', NULL, 'wikipedia', 1.0),
  (10, 3, 1990, 'German Reunification', 'East and West Germany officially reunite', 'political', NULL, 'wikipedia', 1.0),
  (10, 9, NULL, 'World Post Day', 'Anniversary of the Universal Postal Union', 'cultural', NULL, 'wikipedia', 1.0),
  (10, 24, 1945, 'United Nations Day', 'UN Charter entered into force in 1945', 'political', NULL, 'wikipedia', 1.0),
  (10, 31, NULL, 'Halloween', 'Day of costumes, trick-or-treating, and All Hallows'' Eve', 'cultural', NULL, 'wikipedia', 1.0),

  -- November
  (11, 9, 1989, 'Fall of the Berlin Wall', 'The Berlin Wall is opened, ending the Cold War symbol', 'historical', NULL, 'wikipedia', 1.0),
  (11, 11, 1918, 'Armistice Day', 'End of World War I (now Veterans Day in the US)', 'historical', NULL, 'wikipedia', 1.0),
  (11, 22, 1963, 'JFK assassination', 'US President John F. Kennedy is assassinated in Dallas', 'historical', NULL, 'wikipedia', 1.0),

  -- December
  (12, 7, 1941, 'Pearl Harbor attack', 'Japanese attack on Pearl Harbor draws the US into WWII', 'historical', NULL, 'wikipedia', 1.0),
  (12, 10, 1901, 'First Nobel Prizes awarded', 'First Nobel Prizes ceremony in Stockholm', 'cultural', NULL, 'wikipedia', 1.0),
  (12, 21, NULL, 'Winter Solstice', 'Shortest day in the Northern Hemisphere', 'cultural', NULL, 'wikipedia', 1.0),
  (12, 24, NULL, 'Christmas Eve', 'Day before Christmas Day', 'cultural', NULL, 'wikipedia', 1.0),
  (12, 25, NULL, 'Christmas Day', 'Christian celebration of the birth of Jesus', 'cultural', NULL, 'wikipedia', 1.0),
  (12, 31, NULL, 'New Year''s Eve', 'Last day of the Gregorian calendar', 'cultural', NULL, 'wikipedia', 1.0);
