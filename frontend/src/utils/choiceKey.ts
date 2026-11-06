/**
 * Çoktan seçmeli soruların cevap anahtarı, şıkların kayıtlı sırasındaki harftir (A–F).
 * Sınav servisi bu harfi şık metnine çevirip öğrencinin gönderdiği metinle karşılaştırır;
 * bu yüzden boş şıklar ayıklanırken harfin aynı şıkkı göstermeye devam etmesi gerekir.
 */
export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export interface CompactedChoices {
    options: string[];
    /** Ayıklanmış listedeki harf; anahtar bir şıkla eşleşmiyorsa boş string. */
    correctAnswer: string;
}

/**
 * Boş şıkları atar ve anahtarı ayıklanmış listeye göre harfe çevirir.
 * Anahtar harf (büyük/küçük) ya da şıkkın metni olabilir.
 */
export function compactChoices(rawOptions: readonly string[], rawKey: string): CompactedChoices {
    const key = rawKey.trim();
    const letterIndex = key.length === 1 ? OPTION_LETTERS.indexOf(key.toUpperCase() as typeof OPTION_LETTERS[number]) : -1;

    const options: string[] = [];
    let correctAnswer = '';

    rawOptions.forEach((raw, index) => {
        const option = raw.trim();
        if (!option) return;

        const matchesKey = letterIndex >= 0
            ? index === letterIndex
            : key !== '' && option.toLocaleLowerCase('tr-TR') === key.toLocaleLowerCase('tr-TR');

        if (matchesKey && !correctAnswer && options.length < OPTION_LETTERS.length) {
            correctAnswer = OPTION_LETTERS[options.length];
        }
        options.push(option);
    });

    return { options, correctAnswer };
}
