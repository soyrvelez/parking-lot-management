/**
 * Audit Service
 * Provides comprehensive audit logging with database persistence
 * Tracks all administrative actions for compliance and security
 */

import { PrismaClient } from '@prisma/client';
import { Request } from 'express';

const prisma = new PrismaClient();

export interface AuditLogEntry {
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: any;
  newValue?: any;
  performedBy: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export class AuditService {
  private static instance: AuditService;

  private constructor() {}

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  /**
   * Log an audit entry to the database
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          oldValue: entry.oldValue,
          newValue: entry.newValue,
          performedBy: entry.performedBy,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          // Add ticket relation if entityType is Ticket
          ticketId: entry.entityType === 'Ticket' ? entry.entityId : undefined,
          // Add admin relation if performedBy is an admin ID
          adminId: await this.isAdminId(entry.performedBy) ? entry.performedBy : undefined
        }
      });

      // Also log to console for immediate visibility
      console.log(`[AUDIT] ${entry.action}:`, {
        entityType: entry.entityType,
        entityId: entry.entityId,
        performedBy: entry.performedBy,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Never let audit failures break the main flow
      console.error('[AUDIT ERROR] Failed to persist audit log:', error);
      // In production, send to external monitoring service
    }
  }

  /**
   * Log an audit entry from an Express request context
   */
  async logFromRequest(
    req: Request & { user?: any },
    entityType: string,
    entityId: string,
    action: string,
    oldValue?: any,
    newValue?: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    const entry: AuditLogEntry = {
      entityType,
      entityId,
      action,
      oldValue,
      newValue,
      performedBy: req.user?.id || 'anonymous',
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent'),
      requestId: req.headers['x-request-id'] as string,
      metadata
    };

    await this.log(entry);
  }

  /**
   * Log a cash register operation
   */
  async logCashOperation(
    operatorId: string,
    action: string,
    amount?: number,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      entityType: 'CashRegister',
      entityId: operatorId,
      action,
      newValue: amount ? { amount } : undefined,
      performedBy: operatorId,
      metadata: details
    });
  }

  /**
   * Log a ticket operation
   */
  async logTicketOperation(
    ticketId: string,
    action: string,
    operatorId: string,
    oldStatus?: string,
    newStatus?: string,
    amount?: number
  ): Promise<void> {
    await this.log({
      entityType: 'Ticket',
      entityId: ticketId,
      action,
      oldValue: oldStatus ? { status: oldStatus } : undefined,
      newValue: newStatus ? { status: newStatus, amount } : undefined,
      performedBy: operatorId
    });
  }

  /**
   * Log an admin operation
   */
  async logAdminOperation(
    adminId: string,
    action: string,
    targetType: string,
    targetId: string,
    changes?: Record<string, any>
  ): Promise<void> {
    await this.log({
      entityType: targetType,
      entityId: targetId,
      action: `ADMIN_${action}`,
      newValue: changes,
      performedBy: adminId
    });
  }

  /**
   * Check if ID belongs to an admin
   */
  private async isAdminId(id: string): Promise<boolean> {
    try {
      const admin = await prisma.admin.findUnique({
        where: { id },
        select: { id: true }
      });
      return !!admin;
    } catch {
      return false;
    }
  }

  /**
   * Query audit logs with filtering
   */
  async queryLogs(filters: {
    entityType?: string;
    action?: string;
    performedBy?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const where: any = {};

    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.action) where.action = filters.action;
    if (filters.performedBy) where.performedBy = filters.performedBy;
    
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    return prisma.auditLog.findMany({
      where,
      include: {
        ticket: {
          select: { plateNumber: true }
        },
        admin: {
          select: { name: true }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: filters.limit || 50,
      skip: filters.offset || 0
    });
  }
}

// Export singleton instance
export const auditService = AuditService.getInstance();

// Export enhanced audit logger function for backward compatibility
export function auditLogger(
  action: string,
  userId?: string,
  details?: Record<string, any>
): void {
  // Fire and forget - don't await to avoid blocking
  auditService.log({
    entityType: 'System',
    entityId: 'system',
    action,
    performedBy: userId || 'system',
    metadata: details
  }).catch(error => {
    console.error('[AUDIT] Failed to log:', error);
  });
}