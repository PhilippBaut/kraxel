// Alle Level-Texte, Schlüssel ist der Dateiname ohne `.txt`.
const files = import.meta.glob('./*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const LEVELS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, text]) => [path.replace(/^\.\//, '').replace(/\.txt$/, ''), text]),
);

/** Das Level, das der Titel startet. Task 17 stellt auf '1-1' um. */
export const START_LEVEL = 'uebungsplatz';
