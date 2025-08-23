export const encrypt = async (text: string, key: string): Promise<string> => {
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const keyData = enc.encode(key.slice(0, 32).padEnd(32, '0'));
    const cryptoKey = await (globalThis.crypto as any).subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = (globalThis.crypto as any).getRandomValues(new Uint8Array(12));
    const encrypted = await (globalThis.crypto as any).subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return Buffer.from(combined).toString('base64');
};

export const decrypt = async (encryptedText: string, key: string): Promise<string> => {
    const data = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0))
    const iv = data.slice(0, 12)
    const encrypted = data.slice(12)
    const encoder = new TextEncoder()
    const keyData = encoder.encode(key.slice(0, 32).padEnd(32, '0'))
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt'])
    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encrypted
    )
    const decoder = new TextDecoder()
    return decoder.decode(decryptedBuffer)
}