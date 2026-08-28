export type BookingStatus = "requested" | "confirmed" | "in_progress" | "completed" | "cancelled";

export type BookingRecord = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  customer_note?: string | null;
  internal_note: string | null;
  cancelled_at?: string | null;
  created_at?: string;
  updated_at?: string;
  service: {
    id: string;
    name: string;
    duration_minutes: number;
    price_display_cents: number | null;
  };
  staff: {id: string; display_name: string};
};

export type OwnerBookingRecord = BookingRecord & {
  customer_user_id: string;
  customer_display_name: string;
  customer_email: string;
};

export type StaffBookingRecord = BookingRecord & {
  customer_display_name: string;
};

export type StaffProfileRecord = {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  service_ids: string[];
};

export type CustomerRecord = {
  id: string;
  display_name: string;
  email: string;
  is_active: boolean;
  booking_count: number;
  last_booking_at: string | null;
};

export type AuditLogRecord = {
  id: string;
  actor_user_id: string | null;
  actor_display_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

export const bookingStatuses: BookingStatus[] = [
  "requested",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
];

export const nextBookingStatuses: Record<BookingStatus, BookingStatus[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};

export const bookingStatusTone: Record<
  BookingStatus,
  "neutral" | "success" | "warning" | "info" | "danger"
> = {
  requested: "warning",
  confirmed: "info",
  in_progress: "success",
  completed: "neutral",
  cancelled: "danger",
};
