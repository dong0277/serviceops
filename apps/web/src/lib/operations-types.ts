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

export type ServiceRecord = {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_display_cents: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OwnerDashboardRecord = {
  timezone: string;
  today: string;
  period_days: number;
  period_start: string;
  period_end: string;
  today_booking_count: number;
  period_booking_count: number;
  completion_rate: number;
  cancellation_count: number;
  requested_count: number;
  status_counts: {status: BookingStatus; count: number}[];
  service_counts: {service_id: string; service_name: string; count: number}[];
  staff_workload: {staff_profile_id: string; staff_display_name: string; count: number}[];
  today_schedule: OwnerBookingRecord[];
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
