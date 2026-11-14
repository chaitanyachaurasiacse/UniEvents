import { body } from 'express-validator';
import { validate } from './http.js';

const id = (f) => body(f).optional({ values: 'falsy' }).isMongoId().withMessage(`${f} is not a valid id.`);
const date = (f) => body(f).optional({ values: 'falsy' }).isISO8601().withMessage(`${f} must be a valid date.`);

/** Event create (all required) or update (all optional). */
export const eventRules = (isUpdate = false) => {
  const req = (chain) => (isUpdate ? chain.optional() : chain);
  return [
    req(body('title')).trim().isLength({ min: 5, max: 120 }).withMessage('Title must be 5–120 characters.'),
    req(body('summary')).trim().isLength({ min: 10, max: 240 }).withMessage('Summary must be 10–240 characters.'),
    req(body('description')).trim().isLength({ min: 20, max: 5000 }).withMessage('Description must be 20–5000 characters.'),
    req(body('category')).isMongoId().withMessage('Choose a category.'),
    req(body('venue')).trim().isLength({ min: 3, max: 150 }).withMessage('Venue must be 3–150 characters.'),
    req(body('startAt')).isISO8601().withMessage('Start time must be a valid date.'),
    req(body('endAt')).isISO8601().withMessage('End time must be a valid date.'),
    req(body('registrationDeadline')).isISO8601().withMessage('Registration deadline must be a valid date.'),
    req(body('capacity')).isInt({ min: 1, max: 5000 }).withMessage('Capacity must be between 1 and 5000.').toInt(),
    date('registrationOpensAt'),
    id('club'),
    body('waitlistEnabled').optional().isBoolean().toBoolean(),
    body('featured').optional().isBoolean().toBoolean(),
    body('imageUrl').optional({ values: 'falsy' }).trim().isLength({ max: 500 }).matches(/^(https:\/\/|\/img\/)/).withMessage('Cover image must be an https:// link.'),
    validate,
  ];
};

export const announcementRules = [
  body('title').trim().isLength({ min: 3, max: 120 }).withMessage('Title must be 3–120 characters.'),
  body('message').trim().isLength({ min: 5, max: 2000 }).withMessage('Message must be 5–2000 characters.'),
  body('audience').optional().isIn(['all', 'student', 'faculty', 'club', 'admin']),
  body('urgent').optional().isBoolean().toBoolean(),
  validate,
];

export const staffRules = [
  body('name').trim().isLength({ min: 2, max: 60 }).withMessage('Name must be 2–60 characters.'),
  body('email').trim().isEmail().withMessage('Enter a valid e-mail address.').normalizeEmail({ gmail_remove_dots: false }),
  body('role').isIn(['faculty', 'club', 'admin']).withMessage('Choose a staff role.'),
  body('password').optional({ values: 'falsy' }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,20}$/).withMessage('Password must be 8–20 characters with upper-case, lower-case, a digit and a symbol.'),
  validate,
];

export const profileRules = [
  body('name').optional().trim().isLength({ min: 2, max: 60 }).withMessage('Name must be 2–60 characters.'),
  body('phone').optional({ values: 'falsy' }).trim().matches(/^[+\d][\d\s-]{6,15}$/).withMessage('Enter a valid phone number.'),
  body('bio').optional().trim().isLength({ max: 200 }).withMessage('Bio can be at most 200 characters.'),
  validate,
];

export const nameRules = [body('name').trim().isLength({ min: 2, max: 60 }).withMessage('Name must be 2–60 characters.'), validate];
