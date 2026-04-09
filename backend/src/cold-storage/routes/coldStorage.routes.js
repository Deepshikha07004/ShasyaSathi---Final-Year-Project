const express = require('express');
const router = express.Router();
const coldStorageController = require('../controllers/coldStorage.controller');
const { protect } = require('../../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

/**
 * @route   GET /api/cold-storage/nearby
 * @desc    Find nearby cold storages for harvested crop
 * @access  Private
 */
router.get('/nearby', coldStorageController.findNearby.bind(coldStorageController));

/**
 * @route   GET /api/cold-storage/search
 * @desc    Search cold storages by city/state/crop
 * @access  Private
 */
router.get('/search', coldStorageController.search.bind(coldStorageController));

/**
 * @route   GET /api/cold-storage/directions/:id
 * @desc    Get directions to cold storage
 * @access  Private
 */
router.get('/directions/:id', coldStorageController.getDirections.bind(coldStorageController));

/**
 * @route   GET /api/cold-storage/:id
 * @desc    Get cold storage details
 * @access  Private
 */
router.get('/:id', coldStorageController.getDetails.bind(coldStorageController));

module.exports = router;