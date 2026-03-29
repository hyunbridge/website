"use client"

import type { MouseEvent, ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"

export function HomeSectionReveal({
	children,
	id,
	className,
  delay = 0,
  amount = 0.16,
}: {
  children: ReactNode
  id?: string
  className?: string
  delay?: number
  amount?: number
}) {
	const prefersReducedMotion = useReducedMotion()
	const isServer = typeof window === "undefined"

	if (isServer || prefersReducedMotion) {
		return (
			<section id={id} className={className}>
				{children}
      </section>
    )
  }

  return (
    <motion.section
      id={id}
      className={className}
      initial={{ opacity: 0, y: 48, scale: 0.97, filter: "blur(14px)" }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      viewport={{ once: true, amount: Math.max(amount, 0.18) }}
      transition={{ type: "spring", stiffness: 180, damping: 22, mass: 0.9, delay }}
    >
      {children}
    </motion.section>
  )
}

export function HomeAmbientCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={className}>{children}</div>
}

export function HomeHoverLift({
	children,
	className,
}: {
	children: ReactNode
	className?: string
}) {
	const prefersReducedMotion = useReducedMotion()
	const isServer = typeof window === "undefined"

	if (isServer || prefersReducedMotion) {
		return <div className={className}>{children}</div>
	}

  return (
    <motion.div
      className={className}
      whileHover={{ y: -6, scale: 1.012 }}
      transition={{ type: "spring", stiffness: 260, damping: 22, mass: 0.75 }}
    >
      {children}
    </motion.div>
  )
}

export function HomeScrollCue({ href }: { href: string }) {
	const prefersReducedMotion = useReducedMotion()
	const isServer = typeof window === "undefined"
	const targetId = href.startsWith("#") ? href.slice(1) : null

	if (isServer) {
		return (
			<a
				href={href}
				className="group inline-flex h-10 w-10 items-center justify-center text-muted-foreground/70 transition-colors hover:text-foreground"
				aria-label="다음 섹션으로 스크롤"
			>
				<span className="flex items-center justify-center">
					<ChevronDown className="h-5 w-5" />
				</span>
			</a>
		)
	}

	const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
		if (!targetId) return

    const target = document.getElementById(targetId)
    if (!target) return

    event.preventDefault()
    target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group inline-flex h-10 w-10 items-center justify-center text-muted-foreground/70 transition-colors hover:text-foreground"
      aria-label="다음 섹션으로 스크롤"
    >
      <motion.span
        className="flex items-center justify-center"
        animate={prefersReducedMotion ? undefined : { y: [0, 3, 0] }}
        transition={
          prefersReducedMotion
            ? undefined
            : { duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
        }
      >
        <ChevronDown className="h-5 w-5" />
      </motion.span>
    </button>
  )
}
