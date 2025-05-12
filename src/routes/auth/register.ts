// express is the framework we're going to use to handle requests
import express, { Request, Response, Router, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

const key = {
    secret: process.env.JSON_WEB_TOKEN,
};

import {
    pool,
    validationFunctions,
    credentialingFunctions,
} from '../../core/utilities';

const isStringProvided = validationFunctions.isStringProvided;
const isNumberProvided = validationFunctions.isNumberProvided;
const generateHash = credentialingFunctions.generateHash;
const generateSalt = credentialingFunctions.generateSalt;

const registerRouter: Router = express.Router();

export interface IUserRequest extends Request {
    id: number;
}

// Add more/your own password validation here. The *rules* must be documented
// and the client-side validation should match these rules.
const isValidPassword = (password: string): boolean => {
    if (!isStringProvided(password)) return false;

    const trimmed = password.trim();
    const regex = new RegExp(
        '^' +
        '(?=.*[a-z])' + // at least one lowercase
        '(?=.*[A-Z])' + // at least one uppercase
        '(?=.*\\d)' + // at least one digit
        '(?=.*!)' + // at least one '!' symbol
        '(?!.*(.)\\1{2,})' + // no 3+ consecutive duplicate characters
        '[A-Za-z\\d!]{10,}' + // only A-Za-z0-9! and at least 10 characters
        '$'
    );

    return regex.test(trimmed);
};

// Add more/your own phone number validation here. The *rules* must be documented
// and the client-side validation should match these rules.
const isValidPhone = (phone: string): boolean => {
    if (!isStringProvided(phone)) return false;

    const trimmed = phone.trim();

    const phoneRegex =
        /^(?:\+1[-.\s]?)?\(?([2-9][0-9]{2})\)?[-.\s]?([2-9][0-9]{2})[-.\s]?(\d{4})$/;

    if (!phoneRegex.test(trimmed)) return false;

    // Extract digits
    const digitsOnly = trimmed.replace(/[^\d]/g, '');
    const normalized =
        digitsOnly.length === 11 && digitsOnly.startsWith('1')
            ? digitsOnly.slice(1)
            : digitsOnly;

    if (normalized.length !== 10) return false;

    const areaCode = parseInt(normalized.slice(0, 3));
    const exchangeCode = parseInt(normalized.slice(3, 6));
    const serial = parseInt(normalized.slice(6, 10));

    return areaCode >= 200 && exchangeCode >= 200 && serial !== 0;
};

// Add more/your own role validation here. The *rules* must be documented
// and the client-side validation should match these rules.
const isValidRole = (role: string): boolean => {
    if (!validationFunctions.isNumberProvided(role)) return false;
    const roleNum = parseInt(role);
    return roleNum >= 1 && roleNum <= 5;
};

const isValidEmail = (email: string): boolean => {
    if (!isStringProvided(email)) return false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};


/**
 * @apiBody {String} role a role for this user [1–5]
 * Must:
 * - Be a number
 * - Be between 1 and 5 inclusive
 * - Represents access level or user type
 */
const roleMiddlewareCheck = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (isValidRole(req.body.role)) {
        next();
    } else {
        res.status(400).send({
            message:
                'Invalid or missing role - must be a number between 1 and 5',
        });
    }
};
/**
 * @apiBody {String} phone a user's phone number
 * Must:
 * - Be 10 digits (or 11 if using +1)
 * - Area code and exchange code must start with 2–9
 * - Accept common formats like (555) 555-5555, 555-555-5555, +1 555 555 5555
 * - Must not include letters or symbols
 */
const phoneMiddlewareCheck = (
    request: Request,
    response: Response,
    next: NextFunction
) => {
    if (isValidPhone(request.body.phone)) {
        next();
    } else {
        response.status(400).send({
            message:
                'Invalid or missing phone number - please refer to documentation',
        });
    }
};
/**
 * @apiBody {String} email a users email 
 * Must:
 * - Be a valid email format (`example@domain.com`)
 * - Contain exactly one "@" symbol
 * - Have a valid domain and top-level domain (e.g., ".com")
 * - Not contain spaces
 */
const emailMiddlewareCheck = (
    request: Request,
    response: Response,
    next: NextFunction
) => {
    if (isValidEmail(request.body.email)) {
        next();
    } else {
        response.status(400).send({
            message: 'Invalid or missing email - please refer to documentation',
        });
    }
};
/**
 * @apiBody {String} password a user's password
 * Must:
 * - Be at least 10 characters long
 * - Include at least one lowercase letter
 * - Include at least one uppercase letter
 * - Include at least one digit
 * - Include at least one `!` character
 * - Not contain 3+ repeated characters in a row
 */
const passwordMiddlewareCheck = (
    request: Request,
    response: Response,
    next: NextFunction
) => {
    if (isValidPassword(request.body.password)) {
        next();
    } else {
        response.status(400).send({
            message:
                'Invalid or missing password - must be at least 10 characters, include one uppercase, one lowercase, one digit, and one !, with no 3+ repeated characters',
        });
    }
};

/**
 * @api {post} /register Request to register a user
 *
 * @apiDescription Document this route. !**Document the password rules here**!
 * !**Document the role rules here**!
 *
 * @apiName PostRegister
 * @apiGroup Auth
 *
 * @apiBody {String} firstname a users first name
 * @apiBody {String} lastname a users last name
 * @apiBody {String} email a users email *unique
 * @apiBody {String} password a users password
 * @apiBody {String} username a username *unique
 * @apiBody {String} role a role for this user [1-5]
 * @apiBody {String} phone a phone number for this user
 *
 * @apiSuccess {String} accessToken JSON Web Token
 * @apiSuccess {Object} user a user object
 * @apiSuccess {string} user.name the first name associated with <code>email</code>
 * @apiSuccess {string} user.email The email associated with <code>email</code>
 * @apiSuccess {string} user.role The role associated with <code>email</code>
 * @apiSuccess {number} user.id The internal user id associated with <code>email</code>
 *
 * @apiError (400: Missing Parameters) {String} message "Missing required information"
 * @apiError (400: Invalid Password) {String} message "Invalid or missing password  - please refer to documentation"
 * @apiError (400: Invalid Phone) {String} message "Invalid or missing phone number  - please refer to documentation"
 * @apiError (400: Invalid Email) {String} message "Invalid or missing email  - please refer to documentation"
 * @apiError (400: Invalid Role) {String} message "Invalid or missing role  - please refer to documentation"
 * @apiError (400: Username exists) {String} message "Username exists"
 * @apiError (400: Email exists) {String} message "Email exists"
 *
 */
registerRouter.post(
    '/',
    emailMiddlewareCheck,
    phoneMiddlewareCheck,
    passwordMiddlewareCheck,
    roleMiddlewareCheck,
    (request: Request, response: Response, next: NextFunction) => {
        if (
            isStringProvided(request.body.firstname) &&
            isStringProvided(request.body.lastname) &&
            isStringProvided(request.body.username)
        ) {
            next();
        } else {
            return response.status(400).send({
                message: 'Missing required information',
            });
        }
    },
    (request: Request, response: Response, next: NextFunction) => {
        if (isValidRole(request.body.role)) {
            next();
        } else {
            return response.status(400).send({
                message:
                    'Invalid or missing role - please refer to documentation',
            });
        }
    },
    (request: IUserRequest, response: Response, next: NextFunction) => {
        const theQuery = `
            INSERT INTO Account (firstname, lastname, username, email, phone, account_role)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING account_id
        `;
        const values = [
            request.body.firstname,
            request.body.lastname,
            request.body.username,
            request.body.email,
            request.body.phone,
            request.body.role,
        ];

        pool.query(theQuery, values)
            .then((result) => {
                request.id = result.rows[0].account_id;
                next();
            })
            .catch((error) => {
                if (error.constraint === 'account_username_key') {
                    return response
                        .status(400)
                        .send({ message: 'Username exists' });
                } else if (error.constraint === 'account_email_key') {
                    return response
                        .status(400)
                        .send({ message: 'Email exists' });
                } else if (error.constraint === 'account_phone_key') {
                    return response.status(400).send({
                        message: 'Duplicate phone number not allowed',
                    });
                } else {
                    console.error('DB Query error on register', error);
                    return response
                        .status(500)
                        .send({ message: 'server error - contact support' });
                }
            });
    },
    (request: IUserRequest, response: Response) => {
        const salt = generateSalt(32);
        const saltedHash = generateHash(request.body.password, salt);

        const theQuery = `
            INSERT INTO Account_Credential(account_id, salted_hash, salt)
            VALUES ($1, $2, $3)
        `;
        const values = [request.id, saltedHash, salt];

        pool.query(theQuery, values)
            .then(() => {
                const accessToken = jwt.sign(
                    {
                        role: request.body.role,
                        id: request.id,
                    },
                    key.secret,
                    {
                        expiresIn: '14 days',
                    }
                );

                response.status(201).send({
                    accessToken,
                    user: {
                        id: request.id,
                        name: request.body.firstname,
                        email: request.body.email,
                        role: request.body.role,
                    },
                });
            })
            .catch((error) => {
                console.error('DB Query error on credential insert', error);
                return response.status(500).send({
                    message: 'server error - contact support',
                });
            });
    }
);

export { registerRouter };
