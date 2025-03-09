"use client"

import { useState, useEffect } from "react"

export function useProjects() {
  const [projects, setProjects] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function fetchProjects() {
      try {
        setIsLoading(true)
        const response = await fetch("/api/projects")

        if (!isMounted) return

        if (!response.ok) {
          throw new Error(`Failed to fetch projects: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()

        if (!isMounted) return

        if (data.error) {
          throw new Error(data.error)
        }

        setProjects(data)
        setError(null)
      } catch (err) {
        if (!isMounted) return
        console.error("Error fetching projects:", err)
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchProjects()

    return () => {
      isMounted = false
    }
  }, [])

  return { projects, isLoading, error }
}

