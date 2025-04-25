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