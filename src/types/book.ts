/** Raw row shape as parsed from books.csv (all fields are strings from CSV). */
export interface RawBookRow {
  book_id: string;
  goodreads_book_id: string;
  best_book_id: string;
  work_id: string;
  books_count: string;
  isbn: string;
  isbn13: string;
  authors: string;
  original_publication_year: string;
  original_title: string;
  title: string;
  language_code: string;
  average_rating: string;
  ratings_count: string;
  work_ratings_count: string;
  work_text_reviews_count: string;
  ratings_1: string;
  ratings_2: string;
  ratings_3: string;
  ratings_4: string;
  ratings_5: string;
  image_url: string;
  small_image_url: string;
}

export interface RawTagRow {
  tag_id: string;
  tag_name: string;
}

export interface RawBookTagRow {
  goodreads_book_id: string;
  tag_id: string;
  count: string;
}

/** Normalized, joined book record ready to become a RAG document. */
export interface CleanBook {
  bookId: number;
  goodreadsBookId: number;
  workId: number;

  title: string;
  authors: string[];

  publicationYear?: number;
  language?: string;

  averageRating: number;
  ratingsCount: number;

  tags: string[];
}

export interface CleaningRejection {
  bookId: string;
  reason: string;
}
