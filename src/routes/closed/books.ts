// express is the framework we're going to use to handle requests
import express, { NextFunction, Request, Response, Router } from 'express';
// Access the connection to Postgres Database
import { pool, validationFunctions } from '../../core/utilities';
import { QueryResult } from 'pg';

const booksRouter: Router = express.Router();

const isStringProvided = validationFunctions.isStringProvided;
const isNumberProvided = validationFunctions.isNumberProvided;

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
interface IRatings {
    average: number;
    count: number;
    rating_1: number;
    rating_2: number;
    rating_3: number;
    rating_4: number;
    rating_5: number;
}

interface IUrlIcon {
    large: string;
    small: string;
}

interface IBook {
    isbn13: number;
    authors: string;
    publication: number;
    original_title: string;
    title: string;
    ratings: IRatings;
    icons: IUrlIcon;
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
booksRouter.get(
    '/author/:author',
    //mwValidAuthor,
    (request: Request, response: Response) => {
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
                if (result.rowCount !== null && result.rowCount > 0) {
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

            if (result.rowCount !== null && result.rowCount > 0) {
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
 * @apiQuery {Number} [page=1] Page number for pagination.
 * @apiQuery {Number} [limit=10] Number of books per page.
 *
 * @apiSuccess {Object[]} books List of books for the page.
 * @apiSuccess {Number} books.isbn13 ISBN-13.
 * @apiSuccess {String} books.authors Comma-separated authors.
 * @apiSuccess {Number} books.publication Publication year.
 * @apiSuccess {String} books.original_title Original title.
 * @apiSuccess {String} books.title Title.
 * @apiSuccess {Object} books.ratings Ratings breakdown.
 * @apiSuccess {Number} books.ratings.average Average rating.
 * @apiSuccess {Number} books.ratings.count Total ratings count.
 * @apiSuccess {Number} books.ratings.rating_1 1-star count.
 * @apiSuccess {Number} books.ratings.rating_2 2-star count.
 * @apiSuccess {Number} books.ratings.rating_3 3-star count.
 * @apiSuccess {Number} books.ratings.rating_4 4-star count.
 * @apiSuccess {Number} books.ratings.rating_5 5-star count.
 * @apiSuccess {Object} books.icons Image URLs.
 * @apiSuccess {String} books.icons.large Large icon URL.
 * @apiSuccess {String} books.icons.small Small icon URL.
 *
 * @apiSuccess {Number} total Total number of books.
 * @apiSuccess {Number} page Current page number.
 * @apiSuccess {Number} limit Books per page.
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
                b.book_id,                          
                b.isbn13,
                b.original_title,
                b.title,
                b.original_publication_year AS publication,
                b.image_url,
                b.small_image_url,
                r.ratings_1,
                r.ratings_2,
                r.ratings_3,
                r.ratings_4,
                r.ratings_5,
                (r.ratings_1 + r.ratings_2 + r.ratings_3 + r.ratings_4 + r.ratings_5) AS rating_count,
                (
                    (1 * r.ratings_1 + 2 * r.ratings_2 + 3 * r.ratings_3 + 4 * r.ratings_4 + 5 * r.ratings_5)::FLOAT /
                    NULLIF((r.ratings_1 + r.ratings_2 + r.ratings_3 + r.ratings_4 + r.ratings_5), 0)
                ) AS rating_average,
                STRING_AGG(a.author, ', ') AS authors
            FROM books b
            JOIN authors a ON b.book_id = a.book_id
            JOIN ratings r ON b.book_id = r.book_id
            GROUP BY 
                b.book_id, b.isbn13, b.original_title, b.title, b.original_publication_year,
                b.image_url, b.small_image_url,
                r.ratings_1, r.ratings_2, r.ratings_3, r.ratings_4, r.ratings_5
            ORDER BY b.book_id
            LIMIT $1 OFFSET $2
        `;

        const countQuery = `SELECT COUNT(*) FROM books`;

        const [booksResult, countResult] = await Promise.all([
            pool.query(booksQuery, [limit, offset]),
            pool.query(countQuery),
        ]);

        const books = booksResult.rows.map((row) => ({
            book_id: row.book_id,
            isbn13: row.isbn13.toString(),
            authors: row.authors,
            publication: row.publication,
            original_title: row.original_title,
            title: row.title,
            ratings: {
                average: parseFloat(row.rating_average),
                count: parseInt(row.rating_count),
                rating_1: row.ratings_1,
                rating_2: row.ratings_2,
                rating_3: row.ratings_3,
                rating_4: row.ratings_4,
                rating_5: row.ratings_5,
            },
            icons: {
                large: row.image_url,
                small: row.small_image_url,
            },
        }));
        const total = parseInt(countResult.rows[0].count);

        response.status(200).json({
            books,
            total,
            page,
            limit,
        });
    } catch (error) {
        console.error('DB Query error on GET /books', error);
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

        const result: QueryResult<BookWithAuthors> = await pool.query(
            insertQuery,
            values
        );

        if (result.rowCount === 0) {
            return res.status(200).json({ books: [] });
        }

        res.status(200).json({ books: result.rows });
    } catch (error) {
        console.error('Database query error on GET /books/age');
        console.error(error);
        res.status(500).send({
            message: 'server error - contact support',
        });
    }
});

/*
 * @api {get} /books Get books within an average rating range
 *
 * @apiDescription Request to get books whose ratings fall in a range of average ratings (both minimum and maximum average ratings are inclusive)
 *
 * @apiName GetBooksByAvgRating
 * @apiGroup Books
 *
 * @apiQuery {Number{1.0-5.0}} [minRating=1.0] Minimum average rating (inclusive)
 * @apiQuery {Number{1.0-5.0}} [maxRating=5.0] Maximum average rating (inclusive)
 *
 * @apiSuccess {Object[]} books List of books matching the rating range
 * @apiSuccess {Number} books.book_id ID number of the book
 * @apiSuccess {String} books.isbn13 ISBN-13 identifier
 * @apiSuccess {Number} books.original_publication_year Original publication year of the book
 * @apiSuccess {String} books.original_title Original title of the book
 * @apiSuccess {String} books.title Title of the book
 * @apiSuccess {String} books.image_url URL for image for the book
 * @apiSuccess {String} books.small_image_url URL for smaller image for the book
 *
 * @apiError (400: Invalid or missing Rating Range) {String} message "Invalid or missing Rating Range - please refer to documentation"
 * @apiError (404: No books found in range) {String} message "No books found in range"
 * @apiError (500: Server error) {String} message "server error - contact support"
 */
booksRouter.get(
    '/',
    mwValidAvgRatingRange,
    async (request: Request, response: Response) => {
        const minRating: number =
            parseFloat(request.query.minRating as string) || 1.0;
        const maxRating: number =
            parseFloat(request.query.maxRating as string) || 5.0;

        const theQuery = `
        SELECT books.*
        FROM books
        JOIN ratings ON books.book_id = ratings.book_id
        WHERE 
            (
                (ratings_1::float + 2 * ratings_2::float + 3 * ratings_3::float + 4 * ratings_4::float + 5 * ratings_5::float) 
                / (ratings_1 + ratings_2 + ratings_3 + ratings_4 + ratings_5) 
            )
            BETWEEN $1 AND $2 
        `;

        const values = [minRating, maxRating];

        pool.query(theQuery, values)
            .then((result) => {
                if (result.rowCount !== null && result.rowCount > 0) {
                    response.send({
                        books: result.rows.map(formatKeep),
                    });
                } else {
                    response.status(404).send({
                        message: 'No books found in range',
                    });
                }
            })
            .catch((error) => {
                console.error('DB Query error on GET');
                console.error(error);
                response.status(500).send({
                    message: 'server error - contact support',
                });
            });
    }
);

/**
 * @api {patch} /isbn/:isbn/:numRatings Update rating count for a specific rating level
 *
 * @apiDescription Request to edit the number of ratings that a certain book has under a certain rating level.
 *
 * @apiName PatchBookRatingCount
 * @apiGroup Books
 *
 * @apiParam {String} isbn ISBN-13 number (10–13 digits).
 * @apiParam {Number} numRatings Number of ratings to set for the given rating level
 *
 * @apiQuery {Number{1-5}} rating Rating level to update (e.g., 1, 2, 3, 4, 5)
 *
 * @apiSuccess {Object[]} books List of books matching the rating range
 * @apiSuccess {Number} books.book_id ID number of the book
 * @apiSuccess {String} books.isbn13 ISBN-13 identifier
 * @apiSuccess {Number} books.original_publication_year Original publication year of the book
 * @apiSuccess {String} books.original_title Original title of the book
 * @apiSuccess {String} books.title Title of the book
 * @apiSuccess {String} books.image_url URL for image for the book
 * @apiSuccess {String} books.small_image_url URL for smaller image for the book
 *
 * @apiError (400: Invalid ISBN Format) {String} message "Invalid ISBN format."
 * @apiError (400: Invalid number of ratings) {String} message "'Invalid or missing Number of Ratings - please refer to documentation'"
 * @apiError (400: Invalid rating) {String} message "Invalid or missing Rating - please refer to documentation"
 * @apiError (404: Book not found) {String} message "Book not found"
 * @apiError (500: Server error) {String} message "server error - contact support"
 */
booksRouter.patch(
    '/isbn/:isbn/:numRatings',
    mwValidISBN,
    mwValidNumberOfRatings,
    mwValidRating,
    async (request: Request, response: Response) => {
        const isbn = BigInt(request.params.isbn);
        const numRatings: number = parseInt(
            request.params.numRatings as string
        );
        const rating: number = parseInt(request.query.rating as string);
        const rateLevel: string = 'ratings_' + rating;

        const theQuery = `
        UPDATE ratings
        SET ${rateLevel} = $1
        FROM books
        WHERE ratings.book_id = books.book_id AND books.isbn13 = $2
        RETURNING books.*
        `;

        const values = [numRatings, isbn];

        pool.query(theQuery, values)
            .then((result) => {
                if (result.rowCount == 1) {
                    response.send({
                        books: result.rows.map(formatKeep),
                    });
                } else {
                    response.status(404).send({
                        message: 'Book not found',
                    });
                }
            })
            .catch((error) => {
                console.error('DB Query error on PATCH ratings');
                console.error(error);
                response.status(500).send({
                    message: 'server error - contact support',
                });
            });
    }
);

/**
 * @api {patch} /isbn/:isbn/:numRatings/incRating Increment rating count for a specific rating level
 *
 * @apiDescription Request to increment the number of ratings that a certain book has under a certain rating level by 1. If the query parameter for the rating level is given as a float, it will be parsed as an integer.
 *
 * @apiName PatchIncrementBookRatingCount
 * @apiGroup Books
 *
 * @apiParam {String} isbn ISBN-13 number (10–13 digits).
 * @apiParam {Number} numRatings Number of ratings to set for the given rating level
 *
 * @apiQuery {Number{1-5}} rating Rating level to update (e.g., 1, 2, 3, 4, 5)
 *
 * @apiSuccess {Object[]} books List of books matching the rating range
 * @apiSuccess {Number} books.book_id ID number of the book
 * @apiSuccess {String} books.isbn13 ISBN-13 identifier
 * @apiSuccess {Number} books.original_publication_year Original publication year of the book
 * @apiSuccess {String} books.original_title Original title of the book
 * @apiSuccess {String} books.title Title of the book
 * @apiSuccess {String} books.image_url URL for image for the book
 * @apiSuccess {String} books.small_image_url URL for smaller image for the book
 *
 * @apiError (400: Invalid ISBN Format) {String} message "Invalid ISBN format."
 * @apiError (400: Invalid number of ratings) {String} message "'Invalid or missing Number of Ratings - please refer to documentation'"
 * @apiError (400: Invalid rating) {String} message "Invalid or missing Rating - please refer to documentation"
 * @apiError (404: Book not found) {String} message "Book not found"
 * @apiError (500: Server error) {String} message "server error - contact support"
 */
booksRouter.patch(
    '/isbn/:isbn/:numRatings/incRating',
    mwValidISBN,
    mwValidNumberOfRatings,
    mwValidRating,
    async (request: Request, response: Response) => {
        const isbn = BigInt(request.params.isbn);
        const numRatings: number = parseInt(
            request.params.numRatings as string
        );
        const rating: number = parseInt(request.query.rating as string);
        const rateLevel: string = 'ratings_' + rating;

        try {
            const theQuery = `
            UPDATE ratings
            SET ${rateLevel} = $1
            FROM books
            WHERE ratings.book_id = books.book_id AND books.isbn13 = $2
            RETURNING books.*
            `;

            const values = [numRatings + 1, isbn];

            const result = await pool.query(theQuery, values);

            if (result.rowCount == 1) {
                response.send({
                    book: result.rows.map(formatKeep),
                });
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
 * @api {patch} /isbn/:isbn/:numRatings/decRating Decrement rating count for a specific rating level
 *
 * @apiDescription Request to decrement the number of ratings that a certain book has under a certain rating level by 1. If the query parameter for the rating level is given as a float, it will be parsed as an integer.
 *
 * @apiName PatchDecrementBookRatingCount
 * @apiGroup Books
 *
 * @apiParam {String} isbn ISBN-13 number (10–13 digits).
 * @apiParam {Number} numRatings Number of ratings to set for the given rating level
 *
 * @apiQuery {Number{1-5}} rating Rating level to update (e.g., 1, 2, 3, 4, 5)
 *
 * @apiSuccess {Object[]} books List of books matching the rating range
 * @apiSuccess {Number} books.book_id ID number of the book
 * @apiSuccess {String} books.isbn13 ISBN-13 identifier
 * @apiSuccess {Number} books.original_publication_year Original publication year of the book
 * @apiSuccess {String} books.original_title Original title of the book
 * @apiSuccess {String} books.title Title of the book
 * @apiSuccess {String} books.image_url URL for image for the book
 * @apiSuccess {String} books.small_image_url URL for smaller image for the book
 *
 * @apiError (400: Invalid ISBN Format) {String} message "Invalid ISBN format."
 * @apiError (400: Invalid number of ratings) {String} message "'Invalid or missing Number of Ratings - please refer to documentation'"
 * @apiError (400: Invalid rating) {String} message "Invalid or missing Rating - please refer to documentation"
 * @apiError (404: Book not found) {String} message "Book not found"
 * @apiError (500: Server error) {String} message "server error - contact support"
 */
booksRouter.patch(
    '/isbn/:isbn/:numRatings/decRating',
    mwValidISBN,
    mwValidNumberOfRatings,
    mwValidRating,
    async (request: Request, response: Response) => {
        const isbn = BigInt(request.params.isbn);
        const numRatings: number = parseInt(
            request.params.numRatings as string
        );
        const rating: number = parseInt(request.query.rating as string);
        const rateLevel: string = 'ratings_' + rating;

        try {
            const theQuery = `
            UPDATE ratings
            SET ${rateLevel} = $1
            FROM books
            WHERE ratings.book_id = books.book_id AND books.isbn13 = $2
            RETURNING books.*
            `;

            const values = [numRatings - 1, isbn];

            const result = await pool.query(theQuery, values);

            if (result.rowCount == 1) {
                response.send({
                    book: result.rows.map(formatKeep),
                });
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
 * @api {get} /books/title/:title Fuzzy search books by title
 * @apiName GetBooksByTitle
 * @apiGroup Books
 * @apiPermission authenticated
 *
 * @apiParam {String} title A fuzzy or partial book title (can be misspelled).
 *
 * @apiDescription
 * Returns a list of books whose titles closely match the provided input using trigram similarity.
 * Output matches IBook structure.
 *
 * @apiSuccess {Object[]} books List of matched books.
 * @apiSuccess {Number} books.isbn13 ISBN-13.
 * @apiSuccess {String} books.authors Comma-separated authors.
 * @apiSuccess {Number} books.publication Publication year.
 * @apiSuccess {String} books.original_title Original title.
 * @apiSuccess {String} books.title Title.
 * @apiSuccess {Object} books.ratings Ratings breakdown.
 * @apiSuccess {Number} books.ratings.average Average rating.
 * @apiSuccess {Number} books.ratings.count Total ratings count.
 * @apiSuccess {Number} books.ratings.rating_1 1-star count.
 * @apiSuccess {Number} books.ratings.rating_2 2-star count.
 * @apiSuccess {Number} books.ratings.rating_3 3-star count.
 * @apiSuccess {Number} books.ratings.rating_4 4-star count.
 * @apiSuccess {Number} books.ratings.rating_5 5-star count.
 * @apiSuccess {Object} books.icons Image URLs.
 * @apiSuccess {String} books.icons.large Large icon URL.
 * @apiSuccess {String} books.icons.small Small icon URL.
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
        // Optional: set threshold for looser matches
        await pool.query('SET pg_trgm.similarity_threshold = 0.2');

        const searchQuery = `
            SELECT 
                b.book_id,
                b.isbn13,
                b.original_publication_year,
                b.original_title,
                b.title,
                r.ratings_1, r.ratings_2, r.ratings_3, r.ratings_4, r.ratings_5,
                (r.ratings_1 + r.ratings_2 + r.ratings_3 + r.ratings_4 + r.ratings_5) AS rating_count,
                (
                (1 * r.ratings_1 + 2 * r.ratings_2 + 3 * r.ratings_3 + 4 * r.ratings_4 + 5 * r.ratings_5)::FLOAT /
                NULLIF((r.ratings_1 + r.ratings_2 + r.ratings_3 + r.ratings_4 + r.ratings_5), 0)
                ) AS rating_average,
                b.image_url,
                b.small_image_url,
                STRING_AGG(a.author, ', ') AS authors
            FROM books b
            JOIN authors a ON b.book_id = a.book_id
            JOIN ratings r ON b.book_id = r.book_id
            WHERE b.title % $1
            GROUP BY b.book_id, b.isbn13, b.original_publication_year, b.original_title, b.title, 
                    r.ratings_1, r.ratings_2, r.ratings_3, r.ratings_4, r.ratings_5,
                    b.image_url, b.small_image_url
            ORDER BY similarity(b.title, $1) DESC
            LIMIT 10;
        `;

        const result = await pool.query(searchQuery, [title]);

        const books = result.rows.map((row) => ({
            book_id: row.book_id,
            isbn13: row.isbn13.toString(), // matches test regex
            title: row.title,
            original_title: row.original_title,
            original_publication_year: row.original_publication_year,
            image_url: row.image_url,
            small_image_url: row.small_image_url,
            authors: row.authors,
            ratings: {
                average: parseFloat(row.rating_average || 0),
                count: parseInt(row.rating_count),
                rating_1: row.ratings_1,
                rating_2: row.ratings_2,
                rating_3: row.ratings_3,
                rating_4: row.ratings_4,
                rating_5: row.ratings_5,
            },
            icons: {
                large: row.image_url,
                small: row.small_image_url,
            },
        }));

        res.status(200).json({ books });
    } catch (error) {
        console.error('DB error on GET /title/:title', error);
        res.status(500).json({ message: 'server error - contact support' });
    }
});
export { booksRouter };
