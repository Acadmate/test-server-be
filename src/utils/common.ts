export function decodeEncodedString(encodedString: string): string {
    return encodedString.replace(
        /\\x([0-9A-Fa-f]{2})/g,
        (_, p1: string) => String.fromCharCode(parseInt(p1, 16))
    );
}

export function extractTextBetweenWords(
    text: string,
    startWord: string,
    endWord: string,
): string | null {
    if (!text || !startWord || !endWord) return null

    const startIndex = text.indexOf(startWord)
    if (startIndex === -1) return null

    const searchStart = startIndex + startWord.length
    const endIndex = text.indexOf(endWord, searchStart)
    if (endIndex === -1) return null

    const result = text.substring(searchStart, endIndex).trim()
    return result.length > 0 ? result : null
}