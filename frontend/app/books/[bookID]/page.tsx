import { SiteHeader } from "@/components/SiteHeader";
import { BookDetailPage } from "@/features/books/BookDetailPage";

export default async function BookPage({ params }: { params: Promise<{ bookID: string }> }) {
  const { bookID } = await params;

  return (
    <>
      <SiteHeader />
      <BookDetailPage bookID={bookID} />
    </>
  );
}
