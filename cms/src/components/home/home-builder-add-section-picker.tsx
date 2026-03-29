"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@shared/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { cn } from "@shared/lib/utils"
import type { HomeSectionPreset } from "@/lib/home-page-service"
import { HomeBuilderPresetIcon } from "@/components/home/home-builder-icons"

type HomeBuilderAddSectionPickerProps = {
  presets: HomeSectionPreset[]
  onSelect: (preset: HomeSectionPreset) => void
  className?: string
  compact?: boolean
  label?: string
}

const categoryLabel: Record<HomeSectionPreset["category"], string> = {
  intro: "기본",
  structure: "구조",
  dynamic: "피드",
  cta: "CTA",
}

export function HomeBuilderAddSectionPicker({
  presets,
  onSelect,
  className,
  compact = false,
  label,
}: HomeBuilderAddSectionPickerProps) {
  const [open, setOpen] = useState(false)
  const groups = Object.entries(
    presets.reduce<Record<HomeSectionPreset["category"], HomeSectionPreset[]>>(
      (acc, preset) => {
        acc[preset.category].push(preset)
        return acc
      },
      { intro: [], structure: [], dynamic: [], cta: [] },
    ),
  ) as Array<[HomeSectionPreset["category"], HomeSectionPreset[]]>

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={compact ? "outline" : "default"}
          size={compact ? "icon" : "sm"}
          className={cn(compact ? "h-9 w-9" : "h-9", className)}
        >
          <Plus className="h-4 w-4" />
          {compact ? (
            <span className="sr-only">{label || "섹션 추가"}</span>
          ) : (
            <span>{label || "섹션 추가"}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[24rem] rounded-xl p-0 shadow-md">
        <Command>
          <div className="border-b px-4 py-3">
            <div className="text-sm font-semibold">블록 추가</div>
          </div>
          <CommandInput placeholder="섹션 검색" className="h-11" />
          <CommandList className="max-h-[22rem]">
            <CommandEmpty>추가할 섹션을 찾지 못했습니다.</CommandEmpty>
            {groups.map(([category, items], index) =>
              items.length > 0 ? (
                <div key={category}>
                  {index > 0 ? <CommandSeparator /> : null}
                  <CommandGroup heading={categoryLabel[category]}>
                    {items.map((preset) => (
                      <CommandItem
                        key={preset.id}
                        value={`${preset.label} ${preset.description} ${preset.type}`}
                        onSelect={() => {
                          onSelect(preset)
                          setOpen(false)
                        }}
                        className="items-start gap-3 rounded-md px-3 py-3"
                      >
                        <div className="mt-0.5 rounded-md border border-border/60 bg-background p-2">
                          <HomeBuilderPresetIcon preset={preset} className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{preset.label}</div>
                          <div className="mt-1 text-xs leading-5 text-muted-foreground">
                            {preset.description}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </div>
              ) : null,
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
