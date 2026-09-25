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
    mission: 'RESTORE THE CITY — Speak with the City Elder, then recover 5 tablets',
    collectible: { name: 'Civilization Tablet', icon: '🧱', target: 5, points: 10 },
    npcs: [
      { name: 'City Elder', icon: '🧙', pos: [6, 0, 4], color: 0x8a5a2b, role: 'giver',
        lines: [
          'Ah, a Guardian of Time! Our city is carefully planned — commendable, no?',
          'Five tablets are lost. Help an old man recover his city’s memory.'
        ] },
      { name: 'Potter Amma', icon: '🏺', pos: [-10, 0, 8], color: 0xb5542d, role: 'sage',
        lines: [
          'Mind my pots, child! Each one carries grain or water to some hungry house.',
          'The Elder’s quest, eh? Walk the city slowly — old walls whisper to patient feet.'
        ] }
    ],
    quest: {
      giver: 'City Elder',
      brief: 'Five clay tablets — the memory of our planned city — lie scattered from market to granary. The City Elder waits near the plaza to guide your search.',
      artifacts: [
        { name: 'Harappan Seal',
          clue: 'Begin where merchants once gathered. Among striped awnings and clay pots, the old marketplace hides the first tablet.',
          praise: 'The Seal of Traders! Well done. Now follow the water — the builders’ drains run like veins beside every lane.' },
        { name: 'Drain Cover Stone',
          clue: 'Follow the ancient water routes. Search beside the glowing drainage channels, where the builders’ careful work still shows.',
          praise: 'You read the city as its builders intended! Next, go where water was part of daily life — the Great Bath.' },
        { name: 'Painted Pottery',
          clue: 'Steam and splashing once filled the air. Climb the steps of the Great Bath and look around its rim.',
          praise: 'Beautifully found! Now head north, past the houses, to the quiet courtyard of banners.' },
        { name: 'Bead Necklace',
          clue: 'North of the plaza lies a quiet courtyard hung with banners. Someone dropped something precious there.',
          praise: 'A treasure returned! One tablet remains — by the great storehouse in the far west, where grain fed the city.' },
        { name: 'Granary Token',
          clue: 'Grain fed the city, and records fed its memory. Search around the pillared granary in the west.',
          praise: 'All five tablets recovered! The History Gate will open for you now.' }
      ],
      done: 'The tablets sing together! Take them to the glowing History Gate, Guardian.'
    },
    gateQuizTitle: '🔱 HISTORY GATE — Indus Valley',
    puzzleTitle: 'Drainage Puzzle — guide water to the Great Bath',
    sealName: '🏺 Indus Valley Seal',
    portalTo: 'Nalanda'
  },
  {
    id: 2, key: 'nalanda', name: "The Scholar's Challenge", era: 'Ancient India · Nalanda · c. 5th–12th century CE',
    icon: '🟡', color: 0xe8c547, sky: 0xbfe3ff, fog: 0xcfe8d8, ground: 0x8fbf7f,
    tagline: 'Recover the lost scrolls of the great university.',
    mission: "THE LOST SCROLLS — Speak with the Acharya, then recover 5 scrolls",
    collectible: { name: 'Palm-leaf Scroll', icon: '📜', target: 5, points: 10 },
    npcs: [
      { name: 'Acharya', icon: '👳', pos: [5, 0, 2], color: 0xcf7a1e, role: 'giver',
        lines: [
          'Welcome, young seeker. Students cross mountains and seas to learn here.',
          'Five of our scrolls have wandered off. Shall we bring them home together?'
        ] },
      { name: 'Student Mira', icon: '🎒', pos: [-8, 0, -6], color: 0x2e7d8a, role: 'sage',
        lines: [
          'I copy sutras till my fingers ache — but I love it here!',
          'The Acharya’s search, yes? I’ve walked every courtyard. Happy to share what I know.'
        ] }
    ],
    quest: {
      giver: 'Acharya',
      brief: 'Five palm-leaf scrolls are missing across the university — from debating halls to the stargazing platform. The Acharya waits in the courtyard to begin the search.',
      artifacts: [
        { name: 'Debate Bell',
          clue: 'Begin where scholars gather to exchange ideas. The debating courtyard rings with arguments — and something small and bronze waits there.',
          praise: 'The Debate Bell! One scroll home. Next, look to the heavens — where students study the stars.' },
        { name: 'Astronomy Chart',
          clue: 'Find the raised platform where students observe the night sky. A chart of the heavens lies nearby.',
          praise: 'Excellent discovery! Now wander to the quiet garden, where stupas keep cool shade.' },
        { name: 'Medicine Mortar',
          clue: 'Healing herbs grow in the stupa garden. Search among the white domes for a healer’s tool.',
          praise: 'The library’s story is still incomplete. The great library itself hides the next scroll.' },
        { name: 'Palm-leaf Sutra',
          clue: 'Climb to the great library with its tall wooden door. Wisdom sleeps between its book piles.',
          praise: 'Wonderful! One scroll remains — near the scholar quarters in the east, where travellers rest.' },
        { name: 'Traveller’s Brush',
          clue: 'Far-travelled students bunk in the eastern quarters. A traveller’s brush waits where they sleep.',
          praise: 'All five scrolls recovered! The History Gate will open for you now.' }
      ],
      done: 'Knowledge restored! Take the scrolls’ blessing to the glowing History Gate.'
    },
    gateQuizTitle: '🔱 HISTORY GATE — Nalanda',
    puzzleTitle: 'Library Puzzle — shelve the scrolls in order',
    sealName: '📜 Nalanda Seal',
    portalTo: 'Chola lands'
  },
  {
    id: 3, key: 'chola', name: 'Rise of the Cholas', era: 'Chola Dynasty · c. 9th–13th century CE',
    icon: '🔵', color: 0x4aa3df, sky: 0x9fd4ff, fog: 0xbcd9f5, ground: 0x9dbb7a,
    tagline: 'Rebuild the great temple, piece by piece.',
    mission: 'THE TEMPLE BLUEPRINT — Speak with the Sthapati, then find 5 design pieces',
    collectible: { name: 'Temple Design Piece', icon: '🛕', target: 5, points: 10 },
    npcs: [
      { name: 'Sthapati (Architect)', icon: '🏛️', pos: [6, 0, 6], color: 0x9c5b1e, role: 'giver',
        lines: [
          'A temple rises like a prayer in stone — base, pillars, walls, tower, finial.',
          'The wind stole my five drawings! Lend me your sharp eyes, Guardian?'
        ] },
      { name: 'Sailor Karikalan', icon: '⛵', pos: [-14, 0, 10], color: 0x1e6f9c, role: 'sage',
        lines: [
          'Ha! Our ships outrun the monsoon itself — spices out, stories in!',
          'Lost drawings, you say? The harbour wind takes everything sooner or later.'
        ] }
    ],
    quest: {
      giver: 'Sthapati (Architect)',
      brief: 'Five temple drawings blew across the city — from stone yard to harbour. The royal architect waits by the market to guide the hunt.',
      artifacts: [
        { name: 'Foundation Design',
          clue: 'Strong temples begin with strong stone. Search the stoneworkers’ yard, where raw rock waits to be shaped.',
          praise: 'The foundation! Now find where sculptors turn stone into beauty — their open workshop.' },
        { name: 'Pillar Design',
          clue: 'Look among the sculptors’ tools and unfinished stones in their pillared workshop.',
          praise: 'Straight and true! Next, the busy market — a drawing flutters near the stalls.' },
        { name: 'Wall Design',
          clue: 'The market hums with traders and bronze. A wall design hides between the stalls.',
          praise: 'Half the temple stands! Now brave the salty wind — search the harbour and its boats.' },
        { name: 'Tower Design',
          clue: 'Gulls cry over masts and ropes. The tower drawing lies somewhere along the harbour.',
          praise: 'Nearly there! Last — the village streets, where something golden glints.' },
        { name: 'Finial Design',
          clue: 'Walk the village lanes east of the market. A glint of gold marks the final drawing.',
          praise: 'All five designs recovered! We shall raise the vimana — but first, the History Gate.' }
      ],
      done: 'The blueprint is whole! Take it to the glowing History Gate, Guardian.'
    },
    gateQuizTitle: '🔱 HISTORY GATE — The Cholas',
    puzzleTitle: 'Temple Puzzle — stack the vimana in order',
    sealName: '🛕 Chola Seal',
    portalTo: 'the Fort'
  },
  {
    id: 4, key: 'fort', name: 'The Fort of Secrets', era: 'Medieval India · Forts & Sultanates',
    icon: '🟠', color: 0xd97b2e, sky: 0xffc98a, fog: 0xe8b083, ground: 0xb08a5a,
    tagline: 'Piece together the hidden inscription.',
    mission: 'THE HIDDEN MESSAGE — Speak with Guard Veer, then find 4 inscription pieces',
    collectible: { name: 'Inscription Piece', icon: '🪨', target: 4, points: 15 },
    npcs: [
      { name: 'Guard Veer', icon: '💂', pos: [4, 0, 8], color: 0x7a3b2e, role: 'giver',
        lines: [
          'Halt! …Oh. A Guardian of Time. Forgive an old soldier’s habits.',
          'Our inscription shattered into four. Help me gather every piece, and the fort will trust you.'
        ] },
      { name: 'Court Scholar', icon: '📖', pos: [-6, 0, -8], color: 0x4a5d8a, role: 'sage',
        lines: [
          'Ah, a seeker! I catalogue every carving in these walls.',
          'Ask Veer for the search order — but for puzzles of memory, I am your scholar.'
        ] }
    ],
    quest: {
      giver: 'Guard Veer',
      brief: 'An ancient inscription lies shattered in four pieces — from the main gate to the secret chamber. Guard Veer waits in the courtyard to brief you.',
      artifacts: [
        { name: 'Inscription · Duty',
          clue: 'Begin near the main entrance. Travellers once streamed through the great gate — a piece hides nearby.',
          praise: 'Duty recovered! Next, where people gather — search the eastern courtyard.' },
        { name: 'Inscription · Courage',
          clue: 'The eastern courtyard bustles with life. Courage waits among its stones.',
          praise: 'Two pieces home! Now the western walls — study the carvings for what does not belong.' },
        { name: 'Inscription · Wisdom',
          clue: 'Old walls wear many symbols. Look along the western courtyard for a carving that stands apart.',
          praise: 'Wisdom returns! The last piece sleeps near the hidden door — approach the secret chamber.' },
        { name: 'Inscription · Memory',
          clue: 'Somewhere north, a plain wall hides a door. The final piece waits at the secret chamber’s feet.',
          praise: 'The message is whole! The History Gate will open for you now.' }
      ],
      done: 'The inscription speaks again! Carry it to the glowing History Gate.'
    },
    gateQuizTitle: '🔱 HISTORY GATE — Medieval India',
    puzzleTitle: 'Secret Chamber — four trials of the fort',
    sealName: '🏰 Fort Seal',
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
    { name: 'Drain Cover Stone', fact: 'Cover stones kept street drains clean — ancient town planning!' },
    { name: 'Painted Pottery', fact: 'Potters painted pots with peacocks, fish and geometric patterns.' },
    { name: 'Bead Necklace', fact: 'Harappans drilled perfect beads from carnelian and shell.' },
    { name: 'Granary Token', fact: 'Great granaries stored grain for the whole city.' }
  ],
  2: [
    { name: 'Debate Bell', fact: 'A bell called scholars together for grand debates.' },
    { name: 'Astronomy Chart', fact: 'Nalanda scholars tracked stars and planets from observatories.' },
    { name: 'Medicine Mortar', fact: 'Ayurveda — the science of life — was studied here.' },
    { name: 'Palm-leaf Sutra', fact: 'Texts were written on dried palm leaves with a metal stylus.' },
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
  ]
};

export const ACHIEVEMENTS = [
  { id: 'first', icon: '🏺', name: 'FIRST DISCOVERY', desc: 'Collect your first artifact.' },
  { id: 'scholar', icon: '🧠', name: 'HISTORY SCHOLAR', desc: 'Score 5/5 on any quiz.' },
  { id: 'explorer', icon: '🗺️', name: 'EXPLORER', desc: 'Find all collectibles in a level.' },
  { id: 'guardian', icon: '🔱', name: 'GUARDIAN OF TIME', desc: 'Collect all four Time Seals.' },
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
