"use client";

import { useI18n } from "@/lib/i18n";
import type { TranslationSection } from "@/lib/i18n";

export default function T({
  section,
  k,
  values,
}: {
  section: TranslationSection;
  k: string;
  values?: Record<string, string | number>;
}) {
  const { t } = useI18n();
  let text = t(section, k);
  if (values) {
    for (const [key, val] of Object.entries(values)) {
      text = text.replace(`{${key}}`, String(val));
    }
  }
  return <>{text}</>;
}
