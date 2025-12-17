import express from 'express';
const router = express.Router();
import { registerProcessor, loginProcessor, getProcessorProfile } from '../controllers/processorController.js';
import { protect } from '../middleware/auth.js';
import { check } from 'express-validator';

router.post('/register', [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
    check('phone', 'Phone number is required').not().isEmpty(),
    check('process_station_name', 'Process station name is required').not().isEmpty(),
    check('process_station_location', 'Process station location is required').not().isEmpty()
], registerProcessor);

router.post('/login', [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
], loginProcessor);

router.get('/profile', protect, getProcessorProfile);

export default router;