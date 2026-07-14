import Link from "next/link";
import { features } from "@/features";

export default function Home() {
  return (
    <div className="font-sans min-h-dvh flex flex-col items-center justify-center p-4 sm:p-16">
      <header className="mb-12 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Space Joops
        </h1>
        <p className="mt-3 text-sm sm:text-base text-black/60 dark:text-white/60">
          원하는 기능을 선택하세요
        </p>
      </header>

      <main className="grid w-full max-w-3xl grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {features.map((feature) => (
          <Link
            key={feature.id}
            href={`/features/${feature.id}`}
            className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-black/[.08] dark:border-white/[.145] p-8 transition-colors hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent"
          >
            <span className="text-3xl" aria-hidden>
              {feature.icon}
            </span>
            <span className="font-semibold text-base group-hover:underline underline-offset-4">
              {feature.title}
            </span>
            <span className="text-xs text-black/50 dark:text-white/50 text-center">
              {feature.description}
            </span>
          </Link>
        ))}
      </main>
    </div>
  );
}
