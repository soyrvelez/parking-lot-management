import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { useEffect } from 'react';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Set Spanish locale for the application
    document.documentElement.lang = 'es-MX';
  }, []);

  return <Component {...pageProps} />;
}