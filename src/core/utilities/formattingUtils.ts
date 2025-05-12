import { Response } from 'express';
import { pool } from '../../core/utilities';
import { QueryResult } from 'pg';

/**
 * Calculates the total number of ratings across all rating levels (1–5).
 *
 * @param {QueryResult} result - An object containing the number of ratings for each level (e.g., ratings_1 through ratings_5).
 *                               It is expected to have numeric properties: ratings_1, ratings_2, ratings_3, ratings_4, and ratings_5.
 *
 * @returns {number} The total count of all ratings combined.
 */
function calcRatingsCount(result: QueryResult): number {
    const count: number =
        result['ratings_1'] +
        result['ratings_2'] +
        result['ratings_3'] +
        result['ratings_4'] +
        result['ratings_5'];
    return count;
}

/**
 * Calculates the average rating of a book by weighting all the rating levels and dividing this by the
 * total number of ratings across all rating levels. Makes a call calcRatingsCount() to get total number of ratings.
 *
 * @param {QueryResult} result - An object containing the number of ratings for each level (e.g., ratings_1 through ratings_5).
 *                               It is expected to have numeric properties: ratings_1, ratings_2, ratings_3, ratings_4, and ratings_5.
 *
 * @returns {number} The average rating of a book.
 */
function calcRatingsAverage(result: QueryResult): number {
    const count: number = calcRatingsCount(result);
    const weightedRatings: number =
        result['ratings_1'] * 1 +
        result['ratings_2'] * 2 +
        result['ratings_3'] * 3 +
        result['ratings_4'] * 4 +
        result['ratings_5'] * 5;
    return parseFloat((weightedRatings / count).toFixed(2));
}

/**
 * Asynchronously retrieves the current rating count at a specific rating level for a book.
 *
 * This function queries the database for the number of ratings at the provided rating level
 * for a given book ID, returning the count if the book exists, or sending an error response if not.
 *
 * @async
 * @param {Response} response - The Express response object, used to send the response back to the client.
 * @param {string} rateLevel - The rating level to check (e.g., "ratings_1", "ratings_2", etc.).
 * @param {bigint} bookid - The unique ID of the book for which the rating count is being fetched.
 * @returns {Promise<number>} A promise that resolves to the current count of ratings at the specified level.
 * @throws {Error} If a database query fails, an error message is logged, and a 500 status code is sent.
 * @throws {Error} If the book is not found, a 404 status code is sent with a relevant error message.
 */
async function getCurrentNumAtRateLevel(
    response: Response,
    rateLevel: string,
    bookid: bigint
): Promise<number> {
    //let currRatings: number;
    try {
        const ratingQuery = `
                SELECT ${rateLevel}
                FROM ratings
                WHERE ratings.book_id = $1
            `;

        const numRatings = await pool.query(ratingQuery, [bookid]);

        if (numRatings.rowCount === 1) {
            return numRatings.rows[0][rateLevel];
        } else {
            response.status(404).send({
                message: 'Book not found',
            });
            return undefined;
        }
    } catch (error) {
        console.error('DB Query error on PATCH ratings');
        console.error(error);
        response.status(500).send({
            message: 'server error - contact support',
        });
        return undefined;
    }
}

function getFormattedRatings(result: QueryResult): IRatings {
    const { book_id, ratings_1, ratings_2, ratings_3, ratings_4, ratings_5 } =
        result.rows[0];

    const count = calcRatingsCount(result.rows[0]);
    const average = count === 0 ? 0 : calcRatingsAverage(result.rows[0]);

    return {
        average,
        count,
        rating_1: ratings_1,
        rating_2: ratings_2,
        rating_3: ratings_3,
        rating_4: ratings_4,
        rating_5: ratings_5,
    };
}

function getFormattedBook(result: QueryResult): IBook {
    const {
        isbn13,
        authors,
        original_publication_year,
        original_title,
        title,
        image_url,
        small_image_url,
        ratings_1,
        ratings_2,
        ratings_3,
        ratings_4,
        ratings_5,
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
        },
    };
}

function getFormattedBooksList(result: QueryResult): IBook[] {
    return result.rows.map((row) => {
        const {
            isbn13,
            authors,
            original_publication_year,
            original_title,
            title,
            image_url,
            small_image_url,
            ratings_1,
            ratings_2,
            ratings_3,
            ratings_4,
            ratings_5,
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
            },
        };
    });
}

const formattingFunctions = {
    calcRatingsCount,
    calcRatingsAverage,
    getCurrentNumAtRateLevel,
    getFormattedRatings,
    getFormattedBook,
    getFormattedBooksList,
};

export { formattingFunctions };
