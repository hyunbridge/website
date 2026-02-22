-- Supabase Schema Setup
-- This script sets up the complete database schema for the application,
-- including tables, relationships, indexes, functions, triggers, and Row Level Security (RLS) policies.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ------------------------------------------------------------------
-- Functions
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------
-- Shared user profile
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  username text NOT NULL,
  full_name text NULL,
  avatar_url text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_username_key UNIQUE (username),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.profiles IS 'Application profiles linked to auth.users.';

-- ------------------------------------------------------------------
-- Content model v2 (versioned)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_items (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  type text NOT NULL,
  owner_id uuid NULL,
  slug text NULL,
  title text NOT NULL,
  summary text NULL,
  cover_image text NULL,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamp with time zone NULL,
  current_version_id uuid NULL,
  published_version_id uuid NULL,
  source text NOT NULL DEFAULT 'supabase',
  source_ref text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT content_items_pkey PRIMARY KEY (id),
  CONSTRAINT content_items_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT content_items_type_check CHECK (type IN ('post', 'project', 'page')),
  CONSTRAINT content_items_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

COMMENT ON TABLE public.content_items IS 'Core metadata shared by all content types.';
COMMENT ON COLUMN public.content_items.slug IS 'Globally unique slug when present.';
COMMENT ON COLUMN public.content_items.source_ref IS 'Optional upstream reference (e.g., Notion page ID).';

CREATE TABLE IF NOT EXISTS public.content_versions (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  content_item_id uuid NOT NULL,
  version_number integer NOT NULL,
  snapshot_status text NOT NULL DEFAULT 'draft',
  body_format text NOT NULL DEFAULT 'html',
  title text NOT NULL,
  summary text NULL,
  body_text text NULL,
  body_json jsonb NULL,
  rendered_html text NULL,
  created_by uuid NULL,
  change_description text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT content_versions_pkey PRIMARY KEY (id),
  CONSTRAINT content_versions_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES public.content_items(id) ON DELETE CASCADE,
  CONSTRAINT content_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT content_versions_item_version_key UNIQUE (content_item_id, version_number),
  CONSTRAINT content_versions_body_format_check CHECK (body_format IN ('html', 'markdown', 'json')),
  CONSTRAINT content_versions_snapshot_status_check CHECK (snapshot_status IN ('draft', 'published', 'archived'))
);

COMMENT ON TABLE public.content_versions IS 'Version snapshots for content items.';
COMMENT ON COLUMN public.content_versions.body_text IS 'Primary body for html/markdown.';
COMMENT ON COLUMN public.content_versions.body_json IS 'Structured editor document when using json.';
COMMENT ON COLUMN public.content_versions.rendered_html IS 'Optional render cache.';

ALTER TABLE public.content_items
  DROP CONSTRAINT IF EXISTS content_items_current_version_id_fkey;
ALTER TABLE public.content_items
  ADD CONSTRAINT content_items_current_version_id_fkey
  FOREIGN KEY (current_version_id) REFERENCES public.content_versions(id) ON DELETE SET NULL;

ALTER TABLE public.content_items
  DROP CONSTRAINT IF EXISTS content_items_published_version_id_fkey;
ALTER TABLE public.content_items
  ADD CONSTRAINT content_items_published_version_id_fkey
  FOREIGN KEY (published_version_id) REFERENCES public.content_versions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.content_tags (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT content_tags_pkey PRIMARY KEY (id),
  CONSTRAINT content_tags_name_key UNIQUE (name),
  CONSTRAINT content_tags_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.content_item_tags (
  content_item_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT content_item_tags_pkey PRIMARY KEY (content_item_id, tag_id),
  CONSTRAINT content_item_tags_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES public.content_items(id) ON DELETE CASCADE,
  CONSTRAINT content_item_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.content_tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.content_links (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  content_item_id uuid NOT NULL,
  label text NOT NULL,
  url text NOT NULL,
  link_type text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT content_links_pkey PRIMARY KEY (id),
  CONSTRAINT content_links_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES public.content_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.assets (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  owner_id uuid NULL,
  asset_type text NOT NULL DEFAULT 'image',
  storage_provider text NOT NULL DEFAULT 's3',
  bucket text NULL,
  object_key text NOT NULL,
  public_url text NOT NULL,
  mime_type text NULL,
  size_bytes bigint NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT assets_pkey PRIMARY KEY (id),
  CONSTRAINT assets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT assets_storage_provider_check CHECK (storage_provider IN ('s3'))
);

CREATE TABLE IF NOT EXISTS public.content_version_assets (
  content_version_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  usage_type text NOT NULL DEFAULT 'embedded',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT content_version_assets_pkey PRIMARY KEY (content_version_id, asset_id, usage_type),
  CONSTRAINT content_version_assets_content_version_id_fkey FOREIGN KEY (content_version_id) REFERENCES public.content_versions(id) ON DELETE CASCADE,
  CONSTRAINT content_version_assets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE,
  CONSTRAINT content_version_assets_usage_type_check CHECK (usage_type IN ('embedded', 'cover'))
);

CREATE TABLE IF NOT EXISTS public.asset_deletion_queue (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  asset_id uuid NOT NULL,
  object_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
  locked_at timestamp with time zone NULL,
  last_error text NULL,
  processed_at timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT asset_deletion_queue_pkey PRIMARY KEY (id),
  CONSTRAINT asset_deletion_queue_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE,
  CONSTRAINT asset_deletion_queue_asset_id_key UNIQUE (asset_id),
  CONSTRAINT asset_deletion_queue_status_check CHECK (status IN ('pending', 'processing', 'failed', 'completed'))
);

CREATE TABLE IF NOT EXISTS public.post_contents (
  content_item_id uuid NOT NULL,
  enable_comments boolean NOT NULL DEFAULT true,
  canonical_url text NULL,
  CONSTRAINT post_contents_pkey PRIMARY KEY (content_item_id),
  CONSTRAINT post_contents_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES public.content_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.project_contents (
  content_item_id uuid NOT NULL,
  featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  start_date date NULL,
  end_date date NULL,
  is_ongoing boolean NOT NULL DEFAULT false,
  role text NULL,
  organization text NULL,
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT project_contents_pkey PRIMARY KEY (content_item_id),
  CONSTRAINT project_contents_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES public.content_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.page_contents (
  content_item_id uuid NOT NULL,
  page_key text NOT NULL,
  route_path text NOT NULL,
  is_singleton boolean NOT NULL DEFAULT true,
  CONSTRAINT page_contents_pkey PRIMARY KEY (content_item_id),
  CONSTRAINT page_contents_page_key_key UNIQUE (page_key),
  CONSTRAINT page_contents_route_path_key UNIQUE (route_path),
  CONSTRAINT page_contents_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES public.content_items(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.content_tags IS 'Reusable tags across content types.';
COMMENT ON TABLE public.content_links IS 'Ordered links for content items.';
COMMENT ON TABLE public.assets IS 'Canonical uploaded assets (files/images) stored in object storage.';
COMMENT ON TABLE public.content_version_assets IS 'Associates assets to specific content versions.';
COMMENT ON TABLE public.asset_deletion_queue IS 'Outbox queue for asynchronous asset deletion from object storage.';
COMMENT ON TABLE public.post_contents IS 'Post-specific fields.';
COMMENT ON TABLE public.project_contents IS 'Project-specific fields.';
COMMENT ON TABLE public.page_contents IS 'Singleton/static pages like CV.';

-- ------------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_items_slug_unique
  ON public.content_items (slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_type_status
  ON public.content_items (type, status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_items_owner
  ON public.content_items (owner_id);

CREATE INDEX IF NOT EXISTS idx_content_versions_item_created
  ON public.content_versions (content_item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_versions_item_version
  ON public.content_versions (content_item_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_content_item_tags_tag
  ON public.content_item_tags (tag_id);

CREATE INDEX IF NOT EXISTS idx_content_links_item_sort
  ON public.content_links (content_item_id, sort_order ASC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_object_key_unique
  ON public.assets (object_key);

CREATE INDEX IF NOT EXISTS idx_assets_owner_created
  ON public.assets (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_version_assets_asset
  ON public.content_version_assets (asset_id);

CREATE INDEX IF NOT EXISTS idx_content_version_assets_version
  ON public.content_version_assets (content_version_id);

CREATE INDEX IF NOT EXISTS idx_asset_deletion_queue_status_next_attempt
  ON public.asset_deletion_queue (status, next_attempt_at ASC);

CREATE INDEX IF NOT EXISTS idx_project_contents_featured_sort
  ON public.project_contents (featured DESC, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_page_contents_route_path
  ON public.page_contents (route_path);

-- ------------------------------------------------------------------
-- Triggers
-- ------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_content_items_updated_at ON public.content_items;
CREATE TRIGGER update_content_items_updated_at
  BEFORE UPDATE ON public.content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------
-- Security view
-- ------------------------------------------------------------------
CREATE OR REPLACE VIEW public.secure_profiles AS
SELECT p.id, p.full_name, p.avatar_url
FROM public.profiles p;

GRANT SELECT ON public.secure_profiles TO authenticated, anon;

COMMENT ON VIEW public.secure_profiles IS 'Public-safe profile fields only.';

-- ------------------------------------------------------------------
-- Basic RLS
-- ------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_item_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_version_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_deletion_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_contents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only view their own profile." ON public.profiles;
CREATE POLICY "Users can only view their own profile."
  ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can update their own profile."
  ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Public can read published content; owners read own content." ON public.content_items;
CREATE POLICY "Public can read published content; owners read own content."
  ON public.content_items FOR SELECT
  USING (status = 'published' OR auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can insert content items." ON public.content_items;
CREATE POLICY "Owners can insert content items."
  ON public.content_items FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update content items." ON public.content_items;
CREATE POLICY "Owners can update content items."
  ON public.content_items FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete content items." ON public.content_items;
CREATE POLICY "Owners can delete content items."
  ON public.content_items FOR DELETE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Readers can read owned or published-linked versions." ON public.content_versions;
CREATE POLICY "Readers can read owned or published-linked versions."
  ON public.content_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.content_items ci
      WHERE ci.id = content_versions.content_item_id
        AND (ci.owner_id = auth.uid() OR (ci.status = 'published' AND ci.published_version_id = content_versions.id))
    )
  );

DROP POLICY IF EXISTS "Owners can insert versions." ON public.content_versions;
CREATE POLICY "Owners can insert versions."
  ON public.content_versions FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND EXISTS (
      SELECT 1 FROM public.content_items ci
      WHERE ci.id = content_versions.content_item_id AND ci.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can update versions." ON public.content_versions;
CREATE POLICY "Owners can update versions."
  ON public.content_versions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.content_items ci
      WHERE ci.id = content_versions.content_item_id AND ci.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.content_items ci
      WHERE ci.id = content_versions.content_item_id AND ci.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can delete versions." ON public.content_versions;
CREATE POLICY "Owners can delete versions."
  ON public.content_versions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.content_items ci
      WHERE ci.id = content_versions.content_item_id AND ci.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tags are viewable by everyone." ON public.content_tags;
CREATE POLICY "Tags are viewable by everyone."
  ON public.content_tags FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage tags." ON public.content_tags;
CREATE POLICY "Authenticated users can manage tags."
  ON public.content_tags FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Content item tags are viewable by everyone." ON public.content_item_tags;
CREATE POLICY "Content item tags are viewable by everyone."
  ON public.content_item_tags FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners can manage content item tags." ON public.content_item_tags;
CREATE POLICY "Owners can manage content item tags."
  ON public.content_item_tags FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = content_item_tags.content_item_id AND ci.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = content_item_tags.content_item_id AND ci.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Content links are viewable by everyone." ON public.content_links;
CREATE POLICY "Content links are viewable by everyone."
  ON public.content_links FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners can manage content links." ON public.content_links;
CREATE POLICY "Owners can manage content links."
  ON public.content_links FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = content_links.content_item_id AND ci.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = content_links.content_item_id AND ci.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Assets are viewable by owners." ON public.assets;
CREATE POLICY "Assets are viewable by owners."
  ON public.assets FOR SELECT
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can manage assets." ON public.assets;
CREATE POLICY "Owners can manage assets."
  ON public.assets FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Version asset refs are viewable by owners and published readers." ON public.content_version_assets;
CREATE POLICY "Version asset refs are viewable by owners and published readers."
  ON public.content_version_assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.content_versions cv
      JOIN public.content_items ci ON ci.id = cv.content_item_id
      WHERE cv.id = content_version_assets.content_version_id
        AND (ci.owner_id = auth.uid() OR ci.status = 'published')
    )
  );

DROP POLICY IF EXISTS "Owners can manage version asset refs." ON public.content_version_assets;
CREATE POLICY "Owners can manage version asset refs."
  ON public.content_version_assets FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.content_versions cv
      JOIN public.content_items ci ON ci.id = cv.content_item_id
      WHERE cv.id = content_version_assets.content_version_id
        AND ci.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.content_versions cv
      JOIN public.content_items ci ON ci.id = cv.content_item_id
      WHERE cv.id = content_version_assets.content_version_id
        AND ci.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can view asset deletion queue for owned assets." ON public.asset_deletion_queue;
CREATE POLICY "Owners can view asset deletion queue for owned assets."
  ON public.asset_deletion_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.assets a
      WHERE a.id = asset_deletion_queue.asset_id
        AND a.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can manage asset deletion queue for owned assets." ON public.asset_deletion_queue;
CREATE POLICY "Owners can manage asset deletion queue for owned assets."
  ON public.asset_deletion_queue FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.assets a
      WHERE a.id = asset_deletion_queue.asset_id
        AND a.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.assets a
      WHERE a.id = asset_deletion_queue.asset_id
        AND a.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Subtype tables are viewable by everyone." ON public.post_contents;
CREATE POLICY "Subtype tables are viewable by everyone."
  ON public.post_contents FOR SELECT USING (true);
DROP POLICY IF EXISTS "Owners can manage post subtype." ON public.post_contents;
CREATE POLICY "Owners can manage post subtype."
  ON public.post_contents FOR ALL
  USING (EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = post_contents.content_item_id AND ci.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = post_contents.content_item_id AND ci.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Project subtype viewable by everyone." ON public.project_contents;
CREATE POLICY "Project subtype viewable by everyone."
  ON public.project_contents FOR SELECT USING (true);
DROP POLICY IF EXISTS "Owners can manage project subtype." ON public.project_contents;
CREATE POLICY "Owners can manage project subtype."
  ON public.project_contents FOR ALL
  USING (EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = project_contents.content_item_id AND ci.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = project_contents.content_item_id AND ci.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Page subtype viewable by everyone." ON public.page_contents;
CREATE POLICY "Page subtype viewable by everyone."
  ON public.page_contents FOR SELECT USING (true);
DROP POLICY IF EXISTS "Owners can manage page subtype." ON public.page_contents;
CREATE POLICY "Owners can manage page subtype."
  ON public.page_contents FOR ALL
  USING (EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = page_contents.content_item_id AND ci.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = page_contents.content_item_id AND ci.owner_id = auth.uid()));

DROP FUNCTION IF EXISTS public.reorder_project_contents(jsonb);
CREATE FUNCTION public.reorder_project_contents(p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  expected_count integer;
  updated_count integer;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items must be a JSON array';
  END IF;

  SELECT count(*) INTO expected_count
  FROM jsonb_to_recordset(p_items) AS x(id uuid, sort_order integer);

  IF expected_count = 0 THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT x.id
      FROM jsonb_to_recordset(p_items) AS x(id uuid, sort_order integer)
      GROUP BY x.id
      HAVING count(*) > 1
    ) dupes
  ) THEN
    RAISE EXCEPTION 'Duplicate project ids in reorder payload';
  END IF;

  WITH payload AS (
    SELECT x.id AS content_item_id, x.sort_order
    FROM jsonb_to_recordset(p_items) AS x(id uuid, sort_order integer)
  )
  UPDATE public.project_contents pc
  SET sort_order = payload.sort_order
  FROM payload
  WHERE pc.content_item_id = payload.content_item_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count <> expected_count THEN
    RAISE EXCEPTION 'Reorder failed for some projects (updated %, expected %)', updated_count, expected_count;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_project_contents(jsonb) TO authenticated;
