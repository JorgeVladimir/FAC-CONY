
import { Invoice } from './types';

export const MOCK_INVOICES: Invoice[] = [
  {
    id: 'inv-18577',
    folio: '001-004-000018577',
    systemNumber: 'LADF-18577',
    accessKey: '2701202601179322484300120010040000185771234567818',
    date: '27/1/2026',
    time: '16:19:46',
    vendor: 'JOSTIN ALAVA',
    clientName: 'JAQUELINE JATIVA',
    clientTaxId: '1705821328',
    supplier: 'COMERCIALIZADORA ONI S.A.',
    total: 51.25,
    tax: 0.00,
    currency: 'USD',
    status: 'PAGADA',
    items: [
      { id: '4012285', ref: '4012285', description: 'ESTRUCTURA DE ARMAR', quantity: 1, unitPrice: 20.4, total: 20.43 },
      { id: 'F001', ref: 'F001', description: 'FUNDA', quantity: 1, unitPrice: 0.00, total: 0.00 },
      { id: '6024846', ref: '6024846', description: 'ESTUCHE DE GAFAS 24', quantity: 1, unitPrice: 1.04, total: 1.04 },
      { id: '6000351', ref: '6000351', description: 'RESALTADOR MG-AHM21', quantity: 2, unitPrice: 0.56, total: 1.13 },
      { id: '4001190', ref: '4001190', description: 'EXPRIMIDOR E-01-03', quantity: 1, unitPrice: 0.52, total: 0.52 },
      { id: '4010350', ref: '4010350', description: 'ALMOHADA PARA PIERN', quantity: 2, unitPrice: 3.39, total: 6.78 }
    ]
  },
  {
    id: 'inv-18580',
    folio: '001-004-000018580',
    systemNumber: 'LADF-18580',
    accessKey: '2801202601179322484300120010040000185801234567818',
    date: '28/1/2026',
    time: '10:05:12',
    vendor: 'JOSTIN ALAVA',
    clientName: 'JAQUELINE JATIVA',
    clientTaxId: '1705821328',
    supplier: 'COMERCIALIZADORA ONI S.A.',
    total: 12.50,
    tax: 1.50,
    currency: 'USD',
    status: 'PENDIENTE',
    items: [
      { id: '6019064', ref: '6019064', description: 'FUNDA BRILLOSA 2413', quantity: 6, unitPrice: 0.13, total: 0.78 }
    ]
  }
];
