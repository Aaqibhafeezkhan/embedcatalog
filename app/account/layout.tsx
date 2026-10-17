import type { Metadata } from "next"

import { AccountGuard } from "components/account-guard"

export const metadata: Metadata = {
  title: "Account",
}

export default function AccountLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <AccountGuard>{children}</AccountGuard>
}
