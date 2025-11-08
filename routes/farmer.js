
import express from 'express';
const router = express.Router();
import { registerFarmer, loginFarmer } from '../controllers/farmerController.js';
import { check } from 'express-validator';

router.post('/register', [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
    check('phone', 'Phone number is required').not().isEmpty(),
    check('nic', 'NIC is required').not().isEmpty(),
    check('address', 'Address is required').not().isEmpty(),
    check('gender', 'Gender is required').not().isEmpty(),
    check('date_of_birth', 'Date of birth must be a valid date').isISO8601(),
], registerFarmer);

router.post('/users/login/farmer', [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
], loginFarmer);

export default router;
