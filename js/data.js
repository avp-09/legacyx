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
          'Guardian of Time! These streets were old when your grandfather’s grandfather was born — every lane straight as a plumb line, every drain covered against the rains.',
          'Five clay tablets carry our city’s memory — market, drains, Bath, banners, granary. Find them, child, and an old man’s heart will rest easy. Shall we begin?'
        ] },
      { name: 'Potter Amma', icon: '🏺', pos: [-10, 0, 8], color: 0xb5542d, role: 'sage',
        lines: [
          'Careful round my pots, little one! That big-bellied jar there? It will carry water to a thirsty house by sundown.',
          'Hunting the Elder’s tablets, are you? Then listen to Amma: the first lies where the merchants shout loudest — striped awnings, clay cups, the smell of grain.',
          'And here is a potter’s secret for free — our drains run beside every lane, north to south. Follow the water-lines and you will never be lost.'
        ] }
    ],
    quest: {
      giver: 'City Elder',
      brief: 'Five clay tablets — the memory of our planned city — lie scattered from market to granary. The City Elder waits near the plaza to guide your search.',
      artifacts: [
        { name: 'Harappan Seal',
          clue: 'Begin among the striped market awnings west of the plaza, where clay pots crowd the counters and merchants call their wares. Look low, between jar and basket.',
          praise: 'The Seal of Traders! Well done. Now follow the water — the builders’ drains run like veins beside every lane.' },
        { name: 'Drain Cover Stone',
          clue: 'Walk the old water-lines: find a glowing drainage channel cutting past the houses, and search the ground where its cover-stones lie in a row.',
          praise: 'You read the city as its builders intended! Next, go where water was part of daily life — the Great Bath.' },
        { name: 'Painted Pottery',
          clue: 'Go to the Great Bath, climb to the brick rim of the sunken pool, and circle it slowly — something painted waits where bathers once rested their cups.',
          praise: 'Beautifully found! Now head north, past the houses, to the quiet courtyard of banners.' },
        { name: 'Bead Necklace',
          clue: 'North of the plaza, past the houses, find the quiet courtyard where two banners hang. Search the ground beneath the cloth, where few feet wander.',
          praise: 'A treasure returned! One tablet remains — by the great storehouse in the far west, where grain fed the city.' },
        { name: 'Granary Token',
          clue: 'Westward to the pillared granary on its raised platform. Walk its shadowed base, among the grain sacks — the city’s memory is filed where its grain was stored.',
          praise: 'All five tablets recovered! The History Gate will open for you now.' }
      ],
      done: 'The tablets sing together! Take them to the glowing History Gate, Guardian.'
    },
    gateQuizTitle: '🔱 HISTORY GATE — Indus Valley',
    puzzleTitle: 'Drainage Puzzle — guide water to the Great Bath',
    sealName: '🏺 Indus Valley Seal',
    portalTo: 'Chola lands'
  },
  {
    id: 2, key: 'chola', name: 'Rise of the Cholas', era: 'Chola Dynasty · c. 9th–13th century CE',
    icon: '🔵', color: 0x4aa3df, sky: 0x9fd4ff, fog: 0xbcd9f5, ground: 0x9dbb7a,
    tagline: 'Rebuild the great temple, piece by piece.',
    mission: 'THE TEMPLE BLUEPRINT — Speak with the Sthapati, then find 5 design pieces',
    collectible: { name: 'Temple Design Piece', icon: '🛕', target: 5, points: 10 },
    npcs: [
      { name: 'Sthapati (Architect)', icon: '🏛️', pos: [6, 0, 6], color: 0x9c5b1e, role: 'giver',
        lines: [
          'You stand before a dream half-built, Guardian. In my mind the vimana already touches the clouds — base, pillars, walls, tower, golden finial.',
          'But the harbour wind scattered my five drawings across the city! Will you walk with an old architect and gather them — stone yard, workshop, market, harbour, village lanes?'
        ] },
      { name: 'Sailor Karikalan', icon: '⛵', pos: [-14, 0, 10], color: 0x1e6f9c, role: 'sage',
        lines: [
          'Karikalan! Three monsoons I have sailed, and the sea still owes me stories. What brings you to my mooring, little Guardian?',
          'Drawings, eh? A heavy one — the foundation — will not have flown far. Try the stoneworkers’ yard, where the raw blocks sleep in rows.',
          'And keep one eye on the market awnings and one on the harbour ropes. Paper loves to hide where men are busiest.'
        ] }
    ],
    quest: {
      giver: 'Sthapati (Architect)',
      brief: 'Five temple drawings blew across the city — from stone yard to harbour. The royal architect waits by the market to guide the hunt.',
      artifacts: [
        { name: 'Foundation Design',
          clue: 'West lie the stoneworkers’ yards — raw blocks, half-cut pillars, the ring of chisels. Search where the unshaped rock waits in rows for the temple.',
          praise: 'The foundation! Now find where sculptors turn stone into beauty — their open workshop.' },
        { name: 'Pillar Design',
          clue: 'Find the open pillared workshop where sculptors work — low roof, stone dust underfoot, unfinished gods watching. Look between mallet and measuring cord.',
          praise: 'Straight and true! Next, the busy market — a drawing flutters near the stalls.' },
        { name: 'Wall Design',
          clue: 'Brave the market lanes, where awnings shade bronze and cloth. Between two neighbouring stalls, tucked where shoppers’ sandals kick the dust, lies the next drawing.',
          praise: 'Half the temple stands! Now brave the salty wind — search the harbour and its boats.' },
        { name: 'Tower Design',
          clue: 'Follow the gulls to the harbour: masts, ropes, mooring posts and lapping water. Search along the working waterfront, where cargo is loaded and unloaded.',
          praise: 'Nearly there! Last — the village streets, where something golden glints.' },
        { name: 'Finial Design',
          clue: 'East of the market run the quiet village lanes, past plaster houses and a grain-plot or two. Look for a glint of gold near a garden wall.',
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
    id: 3, key: 'fort', name: 'The Fort of Secrets', era: 'Medieval India · Forts & Sultanates',
    icon: '🟠', color: 0xd97b2e, sky: 0xffc98a, fog: 0xe8b083, ground: 0xb08a5a,
    tagline: 'Piece together the hidden inscription.',
    mission: 'THE HIDDEN MESSAGE — Speak with Guard Veer, then find 4 inscription pieces',
    collectible: { name: 'Inscription Piece', icon: '🪨', target: 4, points: 15 },
    npcs: [
      { name: 'Guard Veer', icon: '💂', pos: [4, 0, 8], color: 0x7a3b2e, role: 'giver',
        lines: [
          'Halt — friend. Forgive me; twenty years on these walls, and my spear arm still answers before my tongue. You are the Guardian, then?',
          'Our inscription lies shattered in four pieces — gate, courtyard, old walls, secret chamber. Walk with me, step by step, and this fort will call you its own. Ready?'
        ] },
      { name: 'Court Scholar', icon: '📖', pos: [-6, 0, -8], color: 0x4a5d8a, role: 'sage',
        lines: [
          'Another seeker! Good, good — these old eyes catalogue carvings all day: lotus for purity, peacock for pride. What troubles you, child?',
          'Veer’s order is wisest: begin at the great gate where the travellers pour through. Duty always waits nearest the entrance, you know.',
          'When the walls confuse you, look for the carving that does not belong — a different chisel, a different tale. Odd ones out are often doors in disguise.'
        ] }
    ],
    quest: {
      giver: 'Guard Veer',
      brief: 'An ancient inscription lies shattered in four pieces — from the main gate to the secret chamber. Guard Veer waits in the courtyard to brief you.',
      artifacts: [
        { name: 'Inscription · Duty',
          clue: 'Start at the great outer gate — twin towers, heavy arch, the tramp of travellers. Search the ground just inside, where every visitor’s feet must pass.',
          praise: 'Duty recovered! Next, where people gather — search the eastern courtyard.' },
        { name: 'Inscription · Courage',
          clue: 'Cross to the eastern courtyard, where stalls and facades crowd a busy square. Look along the base of the old stones, where the crowd rarely glances down.',
          praise: 'Two pieces home! Now the western walls — study the carvings for what does not belong.' },
        { name: 'Inscription · Wisdom',
          clue: 'Walk the western courtyard slowly and study its carvings — lotus, peacock, geometry. One panel was cut by a different hand; the piece rests at its foot.',
          praise: 'Wisdom returns! The last piece sleeps near the hidden door — approach the secret chamber.' },
        { name: 'Inscription · Memory',
          clue: 'North of the courtyard stands a plain, unremarkable wall — the kind eyes slide past. Press close: a hidden door sleeps there, and the last piece waits at its threshold.',
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
    { q: 'Which feature is strongly associated with cities of the Indus Valley Civilization?', options: ['Covered drains beside planned streets', 'Fortified watchtowers on every corner', 'Rock-cut cave theatres', 'Iron suspension bridges'], answer: 0, fact: 'Many Harappan cities had covered drains running beside planned streets.' },
    { q: 'What material gave the “Red City” its colour — used for most Harappan houses?', options: ['Polished sandstone blocks', 'Standard-sized fired mud bricks', 'Sun-dried thatch bundles', 'Carved marble slabs'], answer: 1, fact: 'Standard-sized fired bricks made Harappan construction strong and uniform.' },
    { q: 'The Great Bath at Mohenjo-daro was most likely used for…', options: ['Storing grain reserves', 'Ritual bathing ceremonies', 'Dyeing cotton cloth', 'Housing temple carts'], answer: 1, fact: 'Historians believe the watertight Great Bath was used for ritual bathing.' },
    { q: 'Harappan seals were mostly made of…', options: ['Carved steatite stone', 'Fired terracotta clay', 'Polished ivory tusks', 'Hammered copper sheets'], answer: 0, fact: 'Tiny steatite seals were carved with animals and undeciphered script.' },
    { q: 'Which of these was a Harappan port town that traded by sea?', options: ['Lothal', 'Dholavira', 'Kalibangan', 'Rakhigarhi'], answer: 0, fact: 'Lothal in Gujarat had a dockyard and traded with far-off lands.' }
  ],
  2: [
    { q: 'The Cholas are best remembered for…', options: ['Great South Indian temples', 'Rock-cut Himalayan caves', 'Planned desert forts', 'Terracotta stepwells'], answer: 0, fact: 'Chola temples like Thanjavur’s Brihadeeswara are architectural marvels.' },
    { q: 'Which famous Chola temple was built by Rajaraja I?', options: ['Brihadeeswara Temple, Thanjavur', 'Shore Temple, Mamallapuram', 'Meenakshi Temple, Madurai', 'Nataraja Temple, Chidambaram'], answer: 0, fact: 'Rajaraja Chola I built the Brihadeeswara temple around 1010 CE.' },
    { q: 'Chola bronze sculptures most famously depict…', options: ['Nataraja, the dancing Shiva', 'Rama, the archer prince', 'Ganesha, the remover of obstacles', 'Parvati, the mountain queen'], answer: 0, fact: 'Chola Nataraja bronzes are celebrated worldwide.' },
    { q: 'Chola power at sea meant they…', options: ['Sent naval expeditions across the seas', 'Built forts along mountain passes', 'Dug canals across the delta', 'Raised walls around the capital'], answer: 0, fact: 'Rajendra Chola’s navy reached Southeast Asia.' },
    { q: 'In temple architecture, the tall tower above the sanctum is called…', options: ['Vimana / Shikhara', 'Mandapa / Gopuram', 'Garbhagriha / Prakara', 'Stupi / Kalasha'], answer: 0, fact: 'The vimana rises above the garbhagriha (inner sanctum).' }
  ],
  3: [
    { q: 'Which monument is associated with Shah Jahan?', options: ['Humayun’s Tomb', 'Taj Mahal', 'Fatehpur Sikri', 'Qutub Minar'], answer: 1, fact: 'Shah Jahan built the Taj Mahal at Agra in memory of Mumtaz Mahal.' },
    { q: 'Forts like the one around you were built mainly to…', options: ['Protect people and rule a region', 'House markets and store grain only', 'Serve as royal hunting lodges', 'Stage plays and musical contests'], answer: 0, fact: 'Forts combined palaces, temples, markets and defences.' },
    { q: 'Qutub Minar was begun under which rulers?', options: ['The Delhi Sultans', 'The Mauryas and Guptas', 'The Cholas and Pallavas', 'The Mughals and Marathas'], answer: 0, fact: 'Qutb-ud-din Aibak began it; Iltutmish completed it.' },
    { q: 'Intricate fort carvings often include…', options: ['Lotus, peacock and geometric patterns', 'Calligraphy bands and arabesque vines', 'Marble Buddhas and stupa rails', 'Terracotta horsemen and chariots'], answer: 0, fact: 'Nature and geometry inspired medieval Indian art.' },
    { q: 'A “secret chamber” in stories usually hides…', options: ['Important records or treasures', 'Spare weapons for guards', 'Kitchens for royal feasts', 'Stables for war elephants'], answer: 0, fact: 'Forts really did have hidden rooms for grain, records and safety.' }
  ]
};

export const FINAL_QUESTIONS = [
  { q: 'Which civilization is known for planned cities and drainage?', options: ['Indus Valley Civilization', 'Vedic Pastoral Culture', 'Sangam Age Kingdoms', 'Rajput Hill Kingdoms'], answer: 0 },
  { q: 'Medieval fort inscriptions often recorded…', options: ['Royal orders and donations', 'Merchant shipping rates', 'Monsoon rainfall charts', 'Pilgrim travel songs'], answer: 0 },
  { q: 'Which dynasty is associated with great South Indian temples?', options: ['The Cholas', 'The Pallavas', 'The Pandyas', 'The Cheras'], answer: 0 },
  { q: 'Which monument is associated with Shah Jahan?', options: ['Qutub Minar', 'Taj Mahal', 'Sanchi Stupa', 'Hampi Vittala'], answer: 1 },
  { q: 'Arrange these eras in chronological (earliest → latest) order. Which comes FIRST?', options: ['Indus Valley Civilization', 'Chola Dynasty', 'Independence Movement', 'Medieval Sultanates'], answer: 0 }
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
    { name: 'Foundation Design', fact: 'Temples begin with a strong stone adhishthana (base).' },
    { name: 'Pillar Design', fact: 'Carved pillars hold up pillared halls (mandapas).' },
    { name: 'Wall Design', fact: 'Walls carry stories of gods, dancers and guardians.' },
    { name: 'Tower Design', fact: 'The vimana tower soars above the sanctum.' },
    { name: 'Finial Design', fact: 'A golden stupi crowns the temple like a blessing.' }
  ],
  3: [
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
  { id: 'guardian', icon: '🔱', name: 'GUARDIAN OF TIME', desc: 'Collect all three Time Seals.' },
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
