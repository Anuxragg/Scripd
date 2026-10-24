import { z } from "zod";
import { apiRequest } from "@/lib/api/client";

const bookSchema = z.object({
  id: z.string(),
  open_library_key: z.string(),
  isbn13: z.string().optional(),
  title: z.string(),
  subtitle: z.string().optional(),
  authors: z.array(z.string()),
  author_keys: z.array(z.string()).optional(),
  cover_url: z.string().optional(),
  published_year: z.number().int().optional(),
  description: z.string().optional(),
  open_library_url: z.string(),
  metadata_synced_at: z.string().optional().default(() => new Date().toISOString()),
  created_at: z.string().optional().default(() => new Date().toISOString()),
  updated_at: z.string().optional().default(() => new Date().toISOString()),
});

const searchResponseSchema = z.object({
  data: z
    .array(bookSchema)
    .nullish()
    .transform((val) => val ?? []),
  meta: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    has_more: z.boolean(),
    source: z.enum(["open_library", "local_catalog"]).optional().default("open_library"),
  }),
});

const bookResponseSchema = z.object({
  data: bookSchema,
  meta: z.record(z.string(), z.unknown()).optional().default({}),
});

export type Book = z.infer<typeof bookSchema>;
export type BookSearchResult = z.infer<typeof searchResponseSchema>;

export const FAMOUS_BOOKS_CATALOG: Book[] = [
  {
    id: "OL1168083W",
    open_library_key: "/works/OL1168083W",
    isbn13: "9780451524935",
    title: "1984",
    subtitle: "A Novel",
    authors: ["George Orwell"],
    cover_url: "https://covers.openlibrary.org/b/id/7222246-L.jpg",
    published_year: 1949,
    description: "Nineteen Eighty-Four is a dystopian social science fiction novel and cautionary tale written by English writer George Orwell. It explores the consequences of totalitarianism, mass surveillance, and repressive regimentation of persons and behaviours within society.",
    open_library_url: "https://openlibrary.org/works/OL1168083W",
    metadata_synced_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "OL468516W",
    open_library_key: "/works/OL468516W",
    isbn13: "9780743273565",
    title: "The Great Gatsby",
    subtitle: undefined,
    authors: ["F. Scott Fitzgerald"],
    cover_url: "https://covers.openlibrary.org/b/id/8432047-L.jpg",
    published_year: 1925,
    description: "The Great Gatsby is a 1925 novel by American writer F. Scott Fitzgerald. Set in the Jazz Age on Long Island, near New York City, the novel depicts first-person narrator Nick Carraway's interactions with mysterious millionaire Jay Gatsby and Gatsby's obsession to reunite with his former lover, Daisy Buchanan.",
    open_library_url: "https://openlibrary.org/works/OL468516W",
    metadata_synced_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "OL893415W",
    open_library_key: "/works/OL893415W",
    isbn13: "9780441013593",
    title: "Dune",
    subtitle: undefined,
    authors: ["Frank Herbert"],
    cover_url: "https://covers.openlibrary.org/b/id/8740578-L.jpg",
    published_year: 1965,
    description: "Set on the desert planet Arrakis, Dune is the story of Paul Atreides, heir to a noble family tasked with ruling an inhospitable world where the only thing of value is the 'spice' melange, a drug capable of extending life and enhancing consciousness.",
    open_library_url: "https://openlibrary.org/works/OL893415W",
    metadata_synced_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "OL82563W",
    open_library_key: "/works/OL82563W",
    isbn13: "9780747532699",
    title: "Harry Potter and the Philosopher's Stone",
    subtitle: undefined,
    authors: ["J.K. Rowling"],
    cover_url: "https://covers.openlibrary.org/b/id/10521270-L.jpg",
    published_year: 1997,
    description: "Harry Potter has never even heard of Hogwarts when the letters start dropping on the doormat at number four, Privet Drive. Addressed in green ink on yellowish parchment with a purple seal, they are swiftly confiscated by his grisly aunt and uncle.",
    open_library_url: "https://openlibrary.org/works/OL82563W",
    metadata_synced_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "OL66554W",
    open_library_key: "/works/OL66554W",
    isbn13: "9780141439518",
    title: "Pride and Prejudice",
    subtitle: undefined,
    authors: ["Jane Austen"],
    cover_url: "https://covers.openlibrary.org/b/id/8258649-L.jpg",
    published_year: 1813,
    description: "Pride and Prejudice is an 1813 romantic novel of manners written by Jane Austen. The novel follows the character development of Elizabeth Bennet, the dynamic protagonist of the book who learns about the repercussions of hasty judgments and comes to appreciate the difference between superficial goodness and actual goodness.",
    open_library_url: "https://openlibrary.org/works/OL66554W",
    metadata_synced_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "OL14959146W",
    open_library_key: "/works/OL14959146W",
    isbn13: "9780060935467",
    title: "To Kill a Mockingbird",
    subtitle: undefined,
    authors: ["Harper Lee"],
    cover_url: "https://covers.openlibrary.org/b/id/8225261-L.jpg",
    published_year: 1960,
    description: "The unforgettable novel of a childhood in a sleepy Southern town and the crisis of conscience that rocked it, To Kill A Mockingbird became an instant bestseller and a critical success when it was first published in 1960.",
    open_library_url: "https://openlibrary.org/works/OL14959146W",
    metadata_synced_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "OL262758W",
    open_library_key: "/works/OL262758W",
    isbn13: "9780547928227",
    title: "The Hobbit",
    subtitle: "There and Back Again",
    authors: ["J.R.R. Tolkien"],
    cover_url: "https://covers.openlibrary.org/b/id/8406782-L.jpg",
    published_year: 1937,
    description: "Bilbo Baggins is a hobbit who enjoys a comfortable, unambitious life, rarely travelling further than the pantry of his hobbit-hole in Bag End. But his contentment is disturbed when the wizard Gandalf and a company of thirteen dwarves arrive on his doorstep.",
    open_library_url: "https://openlibrary.org/works/OL262758W",
    metadata_synced_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "OL1184W",
    open_library_key: "/works/OL1184W",
    isbn13: "9780140449136",
    title: "Crime and Punishment",
    subtitle: undefined,
    authors: ["Fyodor Dostoevsky"],
    cover_url: "https://covers.openlibrary.org/b/id/8235116-L.jpg",
    published_year: 1866,
    description: "Raskolnikov, a destitute and desperate former student, wanders through the slums of St Petersburg and commits a random murder without remorse or regret. He imagines himself to be an extraordinary human being, a Napoleon, having a right to commit crimes.",
    open_library_url: "https://openlibrary.org/works/OL1184W",
    metadata_synced_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "OL103123W",
    open_library_key: "/works/OL103123W",
    isbn13: "9781451673319",
    title: "Fahrenheit 451",
    subtitle: undefined,
    authors: ["Ray Bradbury"],
    cover_url: "https://covers.openlibrary.org/b/id/8780366-L.jpg",
    published_year: 1953,
    description: "Guy Montag is a fireman. In his world, where television rules and literature is on the brink of extinction, firemen start fires rather than put them out. His job is to destroy the most illegal of commodities, the printed book, along with the houses in which they are hidden.",
    open_library_url: "https://openlibrary.org/works/OL103123W",
    metadata_synced_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "OL1168007W",
    open_library_key: "/works/OL1168007W",
    isbn13: "9780451526342",
    title: "Animal Farm",
    subtitle: "A Fairy Story",
    authors: ["George Orwell"],
    cover_url: "https://covers.openlibrary.org/b/id/8225631-L.jpg",
    published_year: 1945,
    description: "A farm is taken over by its overworked, mistreated animals. With flaming idealism and stirring slogans, they set out to create a paradise of progress, justice, and equality. Thus the stage is set for one of the most telling satiric fables ever penned.",
    open_library_url: "https://openlibrary.org/works/OL1168007W",
    metadata_synced_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

function findInFamousCatalog(query: string): Book[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return FAMOUS_BOOKS_CATALOG.filter(
    (b) =>
      b.title.toLowerCase().includes(q) ||
      b.authors.some((a) => a.toLowerCase().includes(q)) ||
      (b.subtitle && b.subtitle.toLowerCase().includes(q))
  );
}

export async function searchBooks(query: string, page: number, limit = 12): Promise<BookSearchResult> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) {
    return {
      data: [],
      meta: { page: 1, limit, total: 0, has_more: false, source: "open_library" },
    };
  }

  const params = new URLSearchParams({ q: trimmed, page: String(page), limit: String(limit) });

  // 1. First attempt: Go backend search
  try {
    const result = await apiRequest(`/api/v1/books/search?${params}`, searchResponseSchema);
    if (result.data && result.data.length > 0) {
      return result;
    }
  } catch {
    // Backend search failed or timed out, will fall back gracefully
  }

  // 2. Direct client fallback to Open Library Search
  try {
    // Open Library Solr search fields: do NOT pass 'subtitle' as it causes 422 Unprocessable Entity
    const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(trimmed)}&page=${page}&limit=${limit}&fields=key,title,author_name,first_publish_year,cover_i,isbn`;
    
    let res = await fetch(olUrl);
    
    // If standard fields call fails, try basic fallback without fields parameter
    if (!res.ok) {
      const basicUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(trimmed)}&page=${page}&limit=${limit}`;
      res = await fetch(basicUrl);
    }

    if (res.ok) {
      const json = await res.json();
      const docs = Array.isArray(json.docs) ? json.docs : [];

      const books: Book[] = docs.map((doc: Record<string, unknown>, index: number) => {
        const rawKey = typeof doc.key === "string" ? doc.key : `/works/OL${index}W`;
        const cleanId = rawKey.replace("/works/", "");
        const isbns = Array.isArray(doc.isbn) ? (doc.isbn as string[]) : [];

        return {
          id: cleanId,
          open_library_key: rawKey,
          isbn13: isbns[0],
          title: typeof doc.title === "string" ? doc.title : "Untitled",
          subtitle: typeof doc.subtitle === "string" ? doc.subtitle : undefined,
          authors: Array.isArray(doc.author_name) ? (doc.author_name as string[]) : ["Unknown Author"],
          cover_url: typeof doc.cover_i === "number" ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : undefined,
          published_year: typeof doc.first_publish_year === "number" ? doc.first_publish_year : undefined,
          description: undefined,
          open_library_url: `https://openlibrary.org${rawKey}`,
          metadata_synced_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      if (books.length > 0) {
        const total = typeof json.numFound === "number" ? json.numFound : books.length;
        return {
          data: books,
          meta: {
            page,
            limit,
            total,
            has_more: page * limit < total,
            source: "open_library",
          },
        };
      }
    }
  } catch {
    // Catch fetch/network errors gracefully without throwing to console
  }

  // 3. Fallback: match from famous books catalog if query matches famous titles
  const localMatches = findInFamousCatalog(trimmed);
  if (localMatches.length > 0) {
    return {
      data: localMatches,
      meta: {
        page: 1,
        limit,
        total: localMatches.length,
        has_more: false,
        source: "local_catalog",
      },
    };
  }

  return {
    data: [],
    meta: {
      page,
      limit,
      total: 0,
      has_more: false,
      source: "open_library",
    },
  };
}

export async function getBook(bookID: string): Promise<Book> {
  const cleanId = bookID.trim().replace(/^\/works\//, "").replace(/^\/books\//, "");

  // 1. Check famous catalog first for instant response
  const famousMatch = FAMOUS_BOOKS_CATALOG.find(
    (b) => b.id === cleanId || b.open_library_key.includes(cleanId)
  );
  if (famousMatch) {
    return famousMatch;
  }

  // 2. Check if UUID and query backend
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
  if (isUUID) {
    try {
      const response = await apiRequest(`/api/v1/books/${cleanId}`, bookResponseSchema);
      return response.data;
    } catch {
      // Continue to Open Library resolution below
    }
  }

  // 3. Direct Open Library Work or Edition resolution
  const isWork = /^OL\d+W$/i.test(cleanId) || bookID.includes("/works/");
  const isEdition = /^OL\d+M$/i.test(cleanId) || bookID.includes("/books/");

  if (isWork || cleanId.startsWith("OL")) {
    try {
      const workKey = isWork ? `/works/${cleanId}` : cleanId.startsWith("OL") ? `/works/${cleanId}` : null;
      if (workKey) {
        const res = await fetch(`https://openlibrary.org${workKey}.json`);
        if (res.ok) {
          const data = await res.json();

          // Title & Subtitle
          const title = typeof data.title === "string" ? data.title : "Untitled";
          const subtitle = typeof data.subtitle === "string" ? data.subtitle : undefined;

          // Description
          let desc: string | undefined = undefined;
          if (typeof data.description === "string") {
            desc = data.description;
          } else if (data.description && typeof data.description.value === "string") {
            desc = data.description.value;
          }
          if (desc) {
            desc = desc.trim().replace(/^["']|["']$/g, "").trim();
          }

          // Cover resolution
          let coverId: number | undefined;
          if (Array.isArray(data.covers)) {
            coverId = data.covers.find((c: unknown) => typeof c === "number" && c > 0);
          }
          const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : undefined;

          // Year resolution
          let publishedYear: number | undefined = undefined;
          if (typeof data.first_publish_date === "string") {
            const match = data.first_publish_date.match(/\b(1\d\d\d|20\d\d)\b/);
            if (match) publishedYear = parseInt(match[1], 10);
          } else if (typeof data.created?.value === "string") {
            const match = data.created.value.match(/\b(1\d\d\d|20\d\d)\b/);
            if (match) publishedYear = parseInt(match[1], 10);
          }

          let authorNames: string[] = [];
          let authorKeys: string[] = [];
          if (Array.isArray(data.authors) && data.authors.length > 0) {
            authorKeys = data.authors
              .slice(0, 3)
              .map((item: Record<string, unknown>) => {
                const authorObj = item.author as Record<string, unknown> | undefined;
                return (typeof authorObj?.key === "string" ? authorObj.key : typeof item.key === "string" ? item.key : null);
              })
              .filter((k: unknown): k is string => typeof k === "string" && Boolean(k));

            if (authorKeys.length > 0) {
              try {
                const authorPromises = authorKeys.map(async (key) => {
                  const aRes = await fetch(`https://openlibrary.org${key}.json`);
                  if (aRes.ok) {
                    const aData = await aRes.json();
                    return typeof aData.name === "string" ? aData.name : null;
                  }
                  return null;
                });
                const resolved = await Promise.all(authorPromises);
                authorNames = resolved.filter((name): name is string => Boolean(name));
              } catch {
                // Ignore author resolution errors
              }
            }
          }

          if (authorNames.length === 0) {
            authorNames = ["Author Unknown"];
          }

          return {
            id: cleanId,
            open_library_key: workKey,
            title,
            subtitle,
            authors: authorNames,
            author_keys: authorKeys,
            cover_url: coverUrl,
            published_year: publishedYear,
            description: desc,
            open_library_url: `https://openlibrary.org${workKey}`,
            metadata_synced_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
      }
    } catch {
      // Fallback
    }
  }

  // 4. Edition resolution for OL...M keys
  if (isEdition) {
    try {
      const res = await fetch(`https://openlibrary.org/books/${cleanId}.json`);
      if (res.ok) {
        const data = await res.json();
        const title = typeof data.title === "string" ? data.title : "Untitled";
        const subtitle = typeof data.subtitle === "string" ? data.subtitle : undefined;
        let coverId: number | undefined;
        if (Array.isArray(data.covers)) {
          coverId = data.covers.find((c: unknown) => typeof c === "number" && c > 0);
        }
        const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : undefined;

        let publishedYear: number | undefined = undefined;
        if (typeof data.publish_date === "string") {
          const match = data.publish_date.match(/\b(1\d\d\d|20\d\d)\b/);
          if (match) publishedYear = parseInt(match[1], 10);
        }

        return {
          id: cleanId,
          open_library_key: `/books/${cleanId}`,
          title,
          subtitle,
          authors: Array.isArray(data.publishers) ? [data.publishers[0]] : ["Author Unknown"],
          cover_url: coverUrl,
          published_year: publishedYear,
          description: undefined,
          open_library_url: `https://openlibrary.org/books/${cleanId}`,
          metadata_synced_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
    } catch {
      // Fallback
    }
  }

  // 5. Final fallback: try finding by title or partial ID in famous books catalog
  const fallback = FAMOUS_BOOKS_CATALOG.find((b) => b.id.includes(cleanId) || cleanId.includes(b.id));
  if (fallback) {
    return fallback;
  }

  throw new Error(`Book ${bookID} could not be found`);
}
