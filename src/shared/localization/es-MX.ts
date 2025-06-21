import { TranslationKey } from '../types/financial';

/**
 * Mexican Spanish translations for parking lot management system
 * Following Mexican Spanish conventions and formal "usted" for customer interactions
 */
export const esMX: TranslationKey = {
               // Parking Operations
               parking: {
                 ticket: 'Boleto',
                 entry: 'Entrada',
                 exit: 'Salida',
                 payment: 'Pago',
                 cash: 'Efectivo',
                 change: 'Cambio',
                 total: 'Total',
                 time: 'Tiempo',
                 plate: 'Placa',
                 parking_lot: 'Estacionamiento',
                 receipt: 'Recibo',
                 lost_ticket: 'Boleto Extraviado',
                 pension: 'Pensión',
                 monthly: 'Mensual',
               },
               
               // Hardware Status
               hardware: {
                                printer_connected: 'Impresora Conectada',
                                printer_disconnected: 'Impresora Desconectada',
                                printer_error: 'Error de Impresora',
                                scanner_ready: 'Escáner Listo',
                                scanner_error: 'Error de Escáner',
                                hardware_check: 'Verificación de Hardware',
                                connection_failed: 'Conexión Fallida',
                                retry_connection: 'Reintentando Conexión',
                                receipt_printing: 'Imprimiendo Recibo...',
                                scan_timeout: 'Tiempo Agotado. Ingrese Manualmente.',
                                hardware_maintenance: 'Mantenimiento del Sistema',
                                connection_restored: 'Conexión Restablecida',
                                manual_entry_required: 'Entrada Manual Requerida',
                               printer_init_failed: 'Error al Inicializar Impresora',
                               queue_full: 'Cola de Impresión Llena',
                               print_failed: 'Error al Imprimir',
                               execution_error: 'Error de Ejecución',
                               health_check_failed: 'Verificación de Estado Fallida',
                               test_print: 'IMPRESIÓN DE PRUEBA',
                               test_successful: 'Prueba Exitosa',
                               // Scanner specific translations
                               scan_already_active: 'Escaneo Ya Activo',
                               empty_scan_buffer: 'Buffer de Escaneo Vacío',
                               invalid_barcode: 'Código de Barras Inválido: {reason}',
                               manual_entry_already_active: 'Entrada Manual Ya Activa',
                               manual_entry_timeout: 'Tiempo de Entrada Manual Agotado',
                               no_manual_entry_active: 'No Hay Entrada Manual Activa',
                               invalid_manual_input: 'Entrada Manual Inválida: {reason}',
                               enter_manually_placeholder: 'Ingrese el código manualmente',
                               barcode_too_short: 'Código muy corto (mínimo {minLength} caracteres)',
                               barcode_too_long: 'Código muy largo (máximo {maxLength} caracteres)',
                               invalid_code39_characters: 'Caracteres inválidos para Código 39',
                               empty_input: 'Entrada Vacía',
                               focus_element_not_found: 'Elemento de enfoque no encontrado: {selector}',
                               scanner_destroyed: 'Escáner Destruido',
                              },
               
                              // Payment and transaction translations
                              payment: {
                                insufficient_amount: 'Cantidad insuficiente. Se requiere {required}, se proporcionó {provided}',
                                insufficient_lost_ticket_fee: 'Tarifa de boleto perdido insuficiente. Se requiere {required}, se proporcionó {provided}',
                                payment_successful: 'Pago exitoso',
                                payment_failed: 'Error en el pago',
                                change_amount: 'Su cambio: {amount}',
                              },
                              
                              // Transaction descriptions
                              transaction: {
                                parking_payment: 'Pago de estacionamiento - Placa {plate} - Duración {duration}',
                                lost_ticket_fee: 'Tarifa por boleto perdido - Placa {plate}',
                                pension_payment: 'Pago de pensión mensual - {customerName}',
                                refund: 'Reembolso - {reason}',
                              },
                              
                              // Pension customer translations
                              pension: {
                                inactive_customer: 'Cliente de pensión inactivo',
                                expired_customer: 'Pensión expirada hace {days} días',
                                valid_customer: 'Pensión válida - {daysRemaining} días restantes',
                                renewal_required: 'Renovación de pensión requerida',
                              },

               // Business Logic Errors
               errors: {
                 insufficient_funds: 'Fondos Insuficientes',
                 ticket_not_found: 'Boleto No Encontrado',
                 invalid_barcode: 'Código de Barras Inválido',
                 payment_required: 'Pago Requerido',
                 cash_register_error: 'Error en Caja Registradora',
                 calculation_error: 'Error de Cálculo',
                 transaction_failed: 'Transacción Fallida',
                 invalid_amount: 'Cantidad Inválida',
                 exceeds_maximum: 'Excede el Máximo Permitido',
                 hardware_unavailable: 'Hardware No Disponible',
               },
               
               // Time and Date
               time: {
                 minutes: 'minutos',
                 hours: 'horas',
                 days: 'días',
                 today: 'hoy',
                 yesterday: 'ayer',
                 morning: 'mañana',
                 afternoon: 'tarde',
                 evening: 'noche',
                 night: 'madrugada',
               },
               
               // Currency and Numbers
               currency: {
                 pesos: 'pesos',
                 centavos: 'centavos',
                 free: 'gratis',
                 owed: 'debe',
                 paid: 'pagado',
                 due: 'vencido',
                 balance: 'saldo',
                 total_collected: 'total recaudado',
               },
               
               // UI Actions
               actions: {
                 scan: 'Escanear',
                 print: 'Imprimir',
                 calculate: 'Calcular',
                 pay: 'Pagar',
                 cancel: 'Cancelar',
                 retry: 'Reintentar',
                 confirm: 'Confirmar',
                 continue: 'Continuar',
                 back: 'Regresar',
                 clear: 'Limpiar',
                 enter_manually: 'Ingresar Manualmente',
               },
               
               // Status Messages
               status: {
                 processing: 'Procesando...',
                 completed: 'Completado',
                 failed: 'Fallido',
                 waiting: 'Esperando...',
                 printing: 'Imprimiendo...',
                 calculating: 'Calculando...',
                 scanning: 'Escaneando...',
                 connecting: 'Conectando...',
               },
               
               // Validation Messages
               validation: {
                 required_field: 'Campo requerido',
                 invalid_format: 'Formato inválido',
                 plate_required: 'Placa requerida',
                 amount_required: 'Cantidad requerida',
                 scan_barcode: 'Escanee el código de barras',
                 enter_plate: 'Ingrese número de placa',
               },
               
               // Customer Service (Formal 'usted' treatment)
               customer: {
                 welcome: 'Bienvenido al Estacionamiento',
                 thank_you: 'Gracias por su preferencia',
                 please_wait: 'Por favor espere un momento',
                 please_pay: 'Por favor realice su pago',
                 please_scan: 'Por favor escanee su boleto',
                 thank_you_payment: 'Gracias por su pago',
                 have_receipt: 'Conserve su recibo',
                 drive_safely: 'Maneja con cuidado',
                 assistance_needed: '¿Necesita asistencia?',
                 call_attendant: 'Llame al encargado',
                keep_receipt: 'Conserve su recibo',
                enjoy_service: 'Disfrute nuestro servicio',
               },
               
               // Receipt Templates
               receipt: {
                 header_line1: '=== ESTACIONAMIENTO ===',
                 header_line2: 'BOLETO DE SALIDA',
                 separator_line: '========================',
                 entry_time_label: 'Entrada:',
                 exit_time_label: 'Salida:',
                 duration_label: 'Tiempo Total:',
                 rate_label: 'Tarifa:',
                 total_label: 'Total a Pagar:',
                 payment_method_label: 'Método de Pago:',
                 change_label: 'Su Cambio:',
                 footer_thank_you: 'Gracias por su visita',
                 footer_drive_safely: 'Maneje con precaución',
                parking_title: 'ESTACIONAMIENTO',
                entry_ticket: 'BOLETO DE ENTRADA',
                payment_receipt: 'RECIBO DE PAGO',
                lost_ticket: 'BOLETO EXTRAVIADO',
                pension_receipt: 'RECIBO PENSIÓN',
                ticket_number: 'Boleto: {number}',
                plate_number: 'Placa: {plate}',
                entry_time: 'Entrada: {time}',
                exit_time: 'Salida: {time}',
                total_time: 'Tiempo Total: {duration}',
                total_amount: 'Total a Pagar: {amount}',
                payment_method: 'Método de Pago: {method}',
                change_given: 'Su Cambio: {amount}',
                lost_ticket_fee: 'Tarifa Boleto Extraviado: {amount}',
                customer_name: 'Cliente: {name}',
                monthly_pension: 'Pensión Mensual',
                valid_until: 'Válido hasta: {date}',
               },
               
              // Payment Methods
              paymentMethods: {
                efectivo: 'Efectivo',
                pension: 'Pensión',
              },

              // API and Validation Messages
              validation: {
                plate_required: 'Número de placa es requerido',
                plate_too_long: 'Número de placa muy largo (máximo 15 caracteres)',
                plate_invalid_format: 'Formato de placa inválido (solo A-Z, 0-9, guión)',
                barcode_too_short: 'Código de barras muy corto (mínimo 3 caracteres)',
                barcode_too_long: 'Código de barras muy largo (máximo 43 caracteres)',
                barcode_invalid_chars: 'Código de barras contiene caracteres inválidos',
                amount_positive: 'El monto debe ser positivo',
                amount_too_large: 'Monto demasiado grande (máximo $9,999.99)',
                amount_invalid: 'Monto inválido',
                ticket_required: 'Número de boleto es requerido',
                operator_required: 'ID de operador es requerido',
                field_invalid: 'Campo {field} inválido: {value}',
                request_invalid: 'Datos de solicitud inválidos'
              },

              // Parking Operations
              parking: {
                vehicle_already_inside: 'Vehículo ya se encuentra dentro del estacionamiento',
                entry_successful: 'Entrada registrada exitosamente',
                ticket_not_found: 'Boleto no encontrado',
                ticket_already_processed: 'Boleto ya fue procesado',
                barcode_mismatch: 'Código de barras no coincide',
                free_period: 'Estacionamiento gratuito - Sin costo',
                payment_required: 'Pago requerido: {amount}',
                insufficient_payment: 'Pago insuficiente',
                payment_successful: 'Pago procesado exitosamente',
                payment_required_for_exit: 'Debe pagar antes de salir',
                exit_successful: 'Salida autorizada - Que tenga buen viaje'
              },

              // Authentication
              auth: {
                token_required: 'Token de autenticación requerido',
                token_invalid: 'Token de autenticación inválido',
                authentication_failed: 'Fallo en la autenticación',
                insufficient_permissions: 'Permisos insuficientes'
              },

              // Cash Register Management
              cash: {
                register_already_open: 'Caja ya está abierta para este operador',
                register_opened_successfully: 'Caja abierta exitosamente',
                no_open_register: 'No hay caja abierta para este operador',
                register_balanced: 'Caja cuadrada correctamente',
                register_discrepancy_detected: 'Discrepancia detectada en caja',
                deposit_successful: 'Depósito realizado exitosamente',
                withdrawal_successful: 'Retiro realizado exitosamente',
                register_status_active: 'Estado de caja activo',
                count_completed: 'Conteo de efectivo completado',
                history_retrieved: 'Historial de caja recuperado'
              },

              // System Messages
              system: {
                health_check_ok: 'Sistema operando normalmente',
                server_started: 'Servidor de estacionamiento iniciado',
                server_healthy: 'Sistema saludable',
                shutdown_initiated: 'Apagado del sistema iniciado',
                shutdown_complete: 'Apagado del sistema completado',
                pricing_not_configured: 'Configuración de precios no encontrada',
                feature_coming_soon: 'Funcionalidad próximamente disponible'
              },

              // Database Errors
              database: {
                operation_failed: 'Operación de base de datos falló',
                duplicate_entry: 'Registro duplicado',
                record_not_found: 'Registro no encontrado',
                foreign_key_constraint: 'Restricción de integridad de datos'
              },

              // Transaction Types
              transaction: {
                parking_payment: 'Pago de estacionamiento'
              },

              // Admin Interface
              // Administration
              admin: {
                dashboard_loading: 'Panel de administración cargando',
                dashboard_metrics_retrieved: 'Métricas del panel obtenidas exitosamente',
                dashboard_error: 'Error al obtener métricas del panel',
                peak_hour_description: 'Hora pico: {hour}:00 con {count} transacciones',
                no_peak_data: 'Sin datos de hora pico disponibles',
                daily_report_generated: 'Reporte diario generado exitosamente',
                monthly_report_generated: 'Reporte mensual generado exitosamente',
                report_generation_error: 'Error al generar reporte',
                audit_log_retrieved: 'Registro de auditoría obtenido exitosamente',
                audit_log_error: 'Error al obtener registro de auditoría',
                system_health_retrieved: 'Estado del sistema obtenido exitosamente',
                health_check_error: 'Error al verificar estado del sistema',
                database_healthy: 'Base de datos funcionando correctamente',
                database_error: 'Error en base de datos',
                auth_service_healthy: 'Servicio de autenticación funcionando',
                operator_created_successfully: 'Operador creado exitosamente',
                operator_updated_successfully: 'Operador actualizado exitosamente',
                operator_not_found: 'Operador no encontrado',
                email_already_exists: 'El correo electrónico ya existe en el sistema',
                operators_retrieved: 'Lista de operadores obtenida exitosamente',
                operators_retrieval_error: 'Error al obtener lista de operadores',
                hourly_activity: 'Actividad a las {hour}:00 - {count} vehículos'
              },

              // Audit Log Actions
              audit: {
                payment_processed: 'Pago procesado para placa {plateNumber}',
                vehicle_entry: 'Entrada de vehículo registrada',
                vehicle_exit: 'Salida de vehículo procesada',
                ticket_created: 'Boleto creado',
                ticket_updated: 'Boleto actualizado',
                cash_register_opened: 'Caja registradora abierta',
                cash_register_closed: 'Caja registradora cerrada',
                cash_adjustment: 'Ajuste de efectivo realizado',
                operator_created: 'Operador creado',
                operator_updated: 'Operador actualizado',
                lost_ticket_processed: 'Boleto extraviado procesado',
                system_backup: 'Respaldo del sistema realizado'
              },

              // User Roles
              roles: {
                admin: 'Administrador',
                manager: 'Gerente',
                viewer: 'Visualizador',
                operator: 'Operador'
              },

              // Months for reports
              months: [
                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
              ],

              // Transaction Types
              transaction: {
                parking: 'Estacionamiento',
                pension: 'Pensión',
                lost_ticket: 'Boleto Extraviado',
                lost_ticket_fee: 'Tarifa por boleto extraviado',
                lost_ticket_fee_no_original: 'Tarifa por boleto extraviado (sin original)',
                parking_payment: 'Pago de estacionamiento',
                refund: 'Reembolso',
                withdrawal: 'Retiro',
                deposit: 'Depósito',
                adjustment: 'Ajuste',
                opening_balance: 'Saldo Inicial',
                closing_balance: 'Saldo Final'
              },

              // Additional Validation Messages
              validationExtended: {
                operator_id_required: 'ID del operador requerido',
                invalid_amount: 'Monto inválido',
                description_required: 'Descripción requerida',
                count_must_be_positive: 'La cantidad debe ser positiva'
              },

              // System Error Messages
              systemErrors: {
                rate_limit_exceeded: 'Límite de solicitudes excedido - intente más tarde',
                endpoint_not_found: 'Endpoint no encontrado: {path}',
                internal_server_error: 'Error interno del servidor',
                insufficient_funds: 'Fondos insuficientes',
                cash_register_error: 'Error en el sistema de caja'
              }
            };