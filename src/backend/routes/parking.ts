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
router.get(
  '/calculate/:ticketId',
  parkingController.calculateFeeById.bind(parkingController)
);

// Vehicle entry endpoint
router.post(
  '/entry',
  validateRequest(EntryRequestSchema),
  parkingController.createEntry.bind(parkingController)
);

// Calculate parking fee
router.post(
  '/calculate',
  validateRequest(CalculateRequestSchema),
  parkingController.calculateFee.bind(parkingController)
);

// Process payment
router.post(
  '/payment',
  validateRequest(PaymentRequestSchema),
  parkingController.processPayment.bind(parkingController)
);

// Exit validation
router.post(
  '/exit',
  validateRequest(ExitRequestSchema),
  parkingController.processExit.bind(parkingController)
);

// Lost ticket handling
router.post(
  '/lost-ticket',
  validateRequest(PaymentRequestSchema),
  parkingController.processLostTicket.bind(parkingController)
);

// Current status endpoint (for operators)
router.get('/status', parkingController.getStatus.bind(parkingController));

export { router as parkingRoutes };