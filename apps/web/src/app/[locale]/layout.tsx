import type {Metadata} from "next";
import {hasLocale, NextIntlClientProvider} from "next-intl";
import {getMessages, getTranslations} from "next-intl/server";
import {notFound} from "next/navigation";
import {routing} from "@/i18n/routing";
import "../globals.css";

export const metadata: Metadata = {
  title: "ServiceOps · Personal Portfolio Demo",
  description:
    "A personal, non-commercial booking and operations portfolio demo. No real services are sold or fulfilled, and no payment is accepted.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}>) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const messages = await getMessages();
  const common = await getTranslations({locale, namespace: "Common"});

  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body>
        <div role="note" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-amber-950">
          <p className="mx-auto max-w-6xl text-center text-xs leading-5 font-semibold">
            {common("fictionalData")}
          </p>
        </div>
        <a
          href="#main-content"
          className="fixed top-3 left-3 z-[100] -translate-y-20 rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white shadow-lg transition focus:translate-y-0"
        >
          {locale === "ko" ? "본문으로 건너뛰기" : "Skip to main content"}
        </a>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
