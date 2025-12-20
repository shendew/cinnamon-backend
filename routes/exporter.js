import express from 'express';
const router = express.Router();
import { 
    registerExporter, 
    loginExporter, 
    getExporterProfile,
    getAvailableBatches,
    markAsCollectedByExporter,
    markAsExported
} from '../controllers/exportController.js';
import { protect } from '../middleware/auth.js';
import { check } from 'express-validator';
import upload from '../middleware/upload.js';

router.post('/register', upload.single('exporter_license'), [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
    check('phone', 'Phone number is required').not().isEmpty()
], registerExporter);

router.post('/login', [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
], loginExporter);

router.get('/profile', protect, getExporterProfile);

router.get('/batches/available', protect, getAvailableBatches);

router.post('/collect', protect, [
    check('batch_no', 'Batch number is required').not().isEmpty(),
    check('batch_no', 'Batch number must be a valid string').isString(),
    check('collected_date', 'Collected date is required').not().isEmpty(),
    check('collected_date', 'Collected date must be a valid date').isISO8601()
], markAsCollectedByExporter);

router.post('/export', protect, [
    check('batch_no', 'Batch number is required').not().isEmpty(),
    check('batch_no', 'Batch number must be a valid string').isString(),
    check('exported_to', 'Exported to is required').not().isEmpty(),
    check('exported_date', 'Exported date is required').not().isEmpty(),
    check('exported_date', 'Exported date must be a valid date').isISO8601()
], markAsExported);

export default router;

