import type { Metadata } from "next";
import { pageProvider } from "@/server/auth/session";
import { getOwnProvider } from "@/server/services/provider-self";
import { providerFormData } from "@/server/services/form-data";
import { ProviderForm, DEFAULT_SCHEDULE } from "@/components/domain/provider-form";
import { Documents } from "./documents";

export const metadata: Metadata = { title: "Профиль исполнителя", robots: { index: false } };

export default async function ProProfilePage() {
  const user = await pageProvider();
  const own = (await getOwnProvider(user))!;
  const p = own.provider;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <ProviderForm
        mode="edit"
        {...await providerFormData()}
        initial={{
          displayName: p.displayName,
          kind: p.kind as "person" | "company",
          headline: p.headline,
          bio: p.bio,
          primarySubcategoryId: p.primarySubcategoryId,
          subcategoryIds: own.subcategoryIds,
          districtId: p.districtId,
          radiusKm: p.radiusKm,
          worksCityWide: p.worksCityWide,
          experienceYears: p.experienceYears,
          priceFrom: p.priceFrom ? String(p.priceFrom) : "",
          phone: p.phone ?? "",
          telegram: p.telegram ?? "",
          showPhone: p.showPhone,
          avatarUrl: p.avatarUrl,
          coverUrl: p.coverUrl,
          schedule: p.schedule ?? DEFAULT_SCHEDULE,
        }}
      />
      <Documents docs={own.documents.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))} verification={p.verification} />
    </div>
  );
}
