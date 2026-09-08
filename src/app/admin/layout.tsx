// Admin routes use the AppShell directly in each page (role = ADMIN/SUPER_ADMIN)
// This layout is a minimal passthrough to avoid double nesting
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
