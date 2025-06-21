# Parking Lot Management System - Project Overview

## Purpose
Single lot parking management system with two main interfaces:
- **Operator Interface**: Ticket/payment processing with barcode scanner and thermal printer
- **Admin Dashboard**: Configuration, reporting, and management

## Key Characteristics
- **Language**: All user-facing content in Mexican Spanish
- **Timezone**: Mexico City (America/Mexico_City)
- **Currency**: Mexican Pesos (MXN)
- **Hardware**: Epson TM-T20III thermal printer, Honeywell Voyager 1250g barcode scanner

## Business Model
- Cash-only parking lot operation
- Hourly parking with 15-minute increments after first hour
- Daily specials with fixed hours/rates
- Monthly pension (parking passes) for regular customers
- Lost ticket fee handling

## Critical Requirements
1. **Financial Accuracy**: All money calculations use Decimal.js (NO floating point)
2. **Reliability**: Atomic transactions, comprehensive error handling
3. **Security**: Locked-down operator workstation, JWT auth for admin
4. **Simplicity**: Minimal typing, barcode scanner primary input
5. **No Placeholders**: Always implement full functionality