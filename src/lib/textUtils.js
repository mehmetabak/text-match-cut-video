// src/lib/textUtils.js
const LOREM_IPSUM = "The match cut is a cinematic technique. In film editing, a match cut is a cut from one shot to another where the two shots are matched by the action or subject matter. For example, a character may be shown opening a door in one shot, and the next shot may show the same character opening a different door. This creates a sense of continuity. The use of a match cut is a powerful tool. The director wanted a special match cut for the final scene. This helps to create a seamless transition between the two shots. The term match cut is essential for filmmakers. It allows for a more fluid and engaging viewing experience. That match cut was truly brilliant.";

export function generateRandomText(phrase) {
    // Metni kasıtlı olarak ifadeyle zenginleştiriyoruz.
    const fullText = LOREM_IPSUM.replace(/match cut/gi, phrase);
    const positions = [];

    let lastIndex = -1;
    while ((lastIndex = fullText.toLowerCase().indexOf(phrase.toLowerCase(), lastIndex + 1)) !== -1) {
        positions.push(lastIndex);
    }

    return { fullText, positions };
}

