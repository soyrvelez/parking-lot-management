#!/usr/bin/env ts-node
/**
 * Comprehensive operator interface validation script
 * Tests all APIs and functionality before manual testing
 */

// Using global fetch (Node.js 18+)

const API_BASE = 'http://localhost:4000/api';
const FRONTEND_URL = 'http://localhost:3001';

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
  duration?: number;
}

class OperatorInterfaceValidator {
  private results: TestResult[] = [];

  private async runTest(testName: string, testFn: () => Promise<boolean>): Promise<void> {
    const start = Date.now();
    try {
      const passed = await testFn();
      const duration = Date.now() - start;
      this.results.push({
        test: testName,
        passed,
        message: passed ? '✅ PASSED' : '❌ FAILED',
        duration
      });
    } catch (error) {
      const duration = Date.now() - start;
      this.results.push({
        test: testName,
        passed: false,
        message: `❌ ERROR: ${error instanceof Error ? error.message : String(error)}`,
        duration
      });
    }
  }

  private async testBackendHealth(): Promise<boolean> {
    const response = await fetch(`${API_BASE.replace('/api', '')}/health`);
    const data = await response.json();
    return response.ok && data.success;
  }

  private async testHardwareStatus(): Promise<boolean> {
    const response = await fetch(`${API_BASE}/hardware/status`);
    const data = await response.json();
    return response.ok && data.success && data.data.printer && data.data.scanner;
  }

  private async testTicketLookup(): Promise<boolean> {
    const response = await fetch(`${API_BASE}/parking/tickets/lookup/PARK123456`);
    const data = await response.json();
    return response.ok && data.success && data.data.plateNumber === 'ABC123';
  }

  private async testPensionLookup(): Promise<boolean> {
    const response = await fetch(`${API_BASE}/pension/lookup/MEX456`);
    const data = await response.json();
    return response.ok && data.success && data.data.name === 'Juan Pérez García';
  }

  private async testPricingCalculation(): Promise<boolean> {
    const response = await fetch(`${API_BASE}/parking/calculate/PARK123456`);
    const data = await response.json();
    return response.ok && data.success && data.data.pricing;
  }

  private async testOperatorStats(): Promise<boolean> {
    const response = await fetch(`${API_BASE}/operator/dashboard/stats`);
    const data = await response.json();
    return response.ok && data.success;
  }

  private async testFrontendAccess(): Promise<boolean> {
    const response = await fetch(FRONTEND_URL);
    return response.ok;
  }

  async runAllTests(): Promise<void> {
    console.log('🔍 Running Operator Interface Validation Tests');
    console.log('===============================================\n');

    await this.runTest('Backend Health Check', () => this.testBackendHealth());
    await this.runTest('Hardware Status Monitoring', () => this.testHardwareStatus());
    await this.runTest('Active Ticket Lookup', () => this.testTicketLookup());
    await this.runTest('Pension Customer Lookup', () => this.testPensionLookup());
    await this.runTest('Parking Fee Calculation', () => this.testPricingCalculation());
    await this.runTest('Operator Dashboard Stats', () => this.testOperatorStats());
    await this.runTest('Frontend Application Access', () => this.testFrontendAccess());

    this.printResults();
  }

  private printResults(): void {
    console.log('\n📊 TEST RESULTS');
    console.log('===============================================');

    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;

    this.results.forEach(result => {
      const duration = result.duration ? ` (${result.duration}ms)` : '';
      console.log(`${result.message} ${result.test}${duration}`);
    });

    console.log(`\n📈 SUMMARY: ${passed}/${total} tests passed`);

    if (passed === total) {
      console.log('\n✅ ALL TESTS PASSED - OPERATOR INTERFACE READY FOR TESTING!');
      console.log('\n🚀 Open your browser to: http://localhost:3001');
      console.log('\n📋 Use these test barcodes:');
      console.log('   • PARK123456 - Active ticket (2 hours, ~$35)');
      console.log('   • PARK789012 - Already paid ticket');
      console.log('   • MEX456 - Pension customer lookup');
      console.log('\n⌨️  Test keyboard shortcuts:');
      console.log('   • F1-F4: Navigation modes');
      console.log('   • F5-F8: Quick payment amounts ($100, $200, $500, $1000)');
      console.log('   • F9: Clear amount');
      console.log('   • F12: Confirm payment');
    } else {
      console.log('\n❌ SOME TESTS FAILED - CHECK SERVICES');
      console.log('\nTroubleshooting:');
      console.log('• Ensure PostgreSQL is running');
      console.log('• Verify backend server on port 4000');
      console.log('• Check frontend server on port 3001');
      console.log('• Review test data seeding');
    }
    console.log('\n===============================================\n');
  }
}

// Run validation
async function main() {
  const validator = new OperatorInterfaceValidator();
  await validator.runAllTests();
}

main().catch(console.error);