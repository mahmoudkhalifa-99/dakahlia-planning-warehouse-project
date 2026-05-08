import { Warehouse, MapPin } from 'lucide-react';
import React from 'react';

export interface WarehouseInfo {
  id: string;
  name: string;
  location: string;
  color: string;
}

export const WAREHOUSES: WarehouseInfo[] = [
  { 
    id: 'damas', 
    name: 'مخازن دماص', 
    location: 'دماص',
    color: 'blue'
  },
  { 
    id: 'sadat', 
    name: 'مخازن السادات', 
    location: 'السادات',
    color: 'emerald'
  },
  { 
    id: 'minia', 
    name: 'مخازن المنيا', 
    location: 'المنيا',
    color: 'orange'
  },
];
