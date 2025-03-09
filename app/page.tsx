"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMobileMenu } from "@/hooks/use-mobile-menu"
import { useIsMobile } from "@/hooks/use-mobile"

export default function Home() {
  const { setIsOpen } = useMobileMenu()
  const isMobile = useIsMobile()

  const handleLearnMore = () => {
    setIsOpen(true)
  }

  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-3xl w-full text-center space-y-6">
        <motion.h1
          className="text-4xl md:text-6xl font-bold tracking-tight"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          Learn, build, grow,
        </motion.h1>
        <motion.h2
          className="text-2xl md:text-4xl font-semibold text-muted-foreground"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          somewhere between code and curiosity.
        </motion.h2>
        <motion.p
          className="text-lg text-muted-foreground mt-4 max-w-xl mx-auto"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          As a computer science student, I'm passionate about solving real-world problems and continuously improving my
          skills. I enjoy working across the full development cycle, from design to deployment, while always seeking
          opportunities to grow and evolve.
        </motion.p>

        {isMobile && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="mt-8"
          >
            <Button onClick={handleLearnMore} className="gap-2">
              Learn more <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

