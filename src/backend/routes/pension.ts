import { Router } from 'express';
import { PensionController } from '../controllers/pensionController';
import { validateRequest } from '../middleware/validation';
import { 
  CreatePensionCustomerSchema,
  PensionPaymentSchema,
  PensionRenewalSchema,
  PensionLookupSchema
} from '../types/pension';

const router = Router();
const pensionController = new PensionController();

// Pension customer lookup by plate number (primary method for operators)
router.get('/lookup/:identifier', async (req, res, next) => {
  try {
    await pensionController.lookupCustomer(req, res);
  } catch (error) {
    next(error);
  }
});

// Search pension customers by partial plate number
router.get(
  '/search/:query',
  pensionController.searchCustomers.bind(pensionController)
);

// Get pension customer details
router.get(
  '/customers/:id',
  pensionController.getCustomer.bind(pensionController)
);

// Create new pension customer
router.post(
  '/customers',
  validateRequest(CreatePensionCustomerSchema),
  pensionController.createCustomer.bind(pensionController)
);

// Process pension payment (monthly fee)
router.post(
  '/payment',
  validateRequest(PensionPaymentSchema),
  pensionController.processPayment.bind(pensionController)
);

// Renew pension customer membership
router.post(
  '/renew/:id',
  validateRequest(PensionRenewalSchema),
  pensionController.renewCustomer.bind(pensionController)
);

// Check pension customer status
router.get(
  '/status/:identifier',
  pensionController.checkStatus.bind(pensionController)
);

// List all active pension customers (for admin/reporting)
router.get(
  '/customers',
  pensionController.listCustomers.bind(pensionController)
);

// Update pension customer details
router.put(
  '/customers/:id',
  validateRequest(CreatePensionCustomerSchema),
  pensionController.updateCustomer.bind(pensionController)
);

// Deactivate pension customer
router.delete(
  '/customers/:id',
  pensionController.deactivateCustomer.bind(pensionController)
);

export { router as pensionRoutes };