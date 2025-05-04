//express is the framework we're going to use to handle requests
import express, { NextFunction, Request, Response, Router } from 'express';
//Access the connection to Postgres Database
import { pool, validationFunctions } from '../../core/utilities';

const booksRouter: Router = express.Router();

const isStringProvided = validationFunctions.isStringProvided;

const format = (resultRow) =>
    `{${resultRow.isbn}} - ${resultRow.title} by ${resultRow.author}`;

const formatKeep = (resultRow) => ({
    ...resultRow,
    formatted: `{${resultRow.isbn}} - ${resultRow.title} by ${resultRow.author}`,
});

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
 * @api {get} /book/:author Request to retrieve a book(s) by author's name
 *
 * @apiDescription Request to retrieve the complete entry for <code>author</code>.
 * Note this endpoint returns an entry as a list of objects.
 *
 * @apiName GetMessageName
 * @apiGroup Book
 *
 * @apiParam {string} author the author to look up.
 *
 * @apiSuccess {Object[]} books the message entry object for <code>author</code>
 * @apiSuccess {string} books.author <code>author</code>
 * @apiSuccess {string} books.title The title associated with <code>author</code>
 * @apiSuccess {number} books.isbn The ISBN associated with <code>author</code>
 *
 * @apiError (404: Author Not Found) {string} message "Author not found"
 */
booksRouter.get('/:author', (request: Request, response: Response) => {
    const theQuery = 'SELECT name, message, priority FROM Demo WHERE name = $1';
    const values = [request.params.author];

    pool.query(theQuery, values)
        .then((result) => {
            if (result.rowCount > 0) {
                // > 0 bc an author could multiple books / authors have same last name
                response.send({
                    message: result.rows.map(formatKeep),
                });
            } else {
                response.status(404).send({
                    message: 'Author not found',
                });
            }
        })
        .catch((error) => {
            //log the error
            console.error('DB Query error on GET /:author');
            console.error(error);
            response.status(500).send({
                message: 'server error - contact support',
            });
        });
});

export { booksRouter };

/**
 * @api {post} /books Create a new book
 * @apiName CreateBook
 * @apiGroup Books
 *
 * @apiParam {String} title Full title of the book.
 * @apiParam {String} original_title Original title of the book.
 * @apiParam {BigInt} isbn13 ISBN-13 number of the book.
 * @apiParam {Number} original_publication_year Year the book was first published.
 * @apiParam {String} authors List of authors (comma separated).
 * @apiParam {Number} average_rating Average rating of the book.
 * @apiParam {Number} ratings_count Total number of ratings.
 * @apiParam {Number} ratings_1 Number of 1-star ratings.
 * @apiParam {Number} ratings_2 Number of 2-star ratings.
 * @apiParam {Number} ratings_3 Number of 3-star ratings.
 * @apiParam {Number} ratings_4 Number of 4-star ratings.
 * @apiParam {Number} ratings_5 Number of 5-star ratings.
 * @apiParam {String} image_url Link to a large image of the book.
 * @apiParam {String} small_image_url Link to a small image of the book.
 *
 * @apiSuccess {Object} book The created book object.
 * @apiSuccess {Number} book.book_id Book ID.
 * @apiSuccess {BigInt} book.isbn13 ISBN-13 number.
 * @apiSuccess {String} book.authors Authors of the book.
 * @apiSuccess {Number} book.original_publication_year Year the book was first published.
 * @apiSuccess {String} book.original_title Original title of the book.
 * @apiSuccess {String} book.title Full title of the book.
 * @apiSuccess {Number} book.average_rating Average rating of the book.
 * @apiSuccess {Number} book.ratings_count Total number of ratings.
 * @apiSuccess {Number} book.ratings_1 Number of 1-star ratings.
 * @apiSuccess {Number} book.ratings_2 Number of 2-star ratings.
 * @apiSuccess {Number} book.ratings_3 Number of 3-star ratings.
 * @apiSuccess {Number} book.ratings_4 Number of 4-star ratings.
 * @apiSuccess {Number} book.ratings_5 Number of 5-star ratings.
 * @apiSuccess {String} book.image_url Link to a large image of the book.
 * @apiSuccess {String} book.small_image_url Link to a small image of the book.
 *
 * @apiError (400 Bad Request) {String} message "Invalid input data"
 * @apiError (500 Internal Server Error) {String} message "server error - contact support"
 */
booksRouter.post('/books', async (request: Request, response: Response) => {
    const {
        title, original_title, isbn13, original_publication_year, authors,
        average_rating, ratings_count, ratings_1, ratings_2, ratings_3,
        ratings_4, ratings_5, image_url, small_image_url
    } = request.body;

    // Validate the input data
    if (!title || !original_title || !isbn13 || !original_publication_year || !authors || !image_url || !small_image_url) {
        return response.status(400).send({
            message: 'Invalid input data',
        });
    }

    // Convert isbn13 to BigInt if it's not already
    const isbnNumber = BigInt(isbn13);

    // Insert the new book into the database
    try {
        const insertQuery = `
            INSERT INTO books (isbn13, authors, original_publication_year, original_title, title, 
                               average_rating, ratings_count, ratings_1, ratings_2, ratings_3, 
                               ratings_4, ratings_5, image_url, small_image_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING book_id, isbn13, authors, original_publication_year, original_title, title, 
                      average_rating, ratings_count, ratings_1, ratings_2, ratings_3, ratings_4, ratings_5, 
                      image_url, small_image_url
        `;
        const values = [
            isbnNumber, authors, original_publication_year, original_title, title,
            average_rating, ratings_count, ratings_1, ratings_2, ratings_3,
            ratings_4, ratings_5, image_url, small_image_url
        ];

        const result = await pool.query(insertQuery, values);

        // Return the created book
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
            SELECT * FROM books
            ORDER BY book_id
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

