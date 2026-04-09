const { body, query, param } = require('express-validator');

const recordHarvestValidator = [
  body('farmerCropId')
    .notEmpty()
    .withMessage('Farmer crop ID is required')
    .isUUID()
    .withMessage('Invalid farmer crop ID format'),
  
  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isFloat({ min: 0.1 })
    .withMessage('Quantity must be greater than 0'),
  
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string')
];

const findNearbyValidator = [
  query('harvestId')
    .notEmpty()
    .withMessage('Harvest ID is required')
    .isUUID()
    .withMessage('Invalid harvest ID format'),
  
  query('radius')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Radius must be between 1 and 500 km'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Limit must be between 1 and 20')
];

const searchValidator = [
  query('city')
    .optional()
    .isString()
    .withMessage('City must be a string'),
  
  query('state')
    .optional()
    .isString()
    .withMessage('State must be a string'),
  
  query('cropId')
    .optional()
    .isUUID()
    .withMessage('Invalid crop ID format')
];

const idParamValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID is required')
    .isUUID()
    .withMessage('Invalid ID format')
];

module.exports = {
  recordHarvestValidator,
  findNearbyValidator,
  searchValidator,
  idParamValidator
};