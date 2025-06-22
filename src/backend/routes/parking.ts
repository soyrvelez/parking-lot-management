import { Router } from 'express';
import { ParkingController } from '../controllers/parkingController';
import { validateRequest } from '../middleware/validation';
import {
  EntryRequestSchema,
  CalculateRequestSchema,
  PaymentRequestSchema,
  ExitRequestSchema
} from '../types/api';

const router = Router();
const parkingController = new ParkingController();

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

// Lost ticket handling
router.post('/lost-ticket', validateRequest(PaymentRequestSchema), async (req, res, next) => {
  try {
    await parkingController.processLostTicket(req, res);
  } catch (error) {
    next(error);
  }
});

// Ticket lookup by barcode/ID for scanner
router.get('/tickets/lookup/:barcode', async (req, res, next) => {
  try {
    await parkingController.lookupTicket(req, res, next);
  } catch (error) {
    next(error);
  }
});

// Current status endpoint (for operators)
router.get('/status', parkingController.getStatus.bind(parkingController));

export { router as parkingRoutes };