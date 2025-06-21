import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="es-MX">
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Sistema de Estacionamiento</title>
      </Head>
      <body className="bg-gray-50 font-sans antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}