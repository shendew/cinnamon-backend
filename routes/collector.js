import express from 'express';
const router = express.Router();
import { registerCollector, loginCollector } from '../controllers/collectorController.js';
import { check } from 'express-validator';

router.post('/register', [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
    check('phone', 'Phone number is required').not().isEmpty(),
    check('center_name', 'Center name is required').not().isEmpty(),
    check('vehicle_id', 'Vehicle ID is required').not().isEmpty(),
    check('location', 'Location is required').not().isEmpty()
], registerCollector);

router.post('/login', [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
], loginCollector);

export default router;

