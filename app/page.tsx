"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export default function Home() {

  // Common transition settings for card effects
  const cardTransition = {
    type: "spring",
    stiffness: 300,
    damping: 25,
    duration: 0.2
  }

  return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background to-muted/10 flex flex-col">
        <div className="container px-4 mx-auto py-4 flex-grow flex flex-col">
          <motion.div
              className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 md:gap-6 auto-rows-fr h-full flex-grow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
          >
            {/* Main title card */}
            <motion.div
                className="col-span-2 sm:col-span-4 md:col-span-3 row-span-2 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-3xl p-8 flex items-center justify-center relative"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                whileHover={{ 
                  scale: 1.03, 
                  zIndex: 10,
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.03)",
                  filter: "contrast(1.02)"
                }}
                whileTap={{ scale: 1.01 }}
                transition={cardTransition}
            >
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-center">
                Hyungyo
                <br />
                Seo
              </h1>
            </motion.div>

            {/* About Me */}
            <motion.div
                className="col-span-2 sm:col-span-4 md:col-span-3 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-3xl p-6 flex flex-col justify-between relative"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                whileHover={{ 
                  scale: 1.03, 
                  zIndex: 10,
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.03)",
                  filter: "contrast(1.02)"
                }}
                whileTap={{ scale: 1.01 }}
                transition={cardTransition}
            >
              <div>
                <h2 className="text-2xl font-bold mb-2">About Me</h2>
                <p className="text-muted-foreground mb-4">
                  As a computer science student, I'm passionate about solving real-world problems and continuously improving
                  my skills. I enjoy working across the full development cycle, from design to deployment, while always
                  seeking opportunities to grow and evolve.
                </p>
              </div>
            </motion.div>

            {/* Projects */}
            <motion.div
                className="col-span-1 sm:col-span-2 md:col-span-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 rounded-3xl p-6 flex flex-col justify-between relative"
                initial={{ y: 20, opacity: 0, boxShadow: "none" }}
                animate={{ y: 0, opacity: 1, boxShadow: "none" }}
                whileHover={{ 
                  scale: 1.03, 
                  zIndex: 10,
                  boxShadow: "0 15px 20px -5px rgba(59, 130, 246, 0.15), 0 8px 8px -5px rgba(59, 130, 246, 0.08)",
                  filter: "contrast(1.03)"
                }}
                whileTap={{ scale: 1.01 }}
                transition={cardTransition}
            >
              <div>
                <h2 className="text-2xl font-bold mb-2">Projects</h2>
                <p className="text-muted-foreground mb-4">Explore my latest work and contributions</p>
              </div>
              <Link
                  href="/projects"
                  className="inline-flex items-center gap-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-800/40 transition-colors px-4 py-2 rounded-lg font-medium"
              >
                View Projects <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>

            {/* Blog */}
            <motion.div
                className="col-span-1 sm:col-span-2 md:col-span-2 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 rounded-3xl p-6 flex flex-col justify-between relative"
                initial={{ y: 20, opacity: 0, boxShadow: "none" }}
                animate={{ y: 0, opacity: 1, boxShadow: "none" }}
                whileHover={{ 
                  scale: 1.03, 
                  zIndex: 10,
                  boxShadow: "0 15px 20px -5px rgba(139, 92, 246, 0.15), 0 8px 8px -5px rgba(139, 92, 246, 0.08)",
                  filter: "contrast(1.03)"
                }}
                whileTap={{ scale: 1.01 }}
                transition={cardTransition}
            >
              <div>
                <h2 className="text-2xl font-bold mb-2">Blog</h2>
                <p className="text-muted-foreground mb-4">Thoughts, tutorials, and insights</p>
              </div>
              <Link
                  href="/blog"
                  className="inline-flex items-center gap-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-800/40 transition-colors px-4 py-2 rounded-lg font-medium"
              >
                Read Articles <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>

            {/* Resume */}
            <motion.div
                className="col-span-1 sm:col-span-2 md:col-span-2 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20 rounded-3xl p-6 flex flex-col justify-between relative"
                initial={{ y: 20, opacity: 0, boxShadow: "none" }}
                animate={{ y: 0, opacity: 1, boxShadow: "none" }}
                whileHover={{ 
                  scale: 1.03, 
                  zIndex: 10,
                  boxShadow: "0 15px 20px -5px rgba(217, 119, 6, 0.15), 0 8px 8px -5px rgba(217, 119, 6, 0.08)",
                  filter: "contrast(1.03)"
                }}
                whileTap={{ scale: 1.01 }}
                transition={cardTransition}
            >
              <div>
                <h2 className="text-2xl font-bold mb-2">Resume</h2>
                <p className="text-muted-foreground mb-4">My experience and qualifications</p>
              </div>
              <Link
                  href="/cv"
                  className="inline-flex items-center gap-2 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-800/40 transition-colors px-4 py-2 rounded-lg font-medium"
              >
                View CV <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>

            {/* Contact */}
            <motion.div
                className="col-span-1 sm:col-span-2 md:col-span-2 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 rounded-3xl p-6 flex flex-col justify-between relative"
                initial={{ y: 20, opacity: 0, boxShadow: "none" }}
                animate={{ y: 0, opacity: 1, boxShadow: "none" }}
                whileHover={{ 
                  scale: 1.03, 
                  zIndex: 10,
                  boxShadow: "0 15px 20px -5px rgba(34, 197, 94, 0.15), 0 8px 8px -5px rgba(34, 197, 94, 0.08)",
                  filter: "contrast(1.03)"
                }}
                whileTap={{ scale: 1.01 }}
                transition={cardTransition}
            >
              <div>
                <h2 className="text-2xl font-bold mb-2">Get in Touch</h2>
                <p className="text-muted-foreground mb-4">I'd love to hear from you!</p>
              </div>
              <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-800/40 transition-colors px-4 py-2 rounded-lg font-medium"
              >
                Contact Me <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>
  )
}
