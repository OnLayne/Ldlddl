export interface ServiceRecord {
  id: string; // Document ID
  serviceId: string; // Human readable ID like 253016
  status: string; // e.g. "Yönlendir", "Parçası Atölyeye Alındı", "Yerinde Bakım Yapıldı"
  
  customerType: string; // Bireysel, Kurumsal
  customerName: string;
  customerPhone1: string;
  customerPhone2?: string;
  customerCity: string;
  customerDistrict: string;
  customerAddress: string;
  customerTaxNo?: string;
  availableDate: string; // ISO string
  availableTimeStart: string; // HH:mm
  availableTimeEnd: string; // HH:mm
  
  deviceBrand: string;
  deviceType: string;
  deviceModel: string;
  deviceSerialNo?: string;
  faultDescription: string;
  warrantyYears: number;
  warrantyStartDate?: string;
  
  technicianName: string;
  operatorNote?: string;
  
  actionsTaken?: string;
  faultDiagnosis?: string;
  partsUsed?: string;
  repairPrice: number;
  repairEndDate?: string;
  
  customerSignature?: string; // data URI (Deprecated/Legacy)
  intakeSignature?: string; // data URI
  deliverySignature?: string; // data URI
  technicianSignature?: string; // data URI
  
  userId: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface ServiceLog {
  id: string;
  actionName: string;
  description: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  actor: string;
  method: string;
  status: string;
  amount: number;
  createdAt: string;
}

export interface Photo {
  id: string;
  url: string;
  createdAt: string;
}

export interface PdfLog {
  id: string;
  createdAt: string;
  operator: string;
  type: 'Intake' | 'Delivery';
}
