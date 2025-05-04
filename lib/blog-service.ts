import { supabase } from "@/lib/supabase"

export type Post = {
  id: string
  created_at: string
  updated_at: string
  title: string
  slug: string
  content: string
  author_id: string
  summary: string
  cover_image: string | null
  is_published: boolean
  published_at: string | null
  enable_comments: boolean
  tags?: Tag[]
  author?: {
    full_name: string
    avatar_url: string | null
  }
}

export type Tag = {
  id: string
  name: string
  slug: string
}

export type PostImage = {
  id: string
  post_id: string
  url: string
  created_at: string
}

export async function getBlogPostCount() {
  const { count, error } = await supabase.from("blog_posts").select("*", { count: "exact", head: true })

  if (error) {
    console.error("Error fetching blog post count:", error)
    return 0
  }

  return count || 0
}

export async function getRecentPosts(limit = 5) {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("id, title, slug, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Error fetching recent posts:", error)
    return []
  }

  return data || []
}

// Get posts with pagination
export async function getPosts(page = 1, pageSize = 10, isPublished = true) {
  const startIndex = (page - 1) * pageSize
  let query = supabase
    .from("posts")
    .select(
      `
      *,
      author:secure_profiles!author_id(id, full_name, avatar_url), 
      tags:post_tags(tag_id, tags(id, name, slug))
    `,
    )
    .order("created_at", { ascending: false })
    .range(startIndex, startIndex + pageSize - 1)

  if (isPublished) {
    query = query.eq("is_published", true)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching posts:", error)
    throw error
  }

  return data.map((post) => ({
    ...post,
    tags: post.tags.map((postTag) => ({
      id: postTag.tags.id,
      name: postTag.tags.name,
      slug: postTag.tags.slug,
    })),
  })) as Post[]
}

// Get a single post by slug
export async function getPostBySlug(slug: string) {
  const { data, error } = await supabase
    .from("posts")
    .select(
      `
    *,
    author:secure_profiles!author_id(id, full_name, avatar_url), 
    tags:post_tags(tag_id, tags(id, name, slug))
  `,
    )
    .eq("slug", slug)
    .single()

  if (error) {
    console.error("Error fetching post by slug:", error)
    throw error
  }

  return {
    ...data,
    tags: data.tags.map((postTag) => ({
      id: postTag.tags.id,
      name: postTag.tags.name,
      slug: postTag.tags.slug,
    })),
  } as Post
}

// Get a single post by ID
export async function getPostById(id: string) {
  const { data, error } = await supabase
    .from("posts")
    .select(
      `
    *,
    author:author_id(full_name, avatar_url),
    tags:post_tags(tag_id, tags(id, name, slug))
  `,
    )
    .eq("id", id)
    .single()

  if (error) {
    console.error("Error fetching post by id:", error)
    throw error
  }

  return {
    ...data,
    tags: data.tags.map((postTag) => ({
      id: postTag.tags.id,
      name: postTag.tags.name,
      slug: postTag.tags.slug,
    })),
  } as Post
}

// Get posts by tag slug
export async function getPostsByTag(tagSlug: string, page = 1, pageSize = 10) {
  const startIndex = (page - 1) * pageSize

  const { data: tagData, error: tagError } = await supabase.from("tags").select("id").eq("slug", tagSlug).single()

  if (tagError) {
    console.error("Error fetching tag:", tagError)
    throw tagError
  }

  const tagId = tagData.id

  const { data, error } = await supabase
    .from("posts")
    .select(
      `
    *,
    author:secure_profiles!author_id(id, full_name, avatar_url), 
    tags:post_tags(tag_id, tags(id, name, slug))
  `,
    )
    .in(
      "id",
      supabase
        .from("post_tags")
        .select("post_id")
        .eq("tag_id", tagId)
        .limit(pageSize)
        .range(startIndex, startIndex + pageSize - 1),
    )
    .eq("is_published", true)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching posts by tag:", error)
    throw error
  }

  return data.map((post) => ({
    ...post,
    tags: post.tags.map((postTag) => ({
      id: postTag.tags.id,
      name: postTag.tags.name,
      slug: postTag.tags.slug,
    })),
  })) as Post[]
}

// Get posts by tag ID (for admin)
export async function getPostsByTagId(tagId: string, page = 1, pageSize = 10, onlyPublished = true) {
  try {
    // First get the tag information
    const { data: tagData, error: tagError } = await supabase.from("tags").select("*").eq("id", tagId).single()

    if (tagError) throw tagError
    if (!tagData) throw new Error("Tag not found")

    // First get the list of post_ids corresponding to the tag
    const { data: postTagsData, error: postTagsError } = await supabase
      .from("post_tags")
      .select("post_id")
      .eq("tag_id", tagId)

    if (postTagsError) throw postTagsError
    
    // Return empty array if no post_ids are found
    if (!postTagsData || postTagsData.length === 0) {
      return { tag: tagData, posts: [] }
    }
    
    // Extract post_id list
    const postIds = postTagsData.map(pt => pt.post_id)
    
    // Get the posts corresponding to these post_ids
    let query = supabase
      .from("posts")
      .select("*, author:secure_profiles!author_id(id, full_name, avatar_url), tags:post_tags(tag_id, tags(id, name, slug))")

    if (onlyPublished) {
      query = query.eq("is_published", true)
    }

    const { data: posts, error } = await query
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (error) throw error

    // Format tag information
    const formattedPosts = posts.map((post) => ({
      ...post,
      tags: post.tags.map((postTag) => ({
        id: postTag.tags.id,
        name: postTag.tags.name,
        slug: postTag.tags.slug,
      })),
    }))

    return { tag: tagData, posts: formattedPosts }
  } catch (error) {
    console.error("Error fetching posts by tag ID:", error)
    throw error
  }
}

// Create a new post
export async function createPost(
  post: Omit<Post, "id" | "created_at" | "updated_at" | "author" | "tags">,
  tagIds: string[],
) {
  const { data, error } = await supabase
    .from("posts")
    .insert([
      {
        ...post,
      },
    ])
    .select()

  if (error) {
    console.error("Error creating post:", error)
    throw error
  }

  const newPost = data[0]

  // Create tag relations
  const tagRelations = tagIds.map((tagId) => ({
    post_id: newPost.id,
    tag_id: tagId,
  }))

  const { error: tagError } = await supabase.from("post_tags").insert(tagRelations)

  if (tagError) {
    console.error("Error adding tags to post:", tagError)
    throw tagError
  }

  return newPost as Post
}

// Update a post
export async function updatePost(
  id: string,
  post: Partial<Omit<Post, "id" | "created_at" | "updated_at" | "author" | "tags">>,
  tagIds?: string[],
  createVersion = false,
  userId?: string,
  changeDescription?: string,
) {
  const updates = {
    ...post,
    updated_at: new Date().toISOString(),
    published_at: post.is_published ? post.published_at || new Date().toISOString() : null,
  }

  // If version creation is enabled, create a version before updating
  if (createVersion && userId) {
    try {
      // Get the current post to create a version
      const { data: currentPost, error: fetchError } = await supabase.from("posts").select("*").eq("id", id).single()

      if (fetchError) {
        console.error("Error fetching current post for versioning:", fetchError)
      } else if (currentPost) {
        // Get the latest version number
        const { data: versions, error: versionsError } = await supabase
          .from("post_versions")
          .select("version_number")
          .eq("post_id", id)
          .order("version_number", { ascending: false })
          .limit(1)

        if (versionsError) {
          console.error("Error fetching versions:", versionsError)
        } else {
          const nextVersionNumber = versions && versions.length > 0 ? versions[0].version_number + 1 : 1

          // Create a new version
          const { error: createVersionError } = await supabase.from("post_versions").insert([
            {
              post_id: id,
              version_number: nextVersionNumber,
              title: currentPost.title,
              content: currentPost.content,
              summary: currentPost.summary,
              created_by: userId,
              change_description: changeDescription || `Version ${nextVersionNumber}`,
            },
          ])

          if (createVersionError) {
            console.error("Error creating version:", createVersionError)
          }
        }
      }
    } catch (error) {
      console.error("Error in version creation:", error)
    }
  }

  const { data, error } = await supabase.from("posts").update(updates).eq("id", id).select()

  if (error) {
    console.error("Error updating post:", error)
    throw error
  }

  // Update tags if provided
  if (tagIds !== undefined) {
    // First, remove all existing tag relations
    const { error: deleteError } = await supabase.from("post_tags").delete().eq("post_id", id)

    if (deleteError) {
      console.error("Error removing existing tags:", deleteError)
      throw deleteError
    }

    // Then add the new tag relations
    if (tagIds.length > 0) {
      const tagRelations = tagIds.map((tagId) => ({
        post_id: id,
        tag_id: tagId,
      }))

      const { error: tagError } = await supabase.from("post_tags").insert(tagRelations)

      if (tagError) {
        console.error("Error adding tags to post:", tagError)
        throw tagError
      }
    }
  }

  return data[0] as Post
}

// Delete a post
export async function deletePost(id: string): Promise<string[]> {
  try {
    // Get the post images before deleting the post
    const { data: images, error: imageError } = await supabase.from("post_images").select("url").eq("post_id", id)

    if (imageError) {
      console.error("Error fetching post images:", imageError)
      throw imageError
    }

    // Extract image URLs
    const imageUrls = images.map((image) => image.url)

    // Delete the post
    const { error } = await supabase.from("posts").delete().eq("id", id)

    if (error) {
      console.error("Error deleting post:", error)
      throw error
    }

    return imageUrls
  } catch (error) {
    console.error("Error in deletePost:", error)
    throw error
  }
}

// Get all tags
export async function getAllTags() {
  const { data, error } = await supabase.from("tags").select("*").order("name")

  if (error) {
    console.error("Error fetching tags:", error)
    throw error
  }

  return data as Tag[]
}

// Create a new tag
export async function createTag(name: string) {
  // Generate slug from name
  const slug = name
    .toLowerCase()
    .replace(/[^\w\s]/gi, "")
    .replace(/\s+/g, "-")

  const { data, error } = await supabase.from("tags").insert([{ name, slug }]).select()

  if (error) {
    console.error("Error creating tag:", error)
    throw error
  }

  return data[0] as Tag
}

// Update a tag
export async function updateTag(id: string, name: string): Promise<Tag> {
  // Create slug from tag name
  const slug = name
    .toLowerCase()
    .replace(/[^\w\s]/gi, "")
    .replace(/\s+/g, "-")

  const { data, error } = await supabase
    .from("tags")
    .update({ name, slug, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("Error updating tag:", error)
    throw new Error("Failed to update tag")
  }

  return data as Tag
}

// Delete a tag
export async function deleteTag(id: string) {
  const { error } = await supabase.from("tags").delete().eq("id", id)

  if (error) {
    console.error("Error deleting tag:", error)
    throw error
  }
}

// Record a post image
export async function recordPostImage(postId: string, url: string) {
  const { data, error } = await supabase
    .from("post_images")
    .insert([{ post_id: postId, url }])
    .select()

  if (error) {
    console.error("Error recording post image:", error)
    throw error
  }

  return data[0] as PostImage
}

// Get post versions
export async function getPostVersions(postId: string) {
  try {
    // 1. Run a simpler query to identify the cause of the error
    const { data, error } = await supabase
      .from("post_versions")
      .select("*, created_by")
      .eq("post_id", postId)
      .order("version_number", { ascending: false })

    if (error) {
      console.error("Error fetching post versions:", error)
      throw error
    }

    // If data is null or empty, return an empty array
    if (!data || data.length === 0) {
      return []
    }

    // 2. Get user information separately
    const userIds = data.filter((v) => v.created_by).map((v) => v.created_by)

    let creators = {}
    if (userIds.length > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, username, full_name")
        .in("id", userIds)

      if (!usersError && usersData) {
        creators = usersData.reduce((acc, user) => {
          acc[user.id] = user
          return acc
        }, {})
      } else if (usersError) {
        console.error("Error fetching version creators:", usersError)
      }
    }

    // 3. Connect user information to each version
    return data.map((version) => ({
      ...version,
      creator: version.created_by ? creators[version.created_by] || null : null,
    }))
  } catch (error) {
    console.error("Error in getPostVersions:", error, typeof error)
    // Add stack trace
    if (error instanceof Error) {
      console.error(error.stack)
    }
    throw error
  }
}

// Restore a post version
export async function restorePostVersion(postId: string, versionNumber: number, userId: string) {
  // Get the version to restore
  const { data: versionData, error: versionError } = await supabase
    .from("post_versions")
    .select("*")
    .eq("post_id", postId)
    .eq("version_number", versionNumber)
    .single()

  if (versionError) {
    console.error("Error fetching version to restore:", versionError)
    throw versionError
  }

  if (!versionData) {
    throw new Error(`Version ${versionNumber} not found for post ${postId}`)
  }

  // Update the post with the version data
  const { error: updateError } = await supabase
    .from("posts")
    .update({
      title: versionData.title,
      content: versionData.content,
      summary: versionData.summary,
    })
    .eq("id", postId)

  if (updateError) {
    console.error("Error updating post with version data:", updateError)
    throw updateError
  }

  // Create a new version to record the restore action
  const { data: versions, error: versionsQueryError } = await supabase
    .from("post_versions")
    .select("version_number")
    .eq("post_id", postId)
    .order("version_number", { ascending: false })
    .limit(1)

  if (versionsQueryError) {
    console.error("Error fetching versions:", versionsQueryError)
  } else {
    const nextVersionNumber = versions && versions.length > 0 ? versions[0].version_number + 1 : 1

    // Create a new version
    const { error: createVersionError } = await supabase.from("post_versions").insert([
      {
        post_id: postId,
        version_number: nextVersionNumber,
        title: versionData.title,
        content: versionData.content,
        summary: versionData.summary,
        created_by: userId,
        change_description: `Restored to version ${versionNumber}`,
      },
    ])

    if (createVersionError) {
      console.error("Error creating version:", createVersionError)
    }
  }
}

