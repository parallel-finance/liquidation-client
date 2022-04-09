import loki from 'lokijs';
import { LiquidationBorrower } from '../types';
import { logger } from '../logger';

const liquidationStore = (filename?: string): Loki => {
  const db = new loki(filename ? filename : 'liquidation.json', {
    autosave: true,
    autosaveInterval: 100
  });

  const records = db.getCollection<LiquidationBorrower>('borrowers');
  if (!records) {
    db.addCollection<LiquidationBorrower>('borrowers');
    logger.debug('Database not found. Adding the borrowers collection.');
  } else {
    logger.debug('Reload Liquidation Database.');
  }

  return db;
};

export default liquidationStore;
