import { useEffect, useState } from "react"

type ResourceState<T> = {
  data: T | null
  error: string | null
  isLoading: boolean
}

export function useResource<T>(loader: () => Promise<T>, deps: unknown[] = []): ResourceState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isActive = true

    setIsLoading(true)
    setError(null)

    loader()
      .then((nextData) => {
        if (!isActive) return
        setData(nextData)
      })
      .catch((nextError: Error) => {
        if (!isActive) return
        setError(nextError.message)
      })
      .finally(() => {
        if (!isActive) return
        setIsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, deps)

  return { data, error, isLoading }
}
