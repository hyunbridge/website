import { Skeleton } from "@shared/components/ui/skeleton"

const bodyLineClass = "h-[calc(1em*1.5)]"
const quoteLineClass = "h-[calc(var(--content-quote-font-size)*1.5)]"
const heading2LineClass =
  "h-[calc(var(--content-heading-2-size)*var(--content-heading-line-height))]"
const heading3LineClass =
  "h-[calc(var(--content-heading-3-size)*var(--content-heading-line-height))]"
const metaLineClass = "h-5"

/** Reusable: H2 section heading followed by a full-width HR divider */
function SectionHeading({ width = "w-28" }: { width?: string }) {
  return (
    <div>
      <Skeleton
        className={`${heading2LineClass} ${width} mt-[var(--content-heading-2-margin-top)] mb-[calc(var(--content-rule-margin-block)+3px)]`}
      />
      <Skeleton className="h-px w-full" />
    </div>
  )
}

type SkillItemProps = {
  labelWidth: string
  valueWidth: string
}

function SkillItem({ labelWidth, valueWidth }: SkillItemProps) {
  return (
    <div className="flex items-start gap-[10px] py-[6px]">
      <Skeleton className="mt-[11px] h-2 w-2 rounded-full flex-shrink-0" />
      <Skeleton className={`${bodyLineClass} ${labelWidth}`} />
      <Skeleton className={`${bodyLineClass} ${valueWidth}`} />
    </div>
  )
}

/** Reusable: Experience / Project entry with two-column layout */
function EntryItem({
  bullets = 3,
  titleWidth = "w-[21rem]",
  subtitleWidth = "w-[30rem]",
}: {
  bullets?: number
  titleWidth?: string
  subtitleWidth?: string
}) {
  return (
    <div className="space-y-[10px]">
      {/* H3 title */}
      <Skeleton className={`${heading3LineClass} ${titleWidth}`} />
      {/* Subtitle */}
      <Skeleton className={`${bodyLineClass} ${subtitleWidth}`} />

      {/* Two-column layout: metadata left, bullet list right */}
      <div className="flex gap-8 pt-[6px]">
        {/* Left column — date, role, tech stack */}
        <div className="w-[30%] space-y-2 flex-shrink-0">
          <Skeleton className={`${bodyLineClass} w-36`} />
          <Skeleton className={`${bodyLineClass} w-28`} />
          <Skeleton className={`${bodyLineClass} w-48`} />
        </div>
        {/* Right column — bullet list */}
        <div className="flex-1">
          {Array.from({ length: bullets }).map((_, i) => (
            <div key={i} className="flex items-start gap-[10px] py-[6px]">
              <Skeleton className="mt-[11px] h-2 w-2 rounded-full flex-shrink-0" />
              <Skeleton className={`${bodyLineClass} ${i === bullets - 1 ? "w-4/5" : "w-full"}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Reusable: Callout box (used for Education, Certifications, Languages) */
function CalloutBox({ lines = 2 }: { lines?: number }) {
  return (
    <div className="flex items-start rounded-[3px] border p-[16px_16px_16px_12px]">
      {/* Icon placeholder */}
      <Skeleton className="h-6 w-6 flex-shrink-0 rounded-[3px]" />
      <div className="ml-2 space-y-1.5 flex-1">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={`${bodyLineClass} ${i === 0 ? "w-72" : i === 1 ? "w-40" : "w-32"}`}
          />
        ))}
      </div>
    </div>
  )
}

export function CVSkeleton() {
  const skillItems = [
    { labelWidth: "w-24", valueWidth: "w-44" },
    { labelWidth: "w-28", valueWidth: "w-44" },
    { labelWidth: "w-24", valueWidth: "w-40" },
    { labelWidth: "w-40", valueWidth: "w-20" },
    { labelWidth: "w-32", valueWidth: "w-40" },
    { labelWidth: "w-28", valueWidth: "w-80" },
    { labelWidth: "w-28", valueWidth: "w-24" },
  ]

  return (
    <div className="space-y-6">
      {/* Blockquote / Introduction */}
      <div className="space-y-1.5 border-l-[3px] border-muted-foreground/30 px-[0.9em] py-[0.2em]">
        <Skeleton className={`${quoteLineClass} w-[31%]`} />
        <Skeleton className={`${quoteLineClass} w-[46%]`} />
        <Skeleton className={`${quoteLineClass} w-[57%]`} />
      </div>

      {/* Skills Section */}
      <section>
        <SectionHeading width="w-20" />
        <div className="mt-4 pl-[1.7em]">
          {skillItems.map((item, i) => (
            <SkillItem key={i} labelWidth={item.labelWidth} valueWidth={item.valueWidth} />
          ))}
        </div>
      </section>

      {/* Experiences Section */}
      <section>
        <SectionHeading width="w-36" />
        <div className="mt-6 space-y-10">
          <EntryItem bullets={2} titleWidth="w-[21rem]" subtitleWidth="w-[32rem]" />
          <EntryItem bullets={4} titleWidth="w-[18rem]" subtitleWidth="w-[26rem]" />
        </div>
      </section>

      {/* Projects Section */}
      <section>
        <SectionHeading width="w-28" />
        <div className="mt-6 space-y-10">
          <EntryItem bullets={3} titleWidth="w-[18rem]" subtitleWidth="w-[28rem]" />
          <EntryItem bullets={2} titleWidth="w-[16rem]" subtitleWidth="w-[24rem]" />
          <EntryItem bullets={3} titleWidth="w-[19rem]" subtitleWidth="w-[29rem]" />
        </div>
      </section>

      {/* Education Section */}
      <section>
        <SectionHeading width="w-32" />
        <div className="mt-4 space-y-3">
          <CalloutBox lines={3} />
          <CalloutBox lines={2} />
        </div>
      </section>

      {/* Certifications Section */}
      <section>
        <SectionHeading width="w-40" />
        <div className="mt-4 space-y-3">
          <CalloutBox lines={2} />
        </div>
      </section>

      {/* Languages Section */}
      <section>
        <SectionHeading width="w-32" />
        <div className="mt-4 space-y-3">
          <CalloutBox lines={2} />
          <CalloutBox lines={3} />
        </div>
      </section>

      {/* Last updated */}
      <div className="pt-2">
        <Skeleton className={`${metaLineClass} w-48`} />
      </div>
    </div>
  )
}
