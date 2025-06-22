/**
 * Test script for pension customer workflow
 * Tests the complete business logic for monthly customers
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:4000/api';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  data?: any;
}

class PensionWorkflowTester {
  private results: TestResult[] = [];
  private testCustomerId: string | null = null;

  async runAllTests(): Promise<void> {
    console.log('🔍 Starting Pension Customer Workflow Tests...\n');

    // Test 1: Create new pension customer
    await this.testCreateCustomer();
    
    // Test 2: Search customers by plate
    await this.testSearchCustomers();
    
    // Test 3: Lookup customer by plate
    await this.testLookupCustomer();
    
    // Test 4: Process monthly payment
    await this.testProcessPayment();
    
    // Test 5: Renew customer for multiple months
    await this.testRenewCustomer();
    
    // Test 6: Check customer status
    await this.testCheckStatus();

    // Print results
    this.printResults();
  }

  private async testCreateCustomer(): Promise<void> {
    try {
      const customerData = {
        name: 'Juan Pérez García',
        phone: '55-1234-5678',
        plateNumber: 'TEST-001',
        vehicleMake: 'Toyota',
        vehicleModel: 'Corolla',
        monthlyRate: 2000,
        startDate: new Date().toISOString(),
        durationMonths: 1
      };

      const response = await fetch(`${API_BASE}/pension/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        this.testCustomerId = result.data.id;
        this.results.push({
          name: 'Create Pension Customer',
          passed: true,
          data: result.data
        });
      } else {
        this.results.push({
          name: 'Create Pension Customer',
          passed: false,
          error: result.error?.message || 'Failed to create customer'
        });
      }
    } catch (error) {
      this.results.push({
        name: 'Create Pension Customer',
        passed: false,
        error: error.message
      });
    }
  }

  private async testSearchCustomers(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/pension/search/TEST`);
      const result = await response.json();

      if (response.ok && result.success && result.data.length > 0) {
        this.results.push({
          name: 'Search Customers by Plate',
          passed: true,
          data: `Found ${result.data.length} customers`
        });
      } else {
        this.results.push({
          name: 'Search Customers by Plate',
          passed: false,
          error: 'No customers found or search failed'
        });
      }
    } catch (error) {
      this.results.push({
        name: 'Search Customers by Plate',
        passed: false,
        error: error.message
      });
    }
  }

  private async testLookupCustomer(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/pension/lookup/TEST-001`);
      const result = await response.json();

      if (response.ok && result.success && result.data) {
        const customer = result.data;
        const isValid = customer.status === 'ACTIVE' && customer.plateNumber === 'TEST-001';
        
        this.results.push({
          name: 'Lookup Customer by Plate',
          passed: isValid,
          data: `Status: ${customer.status}, Plate: ${customer.plateNumber}`
        });
      } else {
        this.results.push({
          name: 'Lookup Customer by Plate',
          passed: false,
          error: result.error?.message || 'Customer not found'
        });
      }
    } catch (error) {
      this.results.push({
        name: 'Lookup Customer by Plate',
        passed: false,
        error: error.message
      });
    }
  }

  private async testProcessPayment(): Promise<void> {
    if (!this.testCustomerId) {
      this.results.push({
        name: 'Process Monthly Payment',
        passed: false,
        error: 'No test customer ID available'
      });
      return;
    }

    try {
      const paymentData = {
        customerId: this.testCustomerId,
        cashReceived: 2000
      };

      const response = await fetch(`${API_BASE}/pension/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        this.results.push({
          name: 'Process Monthly Payment',
          passed: true,
          data: `Payment: ${result.data.payment.amount}, Valid until: ${result.data.payment.validUntil}`
        });
      } else {
        this.results.push({
          name: 'Process Monthly Payment',
          passed: false,
          error: result.error?.message || 'Payment failed'
        });
      }
    } catch (error) {
      this.results.push({
        name: 'Process Monthly Payment',
        passed: false,
        error: error.message
      });
    }
  }

  private async testRenewCustomer(): Promise<void> {
    if (!this.testCustomerId) {
      this.results.push({
        name: 'Renew Customer (3 months)',
        passed: false,
        error: 'No test customer ID available'
      });
      return;
    }

    try {
      const renewalData = {
        durationMonths: 3,
        cashReceived: 6000 // 3 months × $2000
      };

      const response = await fetch(`${API_BASE}/pension/renew/${this.testCustomerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(renewalData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        this.results.push({
          name: 'Renew Customer (3 months)',
          passed: true,
          data: `Renewed until: ${new Date(result.data.endDate).toLocaleDateString('es-MX')}`
        });
      } else {
        this.results.push({
          name: 'Renew Customer (3 months)',
          passed: false,
          error: result.error?.message || 'Renewal failed'
        });
      }
    } catch (error) {
      this.results.push({
        name: 'Renew Customer (3 months)',
        passed: false,
        error: error.message
      });
    }
  }

  private async testCheckStatus(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/pension/status/TEST-001`);
      const result = await response.json();

      if (response.ok && result.success && result.data.found) {
        const { customer, accessAllowed } = result.data;
        
        this.results.push({
          name: 'Check Customer Status',
          passed: accessAllowed && customer.status === 'ACTIVE',
          data: `Access: ${accessAllowed ? 'ALLOWED' : 'DENIED'}, Status: ${customer.status}`
        });
      } else {
        this.results.push({
          name: 'Check Customer Status',
          passed: false,
          error: 'Status check failed or customer not found'
        });
      }
    } catch (error) {
      this.results.push({
        name: 'Check Customer Status',
        passed: false,
        error: error.message
      });
    }
  }

  private printResults(): void {
    console.log('\n📊 Test Results Summary:');
    console.log('=' .repeat(50));
    
    let passed = 0;
    let total = this.results.length;

    this.results.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const details = result.passed 
        ? (result.data ? ` - ${result.data}` : '')
        : ` - ${result.error}`;
      
      console.log(`${index + 1}. ${result.name}: ${status}${details}`);
      
      if (result.passed) passed++;
    });

    console.log('=' .repeat(50));
    console.log(`Overall: ${passed}/${total} tests passed (${((passed/total) * 100).toFixed(1)}%)`);
    
    if (passed === total) {
      console.log('🎉 All pension customer workflows are working correctly!');
    } else {
      console.log('⚠️  Some tests failed. Please check the errors above.');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new PensionWorkflowTester();
  tester.runAllTests().catch(console.error);
}

export { PensionWorkflowTester };