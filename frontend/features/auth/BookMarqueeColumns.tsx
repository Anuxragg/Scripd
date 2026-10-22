"use client";

import Image from "next/image";
import { useState } from "react";

interface BookItem {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  fallbackBg: string;
}

const COLUMN_1_BOOKS: BookItem[] = [
  {
    id: "c1-1",
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    coverUrl: "https://covers.openlibrary.org/b/id/8231856-L.jpg",
    fallbackBg: "from-amber-900/60 to-stone-900",
  },
  {
    id: "c1-2",
    title: "1984",
    author: "George Orwell",
    coverUrl: "https://covers.openlibrary.org/b/id/8235113-L.jpg",
    fallbackBg: "from-red-950/60 to-stone-950",
  },
  {
    id: "c1-3",
    title: "To Kill a Mockingbird",
    author: "Harper Lee",
    coverUrl: "https://covers.openlibrary.org/b/id/12847926-L.jpg",
    fallbackBg: "from-blue-950/60 to-slate-950",
  },
  {
    id: "c1-4",
    title: "Dune",
    author: "Frank Herbert",
    coverUrl: "https://covers.openlibrary.org/b/id/7222246-L.jpg",
    fallbackBg: "from-orange-950/60 to-amber-950",
  },
  {
    id: "c1-5",
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    coverUrl: "https://covers.openlibrary.org/b/id/12836262-L.jpg",
    fallbackBg: "from-emerald-950/60 to-stone-950",
  },
  {
    id: "c1-6",
    title: "Pride and Prejudice",
    author: "Jane Austen",
    coverUrl: "https://covers.openlibrary.org/b/id/10522964-L.jpg",
    fallbackBg: "from-rose-950/60 to-neutral-950",
  },
  {
    id: "c1-7",
    title: "Frankenstein",
    author: "Mary Shelley",
    coverUrl: "https://covers.openlibrary.org/b/id/8315147-L.jpg",
    fallbackBg: "from-teal-950/60 to-neutral-950",
  },
];

const COLUMN_2_BOOKS: BookItem[] = [
  {
    id: "c2-1",
    title: "Brave New World",
    author: "Aldous Huxley",
    coverUrl: "https://covers.openlibrary.org/b/id/8235113-M.jpg",
    fallbackBg: "from-indigo-950/60 to-zinc-950",
  },
  {
    id: "c2-2",
    title: "The Picture of Dorian Gray",
    author: "Oscar Wilde",
    coverUrl: "https://covers.openlibrary.org/b/id/10522964-M.jpg",
    fallbackBg: "from-purple-950/60 to-neutral-950",
  },
  {
    id: "c2-3",
    title: "Sapiens",
    author: "Yuval Noah Harari",
    coverUrl: "https://covers.openlibrary.org/b/id/8231856-M.jpg",
    fallbackBg: "from-amber-950/60 to-stone-950",
  },
  {
    id: "c2-4",
    title: "Atomic Habits",
    author: "James Clear",
    coverUrl: "https://covers.openlibrary.org/b/id/12847926-M.jpg",
    fallbackBg: "from-sky-950/60 to-slate-950",
  },
  {
    id: "c2-5",
    title: "The Alchemist",
    author: "Paulo Coelho",
    coverUrl: "https://covers.openlibrary.org/b/id/12836262-M.jpg",
    fallbackBg: "from-yellow-950/60 to-stone-950",
  },
  {
    id: "c2-6",
    title: "Little Women",
    author: "Louisa May Alcott",
    coverUrl: "https://covers.openlibrary.org/b/id/7222246-M.jpg",
    fallbackBg: "from-pink-950/60 to-neutral-950",
  },
  {
    id: "c2-7",
    title: "The Catcher in the Rye",
    author: "J.D. Salinger",
    coverUrl: "https://covers.openlibrary.org/b/id/8315147-M.jpg",
    fallbackBg: "from-red-950/60 to-stone-950",
  },
];

const COLUMN_3_BOOKS: BookItem[] = [
  {
    id: "c3-1",
    title: "Fahrenheit 451",
    author: "Ray Bradbury",
    coverUrl: "https://covers.openlibrary.org/b/id/12847926-L.jpg",
    fallbackBg: "from-orange-950/60 to-stone-950",
  },
  {
    id: "c3-2",
    title: "The Metamorphosis",
    author: "Franz Kafka",
    coverUrl: "https://covers.openlibrary.org/b/id/12836262-L.jpg",
    fallbackBg: "from-zinc-900 to-black",
  },
  {
    id: "c3-3",
    title: "Animal Farm",
    author: "George Orwell",
    coverUrl: "https://covers.openlibrary.org/b/id/8235113-L.jpg",
    fallbackBg: "from-stone-900 to-black",
  },
  {
    id: "c3-4",
    title: "The Lord of the Rings",
    author: "J.R.R. Tolkien",
    coverUrl: "https://covers.openlibrary.org/b/id/7222246-L.jpg",
    fallbackBg: "from-emerald-950/60 to-black",
  },
  {
    id: "c3-5",
    title: "One Hundred Years of Solitude",
    author: "Gabriel García Márquez",
    coverUrl: "https://covers.openlibrary.org/b/id/10522964-L.jpg",
    fallbackBg: "from-amber-950/60 to-neutral-950",
  },
  {
    id: "c3-6",
    title: "Slaughterhouse-Five",
    author: "Kurt Vonnegut",
    coverUrl: "https://covers.openlibrary.org/b/id/8315147-L.jpg",
    fallbackBg: "from-violet-950/60 to-stone-950",
  },
  {
    id: "c3-7",
    title: "Norwegian Wood",
    author: "Haruki Murakami",
    coverUrl: "https://covers.openlibrary.org/b/id/8231856-L.jpg",
    fallbackBg: "from-rose-950/60 to-stone-950",
  },
];

function BookCard({ book }: { book: BookItem }) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="group relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-[#141517] shadow-xl border border-white/5 transition duration-300 hover:scale-[1.02] hover:border-white/20 select-none">
      {!hasError ? (
        <Image
          src={book.coverUrl}
          alt={book.title}
          fill
          sizes="(max-width: 1024px) 30vw, 180px"
          className="object-cover transition duration-500 group-hover:contrast-105"
          onError={() => setHasError(true)}
          unoptimized
        />
      ) : (
        <div
          className={`flex h-full w-full flex-col justify-between p-4 bg-gradient-to-b ${book.fallbackBg} text-white`}
        >
          <div className="h-2 w-8 rounded-full bg-white/20" />
          <div>
            <h4 className="font-serif text-sm font-bold leading-tight">{book.title}</h4>
            <p className="mt-1 text-xs text-white/60">{book.author}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MarqueeColumn({ books, animationClass }: { books: BookItem[]; animationClass: string }) {
  // Duplicate for seamless 50% loop
  const duplicated = [...books, ...books];

  return (
    <div className="relative h-full flex-1 overflow-hidden">
      <div className={`flex flex-col gap-4 sm:gap-6 will-change-transform ${animationClass}`}>
        {duplicated.map((book, idx) => (
          <BookCard key={`${book.id}-${idx}`} book={book} />
        ))}
      </div>
    </div>
  );
}

export function BookMarqueeColumns() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#0a0b0d] p-3 sm:p-6 lg:p-8">
      {/* 3 Vertical Columns */}
      <div className="grid h-full grid-cols-3 gap-3 sm:gap-5 lg:gap-6">
        {/* Column 1: UPWARD */}
        <MarqueeColumn books={COLUMN_1_BOOKS} animationClass="animate-marquee-up-1" />

        {/* Column 2: DOWNWARD */}
        <MarqueeColumn books={COLUMN_2_BOOKS} animationClass="animate-marquee-down-2" />

        {/* Column 3: UPWARD */}
        <MarqueeColumn books={COLUMN_3_BOOKS} animationClass="animate-marquee-up-3" />
      </div>
    </div>
  );
}
