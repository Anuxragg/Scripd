import { SiteHeader } from "@/components/SiteHeader";
import { BookSearchPage } from "@/features/books/BookSearchPage";

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 120) : "";
  const pageValue = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isInteger(pageValue) && pageValue >= 1 && pageValue <= 1000 ? pageValue : 1;

  return (
    <>
      <SiteHeader />
      <BookSearchPage key={`${query}:${page}`} initialQuery={query} initialPage={page} />
    </>
  );
}
