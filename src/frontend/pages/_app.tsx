import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminErrorBoundary from '@/components/admin/AdminErrorBoundary';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  
  useEffect(() => {
    // Set Spanish locale for the application
    document.documentElement.lang = 'es-MX';
  }, []);

  // Wrap admin routes with AdminErrorBoundary
  if (router.pathname.startsWith('/admin')) {
    return (
      <AdminErrorBoundary>
        <Component {...pageProps} />
      </AdminErrorBoundary>
    );
  }

  return <Component {...pageProps} />;
}