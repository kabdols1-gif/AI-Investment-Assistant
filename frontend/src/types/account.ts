/**
 * Account Types
 */

export interface AccountInfo {
  account_no: string;
  account_no_full: string;
  account_type: string;
  prod_code: string;
  is_vps: boolean;
  mode: string;
}

export interface Holding {
  stock_code: string;
  stock_name: string;
  quantity: number;
  orderable_quantity?: number;
  avg_price: number;
  current_price: number;
  purchase_amount?: number;
  eval_amount: number;
  financing_amount?: number;
  profit_loss: number;
  profit_rate: number;
  currency?: string;
}

export interface Balance {
  deposit: number;
  total_eval: number;
  purchase_amount: number;
  eval_amount: number;
  profit_loss: number;
  profit_rate?: number;
  withdrawable_amount?: number;
  next_withdrawable_amount?: number;
  margin_rate?: number;
  holdings?: Holding[];
  holdings_count?: number;
  account_no?: string;
  account_name?: string;
  product_code?: string;
  product_name?: string;
  fetched_at?: string;
  source?: string;
  raw_response_masked?: unknown;
  account_response_masked?: unknown;
  deposit_formatted?: string;
  total_eval_formatted?: string;
  profit_loss_formatted?: string;
}

export interface BuyableInfo {
  stock_code: string;
  price: number;
  amount: number;
  quantity: number;
  amount_formatted?: string;
}
