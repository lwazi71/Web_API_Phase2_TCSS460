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
 * @api {get} /books/author/:author Retrieve books by author
 * @apiName GetBooksByAuthor
 * @apiGroup Books
 *
 * @apiParam {String} author Full name of the author (URL encoded if needed).
 *
 * @apiSuccess {Object[]} books List of books written by the author.
 * @apiSuccess {Number} books.book_id Book ID.
 * @apiSuccess {BigInt} books.isbn13 ISBN-13 number.
 * @apiSuccess {Number} books.original_publication_year Year the book was first published.
 * @apiSuccess {String} books.original_title Original title of the book.
 * @apiSuccess {String} books.title Full title.
 * @apiSuccess {String} books.image_url Link to a large image of the book.
 * @apiSuccess {String} books.small_image_url Link to a small image of the book.
 * @apiSuccess {String} books.formatted Formatted string combining ISBN and title.
 *
 * @apiError (404 Not Found) {String} message "Author not found"
 * @apiError (500 Internal Server Error) {String} message "server error - contact support"
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
 * @apiParam {String} isbn ISBN-13 number of the book (10–13 digits).
 *
 * @apiSuccess {Object} book Book details.
 * @apiSuccess {Number} book.book_id Book ID.
 * @apiSuccess {BigInt} book.isbn13 ISBN-13 number.
 * @apiSuccess {Number} book.original_publication_year Year the book was first published.
 * @apiSuccess {String} book.original_title Original title of the book.
 * @apiSuccess {String} book.title Full title.
 * @apiSuccess {String} book.image_url Link to a large image of the book.
 * @apiSuccess {String} book.small_image_url Link to a small image of the book.
 *
 * @apiError (400 Bad Request) {String} message "Invalid ISBN format."
 * @apiError (404 Not Found) {String} message "Book not found"
 * @apiError (500 Internal Server Error) {String} message "server error - contact support"
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

export { booksRouter };
