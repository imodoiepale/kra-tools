export interface Company {
  id: string | number;
  company_name: string;
  kra_pin: string;
  [key: string]: any;
}

export interface ChecklistItem {
  company_name: string;
  kra_pin?: string;
  file_management: {
    [year: string]: {
      [month: string]: {
        broughtBy?: string;
        receivedAt?: string;
        isNil?: boolean;
        filesDelivered?: boolean;
        deliveredAt?: string;
        deliveredTo?: string;
        notes?: string;
        [key: string]: any;
      }
    }
  };
  [key: string]: any;
}

export interface MonthlyTableProps {
  clients: Company[];
  checklist: Record<string, ChecklistItem>;
  selectedDate: Date;
  updateClientStatus: (
    companyName: string,
    year: string,
    month: string,
    status: Record<string, any>,
    kraPin: string
  ) => Promise<void>;
}
