import { UserPermissions, Role } from '../../types';

export const getDefaultPermissions = (role: Role): UserPermissions => {
  const base: UserPermissions = {
    screens: {
        sb_home: 'available'
    },
    features: {},
    actions: {
      canImport: false,
      canExport: false,
      canDelete: false,
      canEditSettings: false,
      canManageCloudLists: false,
    },
  };

  switch (role) {
    case 'admin':
      return {
        screens: {
          sb_home: 'edit', sb_purchases: 'edit', sb_sales: 'edit', sb_finished: 'edit',
          sb_raw: 'edit', sb_general: 'edit', sb_monthly_reports: 'edit', sb_settings: 'edit',
          sb_expenses: 'edit', m_dashboard: 'edit', sb_minia_production: 'edit',
          sb_minia_reports: 'edit', sb_minia_warehouses: 'edit'
        },
        features: {
          // Sales
          sale_pulse: 'edit', sale_list: 'edit', sale_search: 'edit', sale_add: 'edit',
          sale_item_with: 'edit', sale_cust_with: 'edit', sale_daily: 'edit', sale_reports: 'edit',
          // Monthly Reports
          rep_items: 'edit', rep_clients: 'edit', rep_transport: 'edit', rep_eff_load: 'edit',
          rep_eff_unload: 'edit', rep_best: 'edit',
          // Purchases
          pur_add: 'edit', pur_list: 'edit', pur_receive: 'edit', pur_return: 'edit', pur_reports: 'edit',
          // Finished
          fin_in: 'edit', fin_sale: 'edit', fin_period: 'edit', fin_bal: 'edit',
          fin_stocktaking: 'edit', fin_return: 'edit', fin_unfinished: 'edit', fin_adj: 'edit',
          fin_import_feed: 'edit', fin_import_biotech: 'edit',
          // Raw
          raw_daily_in: 'edit', raw_sale: 'edit', raw_in: 'edit', raw_pur: 'edit',
          raw_control: 'edit', raw_silo: 'edit', raw_period: 'edit', raw_all_rep: 'edit',
          raw_wh_out: 'edit', raw_short: 'edit', raw_wh_trans: 'edit', raw_wh_adj: 'edit',
          raw_silo_adj: 'edit', raw_return: 'edit', raw_bal: 'edit',
          // General
          gen_parts: 'edit', gen_cat: 'edit', gen_cust: 'edit',
          // Expenses
          exp_add: 'edit', exp_delete: 'edit',
          // Parts
          p_bal: 'edit', p_pur: 'edit', p_in: 'edit', p_out: 'edit', p_rep: 'edit',
          p_trans_in: 'edit', p_trans_out: 'edit', p_period: 'edit', p_return: 'edit',
          p_adj_minus: 'edit', p_adj_plus: 'edit',
          // Catering
          c_bal: 'edit', c_pur: 'edit', c_in: 'edit', c_out: 'edit', c_trans_to: 'edit',
          c_trans_from: 'edit', c_return: 'edit', c_period: 'edit', c_adj_plus: 'edit',
          c_adj_minus: 'edit',
          // Minia Features
          m_prod_view: 'edit', m_prod_add: 'edit', m_prod_edit: 'edit',
          m_rep_daily: 'edit', m_rep_period: 'edit', m_rep_stats: 'edit',
          m_wh_bal: 'edit', m_wh_move: 'edit', rep_sector_consumption: 'edit'
        },
        actions: {
          canImport: true, canExport: true, canDelete: true, canEditSettings: true, canManageCloudLists: true
        }
      };

    case 'system_supervisor':
      return {
        screens: {
          sb_home: 'edit', sb_purchases: 'edit', sb_sales: 'edit', sb_finished: 'edit',
          sb_raw: 'edit', sb_general: 'edit', sb_monthly_reports: 'edit', sb_settings: 'available',
          sb_expenses: 'edit', m_dashboard: 'edit'
        },
        features: {
          // Sales
          sale_pulse: 'edit', sale_list: 'edit', sale_search: 'edit', sale_add: 'edit',
          sale_item_with: 'edit', sale_cust_with: 'edit', sale_daily: 'edit', sale_reports: 'edit',
          // Monthly Reports
          rep_items: 'edit', rep_clients: 'edit', rep_transport: 'edit', rep_eff_load: 'edit',
          rep_eff_unload: 'edit', rep_best: 'edit',
          // Purchases
          pur_add: 'edit', pur_list: 'edit', pur_receive: 'edit', pur_return: 'edit', pur_reports: 'edit',
          // Finished
          fin_in: 'edit', fin_sale: 'edit', fin_period: 'edit', fin_bal: 'edit',
          fin_stocktaking: 'edit', fin_return: 'edit', fin_unfinished: 'edit', fin_adj: 'edit',
          fin_import_feed: 'edit', fin_import_biotech: 'edit',
          // Raw
          raw_daily_in: 'edit', raw_sale: 'edit', raw_in: 'edit', raw_pur: 'edit',
          raw_control: 'edit', raw_silo: 'edit', raw_period: 'edit', raw_all_rep: 'edit',
          raw_wh_out: 'edit', raw_short: 'edit', raw_wh_trans: 'edit', raw_wh_adj: 'edit',
          raw_silo_adj: 'edit', raw_return: 'edit', raw_bal: 'edit',
          // General
          gen_parts: 'edit', gen_cat: 'edit', gen_cust: 'edit',
          // Expenses
          exp_add: 'edit', exp_delete: 'available',
          // Parts
          p_bal: 'edit', p_pur: 'edit', p_in: 'edit', p_out: 'edit', p_rep: 'edit',
          p_trans_in: 'edit', p_trans_out: 'edit', p_period: 'edit', p_return: 'edit',
          p_adj_minus: 'edit', p_adj_plus: 'edit',
          // Catering
          c_bal: 'edit', c_pur: 'edit', c_in: 'edit', c_out: 'edit', c_trans_to: 'edit',
          c_trans_from: 'edit', c_return: 'edit', c_period: 'edit', c_adj_plus: 'edit',
          c_adj_minus: 'edit',
          // Sector Consumption
          rep_sector_consumption: 'edit'
        },
        actions: {
          canImport: true, canExport: true, canDelete: false, canEditSettings: false, canManageCloudLists: true
        }
      };

    case 'head_finished':
      return {
        screens: {
          sb_home: 'edit', sb_finished: 'edit', sb_monthly_reports: 'available', sb_expenses: 'available',
          sb_general: 'available', sb_sales: 'available', sb_purchases: 'available'
        },
        features: {
          fin_bal: 'edit', fin_in: 'edit', fin_adj: 'edit', fin_return: 'edit',
          fin_stocktaking: 'edit', fin_sale: 'available', fin_period: 'available',
          fin_unfinished: 'edit', fin_import_feed: 'edit', fin_import_biotech: 'edit',
          sale_reports: 'available', pur_list: 'available', exp_add: 'available'
        },
        actions: { canImport: true, canExport: true, canDelete: false, canEditSettings: false, canManageCloudLists: false }
      };

    case 'head_raw':
      return {
        screens: {
          sb_home: 'edit', sb_raw: 'edit', sb_monthly_reports: 'available', sb_expenses: 'available',
          sb_general: 'available', sb_purchases: 'available'
        },
        features: {
          raw_in: 'edit', raw_silo: 'edit', raw_control: 'edit', raw_short: 'edit',
          raw_bal: 'edit', raw_period: 'available', raw_daily_in: 'available',
          raw_wh_adj: 'edit', raw_silo_adj: 'edit', raw_wh_out: 'edit',
          raw_wh_trans: 'edit', raw_return: 'edit', raw_all_rep: 'available', exp_add: 'available'
        },
        actions: { canImport: true, canExport: true, canDelete: false, canEditSettings: false, canManageCloudLists: false }
      };

    case 'head_parts':
      return {
        screens: {
          sb_home: 'edit', sb_general: 'edit', sb_purchases: 'available', sb_expenses: 'available'
        },
        features: {
          gen_parts: 'edit', gen_cat: 'edit', gen_cust: 'edit', pur_list: 'available',
          p_bal: 'edit', p_in: 'edit', p_out: 'edit', p_rep: 'available', p_period: 'available',
          exp_add: 'available'
        },
        actions: { canImport: true, canExport: true, canDelete: false, canEditSettings: false, canManageCloudLists: false }
      };

    case 'supervisor_finished':
      return {
        screens: { sb_home: 'edit', sb_finished: 'edit', sb_expenses: 'available', sb_monthly_reports: 'available' },
        features: { 
          fin_bal: 'edit', fin_in: 'edit', fin_return: 'edit', fin_adj: 'available',
          fin_sale: 'available', fin_period: 'available'
        },
        actions: { canImport: false, canExport: true, canDelete: false, canEditSettings: false, canManageCloudLists: false }
      };

    case 'storekeeper_finished':
      return {
        screens: { sb_home: 'edit', sb_finished: 'edit' },
        features: { fin_in: 'edit', fin_return: 'edit', fin_bal: 'available' },
        actions: { canImport: false, canExport: false, canDelete: false, canEditSettings: false, canManageCloudLists: false }
      };

    case 'supervisor_raw':
      return {
        screens: { sb_home: 'edit', sb_raw: 'edit', sb_expenses: 'available', sb_monthly_reports: 'available' },
        features: { 
          raw_in: 'edit', raw_silo: 'edit', raw_control: 'edit', raw_short: 'available',
          raw_bal: 'available', raw_period: 'available'
        },
        actions: { canImport: false, canExport: true, canDelete: false, canEditSettings: false, canManageCloudLists: false }
      };

    case 'storekeeper_raw':
      return {
        screens: { sb_home: 'edit', sb_raw: 'edit' },
        features: { raw_in: 'edit', raw_silo: 'edit', raw_bal: 'available' },
        actions: { canImport: false, canExport: false, canDelete: false, canEditSettings: false, canManageCloudLists: false }
      };

    case 'supervisor_parts':
      return {
        screens: { sb_home: 'edit', sb_general: 'edit', sb_expenses: 'available', sb_monthly_reports: 'available' },
        features: { gen_parts: 'edit', gen_cat: 'edit', gen_cust: 'available', p_bal: 'available' },
        actions: { canImport: false, canExport: true, canDelete: false, canEditSettings: false, canManageCloudLists: false }
      };

    case 'storekeeper_parts':
      return {
        screens: { sb_home: 'edit', sb_general: 'edit' },
        features: { gen_parts: 'edit', gen_cust: 'available', p_bal: 'available' },
        actions: { canImport: false, canExport: false, canDelete: false, canEditSettings: false, canManageCloudLists: false }
      };

    case 'cashier':
      return {
        screens: { sb_home: 'edit', sb_sales: 'edit' },
        features: { 
          sale_add: 'edit', sale_search: 'available', sale_list: 'available', 
          sale_reports: 'available', sale_daily: 'available'
        },
        actions: { canImport: false, canExport: true, canDelete: false, canEditSettings: false, canManageCloudLists: false }
      };

    default:
      return base;
  }
};
