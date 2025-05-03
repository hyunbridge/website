-- Supabase Schema Setup
-- This script sets up the complete database schema for the application,
-- including tables, relationships, indexes, functions, triggers, and Row Level Security (RLS) policies.

-- Section 1: Extensions
-- -----------------------------------------
-- Enable the uuid-ossp extension if it's not already enabled.
-- This extension provides functions to generate UUIDs.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Section 2: Functions
-- -----------------------------------------
-- Function to automatically update the 'updated_at' timestamp on row modification.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW(); -- Set the updated_at column to the current timestamp
RETURN NEW; -- Return the modified row
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- SECURITY DEFINER allows the function to run with the permissions of the user who defined it.

-- Function to automatically create a user profile when a new user signs up in Supabase Auth.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a new row into the public.profiles table
INSERT INTO public.profiles (id, username, full_name, avatar_url)
VALUES (
           NEW.id, -- Use the user's ID from auth.users
           NEW.email, -- Use the user's email as the initial username (can be updated later)
           NEW.raw_user_meta_data->>'full_name', -- Get full_name from user metadata if available
           NEW.raw_user_meta_data->>'avatar_url' -- Get avatar_url from user metadata if available
       );
RETURN NEW; -- Return the new user row
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- SECURITY DEFINER is necessary to insert into public.profiles from the auth trigger.

-- Section 3: Tables
-- -----------------------------------------

-- Profiles Table: Stores user profile information, linked to Supabase Auth users.
CREATE TABLE IF NOT EXISTS public.profiles (
                                               id uuid NOT NULL, -- Primary Key, references auth.users.id
                                               username text NOT NULL, -- Unique username for the profile
                                               full_name text NULL, -- User's full name (optional)
                                               avatar_url text NULL, -- URL for the user's avatar image (optional)
                                               created_at timestamp with time zone NOT NULL DEFAULT now(), -- Timestamp of profile creation
    updated_at timestamp with time zone NOT NULL DEFAULT now(), -- Timestamp of last profile update

-- Constraints
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_username_key UNIQUE (username),
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE -- If the auth user is deleted, delete the profile too
    ) TABLESPACE pg_default;

COMMENT ON TABLE public.profiles IS 'Stores user profile information linked to Supabase Auth.';

-- Posts Table: Stores blog post content and metadata.
CREATE TABLE IF NOT EXISTS public.posts (
                                            id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(), -- Primary Key, auto-generated UUID
    created_at timestamp with time zone NOT NULL DEFAULT now(), -- Timestamp of post creation
    updated_at timestamp with time zone NOT NULL DEFAULT now(), -- Timestamp of last post update
    title text NOT NULL, -- Title of the blog post
    slug text NOT NULL, -- Unique, URL-friendly identifier for the post
    content text NOT NULL, -- Main content of the blog post (e.g., Markdown, HTML)
    author_id uuid NOT NULL, -- Foreign Key referencing the author's profile
    summary text NOT NULL, -- A short summary or excerpt of the post
    cover_image text NULL, -- URL for the post's cover image (optional)
    is_published boolean NOT NULL DEFAULT false, -- Flag indicating if the post is publicly visible
    published_at timestamp with time zone NULL, -- Timestamp when the post was published (NULL if not published)
                             enable_comments boolean NOT NULL DEFAULT true, -- Flag to enable/disable comments on the post

                             -- Constraints
                             CONSTRAINT posts_pkey PRIMARY KEY (id),
    CONSTRAINT posts_slug_key UNIQUE (slug),
    CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE -- If the author's profile is deleted, delete their posts too
    ) TABLESPACE pg_default;

COMMENT ON TABLE public.posts IS 'Stores blog post content and metadata.';

-- Tags Table: Stores tags that can be applied to posts.
CREATE TABLE IF NOT EXISTS public.tags (
                                           id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(), -- Primary Key, auto-generated UUID
    name text NOT NULL, -- Unique name of the tag
    slug text NOT NULL, -- Unique, URL-friendly identifier for the tag
    created_at timestamp with time zone NOT NULL DEFAULT now(), -- Timestamp of tag creation

-- Constraints
    CONSTRAINT tags_pkey PRIMARY KEY (id),
    CONSTRAINT tags_name_key UNIQUE (name),
    CONSTRAINT tags_slug_key UNIQUE (slug)
    ) TABLESPACE pg_default;

COMMENT ON TABLE public.tags IS 'Stores tags that can be applied to posts.';

-- Post_Tags Table: Junction table for the many-to-many relationship between posts and tags.
CREATE TABLE IF NOT EXISTS public.post_tags (
                                                id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(), -- Primary Key for the relationship itself (optional, composite key below is sufficient)
    post_id uuid NOT NULL, -- Foreign Key referencing the post
    tag_id uuid NOT NULL, -- Foreign Key referencing the tag
    created_at timestamp with time zone NOT NULL DEFAULT now(), -- Timestamp when the tag was associated with the post

-- Constraints
    CONSTRAINT post_tags_pkey PRIMARY KEY (id), -- Optional primary key for the junction row
    CONSTRAINT post_tags_post_id_tag_id_key UNIQUE (post_id, tag_id), -- Ensure a tag is associated with a post only once
    CONSTRAINT post_tags_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE, -- If the post is deleted, remove the association
    CONSTRAINT post_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE -- If the tag is deleted, remove the association
    ) TABLESPACE pg_default;

COMMENT ON TABLE public.post_tags IS 'Junction table linking posts and tags (many-to-many).';

-- Post_Images Table: Stores URLs of images associated with a specific post.
CREATE TABLE IF NOT EXISTS public.post_images (
                                                  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(), -- Primary Key, auto-generated UUID
    post_id uuid NOT NULL, -- Foreign Key referencing the post the image belongs to
    url text NOT NULL, -- URL of the image
    created_at timestamp with time zone NOT NULL DEFAULT now(), -- Timestamp when the image was associated

-- Constraints
    CONSTRAINT post_images_pkey PRIMARY KEY (id),
    CONSTRAINT post_images_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE -- If the post is deleted, remove associated image records
    ) TABLESPACE pg_default;

COMMENT ON TABLE public.post_images IS 'Stores URLs of images uploaded for or embedded within a specific post.';

-- Post_Versions Table: Tracks the history of changes made to posts.
CREATE TABLE IF NOT EXISTS public.post_versions (
                                                    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(), -- Primary Key for the version record
    post_id uuid NOT NULL, -- Foreign Key referencing the post being versioned
    version_number integer NOT NULL, -- Sequential version number for the post
    title text NOT NULL, -- Post title at this version
    content text NOT NULL, -- Post content at this version
    summary text NOT NULL, -- Post summary at this version
    created_at timestamp with time zone NOT NULL DEFAULT now(), -- Timestamp when this version was created
    created_by uuid NOT NULL, -- Foreign Key referencing the user (from auth.users) who created this version
    change_description text NULL, -- Optional description of changes made in this version

-- Constraints
    CONSTRAINT post_versions_pkey PRIMARY KEY (id),
    CONSTRAINT post_versions_post_id_version_number_key UNIQUE (post_id, version_number), -- Ensure version numbers are unique per post
    CONSTRAINT post_versions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE, -- If the post is deleted, delete its versions
    CONSTRAINT post_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL -- Keep version history even if the creating user is deleted
    ) TABLESPACE pg_default;

COMMENT ON TABLE public.post_versions IS 'Tracks the history of changes (versions) for each blog post.';


-- Section 4: Indexes
-- -----------------------------------------
-- Indexes improve query performance by allowing the database to find rows faster.

-- Indexes for 'profiles' table
-- No additional indexes beyond PK and UNIQUE constraints needed for typical profile lookups.

-- Indexes for 'posts' table
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts USING btree (author_id) TABLESPACE pg_default; -- For finding posts by author
CREATE INDEX IF NOT EXISTS idx_posts_slug ON public.posts USING btree (slug) TABLESPACE pg_default; -- For finding posts by slug (already unique, but index helps)
CREATE INDEX IF NOT EXISTS idx_posts_published ON public.posts USING btree (is_published, published_at DESC) TABLESPACE pg_default; -- For efficiently querying published posts, ordered by publish date

-- Indexes for 'tags' table
CREATE INDEX IF NOT EXISTS idx_tags_slug ON public.tags USING btree (slug) TABLESPACE pg_default; -- For finding tags by slug (already unique)

-- Indexes for 'post_tags' table
CREATE INDEX IF NOT EXISTS idx_post_tags_post_id ON public.post_tags USING btree (post_id) TABLESPACE pg_default; -- For finding tags associated with a post
CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id ON public.post_tags USING btree (tag_id) TABLESPACE pg_default; -- For finding posts associated with a tag

-- Indexes for 'post_images' table
CREATE INDEX IF NOT EXISTS idx_post_images_post_id ON public.post_images USING btree (post_id) TABLESPACE pg_default; -- For finding images associated with a post

-- Indexes for 'post_versions' table
CREATE INDEX IF NOT EXISTS idx_post_versions_post_id ON public.post_versions USING btree (post_id) TABLESPACE pg_default; -- For finding versions of a specific post
CREATE INDEX IF NOT EXISTS idx_post_versions_version_number ON public.post_versions USING btree (post_id, version_number DESC) TABLESPACE pg_default; -- For ordering versions of a post

-- Section 5: Triggers
-- -----------------------------------------
-- Triggers automatically execute functions in response to table events (INSERT, UPDATE, DELETE).

-- Trigger for 'profiles' table to update 'updated_at' timestamp on update.
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for 'posts' table to update 'updated_at' timestamp on update.
CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to create a profile when a new user is added to Supabase Auth.
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Section 6: Row Level Security (RLS) Policies
-- -----------------------------------------
-- RLS policies control which rows users are allowed to query or modify.

-- RLS for 'profiles' table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
                                    USING (true); -- Anyone can view any profile

CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id); -- A user can only insert a profile for themselves

CREATE POLICY "Users can update their own profile."
  ON public.profiles FOR UPDATE
                                           USING (auth.uid() = id) -- A user can only update their own profile
                         WITH CHECK (auth.uid() = id);

-- RLS for 'posts' table
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published posts are viewable by everyone, authors view all their posts."
  ON public.posts FOR SELECT
                                 USING (is_published = true OR auth.uid() = author_id); -- View if published OR if you are the author

CREATE POLICY "Users can insert their own posts."
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = author_id); -- A user can only insert posts as themselves

CREATE POLICY "Users can update their own posts."
  ON public.posts FOR UPDATE
                                        USING (auth.uid() = author_id) -- A user can only update their own posts
                      WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can delete their own posts."
  ON public.posts FOR DELETE
USING (auth.uid() = author_id); -- A user can only delete their own posts

-- RLS for 'tags' table
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tags are viewable by everyone."
  ON public.tags FOR SELECT
                                USING (true); -- Anyone can view tags

CREATE POLICY "Authenticated users can insert tags." -- Consider restricting this further based on roles if needed
  ON public.tags FOR INSERT
  WITH CHECK (auth.role() = 'authenticated'); -- Any logged-in user can create tags

CREATE POLICY "Authenticated users can update tags." -- Consider restricting this further
  ON public.tags FOR UPDATE
                                       USING (auth.role() = 'authenticated')
                     WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete tags." -- Consider restricting this further
  ON public.tags FOR DELETE
USING (auth.role() = 'authenticated');

-- RLS for 'post_tags' table
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Post tag associations are viewable by everyone."
  ON public.post_tags FOR SELECT
                                     USING (true); -- Anyone can see which tags are linked to which posts

CREATE POLICY "Users can insert tags for their own posts."
  ON public.post_tags FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS ( -- Check if the user owns the post they are adding a tag to
      SELECT 1 FROM public.posts
      WHERE posts.id = post_tags.post_id AND posts.author_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete tags from their own posts."
  ON public.post_tags FOR DELETE
USING (
    auth.role() = 'authenticated' AND
    EXISTS ( -- Check if the user owns the post they are removing a tag from
      SELECT 1 FROM public.posts
      WHERE posts.id = post_tags.post_id AND posts.author_id = auth.uid()
    )
  );

-- RLS for 'post_images' table
ALTER TABLE public.post_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Post images are viewable by everyone." -- Assumes image URLs might be public anyway
  ON public.post_images FOR SELECT
                                       USING (true);

CREATE POLICY "Users can insert images for their own posts."
  ON public.post_images FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS ( -- Check if the user owns the post they are adding an image to
      SELECT 1 FROM public.posts
      WHERE posts.id = post_images.post_id AND posts.author_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete images from their own posts."
  ON public.post_images FOR DELETE
USING (
    auth.role() = 'authenticated' AND
    EXISTS ( -- Check if the user owns the post they are removing an image from
      SELECT 1 FROM public.posts
      WHERE posts.id = post_images.post_id AND posts.author_id = auth.uid()
    )
  );

-- RLS for 'post_versions' table
ALTER TABLE public.post_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can view versions of their own posts."
  ON public.post_versions FOR SELECT
                                         USING (
                                         EXISTS ( -- Check if the current user is the author of the corresponding post
                                         SELECT 1 FROM public.posts
                                         WHERE posts.id = post_versions.post_id
                                         AND posts.author_id = auth.uid() -- Only allow the author
                                         )
                                         );

CREATE POLICY "Authors can insert versions for their own posts."
  ON public.post_versions FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    -- Ensure the 'created_by' field in the data being inserted matches the current user
    created_by = auth.uid() AND
    -- Check if the current user is the author of the post being versioned
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_versions.post_id AND posts.author_id = auth.uid()
    )
  );

CREATE POLICY "Authors can delete versions of their own posts."
  ON public.post_versions FOR DELETE
USING (
    auth.role() = 'authenticated' AND
    -- Check if the current user is the author of the post whose version is being deleted
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_versions.post_id AND posts.author_id = auth.uid()
    )
  );

COMMENT ON TABLE public.post_versions IS 'Tracks the history of changes (versions) for each blog post. RLS allows authors to insert/delete versions and view versions of their own posts.';
