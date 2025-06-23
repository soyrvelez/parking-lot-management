import { useEffect } from 'react';

interface KeyboardShortcuts {
  onScanMode?: () => void;
  onEntryMode?: () => void;
  onPensionMode?: () => void;
  onPaymentMode?: () => void;
  onConfirmPayment?: () => void;
  onClearAmount?: () => void;
  onPrintReceipt?: () => void;
  onEscape?: () => void;
  onQuickAmount?: (amount: string) => void;
  onExactAmount?: () => void;
}

/**
 * Hook for handling keyboard shortcuts in the operator interface
 * Follows standard cash register/POS system conventions
 */
export const useKeyboardShortcuts = (shortcuts: KeyboardShortcuts) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Handle F-key shortcuts (standard for POS systems)
      switch (event.key) {
        case 'F1':
          event.preventDefault();
          shortcuts.onScanMode?.();
          break;
        
        case 'F2':
          event.preventDefault();
          shortcuts.onEntryMode?.();
          break;
        
        case 'F3':
          event.preventDefault();
          shortcuts.onPensionMode?.();
          break;
        
        case 'F4':
          event.preventDefault();
          shortcuts.onExactAmount?.() || shortcuts.onPaymentMode?.();
          break;
        
        case 'F5':
          event.preventDefault();
          shortcuts.onQuickAmount?.('100');
          break;
        
        case 'F6':
          event.preventDefault();
          shortcuts.onQuickAmount?.('200');
          break;
        
        case 'F7':
          event.preventDefault();
          shortcuts.onQuickAmount?.('500');
          break;
        
        case 'F8':
          event.preventDefault();
          shortcuts.onQuickAmount?.('1000');
          break;
        
        case 'F9':
          event.preventDefault();
          shortcuts.onClearAmount?.();
          break;
        
        case 'F10':
          event.preventDefault();
          shortcuts.onPrintReceipt?.();
          break;
        
        case 'F11':
          event.preventDefault();
          shortcuts.onQuickAmount?.('50');
          break;
        
        case 'F12':
        case 'Enter':
          // F12 or Enter for payment confirmation (when not in input field)
          if (event.ctrlKey || event.key === 'F12') {
            event.preventDefault();
            shortcuts.onConfirmPayment?.();
          }
          break;
        
        case 'Escape':
          event.preventDefault();
          shortcuts.onEscape?.();
          break;
      }

      // Handle Ctrl + number shortcuts for quick amounts
      if (event.ctrlKey && event.key >= '1' && event.key <= '9') {
        event.preventDefault();
        const quickAmounts = ['25', '50', '100', '200', '500', '1000'];
        const index = parseInt(event.key) - 1;
        if (index < quickAmounts.length) {
          // Dispatch custom event for quick amount selection
          window.dispatchEvent(new CustomEvent('quickAmount', { 
            detail: { amount: quickAmounts[index] } 
          }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts]);
};
             
             /**
              * Hook for making authenticated API calls to admin endpoints
              * Automatically includes Authorization header with admin token
              */
             import { useRouter } from 'next/router';
             import { useCallback } from 'react';
             
             interface ApiCallOptions extends RequestInit {
               requireAuth?: boolean;
             }
             
             export function useAuthenticatedFetch() {
               const router = useRouter();
             
               const authenticatedFetch = useCallback(async (
                 url: string, 
                 options: ApiCallOptions = {}
               ): Promise<Response> => {
                 const { requireAuth = true, headers = {}, ...otherOptions } = options;
             
                 // Build headers object
                 const requestHeaders: HeadersInit = {
                   'Content-Type': 'application/json',
                   ...headers,
                 };
             
                 // Add Authorization header if required
                 if (requireAuth) {
                   const token = localStorage.getItem('adminToken');
                   
                   if (!token) {
                     router.push('/admin/login');
                     throw new Error('No authentication token found');
                   }
             
                   (requestHeaders as any)['Authorization'] = `Bearer ${token}`;
                 }
             
                 try {
                   const response = await fetch(url, {
                     credentials: 'include',
                     ...otherOptions,
                     headers: requestHeaders,
                   });
             
                   // Handle 401 responses by redirecting to login
                   if (response.status === 401 && requireAuth) {
                     localStorage.removeItem('adminToken');
                     router.push('/admin/login');
                     throw new Error('Authentication expired');
                   }
             
                   return response;
                 } catch (error) {
                   // If it's a network error or other fetch error, rethrow
                   throw error;
                 }
               }, [router]);
             
               return authenticatedFetch;
             }
export default useKeyboardShortcuts;