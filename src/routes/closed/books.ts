// express is the framework we're going to use to handle requests
import express, { NextFunction, Request, Response, Router } from 'express';
// Access the connection to Postgres Database
import {
    pool,
    validationFunctions,
    formattingFunctions,
} from '../../core/utilities';
import { QueryResult } from 'pg';
import './http_responses';

const booksRouter: Router = express.Router();

const isStringProvided = validationFunctions.isStringProvided;
const isNumberProvided = validationFunctions.isNumberProvided;
const calcRatingsCount = formattingFunctions.calcRatingsCount;
const calcRatingsAverage = formattingFunctions.calcRatingsAverage;
const getCurrentNumAtRateLevel = formattingFunctions.getCurrentNumAtRateLevel;
const getFormattedRatings = formattingFunctions.getFormattedRatings;
const getFormattedBook = formattingFunctions.getFormattedBook;
const getFormattedBooksList = formattingFunctions.getFormattedBooksList;

// For formatting output
const formatKeep = (resultRow) => ({
    ...resultRow,
    //formatted: `{${resultRow.isbn13}} - ${resultRow.title}`,
});

function mwValidBookID(
    request: Request,
    response: Response,
    next: NextFunction
) {
    const bookID: number = parseInt(request.params.bookid as string);
    if (isNumberProvided(bookID) && bookID > 0) {
        next();
    } else {
        console.error('Invalid or missing Book ID');
        response.status(400).send({
            message:
                'Invalid or missing Book ID - please refer to documentation',
        });
    }
}

// Middleware for validating ISBN format
function mwValidISBN(request: Request, response: Response, next: NextFunction) {
    const { isbn } = request.params;
    const isValid = /^[0-9]{10,13}$/.test(isbn);
    if (isValid) next();
    else {
        response.status(400).send({ error: 'Invalid ISBN format.' });
    }
}

function mwValidAvgRatingRange(
    request: Request,
    response: Response,
    next: NextFunction
) {
    const minRating: number = parseFloat(request.query.minRating as string);
    const maxRating: number = parseFloat(request.query.maxRating as string);
    if (
        isNumberProvided(minRating) &&
        isNumberProvided(maxRating) &&
        minRating >= 1 &&
        maxRating <= 5 &&
        minRating <= maxRating
    ) {
        next();
    } else {
        console.error('Invalid or missing Rating Range');
        response.status(400).send({
            message:
                'Invalid or missing Rating Range - please refer to documentation',
        });
    }
}

function mwValidNumberOfRatings(
    request: Request,
    response: Response,
    next: NextFunction
) {
    const numRatings: number = parseInt(request.params.numRatings as string);
    if (isNumberProvided(numRatings) && numRatings >= 0) {
        next();
    } else {
        console.error('Invalid or missing Number of Ratings');
        response.status(400).send({
            message:
                'Invalid or missing Number of Ratings - please refer to documentation',
        });
    }
}

function mwValidRating(
    request: Request,
    response: Response,
    next: NextFunction
) {
    const rating: number = parseInt(request.query.rating as string);
    if (isNumberProvided(rating) && rating >= 1 && rating <= 5) {
        next();
    } else {
        console.error('Invalid or missing Rating');
        response.status(400).send({
            message:
                'Invalid or missing Rating - please refer to documentation',
        });
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
 * @apiBody {BigInt} isbn13 ISBN-13 number (13 digits). (required)
 * @apiBody {Number} original_publication_year Year the book was published. (required)
 * @apiBody {String} authors Comma-separated list of authors. (required)
 * @apiBody {String} image_url Link to the large image of the book. (required)
 * @apiBody {String} small_image_url Link to the small image of the book. (required)
 *
 * @apiSuccess {Object} book The newly created book object.
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 201 Created
 *    {
 *      "book": {
 *          "isbn13": 9781234567897,
 *          "authors": "Author One, Author Two",
 *          "publication": 1999,
 *          "original_title": "Example Title",
 *          "title": "Example Title Full",
 *          "ratings": {
 *              "average": 0,
 *              "count": 0,
 *              "rating_1": 0,
 *              "rating_2": 0,
 *              "rating_3": 0,
 *              "rating_4": 0,
 *              "rating_5": 0
 *          },
 *          "icons": {
 *              "large": "http://example.com/large.jpg",
 *              "small": "http://example.com/small.jpg"
 *          }
 *      }
 *    }
 *
 * @apiError (400) InvalidInput "One or more body parameters are invalid."
 * @apiError (500) ServerError "Server error - contact support"
 */
booksRouter.post('/', async (request: Request, response: Response) => {
    const {
        isbn13,
        authors,
        original_publication_year,
        original_title,
        title,
        image_url,
        small_image_url
    } = request.body;

    // validate required input
    if (
        !title ||
        !original_title ||
        !isbn13 ||
        !original_publication_year ||
        !image_url ||
        !small_image_url ||
        !authors
    ) {
        return response.status(400).send({
            error: 'One or more body parameters are missing.',
        });
    }

    try {
        await pool.query('BEGIN');

        // insert the book
        const insertBookQuery = `
            INSERT INTO books (
                isbn13, original_publication_year,
                original_title, title, image_url, small_image_url
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const values = [
            BigInt(isbn13),
            original_publication_year,
            original_title,
            title,
            image_url,
            small_image_url
        ];
        const result = await pool.query(insertBookQuery, values);
        const book = result.rows[0];

        // insert authors
        const authorList = [...new Set(authors.split(',').map((a: string) => a.trim()))];
        const insertAuthorQuery = `
            INSERT INTO authors (book_id, author) VALUES ($1, $2)
        `;
        for (const author of authorList) {
            await pool.query(insertAuthorQuery, [book.book_id, author])
        }

        // insert default ratings
        const insertRatingsQuery = `
            INSERT INTO ratings (
                book_id, ratings_1, ratings_2, ratings_3, ratings_4, ratings_5
            )
            VALUES ($1, 0, 0, 0, 0, 0)
        `;
        await pool.query(insertRatingsQuery, [book.book_id])

        await pool.query('COMMIT');

        const formattedBook: IBook = {
            isbn13: Number(book.isbn13),
            authors: authorList.join(', '),
            publication: book.original_publication_year,
            original_title: book.original_title,
            title: book.title,
            ratings: {
                average: 0,
                count: 0,
                rating_1: 0,
                rating_2: 0,
                rating_3: 0,
                rating_4: 0,
                rating_5: 0
            },
            icons: {
                large: book.image_url,
                small: book.small_image_url
            }
        };

        response.status(201).send({ book: formattedBook });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('DB Query error on POST /books');
        console.error(error);
        response.status(500).send({
            message: 'server error - contact support',
        });
    }
});

/**
 * @api {get} /books/author/:author Retrieve books by author
 *
 * @apiDescription Request to get books by a certain author. This will retrieve all books that the author wrote and co-wrote.
 *
 * @apiName GetBooksByAuthor
 * @apiGroup Books
 *
 * @apiParam {String} author Author's full name (URL encoded if needed).
 *
 * @apiSuccess {Object[]} books List of books written by the given author.
 * @apiSuccess {Number} books.isbn13 ISBN-13 as a number.
 * @apiSuccess {String} books.authors Comma-separated list of authors.
 * @apiSuccess {Number} books.publication Year the book was originally published.
 * @apiSuccess {String} books.original_title Original title of the book.
 * @apiSuccess {String} books.title Title of the book.
 * @apiSuccess {Object} books.ratings Rating statistics.
 * @apiSuccess {Number} books.ratings.average Average rating (0–5, two decimals).
 * @apiSuccess {Number} books.ratings.count Total number of ratings.
 * @apiSuccess {Number} books.ratings.rating_1 Count of 1-star ratings.
 * @apiSuccess {Number} books.ratings.rating_2 Count of 2-star ratings.
 * @apiSuccess {Number} books.ratings.rating_3 Count of 3-star ratings.
 * @apiSuccess {Number} books.ratings.rating_4 Count of 4-star ratings.
 * @apiSuccess {Number} books.ratings.rating_5 Count of 5-star ratings.
 * @apiSuccess {Object} books.icons Image URLs.
 * @apiSuccess {String} books.icons.large Full-size image URL.
 * @apiSuccess {String} books.icons.small Small image URL.
 *
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
 *    {
 *      "books": [
 *        {
 *          "isbn13": 9781234567897,
 *          "authors": "Author One, Author Two",
 *          "publication": 1999,
 *          "original_title": "Example Title",
 *          "title": "Example Title Full",
 *          "ratings": {
 *            "average": 4.27,
 *            "count": 5823,
 *            "rating_1": 123,
 *            "rating_2": 432,
 *            "rating_3": 1342,
 *            "rating_4": 2341,
 *            "rating_5": 1585
 *          },
 *          "icons": {
 *            "large": "http://example.com/large.jpg",
 *            "small": "http://example.com/small.jpg"
 *          }
 *        }
 *      ]
 *    }
 *
 * @apiError (404: Author not found) {String} message "Author not found"
 * @apiError (500: Server error) {String} message "server error - contact support"
 */
booksRouter.get(
    '/author/:author',
    //mwValidAuthor,
    async (request: Request, response: Response) => {
        const author = request.params.author;

        try {
            const theQuery = `
                SELECT 
                    b.isbn13,
                    b.original_publication_year,
                    b.original_title,
                    b.title,
                    b.image_url,
                    b.small_image_url,
                    STRING_AGG(a.author, ', ') AS authors,
                    r.ratings_1,
                    r.ratings_2,
                    r.ratings_3,
                    r.ratings_4,
                    r.ratings_5
                FROM books b
                JOIN authors a ON b.book_id = a.book_id
                LEFT JOIN ratings r ON b.book_id = r.book_id
                WHERE b.book_id IN (
                    SELECT book_id FROM authors WHERE author = $1
                )
                GROUP BY 
                    b.book_id, 
                    b.isbn13, 
                    b.original_publication_year, 
                    b.original_title, 
                    b.title, 
                    b.image_url, 
                    b.small_image_url,
                    r.ratings_1, r.ratings_2, r.ratings_3, r.ratings_4, r.ratings_5
            `;

            const result = await pool.query(theQuery, [author]);

            if (result.rowCount === 0) {
                return response.status(404).json({
                    message: 'Author not found',
                });
            }

            const books: IBook[] = getFormattedBooksList(result);

            response.status(200).json({ books });
        } catch (error) {
            console.error('DB Query error on GET /author/:author');
            console.error(error);
            response.status(500).send({
                message: 'server error - contact support',
            });
        }
    }
);

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
    async (req: Request, res: Response) => {
        const isbn = parseInt(req.params.isbn);

        try {
            const query = `
                SELECT 
                    b.isbn13,
                    b.original_publication_year,
                    b.original_title,
                    b.title,
                    b.image_url,
                    b.small_image_url,
                    STRING_AGG(a.author, ', ') AS authors,
                    r.ratings_1,
                    r.ratings_2,
                    r.ratings_3,
                    r.ratings_4,
                    r.ratings_5
                FROM books b
                JOIN authors a ON b.book_id = a.book_id
                LEFT JOIN ratings r ON b.book_id = r.book_id
                WHERE b.isbn13 = $1
                GROUP BY 
                    b.book_id, 
                    b.isbn13, 
                    b.original_publication_year, 
                    b.original_title, 
                    b.title, 
                    b.image_url, 
                    b.small_image_url,
                    r.ratings_1, r.ratings_2, r.ratings_3, r.ratings_4, r.ratings_5
            `;

            const result = await pool.query(query, [isbn])

            if (result.rowCount === 0) {
                return res.status(404).json({
                    message: `Book with ISBN of '${isbn}' not found.`
                });
            }

            const book: IBook = (() => {
                const {
                    isbn13,
                    authors,
                    original_publication_year,
                    original_title,
                    title,
                    image_url,
                    small_image_url,
                    ratings_1 = 0,
                    ratings_2 = 0,
                    ratings_3 = 0,
                    ratings_4 = 0,
                    ratings_5 = 0
                } = result.rows[0];

                const count = calcRatingsCount(result.rows[0]);
                const average = count === 0 ? 0 : calcRatingsAverage(result.rows[0]);

                return {
                    isbn13: Number(isbn13),
                    authors,
                    publication: original_publication_year,
                    original_title,
                    title,
                    ratings: {
                        average,
                        count,
                        rating_1: ratings_1,
                        rating_2: ratings_2,
                        rating_3: ratings_3,
                        rating_4: ratings_4,
                        rating_5: ratings_5,
                    },
                    icons: {
                        large: image_url,
                        small: small_image_url,
                    }
                };
            })();

            res.status(200).json({ book })
        } catch (error) {
            console.error('DB Query error on GET /books/isbn/:isbn');
            console.error(error);
            res.status(500).send({
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
            SELECT *
            FROM books
            ORDER BY id
                LIMIT $1 OFFSET $2
        `;
        const countQuery = `SELECT COUNT(*) FROM books`;

        const [booksResult, countResult] = await Promise.all([
            pool.query(booksQuery, [limit, offset]),
            pool.query(countQuery),
        ]);

        const total = parseInt(countResult.rows[0].count);

        const books: IBook[] = booksResult.rows.map((book: any): IBook => ({
            isbn13: Number(book.isbn13),
            authors: book.authors,
            publication: book.publication_year,
            original_title: book.original_title,
            title: book.title,
            ratings: {
                average: book.rating_avg,
                count: book.rating_count,
                rating_1: book.rating_1_star,
                rating_2: book.rating_2_star,
                rating_3: book.rating_3_star,
                rating_4: book.rating_4_star,
                rating_5: book.rating_5_star,
            },
            icons: {
                large: book.image_url,
                small: book.image_small_url,
            },
        }));

        response.send({
            books,
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
 * @apiSuccess {Number} books.isbn13 ISBN-13 as a number.
 * @apiSuccess {String} books.authors Comma-separated list of authors.
 * @apiSuccess {Number} books.publication Year the book was originally published.
 * @apiSuccess {String} books.original_title Original title of the book.
 * @apiSuccess {String} books.title Title of the book.
 * @apiSuccess {Object} books.ratings Rating statistics.
 * @apiSuccess {Number} books.ratings.average Average rating (0–5, two decimals).
 * @apiSuccess {Number} books.ratings.count Total number of ratings.
 * @apiSuccess {Number} books.ratings.rating_1 Count of 1-star ratings.
 * @apiSuccess {Number} books.ratings.rating_2 Count of 2-star ratings.
 * @apiSuccess {Number} books.ratings.rating_3 Count of 3-star ratings.
 * @apiSuccess {Number} books.ratings.rating_4 Count of 4-star ratings.
 * @apiSuccess {Number} books.ratings.rating_5 Count of 5-star ratings.
 * @apiSuccess {Object} books.icons Image URLs.
 * @apiSuccess {String} books.icons.large Full-size image URL.
 * @apiSuccess {String} books.icons.small Small image URL.
 *
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
 *    {
 *      "books": [
 *        {
 *          "isbn13": 9781234567897,
 *          "authors": "Author One, Author Two",
 *          "publication": 1999,
 *          "original_title": "Example Title",
 *          "title": "Example Title Full",
 *          "ratings": {
 *            "average": 4.27,
 *            "count": 5823,
 *            "rating_1": 123,
 *            "rating_2": 432,
 *            "rating_3": 1342,
 *            "rating_4": 2341,
 *            "rating_5": 1585
 *          },
 *          "icons": {
 *            "large": "http://example.com/large.jpg",
 *            "small": "http://example.com/small.jpg"
 *          }
 *        }
 *      ]
 *    }
 *
 * @apiError (400) MissingOrderParameter "Missing order query parameter. It must be 'old' or 'new'"
 * @apiError (400) InvalidOrderParameter "Invalid order query parameter. It must be 'old' or 'new'"
 * @apiError (400) InvalidLimitParameter "Invalid limit query parameter. It must be zero or greater and less than 200."
 * @apiError (400) InvalidPageParameter "Invalid page query parameter. It must be zero or greater and less than 100."
 * @apiError (500) ServerError "server error - contact support"
 */

booksRouter.get('/age', async (req: Request, res: Response) => {
    if (!req.query.order) {
        return res.status(400).json({
            // return to stop the rest of code from running
            error: 'Missing order query parameter. It must be "old" or "new"',
        });
    }

    const order: string =
        typeof req.query.order === 'string'
            ? (req.query.order as string).toLowerCase()
            : '';
    const limit: number = parseInt(req.query.limit as string) || 20; // default limit of books is 20
    const page: number = parseInt(req.query.page as string) || 1; // default page number is 1

    if (order !== 'old' && order !== 'new') {
        return res.status(400).json({
            error: 'Invalid order query parameter. It must be "old" or "new"',
        });
    }
    if (limit <= 0 || limit > 200) {
        return res.status(400).json({
            error: 'Invalid limit query parameter. It must be zero or greater and less than 200.',
        });
    }
    if (page <= 0 || page > 100) {
        return res.status(400).json({
            error: 'Invalid page query parameter. It must be zero or greater and less than 100.',
        });
    }

    const offset: number = (page - 1) * limit; // for PostgreSQL OFFSET
    const orderInSQL: 'ASC' | 'DESC' = order === 'old' ? 'ASC' : 'DESC'; // can only ever be 'ASC' or 'DESC'

    try {
        const query = `
                SELECT 
                    b.isbn13,
                    b.original_publication_year,
                    b.original_title,
                    b.title,
                    b.image_url,
                    b.small_image_url,
                    STRING_AGG(a.author, ', ') AS authors,
                    r.ratings_1,
                    r.ratings_2,
                    r.ratings_3,
                    r.ratings_4,
                    r.ratings_5
                FROM books b
                JOIN authors a ON b.book_id = a.book_id
                LEFT JOIN ratings r ON b.book_id = r.book_id
                GROUP BY b.book_id, r.ratings_1, r.ratings_2, r.ratings_3, r.ratings_4, r.ratings_5
                ORDER BY b.original_publication_year ${orderInSQL}
                LIMIT $1 OFFSET $2
            `;

        const result = await pool.query(query, [limit, offset]);

        const books: IBook[] = result.rows.map(row => {
            const {
                isbn13,
                authors,
                original_publication_year,
                original_title,
                title,
                image_url,
                small_image_url,
                ratings_1 = 0,
                ratings_2 = 0,
                ratings_3 = 0,
                ratings_4 = 0,
                ratings_5 = 0
            } = row;

            const count = calcRatingsCount(row);
            const average = count === 0 ? 0 : calcRatingsAverage(row);

            return {
                isbn13: Number(isbn13),
                authors,
                publication: original_publication_year,
                original_title,
                title,
                ratings: {
                    average,
                    count,
                    rating_1: ratings_1,
                    rating_2: ratings_2,
                    rating_3: ratings_3,
                    rating_4: ratings_4,
                    rating_5: ratings_5,
                },
                icons: {
                    large: image_url,
                    small: small_image_url,
                }
            };
        });

        res.status(200).json({ books });
    } catch (error) {
        console.error('Database query error on GET /books/age');
        console.error(error);
        res.status(500).send({
            error: 'server error - contact support',
        });
    }
}
);

/**
 * @api {get} /closed/books/ratingRange Get books within an average rating range
 *
 * @apiDescription Request to get books whose ratings fall in a range of average ratings (both minimum and maximum average ratings are inclusive)
 *
 * @apiName GetBooksByAvgRating
 * @apiGroup Books
 *
 * @apiQuery {Number{1.0-5.0}} [minRating=1.0] Minimum average rating (inclusive)
 * @apiQuery {Number{1.0-5.0}} [maxRating=5.0] Maximum average rating (inclusive)
 *
 * @apiSuccess {Object[]} books List of books included in the average rating range.
 * @apiSuccess {Number} books.isbn13 ISBN-13 as a number.
 * @apiSuccess {String} books.authors Comma-separated list of authors.
 * @apiSuccess {Number} books.publication Year the book was originally published.
 * @apiSuccess {String} books.original_title Original title of the book.
 * @apiSuccess {String} books.title Title of the book.
 * @apiSuccess {Object} books.ratings Rating statistics.
 * @apiSuccess {Number} books.ratings.average Average rating (0–5, two decimals).
 * @apiSuccess {Number} books.ratings.count Total number of ratings.
 * @apiSuccess {Number} books.ratings.rating_1 Count of 1-star ratings.
 * @apiSuccess {Number} books.ratings.rating_2 Count of 2-star ratings.
 * @apiSuccess {Number} books.ratings.rating_3 Count of 3-star ratings.
 * @apiSuccess {Number} books.ratings.rating_4 Count of 4-star ratings.
 * @apiSuccess {Number} books.ratings.rating_5 Count of 5-star ratings.
 * @apiSuccess {Object} books.icons Image URLs.
 * @apiSuccess {String} books.icons.large Full-size image URL.
 * @apiSuccess {String} books.icons.small Small image URL.
 *
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
 *    {
 *      "books": [
 *        {
 *          "isbn13": 9781234567897,
 *          "authors": "Author One, Author Two",
 *          "publication": 1999,
 *          "original_title": "Example Title",
 *          "title": "Example Title Full",
 *          "ratings": {
 *            "average": 4.27,
 *            "count": 5823,
 *            "rating_1": 123,
 *            "rating_2": 432,
 *            "rating_3": 1342,
 *            "rating_4": 2341,
 *            "rating_5": 1585
 *          },
 *          "icons": {
 *            "large": "http://example.com/large.jpg",
 *            "small": "http://example.com/small.jpg"
 *          }
 *        }
 *      ]
 *    }
 *
 * @apiError (400: Invalid or missing Rating Range) {String} message "Invalid or missing Rating Range - please refer to documentation"
 * @apiError (404: No books found in range) {String} message "No books found in range"
 * @apiError (500: Server error) {String} message "server error - contact support"
 */
booksRouter.get(
    '/ratingRange',
    mwValidAvgRatingRange,
    async (request: Request, response: Response) => {
        const minRating: number =
            parseFloat(request.query.minRating as string) || 1.0;
        const maxRating: number =
            parseFloat(request.query.maxRating as string) || 5.0;

        try {
            const theQuery = `
                SELECT 
                    b.isbn13,
                    b.original_publication_year,
                    b.original_title,
                    b.title,
                    b.image_url,
                    b.small_image_url,
                    STRING_AGG(a.author, ', ') AS authors,
                    r.ratings_1,
                    r.ratings_2,
                    r.ratings_3,
                    r.ratings_4,
                    r.ratings_5
                FROM books b
                JOIN authors a ON b.book_id = a.book_id
                LEFT JOIN ratings r ON b.book_id = r.book_id
                WHERE (
                        (ratings_1::float + 2 * ratings_2::float + 3 * ratings_3::float + 4 * ratings_4::float + 5 * ratings_5::float) 
                        / (ratings_1 + ratings_2 + ratings_3 + ratings_4 + ratings_5) 
                    )
                    BETWEEN $1 AND $2 
                GROUP BY 
                    b.book_id, 
                    b.isbn13, 
                    b.original_publication_year, 
                    b.original_title, 
                    b.title, 
                    b.image_url, 
                    b.small_image_url,
                    r.ratings_1, r.ratings_2, r.ratings_3, r.ratings_4, r.ratings_5
            `;

            const values = [minRating, maxRating];

            const result = await pool.query(theQuery, values);

            if (result.rowCount === 0) {
                return response.status(404).json({
                    message: 'No books found in range',
                });
            }

            const books: IBook[] = getFormattedBooksList(result);

            response.status(200).json({ books });
        } catch (error) {
            console.error('DB Query error on GET');
            console.error(error);
            response.status(500).send({
                message: 'server error - contact support',
            });
        }
    }
);

/**
 * @api {patch} /closed/books/bookid/:bookid/numOfRatings/:numRatings Update rating count for a specific rating level
 *
 * @apiDescription Request to edit the number of ratings that a certain book has under a certain rating level.
 *
 * @apiName PatchBookRatingCount
 * @apiGroup Books
 *
 * @apiParam {Number} bookid The ID number of the book
 * @apiParam {Number} numRatings Positive number of ratings to set for the given rating level
 *
 * @apiQuery {Number{1-5}} rating Rating level to update (e.g., 1, 2, 3, 4, 5)
 *
 * @apiSuccess {Object} book Book object with updated number of ratings at selected rating level.
 * @apiSuccess {Number} book.isbn13 ISBN-13 as a number.
 * @apiSuccess {String} book.authors Comma-separated list of authors.
 * @apiSuccess {Number} book.publication Year the book was originally published.
 * @apiSuccess {String} book.original_title Original title of the book.
 * @apiSuccess {String} book.title Title of the book.
 * @apiSuccess {Object} book.ratings Rating statistics.
 * @apiSuccess {Number} book.ratings.average Average rating (0–5, two decimals).
 * @apiSuccess {Number} book.ratings.count Total number of ratings.
 * @apiSuccess {Number} book.ratings.rating_1 Count of 1-star ratings.
 * @apiSuccess {Number} book.ratings.rating_2 Count of 2-star ratings.
 * @apiSuccess {Number} book.ratings.rating_3 Count of 3-star ratings.
 * @apiSuccess {Number} book.ratings.rating_4 Count of 4-star ratings.
 * @apiSuccess {Number} book.ratings.rating_5 Count of 5-star ratings.
 * @apiSuccess {Object} book.icons Image URLs.
 * @apiSuccess {String} book.icons.large Full-size image URL.
 * @apiSuccess {String} book.icons.small Small image URL.
 *
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
 *    {
 *      "book": {
 *          "isbn13": 9781234567897,
 *          "authors": "Author One, Author Two",
 *          "publication": 1999,
 *          "original_title": "Example Title",
 *          "title": "Example Title Full",
 *          "ratings": {
 *              "average": 4.27,
 *              "count": 5823,
 *              "rating_1": 123,
 *              "rating_2": 432,
 *              "rating_3": 1342,
 *              "rating_4": 2341,
 *              "rating_5": 1585
 *          },
 *          "icons": {
 *              "large": "http://example.com/large.jpg",
 *              "small": "http://example.com/small.jpg"
 *          }
 *      }
 *    }
 *
 *
 * @apiError (400: Invalid book ID) {String} message "Invalid or missing Book ID - please refer to documentation"
 * @apiError (400: Invalid number of ratings) {String} message "'Invalid or missing Number of Ratings - please refer to documentation'"
 * @apiError (400: Invalid rating) {String} message "Invalid or missing Rating - please refer to documentation"
 * @apiError (404: Book not found) {String} message "Book not found"
 * @apiError (500: Server error) {String} message "server error - contact support"
 */
booksRouter.patch(
    '/bookid/:bookid/numOfRatings/:numRatings',
    mwValidBookID,
    mwValidNumberOfRatings,
    mwValidRating,
    async (request: Request, response: Response) => {
        const bookid = BigInt(request.params.bookid);
        const numRatings: number = parseInt(
            request.params.numRatings as string
        );
        const rating: number = parseInt(request.query.rating as string);
        const rateLevel: string = 'ratings_' + rating;

        try {
            const theUpdateQuery = `
                UPDATE ratings
                SET ${rateLevel} = $1
                FROM books
                WHERE ratings.book_id = books.book_id AND books.book_id = $2
                RETURNING ratings.*
            `;

            const values = [numRatings, bookid];

            const updatedResult = await pool.query(theUpdateQuery, values);

            if (updatedResult.rowCount === 0) {
                return response.status(404).json({
                    message: 'Book not found',
                });
            }

            const theQuery = `
                SELECT 
                    b.isbn13,
                    b.original_publication_year,
                    b.original_title,
                    b.title,
                    b.image_url,
                    b.small_image_url,
                    STRING_AGG(a.author, ', ') AS authors,
                    r.ratings_1,
                    r.ratings_2,
                    r.ratings_3,
                    r.ratings_4,
                    r.ratings_5
                FROM books b
                JOIN authors a ON b.book_id = a.book_id
                LEFT JOIN ratings r ON b.book_id = r.book_id
                WHERE b.book_id = $1
                GROUP BY 
                    b.book_id, 
                    b.isbn13, 
                    b.original_publication_year, 
                    b.original_title, 
                    b.title, 
                    b.image_url, 
                    b.small_image_url,
                    r.ratings_1, r.ratings_2, r.ratings_3, r.ratings_4, r.ratings_5
            `;

            const result = await pool.query(theQuery, [bookid]);

            if (result.rowCount === 1) {
                const book: IBook = getFormattedBook(result);
                response.status(200).json({ book });
            } else {
                response.status(404).send({
                    message: 'Book not found',
                });
            }
        } catch (error) {
            console.error('DB Query error on PATCH ratings');
            console.error(error);
            response.status(500).send({
                message: 'server error - contact support',
            });
        }
    }
);

/**
 * @api {patch} /closed/books/bookid/:bookid/incRating Increment rating count for a specific rating level
 *
 * @apiDescription Request to increment the number of ratings that a certain book has under a certain rating level by 1.
 * If the query parameter for the rating level is given as a float, it will be parsed as an integer. This makes a call to getCurrentNumAtRateLevel()
 * to retrieve the current number of ratings a book has at a specific rating level so that it can update the ratings table.
 *
 * @apiName PatchIncrementBookRatingCount
 * @apiGroup Books
 *
 * @apiParam {Number} bookid The ID number of the book
 *
 * @apiQuery {Number{1-5}} rating Rating level to update (e.g., 1, 2, 3, 4, 5)
 *
 * @apiSuccess {Object} book Book object with incremented (+1) ratings at selected rating level.
 * @apiSuccess {Number} book.isbn13 ISBN-13 as a number.
 * @apiSuccess {String} book.authors Comma-separated list of authors.
 * @apiSuccess {Number} book.publication Year the book was originally published.
 * @apiSuccess {String} book.original_title Original title of the book.
 * @apiSuccess {String} book.title Title of the book.
 * @apiSuccess {Object} book.ratings Rating statistics.
 * @apiSuccess {Number} book.ratings.average Average rating (0–5, two decimals).
 * @apiSuccess {Number} book.ratings.count Total number of ratings.
 * @apiSuccess {Number} book.ratings.rating_1 Count of 1-star ratings.
 * @apiSuccess {Number} book.ratings.rating_2 Count of 2-star ratings.
 * @apiSuccess {Number} book.ratings.rating_3 Count of 3-star ratings.
 * @apiSuccess {Number} book.ratings.rating_4 Count of 4-star ratings.
 * @apiSuccess {Number} book.ratings.rating_5 Count of 5-star ratings.
 * @apiSuccess {Object} book.icons Image URLs.
 * @apiSuccess {String} book.icons.large Full-size image URL.
 * @apiSuccess {String} book.icons.small Small image URL.
 *
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
 *    {
 *      "book": {
 *          "isbn13": 9781234567897,
 *          "authors": "Author One, Author Two",
 *          "publication": 1999,
 *          "original_title": "Example Title",
 *          "title": "Example Title Full",
 *          "ratings": {
 *              "average": 4.27,
 *              "count": 5823,
 *              "rating_1": 123,
 *              "rating_2": 432,
 *              "rating_3": 1342,
 *              "rating_4": 2341,
 *              "rating_5": 1585
 *          },
 *          "icons": {
 *              "large": "http://example.com/large.jpg",
 *              "small": "http://example.com/small.jpg"
 *          }
 *      }
 *    }
 *
 * @apiError (400: Invalid book ID) {String} message "Invalid or missing Book ID - please refer to documentation"
 * @apiError (400: Invalid rating) {String} message "Invalid or missing Rating - please refer to documentation"
 * @apiError (404: Book not found) {String} message "Book not found"
 * @apiError (500: Server error) {String} message "server error - contact support"
 */
booksRouter.patch(
    '/bookid/:bookid/incRating',
    mwValidBookID,
    mwValidRating,
    async (request: Request, response: Response) => {
        const bookid = BigInt(request.params.bookid);
        const rating: number = parseInt(request.query.rating as string);
        const rateLevel: string = 'ratings_' + rating;

        const currRatings = await getCurrentNumAtRateLevel(
            response,
            rateLevel,
            bookid
        );

        try {
            const theUpdateQuery = `
                UPDATE ratings
                SET ${rateLevel} = $1
                FROM books
                WHERE ratings.book_id = books.book_id AND books.book_id = $2
                RETURNING ratings.*
            `;

            const values = [currRatings + 1, bookid];

            const updatedResult = await pool.query(theUpdateQuery, values);

            if (updatedResult.rowCount === 0) {
                return response.status(404).json({
                    message: 'Book not found',
                });
            }

            const theQuery = `
                SELECT 
                    b.isbn13,
                    b.original_publication_year,
                    b.original_title,
                    b.title,
                    b.image_url,
                    b.small_image_url,
                    STRING_AGG(a.author, ', ') AS authors,
                    r.ratings_1,
                    r.ratings_2,
                    r.ratings_3,
                    r.ratings_4,
                    r.ratings_5
                FROM books b
                JOIN authors a ON b.book_id = a.book_id
                LEFT JOIN ratings r ON b.book_id = r.book_id
                WHERE b.book_id = $1
                GROUP BY 
                    b.book_id, 
                    b.isbn13, 
                    b.original_publication_year, 
                    b.original_title, 
                    b.title, 
                    b.image_url, 
                    b.small_image_url,
                    r.ratings_1, r.ratings_2, r.ratings_3, r.ratings_4, r.ratings_5
            `;

            const result = await pool.query(theQuery, [bookid]);

            if (result.rowCount === 1) {
                const book: IBook = getFormattedBook(result);
                response.status(200).json({ book });
            } else {
                response.status(404).send({
                    message: 'Book not found',
                });
            }
        } catch (error) {
            console.error('DB Query error on PATCH ratings');
            console.error(error);
            response.status(500).send({
                message: 'server error - contact support',
            });
        }
    }
);

/**
 * @api {patch} /closed/books/bookid/:bookid/decRating Decrement rating count for a specific rating level
 *
 * @apiDescription Request to decrement the number of ratings that a certain book has under a certain rating level by 1.
 * If the query parameter for the rating level is given as a float, it will be parsed as an integer. This makes a call to getCurrentNumAtRateLevel()
 * to retrieve the current number of ratings a book has at a specific rating level so that it can update the ratings table.
 *
 * @apiName PatchDecrementBookRatingCount
 * @apiGroup Books
 *
 * @apiParam {Number} bookid The ID number of the book
 *
 * @apiQuery {Number{1-5}} rating Rating level to update (e.g., 1, 2, 3, 4, 5)
 *
 * @apiSuccess {Object} book Book object with decremented (-1) ratings at selected rating level.
 * @apiSuccess {Number} book.isbn13 ISBN-13 as a number.
 * @apiSuccess {String} book.authors Comma-separated list of authors.
 * @apiSuccess {Number} book.publication Year the book was originally published.
 * @apiSuccess {String} book.original_title Original title of the book.
 * @apiSuccess {String} book.title Title of the book.
 * @apiSuccess {Object} book.ratings Rating statistics.
 * @apiSuccess {Number} book.ratings.average Average rating (0–5, two decimals).
 * @apiSuccess {Number} book.ratings.count Total number of ratings.
 * @apiSuccess {Number} book.ratings.rating_1 Count of 1-star ratings.
 * @apiSuccess {Number} book.ratings.rating_2 Count of 2-star ratings.
 * @apiSuccess {Number} book.ratings.rating_3 Count of 3-star ratings.
 * @apiSuccess {Number} book.ratings.rating_4 Count of 4-star ratings.
 * @apiSuccess {Number} book.ratings.rating_5 Count of 5-star ratings.
 * @apiSuccess {Object} book.icons Image URLs.
 * @apiSuccess {String} book.icons.large Full-size image URL.
 * @apiSuccess {String} book.icons.small Small image URL.
 *
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
 *    {
 *      "book": {
 *          "isbn13": 9781234567897,
 *          "authors": "Author One, Author Two",
 *          "publication": 1999,
 *          "original_title": "Example Title",
 *          "title": "Example Title Full",
 *          "ratings": {
 *              "average": 4.27,
 *              "count": 5823,
 *              "rating_1": 123,
 *              "rating_2": 432,
 *              "rating_3": 1342,
 *              "rating_4": 2341,
 *              "rating_5": 1585
 *          },
 *          "icons": {
 *              "large": "http://example.com/large.jpg",
 *              "small": "http://example.com/small.jpg"
 *          }
 *      }
 *    }
 *
 * @apiError (400: Invalid book ID) {String} message "Invalid or missing Book ID - please refer to documentation"
 * @apiError (400: Invalid rating) {String} message "Invalid or missing Rating - please refer to documentation"
 * @apiError (404: Book not found) {String} message "Book not found"
 * @apiError (500: Server error) {String} message "server error - contact support"
 */
booksRouter.patch(
    '/bookid/:bookid/decRating',
    mwValidBookID,
    mwValidRating,
    async (request: Request, response: Response) => {
        const bookid = BigInt(request.params.bookid);
        const rating: number = parseInt(request.query.rating as string);
        const rateLevel: string = 'ratings_' + rating;

        const currRatings = await getCurrentNumAtRateLevel(
            response,
            rateLevel,
            bookid
        );

        try {
            const theUpdateQuery = `
                UPDATE ratings
                SET ${rateLevel} = $1
                FROM books
                WHERE ratings.book_id = books.book_id AND books.book_id = $2
                RETURNING ratings.*
            `;

            const values = [currRatings - 1, bookid];

            const updatedResult = await pool.query(theUpdateQuery, values);

            if (updatedResult.rowCount === 0) {
                return response.status(404).json({
                    message: 'Book not found',
                });
            }

            const theQuery = `
                SELECT 
                    b.isbn13,
                    b.original_publication_year,
                    b.original_title,
                    b.title,
                    b.image_url,
                    b.small_image_url,
                    STRING_AGG(a.author, ', ') AS authors,
                    r.ratings_1,
                    r.ratings_2,
                    r.ratings_3,
                    r.ratings_4,
                    r.ratings_5
                FROM books b
                JOIN authors a ON b.book_id = a.book_id
                LEFT JOIN ratings r ON b.book_id = r.book_id
                WHERE b.book_id = $1
                GROUP BY 
                    b.book_id, 
                    b.isbn13, 
                    b.original_publication_year, 
                    b.original_title, 
                    b.title, 
                    b.image_url, 
                    b.small_image_url,
                    r.ratings_1, r.ratings_2, r.ratings_3, r.ratings_4, r.ratings_5
            `;

            const result = await pool.query(theQuery, [bookid]);

            if (result.rowCount === 1) {
                const book: IBook = getFormattedBook(result);
                response.status(200).json({ book });
            } else {
                response.status(404).send({
                    message: 'Book not found',
                });
            }
        } catch (error) {
            console.error('DB Query error on PATCH ratings');
            console.error(error);
            response.status(500).send({
                message: 'server error - contact support',
            });
        }
    }
);

/**
 * @api {delete} /books/:isbn13 Delete a book by ISBN-13
 * @apiName DeleteBook
 * @apiGroup Books
 *
 * @apiParam {BigInt} isbn13 ISBN-13 number of the book to delete.
 *
 * @apiSuccess {String} message Confirmation of deletion.
 *
 * @apiError (404) NotFound Book not found.
 * @apiError (500) ServerError "server error - contact support"
 */
booksRouter.delete('/:isbn13', async (request: Request, response: Response) => {
    const { isbn13 } = request.params;

    try {
        const isbnNumber = BigInt(isbn13); // Validate input as BigInt

        const deleteQuery = `DELETE FROM books WHERE isbn13 = $1 RETURNING *`;
        const result = await pool.query(deleteQuery, [isbnNumber]);

        if (result.rowCount === 0) {
            return response.status(404).send({
                message: `Book with ISBN ${isbn13} not found.`,
            });
        }

        response.send({
            message: `Book with ISBN ${isbn13} has been deleted.`,
        });
    } catch (error) {
        console.error('DB Query error on DELETE /books/:isbn13');
        console.error(error);
        response.status(500).send({
            message: 'server error - contact support',
        });
    }
});

/**
 * @api {get} /closed/books/bookid/:bookid/ratings Get ratings for a specific book
 *
 * @apiDescription Request to ratings for a book. Book is retrieved from the book ID. Only the ratings are returned, not the full book info.
 *
 * @apiName GetBookRatings
 * @apiGroup Books
 *
 * @apiParam {Number} bookid The ID number of the book
 *
 * @apiSuccess {Object} ratings Rating statistics.
 * @apiSuccess {Number} ratings.average Average rating (0–5, two decimals).
 * @apiSuccess {Number} ratings.count Total number of ratings.
 * @apiSuccess {Number} ratings.rating_1 Count of 1-star ratings.
 * @apiSuccess {Number} ratings.rating_2 Count of 2-star ratings.
 * @apiSuccess {Number} ratings.rating_3 Count of 3-star ratings.
 * @apiSuccess {Number} ratings.rating_4 Count of 4-star ratings.
 * @apiSuccess {Number} ratings.rating_5 Count of 5-star ratings.
 *
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
 *    {
 *      "ratings": {
 *          "average": 4.27,
 *          "count": 5823,
 *          "rating_1": 123,
 *          "rating_2": 432,
 *          "rating_3": 1342,
 *          "rating_4": 2341,
 *          "rating_5": 1585
 *      }
 *    }
 *
 * @apiError (400: Invalid book ID) {String} message "Invalid or missing Book ID - please refer to documentation"
 * @apiError (404: Book not found) {String} message "Book not found"
 * @apiError (500: Server error) {String} message "server error - contact support"
 */
booksRouter.get(
    '/bookid/:bookid/ratings',
    mwValidBookID,
    async (request: Request, response: Response) => {
        const bookid = BigInt(request.params.bookid);

        try {
            const theQuery = `
                SELECT ratings.*
                FROM ratings
                WHERE ratings.book_id = $1
            `;

            const result = await pool.query(theQuery, [bookid]);

            if (result.rowCount == 1) {
                const ratings: IRatings = getFormattedRatings(result);
                response.status(200).send({ ratings });
            } else {
                response.status(404).send({
                    message: 'Book not found',
                });
            }
        } catch (error) {
            console.error('DB Query error on GET ratings');
            console.error(error);
            response.status(500).send({
                message: 'server error - contact support',
            });
        }
    }
);

/**
 * @api {get} /books/:bookId/image Retrieve image of a book
 * @apiName GetBookImage
 * @apiGroup Books
 *
 * @apiParam {Number} bookId Book ID (must be a positive number).
 *
 * @apiSuccess {String} image image URL for the given book.
 *
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
 *    {
 *      "image": "http://example.com/full-image.jpg"
 *    }
 *
 * @apiError (400) InvalidBookIdParameter "Invalid book ID parameter. It must be a positive number."
 * @apiError (404) ImageNotFound "Image not found for given book ID."
 * @apiError (500) ServerError "server error - contact support"
 */
booksRouter.get('/:bookId/image', async (req: Request, res: Response) => {
    const bookId: number = parseInt(req.params.bookId);
    const bookId: number = parseInt(req.params.bookId);

    if (isNaN(bookId) || bookId <= 0) {
        return res.status(400).json({
            error: 'Invalid book ID parameter. It must be a number and positive.'
        });
    }

    try {
        const query: string = `
    try {
        const query: string = `
                SELECT image_url
                FROM books
                WHERE book_id = $1
            `;

        const result = await pool.query(query, [bookId]);
        const result = await pool.query(query, [bookId]);

        if (result.rowCount == 0 || !result.rows[0].image_url) {
            return res.status(404).json({
                error: 'Image not found for given book ID.'
            });
        }

        res.status(200).json({ image: result.rows[0].image_url });
    } catch (error) {
        console.error('Database query error on GET /books/:bookId/image');
        console.error(error);
        res.status(500).send({
            error: 'server error - contact support',
        });
    }
}
);

/**
 * @api {get} /books/:bookId/small-image Retrieve small image of a book
 * @apiName GetBookSmallImage
 * @apiGroup Books
 *
 * @apiParam {Number} bookId Book ID (must be a positive number).
 *
 * @apiSuccess {String} image Small image URL for the given book.
 *
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
 *    {
 *      "image": "http://example.com/small-image.jpg"
 *    }
 *
 * @apiError (400) InvalidBookIdParameter "Invalid book ID parameter. It must be a positive number."
 * @apiError (404) SmallImageNotFound "Small image not found for given book ID."
 * @apiError (500) ServerError "server error - contact support"
 */
booksRouter.get('/:bookId/small-image', async (req: Request, res: Response) => {
    const bookId: number = parseInt(req.params.bookId);
    const bookId: number = parseInt(req.params.bookId);

    if (isNaN(bookId) || bookId <= 0) {
        return res.status(400).json({
            error: 'Invalid book ID parameter. It must be a number and positive.'
        });
    }

    try {
        const query: string = `
        try {
            const query: string = `
                SELECT small_image_url
                FROM books
                WHERE book_id = $1
            `;

            const result = await pool.query(query, [bookId]);
            const result = await pool.query(query, [bookId]);

            if (result.rowCount === 0 || !result.rows[0].small_image_url) {
                return res.status(404).json({
                    error: 'Small image not found for given book ID.'
                });
            }

            res.status(200).json({ image: result.rows[0].small_image_url });
        } catch (error) {
            console.error('Database query error on GET /books/:bookId/small-image');
            console.error(error);
            res.status(500).send({
                error: 'server error - contact support',
            });
        }
    }
);

/**
 * @api {get} /books/title/:title Fuzzy search books by title
 * @apiName GetBooksByTitle
 * @apiGroup Books
 * @apiPermission authenticated
 *
 * @apiParam {String} title A fuzzy or partial book title (can be misspelled).
 *
 * @apiDescription
 * Returns a list of books whose titles closely match the provided input using trigram similarity.
 * Useful for cases where the title is mistyped or partially remembered.
 *
 * @apiExample {curl} Example usage:
 *     curl -X GET http://localhost:4000/c/books/title/name%20of%20wind \
 *     -H "Authorization: Bearer {accessToken}"
 *
 * @apiSuccess {Object[]} books List of matched books.
 * @apiSuccess {Number} books.book_id Book ID.
 * @apiSuccess {BigInt} books.isbn13 ISBN-13 number.
 * @apiSuccess {Number} books.original_publication_year Year of publication.
 * @apiSuccess {String} books.original_title Original title of the book.
 * @apiSuccess {String} books.title Title of the book.
 * @apiSuccess {String} books.image_url Link to the large image of the book.
 * @apiSuccess {String} books.small_image_url Link to the small image of the book.
 *
 * @apiSuccessExample {json} Success Response:
 * HTTP/1.1 200 OK
 * {
 *   "books": [
 *     {
 *       "book_id": 123,
 *       "isbn13": 9781234567897,
 *       "original_publication_year": 2007,
 *       "original_title": "The Name of the Wind",
 *       "title": "Name of the Wind",
 *       "image_url": "http://example.com/large.jpg",
 *       "small_image_url": "http://example.com/small.jpg"
 *     }
 *   ]
 * }
 *
 * @apiError (400: Invalid Title) {String} message "Missing or invalid title parameter"
 * @apiError (500: Server Error) {String} message "server error - contact support"
 */
booksRouter.get('/title/:title', async (req: Request, res: Response) => {
    const { title } = req.params;

    if (!title || title.trim() === '') {
        return res
            .status(400)
            .json({ message: 'Missing or invalid title parameter' });
    }

    try {
        const searchQuery = `
            SELECT * FROM books
            WHERE title % $1
            ORDER BY similarity(title, $1) DESC
            LIMIT 10;
        `;
        const result = await pool.query(searchQuery, [title]);

        res.status(200).json({ books: result.rows });
    } catch (error) {
        console.error('DB error on GET /title/:title', error);
        res.status(500).json({ message: 'server error - contact support' });
    }
});

export { booksRouter };

/**
 * @api {delete} /closed/books/author/:author Delete books based on author
 *
 * @apiDescription Deletes books based on the books author. This will delete all books that the author wrote and co-wrote.
 *
 * @apiName DeleteBooksByAuthor
 * @apiGroup Books
 *
 * @apiParam {String} author The author's full name
 *
 * @apiSuccess {Object[]} books List of books that have been deleted based on the given author.
 * @apiSuccess {Number} books.isbn13 ISBN-13 as a number.
 * @apiSuccess {String} books.authors Comma-separated list of authors.
 * @apiSuccess {Number} books.publication Year the book was originally published.
 * @apiSuccess {String} books.original_title Original title of the book.
 * @apiSuccess {String} books.title Title of the book.
 * @apiSuccess {Object} books.ratings Rating statistics.
 * @apiSuccess {Number} books.ratings.average Average rating (0–5, two decimals).
 * @apiSuccess {Number} books.ratings.count Total number of ratings.
 * @apiSuccess {Number} books.ratings.rating_1 Count of 1-star ratings.
 * @apiSuccess {Number} books.ratings.rating_2 Count of 2-star ratings.
 * @apiSuccess {Number} books.ratings.rating_3 Count of 3-star ratings.
 * @apiSuccess {Number} books.ratings.rating_4 Count of 4-star ratings.
 * @apiSuccess {Number} books.ratings.rating_5 Count of 5-star ratings.
 * @apiSuccess {Object} books.icons Image URLs.
 * @apiSuccess {String} books.icons.large Full-size image URL.
 * @apiSuccess {String} books.icons.small Small image URL.
 *
 * @apiSuccessExample {json} Success-Response:
 *    HTTP/1.1 200 OK
 *    {
 *      "books": [
 *        {
 *          "isbn13": 9781234567897,
 *          "authors": "Author One, Author Two",
 *          "publication": 1999,
 *          "original_title": "Example Title",
 *          "title": "Example Title Full",
 *          "ratings": {
 *            "average": 4.27,
 *            "count": 5823,
 *            "rating_1": 123,
 *            "rating_2": 432,
 *            "rating_3": 1342,
 *            "rating_4": 2341,
 *            "rating_5": 1585
 *          },
 *          "icons": {
 *            "large": "http://example.com/large.jpg",
 *            "small": "http://example.com/small.jpg"
 *          }
 *        }
 *      ]
 *    }
 *
 * @apiError (404: Author not found) {String} message "Author not found"
 * @apiError (500: Server error) {String} message "server error - contact support"
 */
booksRouter.delete(
    '/author/:author',
    async (request: Request, response: Response) => {
        const author = request.params.author;

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Start by getting all the books from the author to send back later
            const getBooksQuery = `
                SELECT 
                    b.isbn13,
                    b.original_publication_year,
                    b.original_title,
                    b.title,
                    b.image_url,
                    b.small_image_url,
                    STRING_AGG(a.author, ', ') AS authors,
                    r.ratings_1,
                    r.ratings_2,
                    r.ratings_3,
                    r.ratings_4,
                    r.ratings_5
                FROM books b
                JOIN authors a ON b.book_id = a.book_id
                LEFT JOIN ratings r ON b.book_id = r.book_id
                WHERE b.book_id IN (
                    SELECT book_id FROM authors WHERE author = $1
                )
                GROUP BY 
                    b.book_id, 
                    b.isbn13, 
                    b.original_publication_year, 
                    b.original_title, 
                    b.title, 
                    b.image_url, 
                    b.small_image_url,
                    r.ratings_1, r.ratings_2, r.ratings_3, r.ratings_4, r.ratings_5
            `;

            const booksResult = await client.query(getBooksQuery, [author]);

            if (booksResult.rowCount === 0) {
                // if no books were found, then 404
                await client.query('ROLLBACK');
                response.status(404).send({
                    message: 'Author not found',
                });
                return;
            }

            // Then get all the book IDs of the author's books
            const getBookIDsQuery = `
                SELECT book_id
                FROM authors
                WHERE author = $1;
            `;

            const bookIDsResult = await client.query(getBookIDsQuery, [author]);

            const bookIds = bookIDsResult.rows.map((row) => row.book_id); // store just the books IDs

            if (bookIds.length === 0) {
                await client.query('ROLLBACK');
                response.status(404).send({
                    message: 'Author not found',
                });
                return;
            }

            //all deletion happens via these 3
            const deleteFromRatingsQuery = `DELETE FROM ratings WHERE book_id = ANY($1)`;
            await client.query(deleteFromRatingsQuery, [bookIds]);

            const deleteFromBooksQuery = `DELETE FROM books WHERE book_id = ANY($1)`;
            await client.query(deleteFromBooksQuery, [bookIds]);

            const deleteFromAuthorsQuery = `DELETE FROM authors WHERE book_id = ANY($1) AND author = $2`;
            await client.query(deleteFromAuthorsQuery, [bookIds, author]);

            await client.query('COMMIT');

            const books: IBook[] = getFormattedBooksList(booksResult);

            response.status(200).json({ books });
        } catch (error) {
            console.error('DB Query error on DELETE author');
            console.error(error);
            response.status(500).send({
                message: 'server error - contact support',
            });
        } finally {
            client.release();
        }
    }
);
