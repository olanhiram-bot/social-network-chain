-- Prisma is the only application data access layer.  Keep the public schema
-- unavailable through Supabase PostgREST, including credentials and sessions.
-- The database owner used by Prisma bypasses RLS; do not FORCE ROW LEVEL SECURITY.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    '_prisma_migrations',
    'User',
    'UserBlock',
    'ContentReport',
    'SocialEvent',
    'SocialEventRsvp',
    'SocialEventInvite',
    'MarketplaceProduct',
    'MarketplaceSaved',
    'Page',
    'PageFollow',
    'Group',
    'GroupMember',
    'GroupJoinRequest',
    'Notification',
    'Conversation',
    'ConversationParticipant',
    'DirectMessage',
    'Wallet',
    'AppSigner',
    'Session',
    'PasswordResetToken',
    'Post',
    'PostComment',
    'PostReaction',
    'SignedAction',
    'ChainAnchor',
    'Story',
    'StoryView',
    'LiveSession',
    'LiveChatMessage',
    'FriendRequest',
    'Friendship'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon', table_name);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM authenticated', table_name);
    END IF;
  END LOOP;
END $$;
