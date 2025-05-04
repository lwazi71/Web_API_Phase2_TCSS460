// express is the framework we're going to use to handle requests
import express, { NextFunction, Request, Response, Router } from 'express';
// Access the connection to Postgres Database
import { pool, validationFunctions } from '../../core/utilities';
import { QueryResult } from 'pg';

const booksRouter: Router = express.Router();

const isStringProvided = validationFunctions.isStringProvided;

interface BookWithAuthors {
    book_id: number;
    isbn13: number;
    original_publication_year: number;
    original_title: string | null;
    title: string;
    image_url: string | null;
    small_image_url: string | null;
    authors: string; // comma-separated list
  }

// For formatting output
const formatKeep = (resultRow) => ({
    ...resultRow,
    formatted: `{${resultRow.isbn13}} - ${resultRow.title}`,
});

// Middleware for validating ISBN format
function mwValidISBN(request: Request, response: Response, next: NextFunction) {
    const { isbn } = request.params;
    const isValid = /^[0-9]{10,13}$/.test(isbn);
    if (isValid) next();
    else {
        response.status(400).send({ message: 'Invalid ISBN format.' });
    }
}

// Middleware for validating Author (optional)
function mwValidAuthor(
    request: Request,
    response: Response,
    next: NextFunction
) {
    if (isStringProvided(request.body.author)) {
        next();
    } else {
        console.error('Invalid Author Name');
        response.status(400).send({
            message: 'Invalid Author Name - please refer to documentation',
        });
    }
}

/**
 * @api {post} /books Create a new book
 * @apiName CreateBook
 * @apiGroup Books
 *
 * @apiBody {String} title Full title of the book. (required)
 * @apiBody {String} original_title Original title of the book. (required)
 * @apiBody {BigInt} isbn13 ISBN-13 number (10–13 digits). (required)
 * @apiBody {Number} original_publication_year Year the book was published. (required)
 * @apiBody {String} image_url Link to the large image of the book. (required)
 * @apiBody {String} small_image_url Link to the small image of the book. (required)
 *
 * @apiSuccess {Object} book The newly created book object.
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 201 Created
 *    {
 *      "book": {
 *          "book_id": 12345,
 *          "isbn13": 9781234567897,
 *          "original_publication_year": 1999,
 *          "original_title": "Example Title",
 *          "title": "Example Title Full",
 *          "image_url": "http://example.com/large.jpg",
 *          "small_image_url": "http://example.com/small.jpg"
 *      }
 *    }
 *
 * @apiError (400) InvalidInput "Invalid input data"
 * @apiError (500) ServerError "server error - contact support"
 */
booksRouter.post('/', async (request: Request, response: Response) => {
    const {
        title,
        original_title,
        isbn13,
        original_publication_year,
        image_url,
        small_image_url,
    } = request.body;

    // Validate input
    if (
        !title ||
        !original_title ||
        !isbn13 ||
        !original_publication_year ||
        !image_url ||
        !small_image_url
    ) {
        return response.status(400).send({
            message: 'Invalid input data',
        });
    }

    try {
        const isbnNumber = BigInt(isbn13);
        const dummyBookId = Math.floor(Math.random() * 1000000);

        const insertQuery = `
            INSERT INTO books (book_id, isbn13, original_publication_year, original_title, title, image_url, small_image_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING book_id, isbn13, original_publication_year, original_title, title, image_url, small_image_url
        `;
        const values = [
            dummyBookId,
            isbnNumber,
            original_publication_year,
            original_title,
            title,
            image_url,
            small_image_url,
        ];

        const result = await pool.query(insertQuery, values);

        response.status(201).send({
            book: result.rows[0],
        });
    } catch (error) {
        console.error('DB Query error on POST /books');
        console.error(error);
        response.status(500).send({
            message: 'server error - contact support',
        });
    }
});

/**
 * @api {get} /books/author/:author Retrieve books by author
 * @apiName GetBooksByAuthor
 * @apiGroup Books
 *
 * @apiParam {String} author Author's full name (URL encoded if needed).
 *
 * @apiSuccess {Object[]} books List of books by the given author.
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
 *    {
 *      "books": [
 *        {
 *          "book_id": 12345,
 *          "isbn13": 9781234567897,
 *          "original_publication_year": 1999,
 *          "original_title": "Example Title",
 *          "title": "Example Title Full",
 *          "image_url": "http://example.com/large.jpg",
 *          "small_image_url": "http://example.com/small.jpg",
 *          "formatted": "{9781234567897} - Example Title Full"
 *        }
 *      ]
 *    }
 *
 * @apiError (404) AuthorNotFound "Author not found"
 * @apiError (500) ServerError "server error - contact support"
 */
booksRouter.get('/author/:author', (request: Request, response: Response) => {
    const author = request.params.author;
    const theQuery = `
        SELECT books.*
        FROM books
        JOIN authors ON books.book_id = authors.book_id
        WHERE authors.author = $1
    `;
    const values = [author];

    pool.query(theQuery, values)
        .then((result) => {
            if (result.rowCount > 0) {
                response.send({
                    books: result.rows.map(formatKeep),
                });
            } else {
                response.status(404).send({
                    message: 'Author not found',
                });
            }
        })
        .catch((error) => {
            console.error('DB Query error on GET /author/:author');
            console.error(error);
            response.status(500).send({
                message: 'server error - contact support',
            });
        });
});

/**
 * @api {get} /books/isbn/:isbn Retrieve a book by ISBN
 * @apiName GetBookByISBN
 * @apiGroup Books
 *
 * @apiParam {String} isbn ISBN-13 number (10–13 digits).
 *
 * @apiSuccess {Object} book Book details for the given ISBN.
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
 *    {
 *      "book": {
 *          "book_id": 12345,
 *          "isbn13": 9781234567897,
 *          "original_publication_year": 1999,
 *          "original_title": "Example Title",
 *          "title": "Example Title Full",
 *          "image_url": "http://example.com/large.jpg",
 *          "small_image_url": "http://example.com/small.jpg"
 *      }
 *    }
 *
 * @apiError (400) InvalidISBNFormat "Invalid ISBN format."
 * @apiError (404) BookNotFound "Book not found"
 * @apiError (500) ServerError "server error - contact support"
 */
booksRouter.get(
    '/isbn/:isbn',
    mwValidISBN,
    async (request: Request, response: Response) => {
        const isbnParam = request.params.isbn;
        const isbnNumber = BigInt(isbnParam);

        try {
            const theQuery = `
            SELECT *
            FROM books
            WHERE isbn13 = $1
        `;
            const values = [isbnNumber];

            const result = await pool.query(theQuery, values);

            if (result.rowCount > 0) {
                response.send({
                    book: result.rows[0],
                });
            } else {
                response.status(404).send({
                    message: 'Book not found',
                });
            }
        } catch (error) {
            console.error('DB Query error on GET /isbn/:isbn');
            console.error(error);
            response.status(500).send({
                message: 'server error - contact support',
            });
        }
    }
);

/**
 * @api {get} /books/age Retrieve books by age (publication year)
 * @apiName GetBooksByAge
 * @apiGroup Books
 *
 * @apiQuery {String="old","new"} order Required. Sort order: "old" for oldest first, "new" for newest first.
 * @apiQuery {Number{1-200}} [limit=20] Optional. Number of books to return per page.
 * @apiQuery {Number{1-100}} [page=1] Optional. Page number for pagination.
 *
 * @apiSuccess {Object[]} books List of books sorted by publication year.
 * @apiSuccess {Number} books.book_id Book ID.
 * @apiSuccess {String} books.isbn13 ISBN-13.
 * @apiSuccess {Number} books.original_publication_year Year the book was originally published.
 * @apiSuccess {String} books.original_title Original title of the book.
 * @apiSuccess {String} books.title Title of the book.
 * @apiSuccess {String} books.image_url Full-size image URL.
 * @apiSuccess {String} books.small_image_url Small image URL.
 * @apiSuccess {String} books.authors Comma-separated list of authors.
 *
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
 *    {
 *      "books": [
 *        {
 *          "book_id": 12345,
 *          "isbn13": "9781234567897",
 *          "original_publication_year": 1999,
 *          "original_title": "Example Title",
 *          "title": "Example Title Full",
 *          "image_url": "http://example.com/large.jpg",
 *          "small_image_url": "http://example.com/small.jpg",
 *          "authors": "Author One, Author Two"
 *        }
 *      ]
 *    }
 *
 * @apiError (400) MissingOrderParameter "Missing order query parameter. It must be 'old' or 'new'"
 * @apiError (400) InvalidOrderParameter "Invalid order query parameter. It must be 'old' or 'new'"
 * @apiError (400) InvalidLimitParameter "Invalid limit query parameter. It must be positive and less than 200."
 * @apiError (400) InvalidPageParameter "Invalid page query parameter. It must be positive and less than 100."
 * @apiError (500) ServerError "server error - contact support"
 */
booksRouter.get('/age', async (req: Request, res: Response) => {
        if (!req.query.order) {
            return res.status(400).json({ // return to stop the rest of code from running
                error: 'Missing order query parameter. It must be "old" or "new"'
            });
        }

        const order: string = typeof req.query.order === 'string' ? 
            (req.query.order as string).toLowerCase() : '';
        const limit: number = parseInt(req.query.limit as string) || 20; // default limit of books is 20
        const page: number = parseInt(req.query.page as string) || 1; // default page number is 1

        if (order !== 'old' && order !== 'new') {
            return res.status(400).json({
                error: 'Invalid order query parameter. It must be "old" or "new"'
            });
        }
        if (limit <= 0 || limit > 200) {
            return res.status(400).json({
                error: 'Invalid limit query parameter. It must be positive and less than 200.'
            });
        }
        if (page <= 0 || page > 100) {
            return res.status(400).json({
                error: 'Invalid page query parameter. It must be positive and less than 100.'
            });
        }

        const offset: number = (page - 1) * limit; // for PostgreSQL OFFSET
        const orderInSQL: 'ASC' | 'DESC' = order === 'old' ? 'ASC' : 'DESC'; // can only ever be 'ASC' or 'DESC'

        try {
            const insertQuery: string = `
                SELECT 
                    b.book_id,
                    b.isbn13,
                    b.original_publication_year,
                    b.original_title,
                    b.title,
                    b.image_url,
                    b.small_image_url,
                    STRING_AGG(a.author, ', ') AS authors
                FROM books b
                JOIN authors a ON b.book_id = a.book_id
                GROUP BY b.book_id
                ORDER BY b.original_publication_year ${orderInSQL}
                LIMIT $1
                OFFSET $2
            `;

            const values = [limit, offset];

            const result: QueryResult<BookWithAuthors> = await pool.query(insertQuery, values);

            if (result.rowCount === 0) {
                return res.status(200).json({ books: [] });
            }
            
            res.status(200).json({ books: result.rows});
        } catch (error) {
            console.error('Database query error on GET /books/age');
            console.error(error);
            res.status(500).send({
                message: 'server error - contact support',
            });
        }
    }
);

export { booksRouter };
