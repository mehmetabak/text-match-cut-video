// src/lib/textUtils.js
const LOREM_IPSUM = "In the world of cinematography, the match cut is a pivotal editing technique. A match cut transitions from one shot to another by matching the action or subject, creating a seamless flow. For instance, a shot of a spinning wheel could match cut to a spinning galaxy. This powerful tool, the match cut, helps bridge time and space within a narrative. Directors often use a clever match cut to surprise or delight the audience. It's not just a transition; it's a statement. Understanding the match cut is essential for any aspiring filmmaker. Its elegance lies in its simplicity and its profound impact on storytelling. Another great example of a match cut can be seen in classic cinema where a bone thrown by a hominid becomes a satellite orbiting Earth. This match cut represents millions of years of evolution in a single, breathtaking moment. The editor searched for the perfect match cut for the climax. Every frame was considered to make the match cut flawless.";

export function generateRandomText(phrase) {
    // Metni, aranan ifadeyle zenginleştirerek daha fazla bulunma olasılığı sağlıyoruz.
    const fullText = LOREM_IPSUM.replace(/match cut/gi, phrase);
    const positions = [];

    // Kelimenin tüm geçtiği yerlerin başlangıç indekslerini bul
    let lastIndex = -1;
    while ((lastIndex = fullText.toLowerCase().indexOf(phrase.toLowerCase(), lastIndex + 1)) !== -1) {
        positions.push(lastIndex);
    }

    // Hata 1'i düzeltmek için: `phrase`'i de geri döndür.
    return { fullText, positions, phrase };
}