
export interface User {
  id: string;
  email: string;
  firstName: string;
  secondName: string;
  lastName: string;
  fullName: string;
  taxId: string; // RUC/Cédula
  address?: string;
  phone?: string;
  companyName?: string;
  privacyAccepted: boolean;
  privacyTimestamp: string;
}

export interface InvoiceItem {
  id: string;
  ref: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  folio: string; // Factura N.
  systemNumber: string; // Número de Sistema (LADF)
  accessKey: string; // Clave de Acceso (49 dígitos)
  date: string;
  time: string;
  vendor: string;
  clientName: string;
  clientTaxId: string;
  supplier: string;
  total: number;
  tax: number;
  currency: string;
  status: 'PAGADA' | 'PENDIENTE' | 'CANCELADA';
  items: InvoiceItem[];
  pdfUrl?: string;
  xmlUrl?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}
