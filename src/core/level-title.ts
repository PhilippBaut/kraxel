// Text der Titelkarte beim Levelstart. Kein Phaser, kein DOM.

/** „1-2 BLUMENHANG“: Kennung und Name in Großbuchstaben, ß wird SS (die Pixelschrift hat kein ß).
 *  Nur Kennungen wie „1-2“ stehen vorn; Dev-Level (z. B. „uebungsplatz“) zeigen nur den Namen. */
export function levelTitle(id: string, name: string): string {
  const text = /^\d+-/.test(id) && name !== id ? `${id} ${name}` : name;
  return text.replace(/ß/g, 'SS').toUpperCase();
}
