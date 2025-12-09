import express from 'express';
const router = express.Router();
import { registerCollector, loginCollector, getCollectorProfile, collectBatch, startTransport, completeTransport } from '../controllers/collectorController.js';
import { protect } from '../middleware/auth.js';
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

router.get('/profile', protect, getCollectorProfile);

router.post('/collect', protect, [
    check('batch_no', 'Batch number is required').not().isEmpty(),
    check('batch_no', 'Batch number must be a valid string').isString(),
    check('collected_date', 'Collected date is required').not().isEmpty(),
    check('collected_date', 'Collected date must be a valid date').isISO8601()
], collectBatch);

router.post('/transport/start', protect, [
    check('batch_no', 'Batch number is required').not().isEmpty(),
    check('batch_no', 'Batch number must be a valid string').isString(),
    check('transport_method', 'Transport method is required').not().isEmpty(),
    check('transport_started_date', 'Transport started date is required').not().isEmpty(),
    check('transport_started_date', 'Transport started date must be a valid date').isISO8601(),
    check('storage_conditions', 'Storage conditions are required').not().isEmpty()
], startTransport);

router.post('/transport/complete', protect, [
    check('batch_no', 'Batch number is required').not().isEmpty(),
    check('batch_no', 'Batch number must be a valid string').isString(),
    check('transport_ended_date', 'Transport ended date is required').not().isEmpty(),
    check('transport_ended_date', 'Transport ended date must be a valid date').isISO8601()
], completeTransport);

export default router;

