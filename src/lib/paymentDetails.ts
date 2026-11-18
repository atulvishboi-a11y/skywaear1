import type { BankAccount } from "@/data/rewardsEngine";

/** Shared payout-detail validation and masking. Safe for client and server. */

export const BANK_ACCOUNT_REGEX = /^\d{9,18}$/;
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const UPI_ID_REGEX = /^[a-zA-Z0-9.\-_]{2,100}@[a-zA-Z0-9.\-_]{2,64}$/;

export function normalizeAccountNumber(value: string): string {
  return (value || "").replace(/\D/g, "");
}

export function normalizeIfsc(value: string): string {
  return (value || "").replace(/\s/g, "").toUpperCase();
}

export function normalizeUpiId(value: string): string {
  return (value || "").trim().toLowerCase();
}

export function ifscBankCode(ifsc: string): string {
  return normalizeIfsc(ifsc).slice(0, 4);
}

/**
 * Same account digits at the same bank are the same payout destination; the same
 * digits at another bank are not. IFSC's first four letters identify the bank.
 */
export function bankIdentityKey(ifsc: string, accountNumber: string): string {
  return `${ifscBankCode(ifsc)}:${normalizeAccountNumber(accountNumber)}`;
}

export function accountLast4(accountNumber: string): string {
  return normalizeAccountNumber(accountNumber).slice(-4);
}

export function maskAccount(accountOrLast4: string): string {
  const digits = normalizeAccountNumber(accountOrLast4);
  const last4 = digits.length > 4 ? digits.slice(-4) : digits.padStart(4, "•");
  return `••••••••${last4}`;
}

export function bankAccountLast4(bank: Partial<BankAccount>): string {
  return bank.accountNumberLast4 || accountLast4(bank.accountNumber || "");
}

export function maskedPendingAccount(pending: NonNullable<BankAccount["pendingUpdate"]>): string {
  const last4 = pending.accountNumberLast4 || accountLast4(pending.accountNumber || "");
  return maskAccount(last4);
}

/**
 * Build the copy that leaves the server. Full account numbers and ciphertext
 * never reach the client; only last four digits and a display mask remain.
 */
export function maskBankAccountForClient(bank: BankAccount): BankAccount {
  const last4 = bankAccountLast4(bank);
  const pending = bank.pendingUpdate
    ? {
        accountHolderName: bank.pendingUpdate.accountHolderName,
        ifscCode: bank.pendingUpdate.ifscCode,
        bankName: bank.pendingUpdate.bankName,
        requestedAt: bank.pendingUpdate.requestedAt,
        accountNumberLast4:
          bank.pendingUpdate.accountNumberLast4 || accountLast4(bank.pendingUpdate.accountNumber || ""),
        maskedAccountNumber: maskedPendingAccount(bank.pendingUpdate),
      }
    : undefined;

  return {
    id: bank.id,
    accountHolderName: bank.accountHolderName,
    ifscCode: bank.ifscCode,
    bankName: bank.bankName,
    isDefault: bank.isDefault,
    verified: bank.verified,
    addedAt: bank.addedAt,
    status: bank.status,
    accountNumberLast4: last4,
    maskedAccountNumber: last4 ? maskAccount(last4) : "••••••••",
    pendingUpdate: pending,
  };
}
