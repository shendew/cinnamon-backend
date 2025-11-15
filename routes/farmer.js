
import express from 'express';
const router = express.Router();
import { registerFarmer, loginFarmer, createFarm, createCultivation } from '../controllers/farmerController.js';
import { protect } from '../middleware/auth.js';
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

router.post('/login', [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
], loginFarmer);

router.post('/farms', protect, [
    check('farm_name', 'Farm name is required').not().isEmpty(),
    check('gps_coordinates', 'GPS coordinates are required').not().isEmpty(),
    check('area_acres', 'Area in acres is required').not().isEmpty(),
    check('area_acres', 'Area must be a valid number').isFloat({ min: 0 })
], createFarm);

router.post('/cultivations', protect, [
    check('farm_id', 'Farm ID is required').not().isEmpty(),
    check('farm_id', 'Farm ID must be a valid number').isInt({ min: 1 }),
    check('date_of_planting', 'Date of planting is required').not().isEmpty(),
    check('date_of_planting', 'Date of planting must be a valid date').isISO8601(),
    check('seeding_source', 'Seeding source is required').not().isEmpty(),
    check('type_of_fertilizer', 'Type of fertilizer is required').not().isEmpty(),
    check('pesticides', 'Pesticides information is required').not().isEmpty(),
    check('organic_certification', 'Organic certification is required').not().isEmpty(),
    check('expected_harvest_date', 'Expected harvest date is required').not().isEmpty(),
    check('expected_harvest_date', 'Expected harvest date must be a valid date').isISO8601(),
    check('no_of_trees', 'Number of trees is required').not().isEmpty(),
    check('no_of_trees', 'Number of trees must be a valid integer').isInt({ min: 1 })
], createCultivation);

export default router;
