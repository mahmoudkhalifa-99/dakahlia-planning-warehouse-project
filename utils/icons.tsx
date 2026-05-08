
import React from 'react';
import * as LucideIcons from 'lucide-react';
import { Role } from '../types';

export const IconMap: Record<string, React.ElementType> = {
  ...(LucideIcons as any)
};

export const getIcon = (name: string): React.ElementType => {
  return IconMap[name] || LucideIcons.Circle;
};

export const iconNames = Object.keys(IconMap);

export const getRoleLabel = (role: Role): string => {
  const rolesMap: Record<string, string> = {
    admin: 'مدير النظام',
    system_supervisor: 'مشرف النظام',
    head_finished: 'رئيس قسم مخزن المنتج التام',
    head_raw: 'رئيس قسم مخزن الخامات',
    head_parts: 'رئيس قسم مخزن قطع الغيار',
    supervisor_finished: 'مشرف المنتج التام',
    supervisor_raw: 'مشرف الخامات',
    supervisor_parts: 'مشرف قطع الغيار',
    storekeeper_finished: 'أمين مخزن المنتج التام',
    storekeeper_raw: 'أمين مخزن الخامات',
    storekeeper_parts: 'أمين مخزن قطع الغيار',
    cashier: 'مسؤول مبيعات'
  };
  return rolesMap[role] || role;
};
