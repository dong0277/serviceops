import {StaffShell} from "@/components/staff/staff-shell";

export default function StaffLayout({children}: {children: React.ReactNode}) {
  return <StaffShell>{children}</StaffShell>;
}
