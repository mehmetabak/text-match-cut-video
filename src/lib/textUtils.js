// src/lib/textUtils.js

const PLACEHOLDER = "__PLACEHOLDER__";

// ==========================================
// 1. KLASİK MOD (Eski yapıyı %100 korur)
// ==========================================
const TEXT_SOURCES = [
    {
        title: `The Inevitable Rise of ${PLACEHOLDER} and Superintelligence`,
        body: `In the realm of artificial intelligence, ${PLACEHOLDER} represents a hypothetical future point where technological growth becomes uncontrollable. Discussions about this concept often involve the idea of an ${PLACEHOLDER}, where an intelligent agent could enter a runaway reaction of self-improvement cycles. This process would create a ${PLACEHOLDER} that would far surpass all human intellect. The ethical implications of ${PLACEHOLDER} are a major topic of debate. How do we ensure that a ${PLACEHOLDER} remains aligned with human values? The challenge of ${PLACEHOLDER} is not just technological, but also deeply moral. It forces us to confront the very definition of ${PLACEHOLDER} and our place in the universe. Many experts believe that ${PLACEHOLDER} is inevitable. The development of ${PLACEHOLDER} requires careful consideration.`
    },
    {
        title: `A Deep Dive into ${PLACEHOLDER} and Its Lasting Legacy`,
        body: `${PLACEHOLDER} was a fervent period of European cultural, artistic, and economic rebirth. Some of the greatest thinkers, including ${PLACEHOLDER}, thrived during this era. Their works are considered absolute ${PLACEHOLDER}. The artistic innovations of ${PLACEHOLDER}, such as perspective, fundamentally changed Western art. The patronage of wealthy families was crucial for ${PLACEHOLDER}. This era promoted the rediscovery of classical philosophy, a key driver for ${PLACEHOLDER}. The spirit of ${PLACEHOLDER} can still be felt in modern art. The legacy of ${PLACEHOLDER} is a testament to human creativity. We study ${PLACEHOLDER} to understand the roots of our modern world. It was a time of true ${PLACEHOLDER}.`
    },
    {
        title: `Understanding ${PLACEHOLDER}: The Philosophy of Freedom`,
        body: `${PLACEHOLDER} is a philosophical inquiry that explores the problem of human existence. It centers on the lived experience of the individual. For these thinkers, the starting point is the ${PLACEHOLDER}. A central proposition of ${PLACEHOLDER} is that existence precedes essence, meaning individuals create their own values. The ${PLACEHOLDER} is one lived with a full awareness of this freedom. This philosophy challenges us to define our own ${PLACEHOLDER}. The search for meaning is a core theme in ${PLACEHOLDER}. It emphasizes concepts like free will, which is central to ${PLACEHOLDER}. Understanding ${PLACEHOLDER} can provide a new perspective on life's challenges. It's a journey into the self, a true ${PLACEHOLDER}.`
    },
    {
        title: `The Art of the ${PLACEHOLDER}: A Cinematic Analysis`,
        body: `In cinematography, the ${PLACEHOLDER} is a pivotal editing technique. A ${PLACEHOLDER} transitions between shots by matching action or subject. This powerful tool, the ${PLACEHOLDER}, helps bridge time and space. Directors often use a clever ${PLACEHOLDER} to surprise the audience. Understanding the ${PLACEHOLDER} is essential for any filmmaker. Its elegance lies in its simplicity and profound impact. That specific ${PLACEHOLDER} was truly brilliant. The editor searched for the perfect ${PLACEHOLDER} for the climax. Every frame was considered to make the ${PLACEHOLDER} flawless. The use of ${PLACEHOLDER} can be seen in many classic films. It is a signature move of a skilled director, this ${PLACEHOLDER}.`
    }
];

export function generateRandomText(phrase) {
    const source = TEXT_SOURCES[Math.floor(Math.random() * TEXT_SOURCES.length)];
    
    const title = source.title.replace(new RegExp(PLACEHOLDER, 'g'), phrase);
    const fullText = source.body.replace(new RegExp(PLACEHOLDER, 'g'), phrase);

    const positions = [];
    let lastIndex = -1;
    while ((lastIndex = fullText.toLowerCase().indexOf(phrase.toLowerCase(), lastIndex + 1)) !== -1) {
        positions.push(lastIndex);
    }

    return { title, fullText, positions, phrase, mode: 'classic' };
}

// ==========================================
// 2. YENİ GAZETE MODU (Newspaper / New Mode)
// ==========================================
const NEWSPAPER_NAMES = [
    "THE DAILY NONSENSE",
    "THE REGIONAL MURMUR",
    "THE BLUFFINGTON POST",
    "THE EVENING RUBBISH",
    "THE LIBERTY CITY LEDGER",
    "THE HONKING GAZETTE",
    "SAN ANDREAS CHRONICLE",
    "THE DOWNTOWN DISPATCH",
    "GREATER AREA TODAY",
    "THE CONTINENTAL WHISPER",
    "THE MORNING VERDICT",
    "THE SUBURBAN ORACLE",
    "THE MIDNIGHT REVIEW",
    "THE WEEKEND PANIC",
    "THE URBAN MYTH TIMES",
    "THE ACCIDENTAL REPORTER",
    "THE LAST PAGE PRESS",
    "THE METROPOLITAN ECHO",
    "THE OBSERVER TRIBUNE",
    "THE CHRONICLE INQUIRER"
];

const BYLINE_TEMPLATES = [
    "— Filed From A Parking Structure",
    "By Staff Reporter (Third Week)",
    "By A Man With A Recorder",
    "— Investigative Team (Redacted)",
    "— Crime & Nonsense Desk",
    "Documents obtained by this newspaper suggest someone knew.",
    "Unconfirmed Sources Unit",
    "— Sources close to the situation say they were told not to talk",
    "By Lead Correspondent (Temporary)",
    "— From Our Special Wire",
    "By Junior Assistant Editor",
    "Reports received past midnight confirmed this.",
    "— Exclusive to this edition",
    "By An Anonymous Observer",
    "— Dispatched From The Scene",
    "Special Reports Bureau",
    "By The Department of Obvious Findings"
];

// Manşet şablonları
const HEADLINE_TEMPLATES = [
    `"A van was seen leaving at speed. ${PLACEHOLDER} It was beige"`,
    `"A local man claims responsibility. ${PLACEHOLDER} Police are not convinced"`,
    `Re-elected despite everything, including ${PLACEHOLDER}`,
    `"An expert was ${PLACEHOLDER} consulted. The expert was also confused"`,
    `Celebrity apologizes for ${PLACEHOLDER}. Nobody is satisfied.`,
    `Police confirm ${PLACEHOLDER}. Decline to elaborate.`,
    `${PLACEHOLDER}: still ongoing`,
    `"${PLACEHOLDER}" — official statement, full text`,
    `Of accountability whispers: "${PLACEHOLDER}"`,
    `${PLACEHOLDER} was briefly mentioned. Authorities are urging calm.`,
    `A pigeon was detained in connection with ${PLACEHOLDER}. It was later released.`,
    `City council voted 4-3 to table ${PLACEHOLDER} indefinitely.`,
    `Insiders say the culture was "a lot", which means ${PLACEHOLDER}.`,
    `Witnesses describe ${PLACEHOLDER} as quiet, which is what they always say.`,
    `The committee formed to address ${PLACEHOLDER} has scheduled four meetings.`,
    `A second statement regarding ${PLACEHOLDER} contradicts the first.`,
    `Officials confirmed the smell but not ${PLACEHOLDER}.`,
    `The contractor billed for ${PLACEHOLDER} was not visible to anyone.`,
    `Three people clapped when ${PLACEHOLDER} was announced.`,
    `The license for ${PLACEHOLDER} had expired in 2019. Nobody noticed.`
];

// Paragraf içinde kelime barındıran şablonlar
const PARAGRAPH_TARGET_TEMPLATES = [
    `The investigation is ongoing, apparently. A pigeon ${PLACEHOLDER} was briefly detained. It offered no statement.`,
    `An audit was ${PLACEHOLDER} mentioned briefly and then not mentioned again. The building has been there for years.`,
    `Nobody noticed until now. Sources say ${PLACEHOLDER} was always like this. He resigned to spend more time.`,
    `The suspect was later found talking about ${PLACEHOLDER} at a nearby buffet. Nobody was charged.`,
    `CCTV captured something resembling ${PLACEHOLDER}. Officers are reviewing it very slowly.`,
    `The email regarding ${PLACEHOLDER} was sent to everyone, including the people it was about.`,
    `Funding for ${PLACEHOLDER} has been allocated. Its current location is unknown. Three people clapped.`
];

// Alt başlıkta kelime barındıran şablonlar
const BYLINE_TARGET_TEMPLATES = [
    `— Filed regarding ${PLACEHOLDER} from a parking structure`,
    `By Staff Reporter on ${PLACEHOLDER} (Third Week)`,
    `— Special Investigation into ${PLACEHOLDER} (Redacted)`,
    `Documents obtained suggest someone knew about ${PLACEHOLDER}.`,
    `— Unconfirmed ${PLACEHOLDER} Sources Unit`
];

const GENERIC_HEADLINES = [
    "Celebrity apologizes to everyone involved",
    "Re-elected despite everything, say officials",
    "Police confirm incident occurred, decline to elaborate",
    "The corporation released a statement. Nobody read it",
    "City council voted 4-3 to table the issue indefinitely",
    "Witnesses describe situation as quiet, which is common",
    "The meeting was rescheduled four times and then cancelled",
    "Officials confirm the smell but not the source",
    "A second van was also seen leaving the parking lot"
];

const FILLER_SENTENCES = [
    "The building has been there for years. Nobody noticed until now.",
    "A van was seen leaving at speed. It was beige.",
    "Sources say it was always like this.",
    "The report is nineteen pages and solves nothing.",
    "Police arrived three hours later. They had sandwiches.",
    "The chairman called it unprecedented. It had happened twice before.",
    "Her publicist says she is resting and reflecting on the experience.",
    "Twelve people filed complaints. One received a reply.",
    "The statue has been removed pending further discussion.",
    "The meeting was rescheduled four times and then cancelled.",
    "The suspect was later found at a nearby buffet.",
    "A pigeon was briefly detained. It offered no statement.",
    "Funding has been allocated. Its current location is unknown.",
    "A full refund was promised to some of the affected customers. Most of it.",
    "The email was sent to everyone, including the people it was about.",
    "Officers are reviewing it slowly. Witnesses disagree on basically everything.",
    "The app was updated. It is worse now.",
    "He resigned to spend more time with his investments.",
    "Officials confirmed the smell but not the source.",
    "The dog was fine. Nobody had asked about the dog.",
    "Three people clapped. Several others checked their phones.",
    "The corporation released a statement. Nobody read it.",
    "Neighbors describe him as quiet, which is what they always say.",
    "The assistant has since resigned. Funding has been paused indefinitely.",
    "CCTV captured something. Officers are reviewing it repeatedly.",
    "The mayor denied everything and then left the building abruptly.",
    "The consultant fee was not disclosed. It was surprisingly large.",
    "Insiders say the culture was 'a lot', which means something specific.",
    "A second van was also seen. Nobody mentioned this until now.",
    "The permit, it turns out, was never filed.",
    "Authorities are urging calm, which is not helping."
];

// Deterministik Seeded Pseudo-Random Generator (Mulberry32)
export function createPRNG(seedNumber) {
    let s = (seedNumber >>> 0) || 1337;
    return function() {
        let t = s += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function stringToSeed(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash);
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function generateDateLine(prng) {
    const day = DAYS[Math.floor(prng() * DAYS.length)];
    const month = MONTHS[Math.floor(prng() * MONTHS.length)];
    const dayNum = Math.floor(prng() * 28) + 1;
    const year = Math.floor(prng() * 40) + 1985;
    const vol = Math.floor(prng() * 300) + 100;
    const no = Math.floor(prng() * 200) + 10;
    return `${day} · ${month} ${dayNum} ${year} · VOL.${vol} NO.${no}`;
}

function generateParagraph(prng, sentenceCount = 6) {
    const sentences = [];
    for (let i = 0; i < sentenceCount; i++) {
        const idx = Math.floor(prng() * FILLER_SENTENCES.length);
        sentences.push(FILLER_SENTENCES[idx]);
    }
    return sentences.join(" ");
}

export function generateNewspaperData(phrase, seedInput) {
    const seed = typeof seedInput === 'number' ? seedInput : stringToSeed(phrase || "match-cut");
    const prng = createPRNG(seed);

    const TOTAL_SCENES = 24;
    const scenes = [];

    const shuffledHeadlines = [...HEADLINE_TEMPLATES].sort(() => prng() - 0.5);
    const shuffledParagraphTargets = [...PARAGRAPH_TARGET_TEMPLATES].sort(() => prng() - 0.5);
    const shuffledBylineTargets = [...BYLINE_TARGET_TEMPLATES].sort(() => prng() - 0.5);
    const shuffledGenericHeadlines = [...GENERIC_HEADLINES].sort(() => prng() - 0.5);
    const shuffledPapers = [...NEWSPAPER_NAMES].sort(() => prng() - 0.5);
    const shuffledBylines = [...BYLINE_TEMPLATES].sort(() => prng() - 0.5);

    // Yerleşim Çeşitleri: 
    // 0 = HEADLINE_FOCUS (Manşet ortası veya başlangıcı)
    // 1 = PARAGRAPH_FOCUS (Paragraf içi, yakın çekim)
    // 2 = HEADLINE_MACRO (Dev manşet, aşırı yakın çekim)
    // 3 = BYLINE_FOCUS (Alt başlık odağı)
    const PLACEMENT_CYCLE = ['HEADLINE', 'PARAGRAPH', 'HEADLINE_MACRO', 'BYLINE', 'HEADLINE'];

    for (let i = 0; i < TOTAL_SCENES; i++) {
        const placementType = PLACEMENT_CYCLE[i % PLACEMENT_CYCLE.length];
        const paperName = shuffledPapers[i % shuffledPapers.length];
        const dateLine = generateDateLine(prng);

        let headline = "";
        let byline = "";
        let targetText = ""; // Hedef kelimenin içinde bulunduğu satır/blok
        let zoomScale = 1.0;

        if (placementType === 'HEADLINE') {
            const rawHead = shuffledHeadlines[i % shuffledHeadlines.length];
            headline = rawHead.replace(new RegExp(PLACEHOLDER, 'g'), phrase);
            byline = shuffledBylines[i % shuffledBylines.length];
            targetText = headline;
            zoomScale = 1.0 + (prng() * 0.25 - 0.1); // 0.9x - 1.15x
        } else if (placementType === 'HEADLINE_MACRO') {
            const rawHead = shuffledHeadlines[(i + 3) % shuffledHeadlines.length];
            headline = rawHead.replace(new RegExp(PLACEHOLDER, 'g'), phrase);
            byline = shuffledBylines[(i + 2) % shuffledBylines.length];
            targetText = headline;
            zoomScale = 1.5 + (prng() * 0.4); // 1.5x - 1.9x (Büyük yakın çekim)
        } else if (placementType === 'PARAGRAPH') {
            headline = shuffledGenericHeadlines[i % shuffledGenericHeadlines.length];
            byline = shuffledBylines[i % shuffledBylines.length];
            const rawPara = shuffledParagraphTargets[i % shuffledParagraphTargets.length];
            targetText = rawPara.replace(new RegExp(PLACEHOLDER, 'g'), phrase);
            zoomScale = 1.15 + (prng() * 0.3); // 1.15x - 1.45x
        } else if (placementType === 'BYLINE') {
            headline = shuffledGenericHeadlines[(i + 1) % shuffledGenericHeadlines.length];
            const rawByline = shuffledBylineTargets[i % shuffledBylineTargets.length];
            byline = rawByline.replace(new RegExp(PLACEHOLDER, 'g'), phrase);
            targetText = byline;
            zoomScale = 1.25 + (prng() * 0.3); // 1.25x - 1.55x
        }

        const topParagraph = generateParagraph(prng, 16);
        const bottomParagraph = generateParagraph(prng, 24);

        scenes.push({
            sceneIndex: i,
            placementType,
            paperName,
            dateLine,
            headline,
            byline,
            targetText,
            topParagraph,
            bottomParagraph,
            phrase,
            zoomScale
        });
    }

    const primaryScene = scenes[0];
    const fullText = `${primaryScene.topParagraph} ${primaryScene.headline} ${primaryScene.bottomParagraph}`;
    const positions = scenes.map((_, idx) => idx);

    return {
        title: primaryScene.headline,
        fullText,
        positions,
        phrase,
        mode: 'newspaper',
        seed,
        scenes
    };
}

// Birleşik veri üreteci
export function generateMatchCutData(phrase, mode = 'classic', seed) {
    if (mode === 'classic') {
        return generateRandomText(phrase);
    }
    return generateNewspaperData(phrase, seed);
}
