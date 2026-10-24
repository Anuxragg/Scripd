"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

// Curated high-res portraits for world-renowned authors for instant loading
const KNOWN_AUTHOR_PHOTOS: Record<string, string> = {
  "george orwell":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/George_Orwell_press_photo.jpg/330px-George_Orwell_press_photo.jpg",
  "f. scott fitzgerald":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/F_Scott_Fitzgerald_1921.jpg/330px-F_Scott_Fitzgerald_1921.jpg",
  "donna tartt": "https://upload.wikimedia.org/wikipedia/commons/a/a7/Donna_Tartt.jpg",
  "haruki murakami":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Haruki_Murakami_2009.jpg/330px-Haruki_Murakami_2009.jpg",
  "frank herbert":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Frank_Herbert_-_1984.jpg/330px-Frank_Herbert_-_1984.jpg",
  "j.k. rowling":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/J._K._Rowling_2010.jpg/330px-J._K._Rowling_2010.jpg",
  "jane austen":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Jane_Austen_coloured_version.jpg/330px-Jane_Austen_coloured_version.jpg",
  "harper lee":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/HarperLee_Richmond.jpg/330px-HarperLee_Richmond.jpg",
  "j.r.r. tolkien":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/J._R._R._Tolkien%2C_ca._1925.jpg/330px-J._R._R._Tolkien%2C_ca._1925.jpg",
  "fyodor dostoevsky":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Vasily_Perov_-_%D0%9F%D0%BE%D1%80%D1%82%D1%80%D0%B5%D1%82_%D0%A4.%D0%9C.%D0%94%D0%BE%D1%81%D1%82%D0%BE%D0%B5%D0%B2%D1%81%D0%BA%D0%BE%D0%B3%D0%BE_-_Google_Art_Project.jpg/330px-Vasily_Perov_-_%D0%9F%D0%BE%D1%80%D1%82%D1%80%D0%B5%D1%82_%D0%A4.%D0%9C.%D0%94%D0%BE%D1%81%D1%82%D0%BE%D0%B5%D0%B2%D1%81%D0%BA%D0%BE%D0%B3%D0%BE_-_Google_Art_Project.jpg",
  "ray bradbury":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Ray_Bradbury_1975_portrait.jpg/330px-Ray_Bradbury_1975_portrait.jpg",
  "aldous huxley":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Aldous_Huxley_photograph.jpg/330px-Aldous_Huxley_photograph.jpg",
  "kazuo ishiguro":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Kazuo_Ishiguro_in_2017.jpg/330px-Kazuo_Ishiguro_in_2017.jpg",
  "min jin lee":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Min_Jin_Lee_by_Elena_Seibert.jpg/330px-Min_Jin_Lee_by_Elena_Seibert.jpg",
  "gabrielle zevin":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Gabrielle_Zevin_at_the_2023_Texas_Book_Festival.jpg/330px-Gabrielle_Zevin_at_the_2023_Texas_Book_Festival.jpg",
  "c.s. lewis":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/C.s.lewis3.JPG/330px-C.s.lewis3.JPG",
  "leo tolstoy":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/L.N.Tolstoy_Prokudin-Gorsky.jpg/330px-L.N.Tolstoy_Prokudin-Gorsky.jpg",
  "virginia woolf":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/George_Charles_Beresford_-_Virginia_Woolf_in_1902_-_Restoration.jpg/330px-George_Charles_Beresford_-_Virginia_Woolf_in_1902_-_Restoration.jpg",
  "franz kafka":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Franz_Kafka%2C_1923.jpg/330px-Franz_Kafka%2C_1923.jpg",
  "ernest hemingway":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/ErnestHemingway.jpg/330px-ErnestHemingway.jpg",
  "agatha christie":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Agatha_Christie.png/330px-Agatha_Christie.png",
  "stephen king":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Stephen_King%2C_Comicon.jpg/330px-Stephen_King%2C_Comicon.jpg",
  "oscar wilde":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Oscar_Wilde_Sarony.jpg/330px-Oscar_Wilde_Sarony.jpg",
};

// In-memory cache to avoid duplicate network calls
const authorPhotoCache = new Map<string, string | null>();

async function fetchAuthorPhoto(name: string, olid?: string): Promise<string | null> {
  const normalized = name.trim().toLowerCase();
  if (KNOWN_AUTHOR_PHOTOS[normalized]) {
    return KNOWN_AUTHOR_PHOTOS[normalized];
  }
  if (authorPhotoCache.has(normalized)) {
    return authorPhotoCache.get(normalized)!;
  }

  // 1. If Open Library author ID is present, try Open Library Covers API
  if (olid) {
    const cleanOlid = olid.replace("/authors/", "");
    const olPhotoUrl = `https://covers.openlibrary.org/a/olid/${cleanOlid}-M.jpg?default=false`;
    try {
      const probe = await fetch(olPhotoUrl, { method: "HEAD" });
      if (probe.ok) {
        authorPhotoCache.set(normalized, olPhotoUrl);
        return olPhotoUrl;
      }
    } catch {
      // Continue to Wikipedia fallback
    }
  }

  // 2. Query Wikipedia REST API (free, open, no auth required, high-res portraits)
  try {
    const wikiName = encodeURIComponent(name.trim().replace(/\s+/g, "_"));
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wikiName}`);
    if (res.ok) {
      const data = await res.json();
      const photo = data.thumbnail?.source || data.originalimage?.source;
      if (typeof photo === "string" && photo.startsWith("http")) {
        authorPhotoCache.set(normalized, photo);
        return photo;
      }
    }
  } catch {
    // Graceful fallback to initials
  }

  authorPhotoCache.set(normalized, null);
  return null;
}

export function AuthorAvatar({
  name,
  olid,
  className = "",
}: {
  name: string;
  olid?: string;
  className?: string;
}) {
  const normalized = name.trim().toLowerCase();
  const [photoUrl, setPhotoUrl] = useState<string | null>(() => {
    return KNOWN_AUTHOR_PHOTOS[normalized] ?? authorPhotoCache.get(normalized) ?? null;
  });
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (photoUrl) return;
    let cancelled = false;
    fetchAuthorPhoto(name, olid).then((url) => {
      if (!cancelled && url) {
        setPhotoUrl(url);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [name, olid, photoUrl]);

  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AU";

  return (
    <div
      className={`relative h-20 w-20 sm:h-24 sm:w-24 rounded-full overflow-hidden border border-white/15 bg-gradient-to-tr from-[#161a24] to-[#252c3c] flex items-center justify-center shadow-md group-hover:border-[#9333ea]/60 transition shrink-0 ${className}`}
    >
      {photoUrl && !imgFailed ? (
        <Image
          src={photoUrl}
          alt={name}
          fill
          unoptimized
          sizes="96px"
          onError={() => setImgFailed(true)}
          className="object-cover object-top transition duration-300 group-hover:scale-105"
        />
      ) : (
        <span className="font-bold text-lg sm:text-xl text-[#9ab] group-hover:text-white transition">
          {initials}
        </span>
      )}
    </div>
  );
}
