INSERT OR REPLACE INTO puzzles (
  date, category, topic, sentences, lie_index, truth, source_url, source_license, status
) VALUES (
  date('now'),
  'science',
  'Photosynthesis',
  '["Photosynthesis is the process by which green plants convert light energy into chemical energy.","It primarily takes place in chloroplasts, which contain the pigment chlorophyll.","During the light-dependent reactions, water molecules are split and oxygen is released.","The Calvin cycle uses carbon dioxide to produce glucose and other sugars.","Chlorophyll absorbs mostly green light and reflects red and blue wavelengths.","Photosynthesis is essential for maintaining Earth''s atmospheric oxygen levels."]',
  4,
  'Chlorophyll absorbs mostly red and blue light and reflects green wavelengths.',
  'https://en.wikipedia.org/wiki/Photosynthesis',
  'CC BY-SA 4.0',
  'approved'
);

INSERT OR REPLACE INTO puzzles (
  date, category, topic, sentences, lie_index, truth, source_url, source_license, status
) VALUES (
  date('now', '-1 day'),
  'history',
  'Apollo 11',
  '["Apollo 11 was the first crewed mission to land on the Moon.","Neil Armstrong and Buzz Aldrin walked on the lunar surface on 20 July 1969.","Michael Collins remained in lunar orbit aboard the command module Columbia.","The lunar module was named Eagle.","Armstrong''s first words on the surface included the phrase ''one small step for man''.","The crew returned to Earth and splashed down in the Atlantic Ocean."]',
  5,
  'The crew returned to Earth and splashed down in the Pacific Ocean.',
  'https://en.wikipedia.org/wiki/Apollo_11',
  'CC BY-SA 4.0',
  'approved'
);

INSERT OR REPLACE INTO puzzles (
  date, category, topic, sentences, lie_index, truth, source_url, source_license, status
) VALUES (
  date('now', '+1 day'),
  'technology',
  'Transistor',
  '["The transistor is a semiconductor device used to amplify or switch electronic signals.","It was demonstrated at Bell Labs in 1947.","Bipolar junction transistors use both electrons and holes as charge carriers.","Most modern processors are built primarily from vacuum tubes.","Moore''s law observed the doubling of transistor counts on integrated circuits over time.","Field-effect transistors control current using an electric field."]',
  3,
  'Most modern processors are built primarily from field-effect transistors.',
  'https://en.wikipedia.org/wiki/Transistor',
  'CC BY-SA 4.0',
  'approved'
);

INSERT OR REPLACE INTO puzzles (
  date, category, topic, sentences, lie_index, truth, source_url, source_license, status
) VALUES (
  date('now', '+2 day'),
  'geography',
  'Amazon River',
  '["The Amazon River is the largest river by discharge volume of water in the world.","It flows through several South American countries including Brazil and Peru.","Its drainage basin covers a substantial portion of the Amazon rainforest.","Seasonal flooding creates vast floodplain forests known as várzea.","The river empties into the Pacific Ocean near Belém.","Indigenous peoples have lived along the Amazon for thousands of years."]',
  4,
  'The river empties into the Atlantic Ocean near Belém.',
  'https://en.wikipedia.org/wiki/Amazon_River',
  'CC BY-SA 4.0',
  'approved'
);
