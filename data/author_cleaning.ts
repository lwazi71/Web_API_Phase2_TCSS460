/*

DO NOT RUN THIS FILE.

This script is meant to:
- Take in a "books.csv" dataset containing "id" and "authors" columns.
- Clean and separate the "authors" column to ensure each author is stored in a separate row, 
  associated with the corresponding book ID.
- Output a new CSV file with two columns: "book_id" and "author", with one author per row.

This transformation is done to remove multivalued dependencies (MVDs) in the original dataset.

*/

import { createReadStream } from 'fs';
import { join } from 'path';
import csvParser from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';

interface RowData {
  book_id: number;
  author: string;
}

// file paths for the input and output CSV files.
const inputFilePath = join(__dirname, 'undup_orig_books.csv'); // original "books.csv" which had duplicated ISBN rows removed
const outputFilePath = join(__dirname, 'authors.csv');

const rows: RowData[] = [];
const seenPairs = new Set<string>(); // pairs of book id and author

// read the "books.csv" file
createReadStream(inputFilePath)
  .pipe(csvParser())
  .on('data', (data: any) => { // handle the data from "books.csv"
    const bookId = parseInt(data['book_id'], 0);
    const authorsRaw = data['authors'];
    if (!isNaN(bookId) && authorsRaw) {
      const authors = authorsRaw.split(',').map((a: string) => a.trim());
      for (const author of authors) {
        const key = `${bookId}-${author}`;
        if (author.length > 0 && !seenPairs.has(key)) {
          seenPairs.add(key);
          rows.push({ book_id: bookId, author });
        }
      }
    }
  })
  .on('end', () => { // after all rows processed
    // sort by book_id then author
    rows.sort((a, b) => {
      if (a.book_id !== b.book_id) return a.book_id - b.book_id;
      return a.author.localeCompare(b.author);
    });

    const csvWriter = createObjectCsvWriter({
      path: outputFilePath,
      header: [
        { id: 'book_id', title: 'book_id' },
        { id: 'author', title: 'author' },
      ],
    });

    csvWriter.writeRecords(rows).then(() => {
      console.log('SUCCESS: Author CSV created at:', outputFilePath);
    });
  });