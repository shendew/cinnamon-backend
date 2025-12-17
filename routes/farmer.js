
import express from 'express';
const router = express.Router();
import { registerFarmer, loginFarmer, createFarm, createCultivation, createHarvest, getFarmerProfile } from '../controllers/farmerController.js';
import { protect } from '../middleware/auth.js';
import { check } from 'express-validator';
import upload from '../middleware/upload.js';

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

router.get('/profile', protect, getFarmerProfile);

router.post('/farms', protect, [
    check('farm_name', 'Farm name is required').not().isEmpty(),
    check('gps_coordinates', 'GPS coordinates are required').not().isEmpty(),
    check('area_acres', 'Area in acres is required').not().isEmpty(),
    check('area_acres', 'Area must be a valid number').isFloat({ min: 0 })
], createFarm);

// Multer error handling middleware
const handleMulterError = (err, req, res, next) => {
    if (err) {
        console.error('Multer error:', err);
        if (err.message === 'Unexpected field') {
            return res.status(400).json({
                success: false,
                message: 'Invalid file field. Please use "organic_certification" as the field name for the file upload.',
                error: err.message
            });
        }
        return res.status(400).json({
            success: false,
            message: 'File upload error',
            error: err.message
        });
    }
    next();
};

router.post('/cultivations', 
    protect, 
    (req, res, next) => {
        upload.single('organic_certification')(req, res, (err) => {
            if (err) {
                return handleMulterError(err, req, res, next);
            }
            next();
        });
    },
    [
        check('batch_no', 'Batch number is required').not().isEmpty(),
        check('batch_no', 'Batch number must be a valid string').isString(),
        check('farm_id', 'Farm ID is required').not().isEmpty(),
        check('farm_id', 'Farm ID must be a valid number').isInt({ min: 1 }),
        check('date_of_planting', 'Date of planting is required').not().isEmpty(),
        check('date_of_planting', 'Date of planting must be a valid date').isISO8601(),
        check('seeding_source', 'Seeding source is required').not().isEmpty(),
        check('type_of_fertilizers', 'Type of fertilizers is required').not().isEmpty(),
        check('pesticides', 'Pesticides information is required').not().isEmpty(),
        check('expected_harvest_date', 'Expected harvest date is required').not().isEmpty(),
        check('expected_harvest_date', 'Expected harvest date must be a valid date').isISO8601(),
        check('no_of_trees', 'Number of trees is required').not().isEmpty(),
        check('no_of_trees', 'Number of trees must be a valid integer').isInt({ min: 1 })
    ], 
    createCultivation
);

router.post('/harvests', protect, [
    check('batch_no', 'Batch number is required').not().isEmpty(),
    check('batch_no', 'Batch number must be a valid string').isString(),
    check('harvest_date', 'Harvest date is required').not().isEmpty(),
    check('harvest_date', 'Harvest date must be a valid date').isISO8601(),
    check('harvest_method', 'Harvest method is required').not().isEmpty(),
    check('quantity', 'Quantity is required').not().isEmpty(),
    check('quantity', 'Quantity must be a valid number').isFloat({ min: 0 })
], createHarvest);

export default router;
