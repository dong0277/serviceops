import * as rootParams from "next/root-params";
import {hasLocale} from "next-intl";
import {getRequestConfig} from "next-intl/server";
import {notFound} from "next/navigation";
import {routing} from "./routing";

export default getRequestConfig(async ({locale}) => {
  if (!locale) {
    const candidate = await rootParams.locale();
    if (hasLocale(routing.locales, candidate)) {
      locale = candidate;
    } else {
      notFound();
    }
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
