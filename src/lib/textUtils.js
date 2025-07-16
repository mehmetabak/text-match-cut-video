// src/lib/textUtils.js

const PLACEHOLDER = "__PLACEHOLDER__";

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

    return { title, fullText, positions, phrase };
}   