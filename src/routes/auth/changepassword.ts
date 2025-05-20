import express, { Request, Response, Router } from 'express';
import {
    pool,
    credentialingFunctions,
    validationFunctions,
} from '../../core/utilities';

const changePasswordRouter: Router = express.Router();

/**
 * @api {patch} /auth/changePassword Change a user's password
 *
 * @apiDescription This route allows a user to change their password by providing their current email, old password, and new password.
 * Passwords are securely hashed and salted before being stored.
 *
 * @apiName PutChangePassword
 * @apiGroup Auth
 *
 * @apiBody {String} email The user's email address.
 * @apiBody {String} oldPassword The user's current password.
 * @apiBody {String} newPassword The user's new desired password.
 *
 * @apiSuccess (200: Password Updated) {String} message "Password updated successfully"
 *
 * @apiError (400: Missing Parameters) {String} message "Missing required information"
 * @apiError (400: User Not Found) {String} message "User not found"
 * @apiError (400: Password Mismatch) {String} message "Old password does not match"
 * @apiError (500: Server Error) {String} message "server error - contact support"
 *
 * @apiExample {json} Request Body Example:
 * {
 *   "email": "testuser@example.com",
 *   "oldPassword": "OldPassword123!",
 *   "newPassword": "NewPassword456!"
 * }
 *
 * @apiExample {json} Successful Response (200 OK):
 * {
 *   "message": "Password updated successfully"
 * }
 *
 * @apiExample {json} Error Response (400 User Not Found):
 * {
 *   "message": "User not found"
 * }
 */
changePasswordRouter.patch(
    '/changePassword',
    async (req: Request, res: Response) => {
        const { email, oldPassword, newPassword } = req.body;

        if (
            !validationFunctions.isStringProvided(email) ||
            !validationFunctions.isStringProvided(oldPassword) ||
            !validationFunctions.isStringProvided(newPassword)
        ) {
            return res
                .status(400)
                .json({ message: 'Missing required information' });
        }

        try {
            const query = `
                SELECT Account_Credential.salted_hash, Account_Credential.salt, Account_Credential.account_id
                FROM Account_Credential
                INNER JOIN Account ON Account.account_id = Account_Credential.account_id
                WHERE Account.email = $1
            `;
            const values = [email];
            const result = await pool.query(query, values);

            if (result.rowCount === 0) {
                return res.status(400).json({ message: 'User not found' });
            }

            const { salted_hash, salt, account_id } = result.rows[0];
            const hashedOldPassword = credentialingFunctions.generateHash(
                oldPassword,
                salt
            );

            if (hashedOldPassword !== salted_hash) {
                return res
                    .status(400)
                    .json({ message: 'Old password does not match' });
            }

            const newSalt = credentialingFunctions.generateSalt(32);
            const newHashedPassword = credentialingFunctions.generateHash(
                newPassword,
                newSalt
            );

            const updateQuery = `
                UPDATE Account_Credential
                SET salted_hash = $1, salt = $2
                WHERE account_id = $3
            `;
            const updateValues = [newHashedPassword, newSalt, account_id];

            await pool.query(updateQuery, updateValues);

            res.status(200).json({ message: 'Password updated successfully' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'server error - contact support' });
        }
    }
);

export { changePasswordRouter };
