import { Router } from 'express';
import { ParkingController } from '../controllers/parkingController';
import { validateRequest } from '../middleware/validation';
import {
  EntryRequestSchema,
  CalculateRequestSchema,
  PaymentRequestSchema,
  LostTicketRequestSchema,
  ExitRequestSchema
} from '../types/api';

const router = Router();
const parkingController = new ParkingController();

// Get pricing configuration (public endpoint for operators)
router.get('/pricing', async (req, res, next) => {
  try {
    await parkingController.getPricingConfig(req, res);
  } catch (error) {
    next(error);
  }
});

// Get ticket status by ID
router.get(
  '/status/:ticketId',
  parkingController.getTicketStatus.bind(parkingController)
);

// Calculate parking fee by ticket ID
router.get('/calculate/:ticketId', async (req, res, next) => {
  try {
    await parkingController.calculateFeeById(req, res);
  } catch (error) {
    next(error);
  }
});

// Vehicle entry endpoint
router.post('/entry', validateRequest(EntryRequestSchema), async (req, res, next) => {
  try {
    await parkingController.createEntry(req, res);
  } catch (error) {
    next(error);
  }
});

// Calculate parking fee
router.post('/calculate', validateRequest(CalculateRequestSchema), async (req, res, next) => {
  try {
    await parkingController.calculateFee(req, res);
  } catch (error) {
    next(error);
  }
});

// Process payment
router.post('/payment', validateRequest(PaymentRequestSchema), async (req, res, next) => {
  try {
    await parkingController.processPayment(req, res);
  } catch (error) {
    next(error);
  }
});

// Exit validation
router.post('/exit', validateRequest(ExitRequestSchema), async (req, res, next) => {
  try {
    await parkingController.processExit(req, res);
  } catch (error) {
    next(error);
  }
});

// Validate plate for lost ticket (check if active ticket exists)
router.post('/validate-plate-for-lost-ticket', async (req, res, next) => {
  try {
    await parkingController.validatePlateForLostTicket(req, res);
  } catch (error) {
    next(error);
  }
});

// Lost ticket handling
router.post('/lost-ticket', validateRequest(LostTicketRequestSchema), async (req, res, next) => {
  try {
    await parkingController.processLostTicket(req, res);
  } catch (error) {
    next(error);
  }
});

// Ticket lookup by barcode/ID for scanner
router.get('/tickets/lookup/:barcode', async (req, res, next) => {
  try {
    await parkingController.lookupTicket(req, res);
  } catch (error) {
    next(error);
  }
});

// Ticket lookup by plate number
router.get('/tickets/by-plate/:plateNumber', async (req, res, next) => {
  try {
    await parkingController.getTicketsByPlate(req, res);
  } catch (error) {
    next(error);
  }
});

// Current status endpoint (for operators)
router.get('/status', parkingController.getStatus.bind(parkingController));

export { router as parkingRoutes };