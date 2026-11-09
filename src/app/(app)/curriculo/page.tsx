import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ResumeOnboarding, ResumeWorkspace } from "@/components/resume/resume-workspace";
import { SkeletonCard } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";
import { isAiConfigured } from "@/server/ai/client";
import { requireUser } from "@/server/auth/dal";
import { getActiveResume, listResumeVersions } from "@/server/repositories/resumes";

export const metadata: Metadata = { title: "Meu currículo" };

async function ResumeContent() {
  const user = await requireUser();
  const [resume, versions] = await Promise.all([getActiveResume(user.id), listResumeVersions(user.id)]);
  const aiConfigured = isAiConfigured();

  if (!resume) return <ResumeOnboarding aiConfigured={aiConfigured} />;

  return (
    <ResumeWorkspace
      aiConfigured={aiConfigured}
      resume={{
        id: resume.id,
        version: resume.version,
        sourceType: resume.sourceType,
        sourceFileName: resume.sourceFileName,
        sourceFileSize: resume.sourceFileSize,
        data: resume.data,
        warnings: resume.warnings,
        createdAtLabel: formatDateTime(resume.createdAt),
      }}
      versions={versions.map((version) => ({
        id: version.id,
        version: version.version,
        isActive: version.isActive,
        sourceType: version.sourceType,
        sourceFileName: version.sourceFileName,
        createdAtLabel: formatDateTime(version.createdAt),
        jobsCount: version.jobsCount,
      }))}
    />
  );
}

export default function ResumePage() {
  return (
    <>
      <PageHeader
        title="Meu currículo"
        description="A fonte oficial das suas informações. Toda personalização parte daqui e nunca altera esta versão."
      />
      <Suspense
        fallback={
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <SkeletonCard lines={8} />
            <SkeletonCard lines={6} />
          </div>
        }
      >
        <ResumeContent />
      </Suspense>
    </>
  );
}
