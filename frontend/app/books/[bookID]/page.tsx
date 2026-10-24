import { SiteHeader } from "@/components/SiteHeader";
import { BookDetailPage } from "@/features/books/BookDetailPage";
import { getBook } from "@/features/books/api";
import type { Book } from "@/features/books/api";

export default async function BookPage({ params }: { params: Promise<{ bookID: string }> }) {
  const { bookID } = await params;
  let initialBook: Book | null = null;
  try {
    initialBook = await getBook(bookID);
  } catch {
    // Graceful fallback to client rendering
  }

  return (
    <>
      <SiteHeader theme="dark" />
      <BookDetailPage bookID={bookID} initialBook={initialBook} />
    </>
  );
}
