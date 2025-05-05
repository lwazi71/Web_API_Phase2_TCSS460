// express is the framework we're going to use to handle requests
import express, { NextFunction, Request, Response, Router } from 'express';
// Access the connection to Postgres Database
import { pool, validationFunctions } from '../../core/utilities';

const booksRouter: Router = express.Router();

const isStringProvided = validationFunctions.isStringProvided;

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
 * @api {get} /books Retrieve all books (paginated)
 * @apiName GetAllBooks
 * @apiGroup Books
 *
 * @apiParam {Number} [page=1] Page number for pagination.
 * @apiParam {Number} [limit=10] Number of books per page.
 *
 * @apiSuccess {Object[]} books List of books for the page.
 * @apiSuccess {Number} total Total number of books.
 * @apiSuccess {Number} page Current page number.
 * @apiSuccess {Number} limit Number of books per page.
 *
 * @apiError (500 Internal Server Error) {String} message "server error - contact support"
 */
booksRouter.get('/', async (request: Request, response: Response) => {
    const page = parseInt(request.query.page as string) || 1;
    const limit = parseInt(request.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    try {
        const booksQuery = `
    SELECT 
        b.*, 
        STRING_AGG(a.author, ', ') AS authors
    FROM books b
    JOIN authors a ON b.book_id = a.book_id
    GROUP BY b.book_id
    ORDER BY b.book_id
    LIMIT $1 OFFSET $2
`;
        const countQuery = `SELECT COUNT(*) FROM books`;

        const [booksResult, countResult] = await Promise.all([
            pool.query(booksQuery, [limit, offset]),
            pool.query(countQuery),
        ]);

        const total = parseInt(countResult.rows[0].count);

        response.send({
            books: booksResult.rows,
            total,
            page,
            limit,
        });
    } catch (error) {
        console.error('DB Query error on GET /books');
        console.error(error);
        response.status(500).send({
            message: 'server error - contact support',
        });
    }
});
export { booksRouter };
