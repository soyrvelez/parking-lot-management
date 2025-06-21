import app from './app';
import { i18n } from '../shared/localization';

const PORT = process.env.PORT || 4000;

// Start server
const server = app.listen(PORT, () => {
  console.log(`=— ${i18n.t('system.server_started')}`);
  console.log(`=Í Puerto: ${PORT}`);
  console.log(`< Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`<å Estado: ${i18n.t('system.server_healthy')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log(`=Ñ ${i18n.t('system.shutdown_initiated')}`);
  server.close(() => {
    console.log(` ${i18n.t('system.shutdown_complete')}`);
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log(`=Ñ ${i18n.t('system.shutdown_initiated')}`);
  server.close(() => {
    console.log(` ${i18n.t('system.shutdown_complete')}`);
    process.exit(0);
  });
});

export default server;