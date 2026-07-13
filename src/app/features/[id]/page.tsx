import Link from "next/link";
import { notFound } from "next/navigation";

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const featureId = Number(id);

  if (!Number.isInteger(featureId) || featureId < 1 || featureId > 9) {
    notFound();
  }

  return (
    <div className="font-sans min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl sm:text-3xl font-bold">기능 {featureId}</h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        아직 구현되지 않은 기능입니다.
      </p>
      <Link
        href="/"
        className="rounded-full border border-black/[.08] dark:border-white/[.145] px-5 h-10 flex items-center transition-colors hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm font-medium"
      >
        ← 메인으로 돌아가기
      </Link>
    </div>
  );
}
