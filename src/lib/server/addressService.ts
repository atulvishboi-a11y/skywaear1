import type { CustomerAccount, CustomerAddress } from "@/data/rewardsEngine";
import { HttpError } from "@/lib/http";
import { sanitizeCustomer } from "./auth";
import { mutate, type ZeninState } from "./store";

const PINCODE = /^[1-9]\d{5}$/;
const MAX_ADDRESSES = 8;

export interface AddressInput {
  label?: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export interface AddressResult {
  customer: CustomerAccount;
  addresses: CustomerAddress[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function recordAudit(state: ZeninState, actor: string, action: string, details: string): void {
  state.auditLogs.unshift({
    id: `log-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    actor,
    action,
    details,
    at: nowIso(),
  });
  state.auditLogs = state.auditLogs.slice(0, 120);
}

function normalize(input: AddressInput): Omit<CustomerAddress, "isDefault"> {
  const label = (input.label ?? "").trim().slice(0, 24) || "Home";
  const street = (input.street ?? "").trim();
  const city = (input.city ?? "").trim();
  const state = (input.state ?? "").trim();
  const pincode = (input.pincode ?? "").trim();

  if (street.length < 8) throw new HttpError(422, "Please enter a complete street address (at least 8 characters).");
  if (!city) throw new HttpError(422, "City is required.");
  if (!state) throw new HttpError(422, "State is required.");
  if (!PINCODE.test(pincode)) throw new HttpError(422, "Enter a valid 6-digit Indian PIN code.");

  return {
    label,
    street: street.slice(0, 200),
    city: city.slice(0, 60),
    state: state.slice(0, 60),
    pincode,
  };
}

function requireCustomer(state: ZeninState, customerId: string): CustomerAccount {
  const customer = state.customers.find((c) => c.id === customerId);
  if (!customer) throw new HttpError(404, "Customer account not found.");
  if (!Array.isArray(customer.addresses)) customer.addresses = [];
  return customer;
}

function ensureDefault(addresses: CustomerAddress[]): void {
  if (addresses.length === 0) return;
  if (!addresses.some((address) => address.isDefault)) {
    addresses[0].isDefault = true;
  }
}

function result(customer: CustomerAccount): AddressResult {
  return {
    customer: sanitizeCustomer(customer),
    addresses: customer.addresses,
  };
}

export function addCustomerAddress(customerId: string, input: AddressInput): Promise<AddressResult> {
  const clean = normalize(input);
  return mutate((state) => {
    const customer = requireCustomer(state, customerId);
    if (customer.addresses.length >= MAX_ADDRESSES) {
      throw new HttpError(422, `You can save up to ${MAX_ADDRESSES} delivery addresses.`);
    }

    const makesDefault = Boolean(input.isDefault) || customer.addresses.length === 0;
    if (makesDefault) customer.addresses.forEach((address) => (address.isDefault = false));

    customer.addresses.push({ ...clean, isDefault: makesDefault });
    ensureDefault(customer.addresses);

    recordAudit(state, customer.name, "ADDRESS_ADDED", `${clean.label} address saved (${clean.city}, ${clean.pincode})`);
    return result(customer);
  });
}

export function updateCustomerAddress(
  customerId: string,
  index: number,
  input: Partial<AddressInput>
): Promise<AddressResult> {
  return mutate((state) => {
    const customer = requireCustomer(state, customerId);
    const current = customer.addresses[index];
    if (!current) throw new HttpError(404, "Address not found.");

    if (input.isDefault === true) {
      customer.addresses.forEach((address) => (address.isDefault = false));
      current.isDefault = true;
    }

    const hasAddressFields =
      input.street !== undefined ||
      input.city !== undefined ||
      input.state !== undefined ||
      input.pincode !== undefined ||
      input.label !== undefined;

    if (hasAddressFields) {
      const clean = normalize({
        label: input.label ?? current.label,
        street: input.street ?? current.street,
        city: input.city ?? current.city,
        state: input.state ?? current.state,
        pincode: input.pincode ?? current.pincode,
      });
      Object.assign(current, clean);
    }

    ensureDefault(customer.addresses);
    recordAudit(state, customer.name, "ADDRESS_UPDATED", `${current.label} address updated (${current.city}, ${current.pincode})`);
    return result(customer);
  });
}

export function removeCustomerAddress(customerId: string, index: number): Promise<AddressResult> {
  return mutate((state) => {
    const customer = requireCustomer(state, customerId);
    const target = customer.addresses[index];
    if (!target) throw new HttpError(404, "Address not found.");

    customer.addresses.splice(index, 1);
    ensureDefault(customer.addresses);

    recordAudit(state, customer.name, "ADDRESS_REMOVED", `${target.label} address removed (${target.city}, ${target.pincode})`);
    return result(customer);
  });
}
