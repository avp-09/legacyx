// ============================================================
// LEGACY: THE LIVING CITY — data-driven historical content
// All questions / NPCs / artifacts / levels live here so new
// eras can be added without touching game logic.
// ============================================================

export const LEVELS = [
  {
    id: 1, key: 'indus', name: 'The Lost City', era: 'Indus Valley Civilization · c. 2600–1900 BCE',
    icon: '🟤', color: 0xd9a066, sky: 0xffd9a0, fog: 0xf2c179, ground: 0xcfa15e,
    tagline: 'Restore the planned city of the Harappans.',
    mission: 'RESTORE THE CITY — Find 5 civilization tablets',
    collectible: { name: 'Civilization Tablet', icon: '🧱', target: 5, points: 10 },
    npcs: [
      { name: 'City Elder', icon: '🧙', pos: [6, 0, 4], color: 0x8a5a2b,
        lines: [
          'Welcome, traveller! Our city is carefully planned. Look beneath the streets…',
          '…and you may discover how our people managed water. The drains run beside every lane!',
          'Tablets glow near the marketplace, the Great Bath, the drains, homes and granary.'
        ] },
      { name: 'Potter Amma', icon: '🏺', pos: [-10, 0, 8], color: 0xb5542d,
        lines: [
          'My pots carry grain and water to every house.',
          'A tablet rests where pots are stacked high — near my stall, child!'
        ] }
    ],
    gateQuizTitle: '🔱 HISTORY GATE — Indus Valley',
    puzzleTitle: 'Drainage Puzzle — guide water to the Great Bath',
    sealName: '🏺 Indus Valley Seal',
    portalTo: 'Nalanda'
  },
  {
    id: 2, key: 'nalanda', name: "The Scholar's Challenge", era: 'Ancient India · Nalanda · c. 5th–12th century CE',
    icon: '🟡', color: 0xe8c547, sky: 0xbfe3ff, fog: 0xcfe8d8, ground: 0x8fbf7f,
    tagline: 'Recover the lost scrolls of the great university.',
    mission: 'THE LOST SCROLLS — Find 5 missing scrolls',
    collectible: { name: 'Palm-leaf Scroll', icon: '📜', target: 5, points: 10 },
    npcs: [
      { name: 'Acharya', icon: '👳', pos: [5, 0, 2], color: 0xcf7a1e,
        lines: [
          'Nalanda welcomes seekers from across Asia, young scholar.',
          'One scroll lies where students studied the stars — the observatory platform.',
          'Another sleeps among the garden stupas. Walk softly and look for golden glows.'
        ] },
      { name: 'Student Mira', icon: '🎒', pos: [-8, 0, -6], color: 0x2e7d8a,
        lines: [
          'I copied sutras in the library till my fingers ached!',
          'Check the library racks, the debate courtyard and the dormitory veranda.'
        ] }
    ],
    gateQuizTitle: '🔱 HISTORY GATE — Nalanda',
    puzzleTitle: 'Library Puzzle — shelve the scrolls in order',
    sealName: '📜 Nalanda Seal',
    portalTo: 'Chola lands'
  },
  {
    id: 3, key: 'chola', name: 'Rise of the Cholas', era: 'Chola Dynasty · c. 9th–13th century CE',
    icon: '🔵', color: 0x4aa3df, sky: 0x9fd4ff, fog: 0xbcd9f5, ground: 0x9dbb7a,
    tagline: 'Rebuild the great temple, piece by piece.',
    mission: 'THE TEMPLE BLUEPRINT — Find 5 architectural pieces',
    collectible: { name: 'Temple Design Piece', icon: '🛕', target: 5, points: 10 },
    npcs: [
      { name: 'Sthapati (Architect)', icon: '🏛️', pos: [6, 0, 6], color: 0x9c5b1e,
        lines: [
          'A temple rises like a prayer in stone: base, pillars, walls, tower, finial.',
          'My drawings blew across the city — market, port, village, carvers’ yard, fields.',
          'Bring all five and we shall raise the vimana together!'
        ] },
      { name: 'Sailor Karikalan', icon: '⛵', pos: [-14, 0, 10], color: 0x1e6f9c,
        lines: [
          'Our ships carried spices and stories to distant shores!',
          'A blueprint page fluttered down near my boat. The port wind is mischievous.'
        ] }
    ],
    gateQuizTitle: '🔱 HISTORY GATE — The Cholas',
    puzzleTitle: 'Temple Puzzle — stack the vimana in order',
    sealName: '🛕 Chola Seal',
    portalTo: 'the Fort'
  },
  {
    id: 4, key: 'fort', name: 'The Fort of Secrets', era: 'Medieval India · Forts & Sultanates',
    icon: '🟠', color: 0xd97b2e, sky: 0xffc98a, fog: 0xe8b083, ground: 0xb08a5a,
    tagline: 'Piece together the hidden inscription.',
    mission: 'THE HIDDEN MESSAGE — Find 4 inscription pieces',
    collectible: { name: 'Inscription Piece', icon: '🪨', target: 4, points: 15 },
    npcs: [
      { name: 'Guard Veer', icon: '💂', pos: [4, 0, 8], color: 0x7a3b2e,
        lines: [
          'Halt… oh, a Guardian of Time! The inscription shattered into four.',
          'One piece needs a matching eye, one needs a map, one needs symbols, one needs memory.',
          'Start at the gate courtyard and follow the golden glows.'
        ] },
      { name: 'Court Scholar', icon: '📖', pos: [-6, 0, -8], color: 0x4a5d8a,
        lines: [
          'Which monument did Shah Jahan raise for love? Keep that answer ready…',
          'The secret chamber opens only for those who honour the past.'
        ] }
    ],
    gateQuizTitle: '🔱 HISTORY GATE — Medieval India',
    puzzleTitle: 'Secret Chamber — four trials of the fort',
    sealName: '🏰 Fort Seal',
    portalTo: 'the freedom struggle'
  },
  {
    id: 5, key: 'freedom', name: 'The Road to Freedom', era: 'Independence Movement · 19th–20th century',
    icon: '🟢', color: 0x4caf6d, sky: 0xaee3ff, fog: 0xc4dfe8, ground: 0x8a8a72,
    tagline: 'Rebuild the newspaper that woke a nation.',
    mission: 'THE MISSING NEWSPAPER — Find 5 newspaper pieces',
    collectible: { name: 'Newspaper Piece', icon: '📰', target: 5, points: 10 },
    npcs: [
      { name: 'Editor Desai', icon: '🖋️', pos: [5, 0, 3], color: 0x3b3b3b,
        lines: [
          'The press is silent! Our newspaper lies scattered across town.',
          'Find the EVENT, DATE, PERSON, LOCATION and HEADLINE.',
          'Check the station, press office, meeting ground, shops and the banyan tree.'
        ] },
      { name: 'Station Master', icon: '🚂', pos: [-12, 0, 6], color: 0x1e4f9c,
        lines: [
          'Trains carried newspapers — and hopes — to every corner of Bharat.',
          'Something fluttered onto platform 2 this morning…'
        ] }
    ],
    gateQuizTitle: '🔱 HISTORY GATE — Freedom Struggle',
    puzzleTitle: 'Press Puzzle — lay out the front page',
    sealName: '🕊️ Freedom Seal',
    portalTo: 'the Final Chamber'
  }
];

export const QUIZZES = {
  1: [
    { q: 'Which feature is strongly associated with cities of the Indus Valley Civilization?', options: ['Sophisticated drainage systems', 'Modern highways', 'Steel bridges', 'Airports'], answer: 0, fact: 'Many Harappan cities had covered drains running beside planned streets.' },
    { q: 'What material gave the “Red City” its colour — used for most Harappan houses?', options: ['Marble', 'Fired mud bricks', 'Glass', 'Steel'], answer: 1, fact: 'Standard-sized fired bricks made Harappan construction strong and uniform.' },
    { q: 'The Great Bath at Mohenjo-daro was most likely used for…', options: ['Spaceship landings', 'Ritual bathing', 'Car parking', 'Wheat grinding'], answer: 1, fact: 'Historians believe the watertight Great Bath was used for ritual bathing.' },
    { q: 'Harappan seals were mostly made of…', options: ['Steatite stone', 'Plastic', 'Rubber', 'Paper'], answer: 0, fact: 'Tiny steatite seals were carved with animals and undeciphered script.' },
    { q: 'Which of these was a Harappan port town that traded by sea?', options: ['Lothal', 'London', 'Tokyo', 'Paris'], answer: 0, fact: 'Lothal in Gujarat had a dockyard and traded with far-off lands.' }
  ],
  2: [
    { q: 'Nalanda was most famous as a…', options: ['Centre of learning', 'Gold mine', 'Race track', 'Ship factory'], answer: 0, fact: 'Nalanda drew students from China, Korea and Central Asia.' },
    { q: 'Which Chinese scholar studied at Nalanda?', options: ['Xuanzang (Hiuen Tsang)', 'Marco Polo', 'Columbus', 'Vasco da Gama'], answer: 0, fact: 'Xuanzang studied and taught at Nalanda in the 7th century CE.' },
    { q: 'Subjects at Nalanda included…', options: ['Astronomy, medicine, logic', 'Video games', 'Rocket racing', 'Deep-sea diving'], answer: 0, fact: 'Nalanda taught philosophy, astronomy, medicine, grammar and logic.' },
    { q: 'Nalanda’s great library was said to hold…', options: ['Lakhs of manuscripts', 'One comic book', 'No books at all', 'Only maps of Rome'], answer: 0, fact: 'Its libraries (Ratnasagara and others) held vast manuscript collections.' },
    { q: 'Nalanda flourished especially under which empire?', options: ['The Guptas and Palas', 'The Romans', 'The Vikings', 'The Aztecs'], answer: 0, fact: 'Gupta and later Pala rulers supported Nalanda generously.' }
  ],
  3: [
    { q: 'The Cholas are best remembered for…', options: ['Great South Indian temples', 'Pyramids of Egypt', 'The Great Wall', 'Stonehenge'], answer: 0, fact: 'Chola temples like Thanjavur’s Brihadeeswara are architectural marvels.' },
    { q: 'Which famous Chola temple was built by Rajaraja I?', options: ['Brihadeeswara Temple, Thanjavur', 'Eiffel Tower', 'Taj Mahal', 'Angkor Wat'], answer: 0, fact: 'Rajaraja Chola I built the Brihadeeswara temple around 1010 CE.' },
    { q: 'Chola bronze sculptures most famously depict…', options: ['Nataraja, the dancing Shiva', 'Penguins', 'Steam engines', 'Satellites'], answer: 0, fact: 'Chola Nataraja bronzes are celebrated worldwide.' },
    { q: 'Chola power at sea meant they…', options: ['Sent naval expeditions across the seas', 'Never left their villages', 'Built submarines', 'Flew aeroplanes'], answer: 0, fact: 'Rajendra Chola’s navy reached Southeast Asia.' },
    { q: 'In temple architecture, the tall tower above the sanctum is called…', options: ['Vimana / Shikhara', 'Runway', 'Chimney', 'Antenna'], answer: 0, fact: 'The vimana rises above the garbhagriha (inner sanctum).' }
  ],
  4: [
    { q: 'Which monument is associated with Shah Jahan?', options: ['Qutub Minar', 'Taj Mahal', 'Sanchi Stupa', 'Konark Temple'], answer: 1, fact: 'Shah Jahan built the Taj Mahal at Agra in memory of Mumtaz Mahal.' },
    { q: 'Forts like the one around you were built mainly to…', options: ['Protect people and rule a region', 'Host cricket matches', 'Store ice cream', 'Launch rockets'], answer: 0, fact: 'Forts combined palaces, temples, markets and defences.' },
    { q: 'Qutub Minar was begun under which rulers?', options: ['The Delhi Sultans', 'The Cholas', 'The Mauryas', 'The British'], answer: 0, fact: 'Qutb-ud-din Aibak began it; Iltutmish completed it.' },
    { q: 'Intricate fort carvings often include…', options: ['Lotus, peacock and geometric patterns', 'Cartoon robots', 'Neon signs', 'Barcodes'], answer: 0, fact: 'Nature and geometry inspired medieval Indian art.' },
    { q: 'A “secret chamber” in stories usually hides…', options: ['Important records or treasures', 'Socks', 'Homework', 'Sandwiches'], answer: 0, fact: 'Forts really did have hidden rooms for grain, records and safety.' }
  ],
  5: [
    { q: 'The printing press helped the freedom movement by…', options: ['Spreading news and ideas quickly', 'Printing pizza menus', 'Making paper boats', 'Wrapping gifts'], answer: 0, fact: 'Newspapers carried ideas of freedom to towns and villages.' },
    { q: 'Mahatma Gandhi’s peaceful method of protest is called…', options: ['Satyagraha', 'Sword-fighting', 'Hide and seek', 'Arm wrestling'], answer: 0, fact: 'Satyagraha means holding firmly to truth through non-violence.' },
    { q: 'The Dandi March (1930) protested…', options: ['The salt tax', 'The price of tea', 'Train timings', 'Cricket rules'], answer: 0, fact: 'Gandhiji walked to Dandi to make salt and defy an unjust law.' },
    { q: '“Jai Hind” and “Vande Mataram” are…', options: ['Stirring slogans and songs of freedom', 'Types of sweets', 'Names of trains', 'Board games'], answer: 0, fact: 'They united millions during the struggle for independence.' },
    { q: 'India became independent in the year…', options: ['1947', '1800', '2001', '1599'], answer: 0, fact: 'India gained independence on 15 August 1947.' }
  ]
};

export const FINAL_QUESTIONS = [
  { q: 'Which civilization is known for planned cities and drainage?', options: ['Indus Valley Civilization', 'Roman Empire', 'Aztec Empire', 'Viking settlements'], answer: 0 },
  { q: 'What was Nalanda known for?', options: ['A great centre of learning', 'A gold mine', 'A sea port only', 'A race track'], answer: 0 },
  { q: 'Which dynasty is associated with great South Indian temples?', options: ['The Cholas', 'The Normans', 'The Incas', 'The Mongols'], answer: 0 },
  { q: 'Which monument is associated with Shah Jahan?', options: ['Qutub Minar', 'Taj Mahal', 'Sanchi Stupa', 'Hampi Vittala'], answer: 1 },
  { q: 'Arrange these eras in chronological (earliest → latest) order. Which comes FIRST?', options: ['Indus Valley Civilization', 'Chola Dynasty', 'Independence Movement', 'Nalanda University'], answer: 0 }
];

export const ARTIFACT_INFO = {
  1: [
    { name: 'Harappan Seal', fact: 'Tiny seals stamped goods and may show one of the world’s oldest scripts.' },
    { name: 'Painted Pottery', fact: 'Potters painted pots with peacocks, fish and geometric patterns.' },
    { name: 'Drain Cover Stone', fact: 'Cover stones kept street drains clean — ancient town planning!' },
    { name: 'Bead Necklace', fact: 'Harappans drilled perfect beads from carnelian and shell.' },
    { name: 'Granary Token', fact: 'Great granaries stored grain for the whole city.' }
  ],
  2: [
    { name: 'Palm-leaf Sutra', fact: 'Texts were written on dried palm leaves with a metal stylus.' },
    { name: 'Astronomy Chart', fact: 'Nalanda scholars tracked stars and planets from observatories.' },
    { name: 'Medicine Mortar', fact: 'Ayurveda — the science of life — was studied here.' },
    { name: 'Debate Bell', fact: 'Scholars debated philosophy in grand courtyards.' },
    { name: 'Traveller’s Brush', fact: 'Xuanzang carried hundreds of manuscripts back to China.' }
  ],
  3: [
    { name: 'Foundation Design', fact: 'Temples begin with a strong stone adhishthana (base).' },
    { name: 'Pillar Design', fact: 'Carved pillars hold up pillared halls (mandapas).' },
    { name: 'Wall Design', fact: 'Walls carry stories of gods, dancers and guardians.' },
    { name: 'Tower Design', fact: 'The vimana tower soars above the sanctum.' },
    { name: 'Finial Design', fact: 'A golden stupi crowns the temple like a blessing.' }
  ],
  4: [
    { name: 'Inscription · Duty', fact: 'Inscriptions recorded royal orders and donations.' },
    { name: 'Inscription · Courage', fact: 'Fort walls protected markets, temples and palaces.' },
    { name: 'Inscription · Wisdom', fact: 'Court scholars preserved poetry, science and history.' },
    { name: 'Inscription · Memory', fact: 'Monuments like the Taj Mahal keep memories in stone.' }
  ],
  5: [
    { name: 'The Event', fact: 'Peaceful marches and meetings demanded freedom.' },
    { name: 'The Date', fact: '15 August 1947 — the day India became independent.' },
    { name: 'The Leader', fact: 'Gandhiji, Nehru, Patel, Bose, Sarojini Naidu and millions more led the way.' },
    { name: 'The Place', fact: 'From Dandi’s shore to Delhi’s streets, every town played a part.' },
    { name: 'The Headline', fact: '“FREEDOM AT LAST” — newspapers carried the news across Bharat.' }
  ]
};

export const ACHIEVEMENTS = [
  { id: 'first', icon: '🏺', name: 'FIRST DISCOVERY', desc: 'Collect your first artifact.' },
  { id: 'scholar', icon: '🧠', name: 'HISTORY SCHOLAR', desc: 'Score 5/5 on any quiz.' },
  { id: 'explorer', icon: '🗺️', name: 'EXPLORER', desc: 'Find all collectibles in a level.' },
  { id: 'guardian', icon: '🔱', name: 'GUARDIAN OF TIME', desc: 'Collect all five Time Seals.' },
  { id: 'master', icon: '🏆', name: 'LEGACY MASTER', desc: 'Complete the entire game.' }
];

export const KALAM_KB = [
  { keys: ['drain', 'water', 'bath'], answer: 'Many Indus Valley cities had carefully planned, covered drainage systems beside their streets. They carried wastewater away and kept the city clean — brilliant town planning, 4000 years ago!' },
  { keys: ['nalanda', 'university', 'scholar', 'student', 'library'], answer: 'Nalanda was one of the world’s greatest ancient universities! Students from China, Korea and Central Asia studied philosophy, astronomy, medicine, logic and grammar there.' },
  { keys: ['chola', 'temple', 'rajaraja', 'vimana'], answer: 'The Cholas built soaring stone temples like the Brihadeeswara at Thanjavur. Its vimana tower rises like a mountain of carved stories — built about 1000 years ago!' },
  { keys: ['taj', 'shah jahan', 'mumtaz', 'fort', 'mughal'], answer: 'Shah Jahan built the Taj Mahal at Agra — a marble monument of love. Medieval forts and palaces combined strong walls with lotus, peacock and geometric art.' },
  { keys: ['gandhi', 'freedom', 'independence', '1947', 'press', 'newspaper'], answer: 'India’s freedom movement used peaceful protest — Satyagraha — and newspapers to unite millions. India became independent on 15 August 1947.' },
  { keys: ['eat', 'food', 'wheat', 'rice'], answer: 'Harappans ate wheat, barley, peas and dates; Nalanda’s kitchens fed thousands of students; Chola farmers grew rice watered by tanks and rivers!' },
  { keys: ['interesting', 'fact', 'tell me'], answer: 'Fun fact: Harappan cities used standard-sized bricks — like ancient LEGO! And Nalanda’s library was so big it is said to have burned for months. History is full of wonders!' },
  { keys: ['who built', 'built this'], answer: 'Great question! Harappan cities were built by skilled town planners; Nalanda grew under Gupta and Pala kings; Chola temples rose under kings like Rajaraja I; and the Taj Mahal under Shah Jahan.' },
  { keys: ['kalam', 'who are you'], answer: 'I am Kalam — your history companion, named after Dr. A.P.J. Abdul Kalam! Ask me about drains, Nalanda, temples, forts or freedom — I love questions!' }
];

export function levelById(id) { return LEVELS.find(l => l.id === id); }
