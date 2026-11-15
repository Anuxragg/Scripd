export interface CatalogBook {
  id: string;
  title: string;
  subtitle?: string;
  authors: string[];
  year?: number;
  pages?: string;
  publisher?: string;
  language?: string;
  coverURL?: string;
  description?: string;
  openLibraryKey?: string;
  openLibraryUrl?: string;
  isbn13?: string;
}

// Canonical books in the Scripd catalog
export const KNOWN_BOOKS: Record<string, CatalogBook> = {
  "secret-history": {
    id: "secret-history",
    title: "The Secret History",
    subtitle: "A story of classics, obsession, and murder",
    authors: ["Donna Tartt"],
    year: 1992,
    pages: "559 pages",
    publisher: "Alfred A. Knopf",
    language: "English",
    coverURL: "https://covers.openlibrary.org/b/id/8231856-L.jpg",
    description:
      "Under the influence of their charismatic classics professor, a group of clever, eccentric misfits at an elite New England college discover a way of thinking and living that is a world away from the humdrum existence of their contemporaries. But when they go beyond the boundaries of normal morality, their lives change profoundly and forever.",
    openLibraryKey: "OL8231856M",
    openLibraryUrl: "https://openlibrary.org/works/OL15368947W",
    isbn13: "9781400031702",
  },
  "norwegian-wood": {
    id: "norwegian-wood",
    title: "Norwegian Wood",
    subtitle: "A nostalgic story of loss and memory",
    authors: ["Haruki Murakami"],
    year: 1987,
    pages: "296 pages",
    publisher: "Kodansha",
    language: "Japanese / English",
    coverURL: "https://covers.openlibrary.org/b/id/8235113-L.jpg",
    description:
      "Toru Watanabe hears his ex-girlfriend Naoko's favorite Beatles song, and everything comes rushing back: his first love, the loss of his best friend Kizuki, and the quiet yearning of college life in late 1960s Tokyo.",
    openLibraryKey: "OL8235113M",
    openLibraryUrl: "https://openlibrary.org/works/OL3142475W",
    isbn13: "9780375704024",
  },
  "tomorrow-tomorrow": {
    id: "tomorrow-tomorrow",
    title: "Tomorrow, and Tomorrow, and Tomorrow",
    subtitle: "A novel of creative collaboration and friendship",
    authors: ["Gabrielle Zevin"],
    year: 2022,
    pages: "416 pages",
    publisher: "Knopf",
    language: "English",
    coverURL: "https://covers.openlibrary.org/b/id/12847926-L.jpg",
    description:
      "Two friends—often in love, but never lovers—come together as creative partners in the world of video game design, where success brings them fame, joy, tragedy, duplicity, and, ultimately, a kind of immortality.",
    openLibraryKey: "OL12847926M",
    openLibraryUrl: "https://openlibrary.org/works/OL27213886W",
    isbn13: "9780593321201",
  },
  dune: {
    id: "dune",
    title: "Dune",
    subtitle: "The epic masterpiece of science fiction",
    authors: ["Frank Herbert"],
    year: 1965,
    pages: "688 pages",
    publisher: "Chilton Books",
    language: "English",
    coverURL: "https://covers.openlibrary.org/b/id/12836262-L.jpg",
    description:
      "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, heir to a noble family tasked with ruling an inhospitable world where the only thing of value is the 'spice' melange, a drug capable of extending life and enhancing consciousness.",
    openLibraryKey: "OL12836262M",
    openLibraryUrl: "https://openlibrary.org/works/OL893415W",
    isbn13: "9780441172719",
  },
  "klara-and-the-sun": {
    id: "klara-and-the-sun",
    title: "Klara and the Sun",
    subtitle: "A story about what it means to love",
    authors: ["Kazuo Ishiguro"],
    year: 2021,
    pages: "303 pages",
    publisher: "Faber & Faber",
    language: "English",
    coverURL: "https://covers.openlibrary.org/b/id/10522964-L.jpg",
    description:
      "Klara is an Artificial Friend with outstanding observational qualities, who, from her place in the store, watches carefully the behavior of those who come in to browse, and of those who pass on the street outside. She remains hopeful that a customer will soon choose her.",
    openLibraryKey: "OL10522964M",
    openLibraryUrl: "https://openlibrary.org/works/OL20847900W",
    isbn13: "9780593318171",
  },
  pachinko: {
    id: "pachinko",
    title: "Pachinko",
    subtitle: "An epic generational saga",
    authors: ["Min Jin Lee"],
    year: 2017,
    pages: "496 pages",
    publisher: "Grand Central Publishing",
    language: "English",
    coverURL: "https://covers.openlibrary.org/b/id/8315147-L.jpg",
    description:
      "In the early 1900s, teenaged Sunja, the adored daughter of a crippled fisherman, falls for a wealthy stranger at the seashore near her home in Korea. He promises her the world, but when she discovers she is pregnant—and that her lover is married—she refuses to be bought.",
    openLibraryKey: "OL8315147M",
    openLibraryUrl: "https://openlibrary.org/works/OL17849514W",
    isbn13: "9781455563937",
  },
  "the-help": {
    id: "the-help",
    title: "The Help",
    subtitle: "A story of courage, friendship, and change",
    authors: ["Kathryn Stockett"],
    year: 2009,
    pages: "464 pages",
    publisher: "Putnam",
    language: "English",
    coverURL: "https://covers.openlibrary.org/b/id/8231991-L.jpg",
    description:
      "In 1962 Mississippi, three extraordinary women dare to shatter the unspoken rules of their town by coming together for a clandestine project that puts them all at risk.",
    openLibraryKey: "OL15368952W",
    isbn13: "9780399155345",
  },
};

export function findKnownBook(idOrTitle?: string): CatalogBook | null {
  if (!idOrTitle) return null;
  const key = idOrTitle.toLowerCase().replace(/^(works\/|books\/)/i, "").trim();
  if (KNOWN_BOOKS[key]) return KNOWN_BOOKS[key];

  const normalizedSlug = key.replace(/[\s_]+/g, "-");
  if (KNOWN_BOOKS[normalizedSlug]) return KNOWN_BOOKS[normalizedSlug];

  const cleanTitle = key.replace(/-/g, " ");
  for (const b of Object.values(KNOWN_BOOKS)) {
    if (
      b.id === key ||
      b.id === normalizedSlug ||
      b.title.toLowerCase() === cleanTitle ||
      b.title.toLowerCase() === key ||
      (b.openLibraryKey && b.openLibraryKey.toLowerCase() === key)
    ) {
      return b;
    }
  }
  return null;
}
