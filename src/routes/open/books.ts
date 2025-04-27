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
 * @api {get} /books/author/:author Request to retrieve a book(s) by author's name
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
