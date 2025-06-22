/**
 * Administration Controller
 * Handles dashboard metrics, reporting, system health, and user management
 * All responses in Mexican Spanish with Money class financial precision
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Money } from '../../shared/utils/money';
import { i18n } from '../../shared/localization';
import { BusinessLogicError } from '../middleware/errorHandler';
import { auditLogger } from '../middleware/logging';
import { AuthenticatedRequest } from '../middleware/auth';
import { BarcodeScannerService } from '../services/scanner/barcode-scanner.service';
import { ThermalPrinterService } from '../services/printer/thermal-printer.service';
import { formatDailyReportCsv, formatMonthlyReportCsv, sanitizeFilename } from '../utils/csvExporter';
import { auditService } from '../services/audit/audit.service';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas with Spanish error messages
const createOperatorSchema = z.object({
  email: z.string().email('Formato de correo electrónico inválido'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  role: z.enum(['ADMIN', 'MANAGER', 'VIEWER'], {
    errorMap: () => ({ message: 'Rol debe ser ADMIN, MANAGER o VIEWER' })
  }),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')
});

const updateOperatorSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'VIEWER'], {
    errorMap: () => ({ message: 'Rol debe ser ADMIN, MANAGER o VIEWER' })
  }).optional(),
  isActive: z.boolean().optional()
});

export class AdminController {
  private scannerService: BarcodeScannerService;
  private printerService: ThermalPrinterService;

  constructor() {
    this.scannerService = new BarcodeScannerService();
    this.printerService = new ThermalPrinterService();
  }

  /**
   * Helper method to get current pricing configuration
   */
  private async getCurrentPricingConfig() {
    const config = await prisma.pricingConfig.findFirst({
      where: { isActive: true },
      include: {
        incrementRates: {
          orderBy: { incrementNumber: 'asc' }
        }
      }
    });

    // Return default config if none exists
    if (!config) {
      return {
        minimumHours: 1,
        minimumRate: 25.00,
        incrementMinutes: 15,
        incrementRate: 5.00,
        lostTicketFee: 50.00,
        monthlyRate: 300.00,
        dailySpecialHours: null,
        dailySpecialRate: null,
        incrementRates: []
      };
    }

    return {
      minimumHours: config.minimumHours,
      minimumRate: parseFloat(config.minimumRate.toString()),
      incrementMinutes: config.incrementMinutes,
      incrementRate: parseFloat(config.incrementRate.toString()),
      lostTicketFee: parseFloat(config.lostTicketFee.toString()),
      monthlyRate: parseFloat(config.monthlyRate.toString()),
      dailySpecialHours: config.dailySpecialHours,
      dailySpecialRate: config.dailySpecialRate ? parseFloat(config.dailySpecialRate.toString()) : null,
      incrementRates: config.incrementRates.map(rate => ({
        incrementNumber: rate.incrementNumber,
        rate: parseFloat(rate.rate.toString())
      }))
    };
  }

  /**
   * Helper method to calculate parking fee based on configuration
   */
  private async calculateParkingFee(entryTime: Date, exitTime: Date = new Date()) {
    const config = await this.getCurrentPricingConfig();
    const durationMs = exitTime.getTime() - entryTime.getTime();
    const durationMinutes = Math.ceil(durationMs / (1000 * 60));
    const durationHours = durationMinutes / 60;

    // Check if daily special applies
    if (config.dailySpecialHours && config.dailySpecialRate && durationHours <= config.dailySpecialHours) {
      return {
        amount: config.dailySpecialRate,
        description: `Tarifa especial diaria - ${config.dailySpecialHours} horas`,
        durationMinutes,
        usedSpecialRate: true
      };
    }

    // Standard calculation
    const minimumMinutes = config.minimumHours * 60;
    
    if (durationMinutes <= minimumMinutes) {
      return {
        amount: config.minimumRate,
        description: `Estacionamiento - ${config.minimumHours} hora mínima`,
        durationMinutes,
        usedSpecialRate: false
      };
    }

    // Calculate incremental charges
    const extraMinutes = durationMinutes - minimumMinutes;
    const extraIncrements = Math.ceil(extraMinutes / config.incrementMinutes);
    const totalAmount = config.minimumRate + (extraIncrements * config.incrementRate);

    const totalHours = Math.ceil(durationMinutes / 60);
    
    return {
      amount: totalAmount,
      description: `Estacionamiento - ${totalHours} hora${totalHours > 1 ? 's' : ''}`,
      durationMinutes,
      usedSpecialRate: false
    };
  }

  /**
   * Get real-time dashboard metrics with Spanish formatting
   */
  async getDashboardMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      // Get active vehicles count
      const activeVehicles = await prisma.ticket.count({
        where: { status: 'ACTIVE' }
      });

      // Get today's revenue
      const todayTransactions = await prisma.transaction.aggregate({
        where: {
          timestamp: {
            gte: startOfDay,
            lt: endOfDay
          },
          type: { in: ['PARKING', 'LOST_TICKET', 'PENSION'] }
        },
        _sum: { amount: true },
        _count: true
      });

      const todayRevenue = Money.fromNumber(todayTransactions._sum.amount || 0);
      const totalTransactions = todayTransactions._count;

      // Calculate average parking duration for today
      const completedTicketsToday = await prisma.ticket.findMany({
        where: {
          status: { in: ['PAID', 'PAID'] },
          paidAt: {
            gte: startOfDay,
            lt: endOfDay
          }
        },
        select: {
          entryTime: true,
          exitTime: true
        }
      });

      let averageDurationMinutes = 0;
      if (completedTicketsToday.length > 0) {
        const totalDuration = completedTicketsToday.reduce((total, ticket) => {
          if (ticket.exitTime) {
            const duration = ticket.exitTime.getTime() - ticket.entryTime.getTime();
            return total + Math.floor(duration / (1000 * 60)); // Convert to minutes
          }
          return total;
        }, 0);
        averageDurationMinutes = Math.floor(totalDuration / completedTicketsToday.length);
      }

      // Calculate peak hours (hourly transaction distribution)
      const hourlyData = await prisma.transaction.groupBy({
        by: ['timestamp'],
        where: {
          timestamp: {
            gte: startOfDay,
            lt: endOfDay
          },
          type: { in: ['PARKING', 'LOST_TICKET', 'PENSION'] }
        }
      });

      const hourlyCount: { [hour: number]: number } = {};
      hourlyData.forEach(transaction => {
        const hour = transaction.timestamp.getHours();
        hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
      });

      const peakHour = Object.entries(hourlyCount)
        .sort(([,a], [,b]) => b - a)[0];

      // Get hardware status
      const hardwareStatus = {
        printer: this.printerService.getStatus(),
        scanner: this.scannerService.getStatus()
      };

      // Get cash register status
      const openRegister = await prisma.cashRegister.findFirst({
        where: { status: 'OPEN' },
        orderBy: { shiftStart: 'desc' }
      });

      const cashRegisterBalance = openRegister 
        ? Money.fromNumber(openRegister.currentBalance.toNumber())
        : Money.ZERO;

      res.json({
        success: true,
        data: {
          metrics: {
            activeVehicles,
            todayRevenue: todayRevenue.formatPesos(),
            totalTransactions,
            averageDuration: i18n.formatDuration(averageDurationMinutes),
            peakHours: {
              hour: peakHour ? parseInt(peakHour[0]) : null,
              count: peakHour ? peakHour[1] : 0,
              description: peakHour 
                ? i18n.t('admin.peak_hour_description', { 
                    hour: peakHour[0], 
                    count: peakHour[1] 
                  })
                : i18n.t('admin.no_peak_data')
            },
            cashRegister: {
              status: openRegister ? 'ABIERTA' : 'CERRADA',
              balance: cashRegisterBalance.formatPesos(),
              operator: openRegister?.operatorId || null
            },
            hardwareStatus: {
              printer: {
                status: hardwareStatus.printer.connected ? 'CONECTADA' : 'DESCONECTADA',
                description: hardwareStatus.printer.connected 
                  ? i18n.t('hardware.printer_connected')
                  : i18n.t('hardware.printer_disconnected'),
                lastActivity: hardwareStatus.printer.lastConnected || null
              },
              scanner: {
                status: hardwareStatus.scanner.ready ? 'LISTO' : 'OCUPADO',
                description: hardwareStatus.scanner.ready
                  ? i18n.t('hardware.scanner_ready')
                  : i18n.t('hardware.scanner_busy'),
                lastScan: hardwareStatus.scanner.lastScan || null
              }
            }
          },
          timestamp: i18n.formatDateTime(new Date()),
          message: i18n.t('admin.dashboard_metrics_retrieved')
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error getting dashboard metrics:', error);
      throw new BusinessLogicError(
        i18n.t('admin.dashboard_error'),
        'DASHBOARD_ERROR',
        500
      );
    }
  }

  /**
   * Generate daily revenue and operations report
   */
  async getDailyReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { date, startDate, endDate, format } = req.query;
      
      let reportStartDate: Date;
      let reportEndDate: Date;

      if (startDate && endDate) {
        reportStartDate = new Date(startDate as string);
        reportEndDate = new Date(endDate as string);
        reportEndDate.setDate(reportEndDate.getDate() + 1); // Include end date
      } else if (date) {
        reportStartDate = new Date(date as string);
        reportEndDate = new Date(reportStartDate);
        reportEndDate.setDate(reportEndDate.getDate() + 1);
      } else {
        // Default to today
        reportStartDate = new Date();
        reportStartDate.setHours(0, 0, 0, 0);
        reportEndDate = new Date(reportStartDate);
        reportEndDate.setDate(reportEndDate.getDate() + 1);
      }

      // Get revenue data
      const revenueData = await prisma.transaction.aggregate({
        where: {
          timestamp: {
            gte: reportStartDate,
            lt: reportEndDate
          },
          type: { in: ['PARKING', 'LOST_TICKET', 'PENSION'] }
        },
        _sum: { amount: true },
        _count: true
      });

      const totalRevenue = Money.fromNumber(revenueData._sum.amount || 0);

      // Get revenue breakdown by type
      const revenueByType = await prisma.transaction.groupBy({
        by: ['type'],
        where: {
          timestamp: {
            gte: reportStartDate,
            lt: reportEndDate
          },
          type: { in: ['PARKING', 'LOST_TICKET', 'PENSION'] }
        },
        _sum: { amount: true },
        _count: true
      });

      const revenueBreakdown = revenueByType.reduce((acc, item) => {
        acc[item.type] = {
          amount: Money.fromNumber(item._sum.amount || 0).formatPesos(),
          count: item._count
        };
        return acc;
      }, {} as any);

      // Get vehicle statistics
      const vehicleStats = await prisma.ticket.findMany({
        where: {
          entryTime: {
            gte: reportStartDate,
            lt: reportEndDate
          }
        },
        select: {
          entryTime: true,
          exitTime: true,
          status: true,
          totalAmount: true
        }
      });

      const vehicleCount = vehicleStats.length;
      const completedVehicles = vehicleStats.filter(t => t.status === 'PAID').length;
      
      // Calculate average duration
      const completedWithDuration = vehicleStats.filter(t => t.exitTime);
      let averageDuration = 0;
      if (completedWithDuration.length > 0) {
        const totalDuration = completedWithDuration.reduce((total, ticket) => {
          const duration = ticket.exitTime!.getTime() - ticket.entryTime.getTime();
          return total + Math.floor(duration / (1000 * 60));
        }, 0);
        averageDuration = Math.floor(totalDuration / completedWithDuration.length);
      }

      // Calculate peak hours
      const hourlyActivity = vehicleStats.reduce((acc, ticket) => {
        const hour = ticket.entryTime.getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {} as { [hour: number]: number });

      const peakHours = Object.entries(hourlyActivity)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([hour, count]) => ({
          hour: parseInt(hour),
          count,
          description: i18n.t('admin.hourly_activity', { hour, count })
        }));

      const reportData = {
        date: date || i18n.formatDate(reportStartDate),
        dateRange: startDate && endDate ? {
          start: i18n.formatDate(reportStartDate),
          end: i18n.formatDate(new Date(reportEndDate.getTime() - 24 * 60 * 60 * 1000))
        } : undefined,
        revenue: {
          total: totalRevenue.formatPesos(),
          cash: revenueBreakdown.PARKING?.amount || Money.ZERO.formatPesos(),
          lostTickets: revenueBreakdown.LOST_TICKET?.amount || Money.ZERO.formatPesos(),
          pension: revenueBreakdown.PENSION?.amount || Money.ZERO.formatPesos(),
          breakdown: revenueBreakdown
        },
        transactions: {
          total: revenueData._count,
          byType: revenueByType.map(item => ({
            type: item.type,
            count: item._count,
            typeDisplay: i18n.t(`transaction.${item.type.toLowerCase()}`)
          }))
        },
        vehicles: {
          total: vehicleCount,
          completed: completedVehicles,
          active: vehicleCount - completedVehicles
        },
        averageDuration: i18n.formatDuration(averageDuration),
        peakHours,
        generatedAt: i18n.formatDateTime(new Date())
      };

      // Handle CSV export with security
      if (format === 'csv') {
        const csvData = formatDailyReportCsv(reportData);
        const filename = sanitizeFilename(`reporte-diario-${reportData.date}.csv`);
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        
        // Log CSV export
        await auditService.logFromRequest(
          req,
          'Report',
          'daily',
          'REPORT_EXPORTED',
          undefined,
          { format: 'csv', date: reportData.date }
        );
        
        res.send(csvData);
        return;
      }

      res.json({
        success: true,
        data: {
          report: reportData,
          message: i18n.t('admin.daily_report_generated')
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error generating daily report:', error);
      throw new BusinessLogicError(
        i18n.t('admin.report_generation_error'),
        'REPORT_ERROR',
        500
      );
    }
  }

  /**
   * Generate monthly trend analysis report
   */
  async getMonthlyReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { month, year } = req.query;
      const reportMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;
      const reportYear = year ? parseInt(year as string) : new Date().getFullYear();

      const startDate = new Date(reportYear, reportMonth - 1, 1);
      const endDate = new Date(reportYear, reportMonth, 1);
      
      // Previous month for comparison
      const prevStartDate = new Date(reportYear, reportMonth - 2, 1);
      const prevEndDate = new Date(reportYear, reportMonth - 1, 1);

      // Get current month data
      const currentMonthData = await this.getMonthlyData(startDate, endDate);
      const previousMonthData = await this.getMonthlyData(prevStartDate, prevEndDate);

      // Calculate trends (growth percentages)
      const trends = {
        revenueGrowth: this.calculateGrowthPercentage(
          currentMonthData.totalRevenue,
          previousMonthData.totalRevenue
        ),
        transactionGrowth: this.calculateGrowthPercentage(
          currentMonthData.totalTransactions,
          previousMonthData.totalTransactions
        ),
        averageDurationChange: this.calculateGrowthPercentage(
          currentMonthData.averageDuration,
          previousMonthData.averageDuration
        )
      };

      // Get daily data for the month
      const dailyData = await this.getDailyDataForMonth(startDate, endDate);

      // Calculate daily averages
      const daysInMonth = new Date(reportYear, reportMonth, 0).getDate();
      const dailyAverages = {
        revenue: currentMonthData.totalRevenue.divide(daysInMonth).formatPesos(),
        transactions: Math.round(currentMonthData.totalTransactions / daysInMonth),
        vehicles: Math.round(currentMonthData.totalVehicles / daysInMonth)
      };

      // Find top performing days
      const topDays = dailyData
        .sort((a, b) => b.revenue.toNumber() - a.revenue.toNumber())
        .slice(0, 5)
        .map(day => ({
          date: i18n.formatDate(day.date),
          revenue: day.revenue.formatPesos(),
          transactions: day.transactions,
          vehicles: day.vehicles
        }));

      res.json({
        success: true,
        data: {
          report: {
            month: reportMonth,
            year: reportYear,
            monthName: i18n.t(`months.${reportMonth - 1}`),
            totalRevenue: currentMonthData.totalRevenue.formatPesos(),
            totalTransactions: currentMonthData.totalTransactions,
            totalVehicles: currentMonthData.totalVehicles,
            averageDuration: i18n.formatDuration(currentMonthData.averageDuration),
            dailyAverages,
            trends: {
              revenueGrowth: trends.revenueGrowth ? `${trends.revenueGrowth > 0 ? '+' : ''}${trends.revenueGrowth.toFixed(1)}%` : 'N/A',
              transactionGrowth: trends.transactionGrowth ? `${trends.transactionGrowth > 0 ? '+' : ''}${trends.transactionGrowth.toFixed(1)}%` : 'N/A',
              averageDurationChange: trends.averageDurationChange ? `${trends.averageDurationChange > 0 ? '+' : ''}${trends.averageDurationChange.toFixed(1)}%` : 'N/A'
            },
            topDays,
            generatedAt: i18n.formatDateTime(new Date())
          },
          message: i18n.t('admin.monthly_report_generated')
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error generating monthly report:', error);
      throw new BusinessLogicError(
        i18n.t('admin.report_generation_error'),
        'REPORT_ERROR',
        500
      );
    }
  }

  /**
   * Get audit log with Spanish descriptions and filtering
   */
  async getAuditLog(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { 
        page = 1, 
        limit = 50, 
        entityType, 
        startDate, 
        endDate, 
        search,
        action 
      } = req.query;

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      const where: any = {};

      if (entityType) {
        where.entityType = entityType;
      }

      if (action) {
        where.action = action;
      }

      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = new Date(startDate as string);
        if (endDate) where.timestamp.lte = new Date(endDate as string);
      }

      // Get audit log entries
      const [auditEntries, total] = await Promise.all([
        prisma.auditLog.findMany({
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
          skip,
          take
        }),
        prisma.auditLog.count({ where })
      ]);

      // Format audit entries with Spanish descriptions
      const formattedEntries = auditEntries.map(entry => ({
        id: entry.id,
        timestamp: i18n.formatDateTime(entry.timestamp),
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        description: this.getSpanishAuditDescription(entry),
        performedBy: entry.admin?.name || entry.performedBy || 'Sistema',
        ipAddress: entry.ipAddress,
        plateNumber: entry.ticket?.plateNumber,
        oldValue: entry.oldValue,
        newValue: entry.newValue
      }));

      // Filter by search term if provided
      let filteredEntries = formattedEntries;
      if (search) {
        const searchTerm = (search as string).toLowerCase();
        filteredEntries = formattedEntries.filter(entry => 
          entry.description.toLowerCase().includes(searchTerm) ||
          entry.plateNumber?.toLowerCase().includes(searchTerm) ||
          entry.performedBy.toLowerCase().includes(searchTerm)
        );
      }

      const pagination = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / take),
        hasNext: skip + take < total,
        hasPrev: parseInt(page as string) > 1
      };

      res.json({
        success: true,
        data: {
          auditLog: search ? filteredEntries : formattedEntries,
          total: search ? filteredEntries.length : total,
          pagination,
          filters: {
            entityType: entityType || null,
            action: action || null,
            dateRange: startDate && endDate ? {
              start: i18n.formatDate(new Date(startDate as string)),
              end: i18n.formatDate(new Date(endDate as string))
            } : null,
            searchTerm: search || null
          },
          message: i18n.t('admin.audit_log_retrieved')
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error getting audit log:', error);
      throw new BusinessLogicError(
        i18n.t('admin.audit_log_error'),
        'AUDIT_LOG_ERROR',
        500
      );
    }
  }

  /**
   * Get comprehensive system health status
   */
  async getSystemHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Database health check
      const dbStart = Date.now();
      const dbHealth = await this.checkDatabaseHealth();
      const dbResponseTime = Date.now() - dbStart;

      // Hardware status
      const printerStatus = this.printerService.getStatus();
      const scannerStatus = this.scannerService.getStatus();

      // Service health checks
      const services = {
        api: {
          status: 'HEALTHY',
          responseTime: `${dbResponseTime}ms`,
          uptime: process.uptime()
        },
        auth: {
          status: 'HEALTHY',
          description: i18n.t('admin.auth_service_healthy')
        },
        localization: {
          status: 'HEALTHY',
          loadedTranslations: 1, // i18n.getLoadedLanguages().length,
          currentLanguage: 'es-MX'
        }
      };

      // Memory usage
      const memoryUsage = process.memoryUsage();
      const memory = {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
      };

      res.json({
        success: true,
        data: {
          systemHealth: {
            overall: 'HEALTHY',
            database: {
              status: dbHealth.status,
              connectionCount: dbHealth.connections,
              responseTime: `${dbResponseTime}ms`,
              description: dbHealth.status === 'HEALTHY' 
                ? i18n.t('admin.database_healthy')
                : i18n.t('admin.database_error')
            },
            hardware: {
              printer: {
                status: printerStatus.connected ? 'CONECTADA' : 'DESCONECTADA',
                description: printerStatus.connected 
                  ? i18n.t('hardware.printer_connected')
                  : i18n.t('hardware.printer_disconnected'),
                lastActivity: printerStatus.lastConnected,
                queueSize: 0 // printerStatus.queueSize || 0
              },
              scanner: {
                status: scannerStatus.ready ? 'LISTO' : 'OCUPADO',
                description: scannerStatus.ready
                  ? i18n.t('hardware.scanner_ready')
                  : i18n.t('hardware.scanner_busy'),
                lastScan: scannerStatus.lastScan,
                isScanning: false // scannerStatus.isScanning || false
              }
            },
            services,
            memory: {
              used: `${memory.used} MB`,
              total: `${memory.total} MB`,
              percentage: `${memory.percentage}%`,
              status: memory.percentage > 90 ? 'WARNING' : 'HEALTHY'
            },
            uptime: {
              seconds: Math.floor(process.uptime()),
              description: i18n.formatDuration(Math.floor(process.uptime() / 60))
            }
          },
          timestamp: i18n.formatDateTime(new Date()),
          message: i18n.t('admin.system_health_retrieved')
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error getting system health:', error);
      throw new BusinessLogicError(
        i18n.t('admin.health_check_error'),
        'HEALTH_CHECK_ERROR',
        500
      );
    }
  }

  /**
   * Create new operator
   */
  async createOperator(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validatedData = createOperatorSchema.parse(req.body);

      // Check if email already exists
      const existingUser = await prisma.admin.findUnique({
        where: { email: validatedData.email }
      });

      if (existingUser) {
        throw new BusinessLogicError(
          i18n.t('admin.email_already_exists'),
          'EMAIL_ALREADY_EXISTS',
          409
        );
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);

      // Create operator
      const operator = await prisma.admin.create({
        data: {
          email: validatedData.email,
          name: validatedData.name,
          role: validatedData.role,
          password: hashedPassword,
          isActive: true
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true
        }
      });

      // Log audit event with persistence
      await auditService.logFromRequest(
        req,
        'Admin',
        operator.id,
        'OPERATOR_CREATED',
        undefined,
        {
          email: operator.email,
          name: operator.name,
          role: operator.role
        }
      );

      res.status(201).json({
        success: true,
        data: {
          operator: {
            ...operator,
            roleDisplay: i18n.t(`roles.${operator.role.toLowerCase()}`)
          },
          message: i18n.t('admin.operator_created_successfully')
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new BusinessLogicError(
          error.errors[0].message,
          'VALIDATION_ERROR',
          400
        );
      }
      throw error;
    }
  }

  /**
   * Get all operators with pagination
   */
  async getOperators(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20, role, isActive } = req.query;
      
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      const where: any = {};
      if (role) where.role = role;
      if (isActive !== undefined) where.isActive = isActive === 'true';

      const [operators, total] = await Promise.all([
        prisma.admin.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            lastLogin: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take
        }),
        prisma.admin.count({ where })
      ]);

      const formattedOperators = operators.map(operator => ({
        ...operator,
        roleDisplay: i18n.t(`roles.${operator.role.toLowerCase()}`),
        lastLogin: operator.lastLogin ? i18n.formatDateTime(operator.lastLogin) : null,
        createdAt: i18n.formatDateTime(operator.createdAt),
        updatedAt: i18n.formatDateTime(operator.updatedAt)
      }));

      const pagination = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / take),
        hasNext: skip + take < total,
        hasPrev: parseInt(page as string) > 1
      };

      res.json({
        success: true,
        data: {
          operators: formattedOperators,
          total,
          pagination,
          message: i18n.t('admin.operators_retrieved')
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error getting operators:', error);
      throw new BusinessLogicError(
        i18n.t('admin.operators_retrieval_error'),
        'OPERATORS_ERROR',
        500
      );
    }
  }

  /**
   * Update operator information
   */
  async updateOperator(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = updateOperatorSchema.parse(req.body);

      // Check if operator exists
      const existingOperator = await prisma.admin.findUnique({
        where: { id }
      });

      if (!existingOperator) {
        throw new BusinessLogicError(
          i18n.t('admin.operator_not_found'),
          'OPERATOR_NOT_FOUND',
          404
        );
      }

      // Update operator
      const updatedOperator = await prisma.admin.update({
        where: { id },
        data: validatedData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          updatedAt: true
        }
      });

      // Log audit event with persistence
      await auditService.logFromRequest(
        req,
        'Admin',
        id,
        'OPERATOR_UPDATED',
        existingOperator,
        validatedData
      );

      res.json({
        success: true,
        data: {
          operator: {
            ...updatedOperator,
            roleDisplay: i18n.t(`roles.${updatedOperator.role.toLowerCase()}`),
            updatedAt: i18n.formatDateTime(updatedOperator.updatedAt)
          },
          message: i18n.t('admin.operator_updated_successfully')
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new BusinessLogicError(
          error.errors[0].message,
          'VALIDATION_ERROR',
          400
        );
      }
      throw error;
    }
  }

  // Helper methods

  private async checkDatabaseHealth() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'HEALTHY' as const,
        connections: 1 // Simplified for now
      };
    } catch (error) {
      return {
        status: 'ERROR' as const,
        connections: 0
      };
    }
  }

  private getSpanishAuditDescription(entry: any): string {
    const baseKey = `audit.${entry.action.toLowerCase()}`;
    
    try {
      if (entry.ticket?.plateNumber) {
        return i18n.t(baseKey, { plateNumber: entry.ticket.plateNumber });
      }
      return i18n.t(baseKey, { entityId: entry.entityId });
    } catch {
      return `${entry.action} - ${entry.entityType}`;
    }
  }

  private async getMonthlyData(startDate: Date, endDate: Date) {
    const [revenue, transactions, vehicles] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          timestamp: { gte: startDate, lt: endDate },
          type: { in: ['PARKING', 'LOST_TICKET', 'PENSION'] }
        },
        _sum: { amount: true }
      }),
      prisma.transaction.count({
        where: {
          timestamp: { gte: startDate, lt: endDate },
          type: { in: ['PARKING', 'LOST_TICKET', 'PENSION'] }
        }
      }),
      prisma.ticket.count({
        where: {
          entryTime: { gte: startDate, lt: endDate }
        }
      })
    ]);

    const completedTickets = await prisma.ticket.findMany({
      where: {
        entryTime: { gte: startDate, lt: endDate },
        exitTime: { not: null }
      },
      select: { entryTime: true, exitTime: true }
    });

    let averageDuration = 0;
    if (completedTickets.length > 0) {
      const totalDuration = completedTickets.reduce((total, ticket) => {
        const duration = ticket.exitTime!.getTime() - ticket.entryTime.getTime();
        return total + Math.floor(duration / (1000 * 60));
      }, 0);
      averageDuration = Math.floor(totalDuration / completedTickets.length);
    }

    return {
      totalRevenue: Money.fromNumber(revenue._sum.amount || 0),
      totalTransactions: transactions,
      totalVehicles: vehicles,
      averageDuration
    };
  }

  private async getDailyDataForMonth(startDate: Date, endDate: Date) {
    const dailyData = [];
    const currentDate = new Date(startDate);

    while (currentDate < endDate) {
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayData = await this.getMonthlyData(dayStart, dayEnd);
      dailyData.push({
        date: new Date(currentDate),
        revenue: dayData.totalRevenue,
        transactions: dayData.totalTransactions,
        vehicles: dayData.totalVehicles
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dailyData;
  }

  private calculateGrowthPercentage(current: Money | number, previous: Money | number): number | null {
    const currentValue = current instanceof Money ? current.toNumber() : current;
    const previousValue = previous instanceof Money ? previous.toNumber() : previous;

    if (previousValue === 0) return null;
    return ((currentValue - previousValue) / previousValue) * 100;
  }

  // CSV generation moved to secure csvExporter utility

  /**
   * GET /api/admin/tickets/active
   * Get all active tickets currently in the parking lot
   */
  async getActiveTickets(req: Request, res: Response): Promise<void> {
    try {
      // Query active tickets from database
      const activeTickets = await prisma.ticket.findMany({
        where: {
          status: 'ACTIVE'
        },
        orderBy: {
          entryTime: 'desc'
        }
      });

      // Transform tickets to include calculated amounts and durations
      const transformedTickets = activeTickets.map(ticket => {
        const entryTime = ticket.entryTime;
        const now = new Date();
        const hoursParked = Math.max(1, Math.ceil((now.getTime() - entryTime.getTime()) / (1000 * 60 * 60)));
        
        // Simple pricing calculation (1st hour: $25, additional hours: $10 each)
        // TODO: Use actual pricing configuration from database
        const estimatedAmount = hoursParked === 1 ? 25 : 25 + ((hoursParked - 1) * 10);
        
        // Calculate duration string
        const durationMs = now.getTime() - entryTime.getTime();
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

        return {
          id: ticket.id,
          plateNumber: ticket.plateNumber,
          entryTime: ticket.entryTime.toISOString(),
          estimatedAmount: estimatedAmount.toFixed(2),
          status: ticket.status,
          duration: duration
        };
      });

      res.json({
        success: true,
        data: {
          tickets: transformedTickets,
          total: transformedTickets.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching active tickets:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_TICKETS_ERROR',
          message: i18n.t('system.internal_error'),
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * GET /api/admin/transactions/recent
   * Get recent transactions for dashboard
   */
  async getRecentTransactions(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Query recent transactions from database
      const recentTransactions = await prisma.transaction.findMany({
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          ticket: {
            select: {
              plateNumber: true,
              barcode: true,
              entryTime: true
            }
          },
          pension: {
            select: {
              name: true,
              plateNumber: true
            }
          }
        }
      });

      // Transform transactions for frontend
      const transformedTransactions = recentTransactions.map(transaction => {
        const ticketInfo = transaction.ticket ? {
          plateNumber: transaction.ticket.plateNumber,
          barcode: transaction.ticket.barcode,
          entryTime: transaction.ticket.entryTime
        } : null;
        
        const pensionInfo = transaction.pension ? {
          customerName: transaction.pension.name,
          plateNumber: transaction.pension.plateNumber
        } : null;

        return {
          id: transaction.id,
          type: transaction.type,
          amount: transaction.amount.toString(),
          description: transaction.description || '',
          timestamp: transaction.timestamp.toISOString(),
          operatorId: transaction.operatorId,
          paymentMethod: transaction.paymentMethod || 'CASH',
          ticket: ticketInfo,
          pension: pensionInfo
        };
      });

      res.json({
        success: true,
        data: {
          transactions: transformedTransactions,
          total: transformedTransactions.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching recent transactions:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_TRANSACTIONS_ERROR',
          message: i18n.t('system.internal_error'),
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * GET /api/admin/reports/summary
   * Get report summary data
   */
  async getReportSummary(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, reportType, transactionType } = req.query;
      
      let queryStartDate: Date;
      let queryEndDate: Date;
      
      if (startDate && endDate) {
        queryStartDate = new Date(startDate as string);
        queryEndDate = new Date(endDate as string);
        queryEndDate.setDate(queryEndDate.getDate() + 1); // Include end date
      } else {
        // Default to today
        queryStartDate = new Date();
        queryStartDate.setHours(0, 0, 0, 0);
        queryEndDate = new Date(queryStartDate);
        queryEndDate.setDate(queryEndDate.getDate() + 1);
      }

      // Build transaction type filter
      let typeFilter: string[] = ['PARKING', 'PENSION', 'LOST_TICKET'];
      if (transactionType && transactionType !== 'all') {
        switch (transactionType) {
          case 'parking': typeFilter = ['PARKING']; break;
          case 'pension': typeFilter = ['PENSION']; break;
          case 'lost_ticket': typeFilter = ['LOST_TICKET']; break;
          case 'refund': typeFilter = ['REFUND']; break;
        }
      }

      // Get revenue summary
      const revenueSummary = await prisma.transaction.aggregate({
        where: {
          timestamp: {
            gte: queryStartDate,
            lt: queryEndDate
          },
          type: { in: typeFilter }
        },
        _sum: { amount: true },
        _count: true
      });

      const totalRevenue = Money.fromNumber(revenueSummary._sum.amount || 0);
      const transactionCount = revenueSummary._count;
      const averageTicketValue = transactionCount > 0 
        ? totalRevenue.dividedBy(transactionCount)
        : Money.fromNumber(0);

      // Get hourly activity for peak hours
      const transactions = await prisma.transaction.findMany({
        where: {
          timestamp: {
            gte: queryStartDate,
            lt: queryEndDate
          },
          type: { in: typeFilter }
        },
        select: { timestamp: true }
      });

      const hourlyActivity = transactions.reduce((acc, transaction) => {
        const hour = transaction.timestamp.getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {} as { [hour: number]: number });

      const peakHours = Object.entries(hourlyActivity)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([hour, count]) => ({
          hour: `${hour.padStart(2, '0')}:00`,
          count
        }));

      res.json({
        success: true,
        data: {
          totalRevenue: totalRevenue.formatPesos(),
          totalTransactions: transactionCount,
          averageTicketValue: averageTicketValue.formatPesos(),
          peakHours
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching report summary:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_SUMMARY_ERROR',
          message: i18n.t('system.internal_error'),
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * GET /api/admin/reports/charts
   * Get chart data for reports
   */
  async getReportCharts(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, reportType } = req.query;
      
      let queryStartDate: Date;
      let queryEndDate: Date;
      
      if (startDate && endDate) {
        queryStartDate = new Date(startDate as string);
        queryEndDate = new Date(endDate as string);
        queryEndDate.setDate(queryEndDate.getDate() + 1);
      } else {
        queryStartDate = new Date();
        queryStartDate.setHours(0, 0, 0, 0);
        queryEndDate = new Date(queryStartDate);
        queryEndDate.setDate(queryEndDate.getDate() + 1);
      }

      // Get hourly revenue data
      const transactions = await prisma.transaction.findMany({
        where: {
          timestamp: {
            gte: queryStartDate,
            lt: queryEndDate
          },
          type: { in: ['PARKING', 'PENSION', 'LOST_TICKET'] }
        },
        select: {
          timestamp: true,
          amount: true,
          type: true
        }
      });

      // Group by hour for revenue chart
      const hourlyRevenue = Array.from({length: 24}, (_, hour) => {
        const hourTransactions = transactions.filter(t => t.timestamp.getHours() === hour);
        const revenue = hourTransactions.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
        return {
          hour: `${hour.toString().padStart(2, '0')}:00`,
          revenue: revenue.toFixed(2),
          count: hourTransactions.length
        };
      });

      // Transaction type breakdown
      const typeBreakdown = transactions.reduce((acc, t) => {
        const type = t.type;
        if (!acc[type]) acc[type] = { count: 0, revenue: 0 };
        acc[type].count++;
        acc[type].revenue += parseFloat(t.amount.toString());
        return acc;
      }, {} as { [key: string]: { count: number, revenue: number } });

      const transactionChart = Object.entries(typeBreakdown).map(([type, data]) => ({
        type,
        count: data.count,
        revenue: data.revenue.toFixed(2)
      }));

      // Simple occupancy chart (active tickets throughout the day)
      const occupancyChart = Array.from({length: 24}, (_, hour) => {
        // This is a simplified calculation - in reality you'd need more complex logic
        const activeAtHour = Math.floor(Math.random() * 50); // Placeholder
        return {
          hour: `${hour.toString().padStart(2, '0')}:00`,
          occupancy: activeAtHour
        };
      });

      res.json({
        success: true,
        data: {
          revenueChart: hourlyRevenue,
          transactionChart,
          occupancyChart
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching report charts:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_CHARTS_ERROR',
          message: i18n.t('system.internal_error'),
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * GET /api/admin/reports/transactions
   * Get transaction history for reports
   */
  async getReportTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, transactionType, page = 1, limit = 50 } = req.query;
      
      let queryStartDate: Date;
      let queryEndDate: Date;
      
      if (startDate && endDate) {
        queryStartDate = new Date(startDate as string);
        queryEndDate = new Date(endDate as string);
        queryEndDate.setDate(queryEndDate.getDate() + 1);
      } else {
        queryStartDate = new Date();
        queryStartDate.setHours(0, 0, 0, 0);
        queryEndDate = new Date(queryStartDate);
        queryEndDate.setDate(queryEndDate.getDate() + 1);
      }

      // Build transaction type filter
      let typeFilter: string[] = ['PARKING', 'PENSION', 'LOST_TICKET', 'REFUND'];
      if (transactionType && transactionType !== 'all') {
        switch (transactionType) {
          case 'parking': typeFilter = ['PARKING']; break;
          case 'pension': typeFilter = ['PENSION']; break;
          case 'lost_ticket': typeFilter = ['LOST_TICKET']; break;
          case 'refund': typeFilter = ['REFUND']; break;
        }
      }

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      // Get transactions with pagination
      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where: {
            timestamp: {
              gte: queryStartDate,
              lt: queryEndDate
            },
            type: { in: typeFilter }
          },
          include: {
            ticket: {
              select: {
                plateNumber: true,
                barcode: true,
                entryTime: true
              }
            },
            pension: {
              select: {
                name: true,
                plateNumber: true
              }
            }
          },
          orderBy: { timestamp: 'desc' },
          skip,
          take
        }),
        prisma.transaction.count({
          where: {
            timestamp: {
              gte: queryStartDate,
              lt: queryEndDate
            },
            type: { in: typeFilter }
          }
        })
      ]);

      // Calculate summary
      const summaryData = await prisma.transaction.aggregate({
        where: {
          timestamp: {
            gte: queryStartDate,
            lt: queryEndDate
          },
          type: { in: typeFilter }
        },
        _sum: { amount: true },
        _count: true
      });

      const formattedTransactions = transactions.map(transaction => ({
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        timestamp: transaction.timestamp,
        operatorId: transaction.operatorId,
        paymentMethod: transaction.paymentMethod,
        plateNumber: transaction.ticket?.plateNumber || transaction.pension?.plateNumber,
        customerName: transaction.pension?.name,
        ticketBarcode: transaction.ticket?.barcode,
        entryTime: transaction.ticket?.entryTime
      }));

      res.json({
        success: true,
        data: {
          transactions: formattedTransactions,
          total,
          summary: {
            totalAmount: Money.fromNumber(summaryData._sum.amount || 0).formatPesos(),
            totalCount: summaryData._count
          },
          pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total,
            pages: Math.ceil(total / parseInt(limit as string))
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching report transactions:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_REPORT_TRANSACTIONS_ERROR',
          message: i18n.t('system.internal_error'),
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * GET /api/admin/hardware/status
   * Get hardware status information
   */
  async getHardwareStatus(req: Request, res: Response): Promise<void> {
    try {
      // Check database connectivity
      const dbStart = Date.now();
      const dbHealth = await this.checkDatabaseHealth();
      const dbResponseTime = Date.now() - dbStart;

      // For now, assume printer and scanner are disconnected unless actual hardware is detected
      // In a real implementation, these would check actual hardware connections
      const printerConnected = false; // No physical printer connected
      const scannerConnected = false; // No physical scanner connected

      res.json({
        success: true,
        data: {
          printer: {
            status: printerConnected ? 'connected' : 'disconnected',
            model: 'Epson TM-T20III',
            lastPrint: printerConnected ? new Date().toISOString() : null,
            description: printerConnected ? 'Impresora conectada y lista' : 'Impresora no detectada'
          },
          scanner: {
            status: scannerConnected ? 'connected' : 'disconnected',
            model: 'Honeywell Voyager 1250g',
            lastScan: scannerConnected ? new Date().toISOString() : null,
            description: scannerConnected ? 'Escáner conectado y listo' : 'Escáner no detectado'
          },
          database: {
            status: dbHealth.status === 'HEALTHY' ? 'connected' : 'disconnected',
            responseTime: `${dbResponseTime}ms`,
            connectionCount: dbHealth.connections || 0,
            description: dbHealth.status === 'HEALTHY' ? 'Base de datos conectada y operativa' : 'Error de conexión con la base de datos'
          },
          network: {
            status: 'connected', // If we can respond to HTTP requests, network is working
            latency: dbResponseTime < 50 ? 'low' : dbResponseTime < 100 ? 'medium' : 'high',
            quality: dbResponseTime < 50 ? 'excellent' : dbResponseTime < 100 ? 'good' : 'poor',
            description: 'Conectividad de red activa'
          },
          system: {
            status: 'healthy',
            uptime: Math.floor(process.uptime()),
            lastUpdate: new Date().toISOString(),
            description: 'Sistema operativo funcionando correctamente'
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching hardware status:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_HARDWARE_STATUS_ERROR',
          message: i18n.t('system.internal_error'),
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * GET /api/admin/tickets/:id
   * Get detailed information for a specific ticket
   */
  async getTicketDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const ticket = await prisma.ticket.findUnique({
        where: { id },
        include: {
          transactions: {
            orderBy: { timestamp: 'desc' }
          }
        }
      });

      if (!ticket) {
        res.status(404).json({
          success: false,
          error: {
            code: 'TICKET_NOT_FOUND',
            message: 'Boleto no encontrado',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Calculate current fee if not paid
      let currentFee = '0.00';
      if (ticket.status === 'ACTIVE') {
        const calculation = await this.calculateParkingFee(ticket.entryTime);
        currentFee = calculation.amount.toString();
      } else {
        currentFee = ticket.totalAmount?.toString() || '0.00';
      }

      res.json({
        success: true,
        data: {
          ticket: {
            id: ticket.id,
            plateNumber: ticket.plateNumber,
            barcode: ticket.barcode,
            entryTime: ticket.entryTime,
            exitTime: ticket.exitTime,
            status: ticket.status,
            totalAmount: ticket.totalAmount?.toString() || '0.00',
            currentFee,
            paidAt: ticket.paidAt,
            printedAt: ticket.printedAt,
            paymentMethod: ticket.paymentMethod
          },
          transactions: ticket.transactions.map(t => ({
            id: t.id,
            type: t.type,
            amount: t.amount.toString(),
            description: t.description,
            timestamp: t.timestamp,
            operatorId: t.operatorId,
            paymentMethod: t.paymentMethod
          }))
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching ticket details:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_TICKET_DETAILS_ERROR',
          message: i18n.t('system.internal_error'),
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * PUT /api/admin/tickets/:id/payment
   * Process payment for a specific ticket
   */
  async processTicketPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { paymentMethod = 'CASH', amountPaid } = req.body;

      const ticket = await prisma.ticket.findUnique({
        where: { id }
      });

      if (!ticket) {
        res.status(404).json({
          success: false,
          error: {
            code: 'TICKET_NOT_FOUND',
            message: 'Boleto no encontrado',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (ticket.status !== 'ACTIVE') {
        res.status(400).json({
          success: false,
          error: {
            code: 'TICKET_NOT_ACTIVE',
            message: 'El boleto no está activo',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Calculate fee using configuration
      const currentTime = new Date();
      const calculation = await this.calculateParkingFee(ticket.entryTime, currentTime);
      const amountToCharge = amountPaid ? parseFloat(amountPaid) : calculation.amount;

      // Update ticket and create transaction
      const [updatedTicket, transaction] = await prisma.$transaction([
        prisma.ticket.update({
          where: { id },
          data: {
            status: 'PAID',
            totalAmount: amountToCharge,
            exitTime: currentTime,
            paidAt: currentTime,
            paymentMethod
          }
        }),
        prisma.transaction.create({
          data: {
            type: 'PARKING',
            amount: amountToCharge,
            description: calculation.description,
            ticketId: id,
            operatorId: req.user?.id || 'ADMIN',
            paymentMethod,
            timestamp: currentTime
          }
        })
      ]);

      res.json({
        success: true,
        data: {
          ticket: {
            id: updatedTicket.id,
            plateNumber: updatedTicket.plateNumber,
            status: updatedTicket.status,
            totalAmount: updatedTicket.totalAmount?.toString(),
            paidAt: updatedTicket.paidAt
          },
          transaction: {
            id: transaction.id,
            amount: transaction.amount.toString(),
            description: transaction.description
          },
          message: 'Pago procesado exitosamente'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error processing ticket payment:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PROCESS_PAYMENT_ERROR',
          message: i18n.t('system.internal_error'),
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * PUT /api/admin/tickets/:id/lost
   * Mark a ticket as lost and apply lost ticket fee
   */
  async markTicketAsLost(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const ticket = await prisma.ticket.findUnique({
        where: { id }
      });

      if (!ticket) {
        res.status(404).json({
          success: false,
          error: {
            code: 'TICKET_NOT_FOUND',
            message: 'Boleto no encontrado',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (ticket.status !== 'ACTIVE') {
        res.status(400).json({
          success: false,
          error: {
            code: 'TICKET_NOT_ACTIVE',
            message: 'El boleto no está activo',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Get lost ticket fee from configuration
      const config = await this.getCurrentPricingConfig();
      const lostTicketFee = config.lostTicketFee;
      const currentTime = new Date();

      // Update ticket and create transaction
      const [updatedTicket, transaction] = await prisma.$transaction([
        prisma.ticket.update({
          where: { id },
          data: {
            status: 'LOST',
            totalAmount: lostTicketFee,
            exitTime: currentTime,
            paidAt: currentTime,
            paymentMethod: 'CASH'
          }
        }),
        prisma.transaction.create({
          data: {
            type: 'LOST_TICKET',
            amount: lostTicketFee,
            description: 'Cobro por boleto perdido',
            ticketId: id,
            operatorId: req.user?.id || 'ADMIN',
            paymentMethod: 'CASH',
            timestamp: currentTime
          }
        })
      ]);

      res.json({
        success: true,
        data: {
          ticket: {
            id: updatedTicket.id,
            plateNumber: updatedTicket.plateNumber,
            status: updatedTicket.status,
            totalAmount: updatedTicket.totalAmount?.toString(),
            paidAt: updatedTicket.paidAt
          },
          transaction: {
            id: transaction.id,
            amount: transaction.amount.toString(),
            description: transaction.description
          },
          message: 'Boleto marcado como perdido y cobro procesado'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error marking ticket as lost:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'MARK_LOST_ERROR',
          message: i18n.t('system.internal_error'),
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * GET /api/admin/config/pricing
   * Get current pricing configuration
   */
  async getPricingConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const pricingConfig = await prisma.pricingConfig.findFirst({
        where: { isActive: true },
        include: {
          incrementRates: {
            orderBy: { incrementNumber: 'asc' }
          }
        }
      });

      if (!pricingConfig) {
        // Return default configuration if none exists
        res.json({
          success: true,
          data: {
            id: null,
            minimumHours: 1,
            minimumRate: '25.00',
            incrementMinutes: 15,
            incrementRate: '5.00',
            dailySpecialHours: null,
            dailySpecialRate: null,
            monthlyRate: '300.00',
            lostTicketFee: '50.00',
            isActive: true,
            incrementRates: []
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: pricingConfig.id,
          minimumHours: pricingConfig.minimumHours,
          minimumRate: pricingConfig.minimumRate.toString(),
          incrementMinutes: pricingConfig.incrementMinutes,
          incrementRate: pricingConfig.incrementRate.toString(),
          dailySpecialHours: pricingConfig.dailySpecialHours,
          dailySpecialRate: pricingConfig.dailySpecialRate?.toString(),
          monthlyRate: pricingConfig.monthlyRate.toString(),
          lostTicketFee: pricingConfig.lostTicketFee.toString(),
          isActive: pricingConfig.isActive,
          validFrom: pricingConfig.validFrom,
          validUntil: pricingConfig.validUntil,
          incrementRates: pricingConfig.incrementRates.map(rate => ({
            incrementNumber: rate.incrementNumber,
            rate: rate.rate.toString(),
            description: rate.description
          }))
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching pricing config:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_PRICING_CONFIG_ERROR',
          message: i18n.t('system.internal_error'),
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * PUT /api/admin/config/pricing
   * Update pricing configuration
   */
  async updatePricingConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        minimumHours,
        minimumRate,
        incrementMinutes,
        incrementRate,
        dailySpecialHours,
        dailySpecialRate,
        monthlyRate,
        lostTicketFee
      } = req.body;

      // Deactivate current active config
      await prisma.pricingConfig.updateMany({
        where: { isActive: true },
        data: { 
          isActive: false,
          validUntil: new Date()
        }
      });

      // Create new configuration
      const newConfig = await prisma.pricingConfig.create({
        data: {
          minimumHours: parseInt(minimumHours) || 1,
          minimumRate: parseFloat(minimumRate) || 25.00,
          incrementMinutes: parseInt(incrementMinutes) || 15,
          incrementRate: parseFloat(incrementRate) || 5.00,
          dailySpecialHours: dailySpecialHours ? parseInt(dailySpecialHours) : null,
          dailySpecialRate: dailySpecialRate ? parseFloat(dailySpecialRate) : null,
          monthlyRate: parseFloat(monthlyRate) || 300.00,
          lostTicketFee: parseFloat(lostTicketFee) || 50.00,
          isActive: true,
          createdBy: req.user?.id || 'ADMIN'
        }
      });

      // Log audit event
      await auditService.logFromRequest(
        req,
        'PricingConfig',
        newConfig.id,
        'CONFIG_UPDATED',
        null,
        {
          minimumRate: newConfig.minimumRate.toString(),
          lostTicketFee: newConfig.lostTicketFee.toString(),
          monthlyRate: newConfig.monthlyRate.toString()
        }
      );

      res.json({
        success: true,
        data: {
          id: newConfig.id,
          minimumHours: newConfig.minimumHours,
          minimumRate: newConfig.minimumRate.toString(),
          incrementMinutes: newConfig.incrementMinutes,
          incrementRate: newConfig.incrementRate.toString(),
          dailySpecialHours: newConfig.dailySpecialHours,
          dailySpecialRate: newConfig.dailySpecialRate?.toString(),
          monthlyRate: newConfig.monthlyRate.toString(),
          lostTicketFee: newConfig.lostTicketFee.toString(),
          message: 'Configuración de precios actualizada exitosamente'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating pricing config:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_PRICING_CONFIG_ERROR',
          message: i18n.t('system.internal_error'),
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * GET /api/admin/metrics/hourly
   * Get hourly metrics for charts and analytics
   */
  async getHourlyMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { date } = req.query;
      
      // Default to today if no date provided
      let targetDate = new Date();
      if (date) {
        targetDate = new Date(date as string);
      }
      
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Get hourly ticket entries (new tickets created each hour)
      const hourlyEntries = await prisma.ticket.groupBy({
        by: ['entryTime'],
        where: {
          entryTime: {
            gte: startOfDay,
            lte: endOfDay
          }
        },
        _count: {
          id: true
        }
      });

      // Get hourly exits (tickets paid each hour)
      const hourlyExits = await prisma.ticket.groupBy({
        by: ['paidAt'],
        where: {
          paidAt: {
            gte: startOfDay,
            lte: endOfDay
          },
          status: { in: ['PAID', 'LOST'] }
        },
        _count: {
          id: true
        }
      });

      // Get hourly revenue (transactions by hour)
      const hourlyRevenue = await prisma.transaction.groupBy({
        by: ['timestamp'],
        where: {
          timestamp: {
            gte: startOfDay,
            lte: endOfDay
          },
          type: { in: ['PARKING', 'LOST_TICKET', 'PENSION'] }
        },
        _sum: {
          amount: true
        },
        _count: {
          id: true
        }
      });

      // Create hourly data structure (24 hours)
      const hourlyData = Array.from({ length: 24 }, (_, hour) => {
        // Count entries for this hour
        const entriesThisHour = hourlyEntries.filter(entry => {
          return new Date(entry.entryTime).getHours() === hour;
        }).reduce((sum, entry) => sum + entry._count.id, 0);

        // Count exits for this hour
        const exitsThisHour = hourlyExits.filter(exit => {
          return exit.paidAt && new Date(exit.paidAt).getHours() === hour;
        }).reduce((sum, exit) => sum + exit._count.id, 0);

        // Sum revenue for this hour
        const revenueThisHour = hourlyRevenue.filter(rev => {
          return new Date(rev.timestamp).getHours() === hour;
        }).reduce((sum, rev) => sum + parseFloat((rev._sum.amount || 0).toString()), 0);

        return {
          hour: hour.toString().padStart(2, '0'),
          entries: entriesThisHour,
          exits: exitsThisHour,
          revenue: revenueThisHour
        };
      });

      // Calculate cumulative revenue for the line chart
      let cumulativeRevenue = 0;
      const revenueData = hourlyData.map(item => {
        cumulativeRevenue += item.revenue;
        return {
          time: `${item.hour}:00`,
          cumulative: cumulativeRevenue
        };
      });

      // Calculate summary statistics
      const totalEntries = hourlyData.reduce((sum, item) => sum + item.entries, 0);
      const totalExits = hourlyData.reduce((sum, item) => sum + item.exits, 0);
      const totalRevenue = hourlyData.reduce((sum, item) => sum + item.revenue, 0);

      res.json({
        success: true,
        data: {
          date: targetDate.toISOString().split('T')[0],
          hourlyData,
          revenueData,
          summary: {
            totalEntries,
            totalExits,
            totalRevenue: totalRevenue.toFixed(2),
            currentOccupancy: totalEntries - totalExits
          },
          lastUpdated: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching hourly metrics:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_HOURLY_METRICS_ERROR',
          message: i18n.t('system.internal_error'),
          timestamp: new Date().toISOString()
        }
      });
    }
  }
}

export default new AdminController();