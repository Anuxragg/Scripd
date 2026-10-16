"use client";

import Image from "next/image";
import { useState } from "react";

export function BookCover({
  title,
  coverURL,
  className = "",
}: {
  title: string;
  coverURL?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = coverURL && !failed;

  return (
    <div
      className={`relative isolate overflow-hidden rounded-xl bg-[#e8e3d8] shadow-md shadow-[#25291f]/10 ${className}`}
    >
      {showImage ? (
        <Image
          alt={`Cover of ${title}`}
          className="object-cover"
          fill
          onError={() => setFailed(true)}
          sizes="(max-width: 640px) 38vw, (max-width: 1024px) 22vw, 180px"
          src={coverURL}
          unoptimized
        />
      ) : (
        <div
          aria-label={`No cover available for ${title}`}
          className="absolute inset-0 flex flex-col justify-between bg-[linear-gradient(155deg,#71826d_0%,#365744_72%)] p-4 text-[#f5f0df]"
          role="img"
        >
          <span className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] opacity-75">
            Scripd edition
          </span>
          <span className="font-serif text-6xl leading-none opacity-90">{title.slice(0, 1)}</span>
          <span className="h-px w-10 bg-[#d8c68e]" />
        </div>
      )}
    </div>
  );
}
