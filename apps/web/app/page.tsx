"use client";

import {
  ChangeEvent,
  Children,
  FormEvent,
  createElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { isAddress, padHex, zeroAddress, type Address } from "viem";
import {
  useAccount,
  useDisconnect,
  useReadContract,
  useSignMessage,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

type User = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  cover: string | null;
  bio: string | null;
};

type Session = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

type Post = {
  id: string;
  content: string;
  mediaUrl: string | null;
  mediaType: "IMAGE" | "VIDEO" | "STREAM" | null;
  metadata: { feeling?: string; location?: string };
  audience: "PUBLIC" | "FRIENDS" | "ONLY_ME";
  createdAt: string;
  signerAddress: string | null;
  messageHash: string | null;
  signature: string | null;
  author: Pick<User, "id" | "name" | "avatar">;
  page: {
    id: string;
    name: string;
    avatar: string | null;
    category: string | null;
  } | null;
  group: {
    id: string;
    name: string | null;
  } | null;
  sharedPost: {
    id: string;
    content: string | null;
    mediaUrl: string | null;
    mediaType: "IMAGE" | "VIDEO" | "STREAM" | null;
    author: Pick<User, "id" | "name" | "avatar">;
  } | null;
  reactionCount: number;
  reactionTypeByMe: "LIKE" | "LOVE" | "CARE" | "HAHA" | "WOW" | "SAD" | "ANGRY" | null;
  commentCount: number;
  shareCount: number;
  reactedByMe: boolean;
  comments: {
    id: string;
    content: string;
    createdAt: string;
    signerAddress: string;
    author: Pick<User, "id" | "name" | "avatar">;
  }[];
};

type Story = {
  id: string;
  caption: string | null;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO" | "STREAM";
  createdAt: string;
  expiresAt: string;
  signerAddress: string | null;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
};

type LiveSession = {
  id: string;
  title: string;
  status: "LIVE" | "ENDED";
  startedAt: string;
  endedAt: string | null;
  recordingUrl: string | null;
  latestFrameUrl: string | null;
  hostId: string;
  hostName: string;
  hostAvatar: string | null;
};

type LiveChatMessage = {
  id: string;
  liveId: string;
  content: string;
  offsetMs: number;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
};

type SearchResults = {
  query: string;
  people: { id: string; name: string; avatar: string | null; bio: string | null }[];
  pages: Pick<SocialPage, "id" | "name" | "category" | "description" | "avatar" | "cover">[];
  groups: Pick<SocialGroup, "id" | "name" | "description" | "privacy" | "cover">[];
  posts: {
    id: string;
    content: string;
    mediaUrl: string | null;
    mediaType: "IMAGE" | "VIDEO" | "STREAM" | null;
    createdAt: string;
    authorId: string;
    authorName: string;
    authorAvatar: string | null;
  }[];
  lives: {
    id: string;
    title: string;
    status: "LIVE" | "ENDED";
    startedAt: string;
    latestFrameUrl: string | null;
    recordingUrl: string | null;
    hostId: string;
    hostName: string;
    hostAvatar: string | null;
  }[];
};

type MarketplaceProduct = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priceCents: number;
  location: string;
  imageUrl: string | null;
  createdAt: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string | null;
};

type SocialEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string;
  startsAt: string;
  imageUrl: string | null;
  hostId: string;
  hostName: string;
  hostAvatar: string | null;
  pageId: string | null;
  pageName: string | null;
  groupId: string | null;
  groupName: string | null;
  goingCount: number;
  interestedCount: number;
  myStatus: "GOING" | "INTERESTED" | null;
};

type PublicProfile = {
  user: User;
  relationship: "SELF" | "FRIEND" | "REQUEST_SENT" | "REQUEST_RECEIVED" | "NONE";
  posts: Post[];
  lives: LiveSession[];
};

type SocialPage = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  avatar: string | null;
  cover: string | null;
  createdAt: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string | null;
  followerCount: number;
  followedByMe: boolean;
};

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationState = {
  unreadCount: number;
  notifications: NotificationItem[];
};

type SocialGroup = {
  id: string;
  name: string;
  description: string | null;
  privacy: "PUBLIC" | "PRIVATE";
  cover: string | null;
  createdAt: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string | null;
  memberCount: number;
  joinedByMe: boolean;
  myRole: string | null;
};

type Conversation = {
  id: string;
  updatedAt: string;
  peerId: string;
  peerName: string;
  peerAvatar: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

type DirectMessage = {
  id: string;
  conversationId: string;
  content: string;
  signerAddress: string | null;
  messageHash: string | null;
  signature: string | null;
  readAt: string | null;
  createdAt: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
};

type FriendRequest = {
  id: string;
  requester: User;
  createdAt: string;
};

type WalletAccount = {
  id: string;
  address: string;
  appSigners: {
    id: string;
    address: string;
    label: string;
    active: boolean;
  }[];
};

type AppView = "home" | "profile" | "friends" | "lives" | "pages" | "pageDetail" | "groups" | "groupDetail" | "messages" | "publicProfile" | "search" | "marketplace" | "events";
const APP_VIEWS: readonly AppView[] = ["home", "profile", "friends", "lives", "pages", "pageDetail", "groups", "groupDetail", "messages", "publicProfile", "search", "marketplace", "events"];
const isAppView = (value: string): value is AppView => APP_VIEWS.includes(value as AppView);
type EditableTarget =
  | { kind: "post"; id: string; title: string; value: string }
  | { kind: "comment"; id: string; title: string; value: string }
  | { kind: "story"; id: string; title: string; value: string }
  | { kind: "live"; id: string; title: string; value: string };
type DeleteTarget = {
  id: string;
  kind: "post" | "comment" | "story" | "live";
  title: string;
  description: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const SESSION_KEY = "social-network-session";
const SESSION_EVENT = "social-network-session-change";
const SEARCH_HISTORY_KEY = "social-network-search-history";
const ZERO_BIGINT = BigInt(0);
const SEPOLIA_CHAIN_ID = 11155111;
const EXPLORER_BASE = process.env.NEXT_PUBLIC_CHAIN_EXPLORER_URL ?? "https://sepolia.etherscan.io";
const optionalAddress = (value: string | undefined) =>
  value && isAddress(value) ? (value as Address) : undefined;
const mediaSrc = (url: string) => (url.startsWith("/") ? `${API_URL}${url}` : url);
const fallbackApiUrl = API_URL.includes("127.0.0.1")
  ? API_URL.replace("127.0.0.1", "localhost")
  : API_URL.includes("localhost")
    ? API_URL.replace("localhost", "127.0.0.1")
    : "";
const isActiveStory = (story: Pick<Story, "expiresAt">, now = Date.now()) =>
  new Date(story.expiresAt).getTime() > now;
const CONTRACTS = {
  idRegistry: optionalAddress(process.env.NEXT_PUBLIC_ID_REGISTRY_ADDRESS),
  keyRegistry: optionalAddress(process.env.NEXT_PUBLIC_KEY_REGISTRY_ADDRESS),
  storageRegistry: optionalAddress(process.env.NEXT_PUBLIC_STORAGE_REGISTRY_ADDRESS),
};
const idRegistryAbi = [
  {
    type: "function",
    name: "idOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "recovery", type: "address" }],
    outputs: [{ name: "id", type: "uint256" }],
  },
] as const;
const keyRegistryAbi = [
  {
    type: "function",
    name: "keyOf",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "addKey",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "key", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;
const storageRegistryAbi = [
  {
    type: "function",
    name: "paidUntil",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "unitPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "rent",
    stateMutability: "payable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
] as const;

function subscribeSession(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(SESSION_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SESSION_EVENT, callback);
  };
}

function getSessionSnapshot() {
  return localStorage.getItem(SESSION_KEY) ?? "";
}

function getServerSessionSnapshot() {
  return "";
}

function saveStoredSession(session: Session | null) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }

  window.dispatchEvent(new Event(SESSION_EVENT));
}

export default function Page() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const sessionSnapshot = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );
  const session = useMemo<Session | null>(
    () => (sessionSnapshot ? JSON.parse(sessionSnapshot) : null),
    [sessionSnapshot],
  );
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [lives, setLives] = useState<LiveSession[]>([]);
  const [profileLives, setProfileLives] = useState<LiveSession[]>([]);
  const [liveMessages, setLiveMessages] = useState<Record<string, LiveChatMessage[]>>({});
  const [pages, setPages] = useState<SocialPage[]>([]);
  const [myPages, setMyPages] = useState<SocialPage[]>([]);
  const [groups, setGroups] = useState<SocialGroup[]>([]);
  const [myGroups, setMyGroups] = useState<SocialGroup[]>([]);
  const [notifications, setNotifications] = useState<NotificationState>({ unreadCount: 0, notifications: [] });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    try {
      return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [marketplaceProducts, setMarketplaceProducts] = useState<MarketplaceProduct[]>([]);
  const [events, setEvents] = useState<SocialEvent[]>([]);
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [wallet, setWallet] = useState<WalletAccount | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [selectedPage, setSelectedPage] = useState<SocialPage | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<SocialGroup | null>(null);
  const [view, setView] = useState<AppView>(() => {
    if (typeof window === "undefined") return "home";
    const hashView = window.location.hash.slice(1);
    return isAppView(hashView) ? hashView : "home";
  });
  const [error, setError] = useState("");
  const [editTarget, setEditTarget] = useState<EditableTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [shareTarget, setShareTarget] = useState<Post | null>(null);
  const [reportTarget, setReportTarget] = useState<Post | null>(null);
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const walletSyncStarted = useRef(false);
  const { address, chainId, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  useEffect(() => {
    const syncFromHash = () => {
      const hashView = window.location.hash.slice(1);
      if (isAppView(hashView)) setView(hashView);
    };
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  useEffect(() => {
    if (window.location.hash !== `#${view}`) {
      window.history.replaceState(null, "", `#${view}`);
    }
  }, [view]);

  async function apiFetch(path: string, init: RequestInit = {}) {
    const primaryUrl = `${API_URL}${path}`;

    try {
      return await fetch(primaryUrl, init);
    } catch {
      if (fallbackApiUrl && fallbackApiUrl !== API_URL) {
        try {
          return await fetch(`${fallbackApiUrl}${path}`, init);
        } catch {
          // Keep the clearer primary URL in the user-facing error below.
        }
      }

      throw new Error(
        `Could not connect to the API at ${primaryUrl}. Check that the backend is running.`,
      );
    }
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await apiFetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    const contentType = response.headers.get("content-type") ?? "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : { message: `Expected JSON from ${API_URL}${path}` };

    if (!response.ok) {
      if (response.status === 401 && data.message === "Invalid access token") {
        saveStoredSession(null);
      }

      throw new Error(data.message ?? "Request failed");
    }

    return data;
  }

  async function authed<T>(path: string, init: RequestInit = {}) {
    if (!session) {
      throw new Error("Missing session");
    }

    return request<T>(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        ...init.headers,
      },
    });
  }

  async function uploadMedia(file: File) {
    if (!session) {
      throw new Error("Missing session");
    }

    const form = new FormData();
    form.append("file", file);
    const response = await apiFetch("/media", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}` },
      body: form,
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message ?? "Upload failed");
    }

    return data as { url: string; mediaType: "IMAGE" | "VIDEO" };
  }

  async function refreshSocialData() {
    if (!session) {
      return;
    }

    const [nextPosts, nextStories, nextLives, nextProfileLives, nextPages, nextMyPages, nextGroups, nextMyGroups, nextNotifications, nextConversations, nextProducts, nextEvents, nextSuggestions, nextFriends, nextRequests, nextWallet] =
      await Promise.all([
      authed<Post[]>("/posts"),
        authed<Story[]>("/stories"),
        authed<LiveSession[]>("/lives"),
        authed<LiveSession[]>("/lives/mine"),
        authed<SocialPage[]>("/pages"),
        authed<SocialPage[]>("/pages/mine"),
        authed<SocialGroup[]>("/groups"),
        authed<SocialGroup[]>("/groups/mine"),
        authed<NotificationState>("/notifications"),
        authed<Conversation[]>("/messages/conversations"),
        authed<MarketplaceProduct[]>("/marketplace"),
        authed<SocialEvent[]>("/events"),
        authed<User[]>("/friends/suggestions"),
        authed<User[]>("/friends"),
        authed<FriendRequest[]>("/friends/requests"),
        authed<WalletAccount | null>("/wallet/me"),
      ]);

    setPosts(nextPosts);
    setStories(nextStories);
    setLives(nextLives);
    setProfileLives(nextProfileLives);
    setPages(nextPages);
    setMyPages(nextMyPages);
    setGroups(nextGroups);
    setMyGroups(nextMyGroups);
    setNotifications(nextNotifications);
    setConversations(nextConversations);
    setMarketplaceProducts(nextProducts);
    setEvents(nextEvents);
    setSelectedPage((current) => nextPages.find((page) => page.id === current?.id) ?? current);
    setSelectedGroup((current) => nextGroups.find((group) => group.id === current?.id) ?? current);
    setSuggestions(nextSuggestions);
    setFriends(nextFriends);
    setRequests(nextRequests);
    setWallet(nextWallet);
    await refreshLiveMessages([...nextLives, ...nextProfileLives]);
  }

  async function refreshLiveMessages(nextLives: LiveSession[]) {
    const uniqueLives = Array.from(new Map(nextLives.map((live) => [live.id, live])).values());
    if (!uniqueLives.length) {
      return;
    }

    const entries = await Promise.all(
      uniqueLives.map(async (live) => [
        live.id,
        await authed<LiveChatMessage[]>(`/lives/${live.id}/messages`),
      ] as const),
    );
    setLiveMessages((current) => ({ ...current, ...Object.fromEntries(entries) }));
  }

  useEffect(() => {
    if (!session) {
      return;
    }

    let cancelled = false;

    async function loadSocialData() {
      try {
        const [nextPosts, nextStories, nextLives, nextProfileLives, nextPages, nextMyPages, nextGroups, nextMyGroups, nextNotifications, nextConversations, nextProducts, nextEvents, nextSuggestions, nextFriends, nextRequests, nextWallet] =
          await Promise.all([
          authed<Post[]>("/posts"),
            authed<Story[]>("/stories"),
            authed<LiveSession[]>("/lives"),
            authed<LiveSession[]>("/lives/mine"),
            authed<SocialPage[]>("/pages"),
            authed<SocialPage[]>("/pages/mine"),
            authed<SocialGroup[]>("/groups"),
            authed<SocialGroup[]>("/groups/mine"),
            authed<NotificationState>("/notifications"),
            authed<Conversation[]>("/messages/conversations"),
            authed<MarketplaceProduct[]>("/marketplace"),
            authed<SocialEvent[]>("/events"),
            authed<User[]>("/friends/suggestions"),
            authed<User[]>("/friends"),
            authed<FriendRequest[]>("/friends/requests"),
            authed<WalletAccount | null>("/wallet/me"),
          ]);

        if (!cancelled) {
          setPosts(nextPosts);
          setStories(nextStories);
          setLives(nextLives);
          setProfileLives(nextProfileLives);
          setPages(nextPages);
          setMyPages(nextMyPages);
          setGroups(nextGroups);
          setMyGroups(nextMyGroups);
          setNotifications(nextNotifications);
          setConversations(nextConversations);
          setMarketplaceProducts(nextProducts);
          setEvents(nextEvents);
          setSelectedPage((current) => nextPages.find((page) => page.id === current?.id) ?? current);
          setSelectedGroup((current) => nextGroups.find((group) => group.id === current?.id) ?? current);
          setSuggestions(nextSuggestions);
          setFriends(nextFriends);
          setRequests(nextRequests);
          setWallet(nextWallet);
          void refreshLiveMessages([...nextLives, ...nextProfileLives]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Request failed");
        }
      }
    }

    void loadSocialData();

    return () => {
      cancelled = true;
    };
  }, [sessionSnapshot]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const source = new EventSource(`${API_URL}/realtime?token=${encodeURIComponent(session.accessToken)}`);
    source.addEventListener("feed_updated", () => {
      void authed<Post[]>("/posts").then(setPosts).catch(() => undefined);
    });
    source.addEventListener("pages_updated", () => {
      void Promise.all([authed<SocialPage[]>("/pages"), authed<SocialPage[]>("/pages/mine")])
        .then(([nextPages, nextMyPages]) => {
          setPages(nextPages);
          setMyPages(nextMyPages);
          setSelectedPage((current) => nextPages.find((page) => page.id === current?.id) ?? current);
        })
        .catch(() => undefined);
    });
    source.addEventListener("groups_updated", () => {
      void Promise.all([authed<SocialGroup[]>("/groups"), authed<SocialGroup[]>("/groups/mine")])
        .then(([nextGroups, nextMyGroups]) => {
          setGroups(nextGroups);
          setMyGroups(nextMyGroups);
          setSelectedGroup((current) => nextGroups.find((group) => group.id === current?.id) ?? current);
        })
        .catch(() => undefined);
    });
    source.addEventListener("notifications_updated", () => {
      void authed<NotificationState>("/notifications").then(setNotifications).catch(() => undefined);
    });
    source.addEventListener("messages_updated", () => {
      void authed<Conversation[]>("/messages/conversations").then(setConversations).catch(() => undefined);
      if (activeConversation) {
        void authed<DirectMessage[]>(`/messages/conversations/${activeConversation.id}`)
          .then(setDirectMessages)
          .catch(() => undefined);
      }
    });
    source.addEventListener("events_updated", () => {
      void authed<SocialEvent[]>("/events").then(setEvents).catch(() => undefined);
    });

    return () => source.close();
  }, [sessionSnapshot, activeConversation?.id]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const id = window.setInterval(async () => {
      try {
        const nextLives = await authed<LiveSession[]>("/lives");
        setLives(nextLives);
      } catch {
        // Keep the current live list if a polling request fails.
      }
    }, 1000);

    return () => window.clearInterval(id);
  }, [sessionSnapshot]);

  useEffect(() => {
    if (!session || view !== "messages") {
      return;
    }

    const id = window.setInterval(async () => {
      try {
        setConversations(await authed<Conversation[]>("/messages/conversations"));
        if (activeConversation) {
          setDirectMessages(await authed<DirectMessage[]>(`/messages/conversations/${activeConversation.id}`));
        }
      } catch {
        // Keep current messenger state if refresh fails.
      }
    }, 3000);

    return () => window.clearInterval(id);
  }, [sessionSnapshot, view, activeConversation?.id]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const id = window.setInterval(async () => {
      try {
        setPosts(await authed<Post[]>("/posts"));
      } catch {
        // Keep current feed if refresh fails.
      }
    }, 3000);

    return () => window.clearInterval(id);
  }, [sessionSnapshot]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const id = window.setInterval(async () => {
      try {
        setNotifications(await authed<NotificationState>("/notifications"));
      } catch {
        // Keep the current notification list if polling fails.
      }
    }, 10_000);

    return () => window.clearInterval(id);
  }, [sessionSnapshot]);

  useEffect(() => {
    if (!isConnected || !address || !chainId || session || walletSyncStarted.current) {
      return;
    }

    const walletAddress = address;
    const walletChainId = chainId;
    walletSyncStarted.current = true;
    async function syncWalletSession() {
      setWalletLoading(true);
      setError("");

      try {
        const { nonce } = await request<{ nonce: string }>("/auth/siwe/nonce");
        const message = createSiweMessage({
          address: walletAddress,
          chainId: walletChainId,
          nonce,
        });
        const signature = await new Promise<string>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error("Wallet signature timed out. Reconnect your wallet and try again.")), 30_000);
          void signMessageAsync({ message }).then(
            (value) => {
              window.clearTimeout(timeout);
              resolve(value);
            },
            (reason) => {
              window.clearTimeout(timeout);
              reject(reason);
            },
          );
        });
        const nextSession = await request<Session>("/auth/siwe/verify", {
          method: "POST",
          body: JSON.stringify({ message, signature }),
        });

        saveStoredSession(nextSession);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Wallet login failed");
      } finally {
        setWalletLoading(false);
        walletSyncStarted.current = false;
      }
    }

    void syncWalletSession();
  }, [address, chainId, isConnected, session, signMessageAsync]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const body =
      mode === "register"
        ? {
            name: String(form.get("name")),
            email: String(form.get("email")),
            password: String(form.get("password")),
          }
        : {
            email: String(form.get("email")),
            password: String(form.get("password")),
          };

    try {
      saveStoredSession(
        await request<Session>(`/auth/${mode}`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const content = String(form.get("content")).trim();
    const file = form.get("mediaFile");
    let mediaUrl = "";
    let mediaType = String(form.get("mediaType"));

    if (!content && !mediaUrl && !(file instanceof File && file.size > 0)) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (file instanceof File && file.size > 0) {
        const uploaded = await uploadMedia(file);
        mediaUrl = uploaded.url;
        mediaType = uploaded.mediaType;
      }

      setPosts([
        await authed<Post>("/posts", {
          method: "POST",
          body: JSON.stringify({
            content,
            mediaUrl: mediaUrl || undefined,
            mediaType: mediaUrl ? mediaType : undefined,
            pageId: String(form.get("pageId") || "") || undefined,
            groupId: String(form.get("groupId") || "") || undefined,
            audience: String(form.get("audience") || "PUBLIC"),
            feeling: String(form.get("feeling") || "") || undefined,
            location: String(form.get("location") || "") || undefined,
          }),
        }),
        ...posts,
      ]);
      formElement.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function createStory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("mediaFile");
    let mediaUrl = "";
    let mediaType = String(form.get("mediaType"));

    if (!mediaUrl && !(file instanceof File && file.size > 0)) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (file instanceof File && file.size > 0) {
        const uploaded = await uploadMedia(file);
        mediaUrl = uploaded.url;
        mediaType = uploaded.mediaType;
      }

      setStories([
        await authed<Story>("/stories", {
          method: "POST",
          body: JSON.stringify({
            mediaUrl,
            mediaType,
            caption: String(form.get("caption")).trim() || undefined,
          }),
        }),
        ...stories,
      ]);
      formElement.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function createPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const avatarFile = form.get("avatarFile");
    const coverFile = form.get("coverFile");
    let avatar = "";
    let cover = "";

    setLoading(true);
    setError("");

    try {
      if (avatarFile instanceof File && avatarFile.size > 0) {
        avatar = (await uploadMedia(avatarFile)).url;
      }

      if (coverFile instanceof File && coverFile.size > 0) {
        cover = (await uploadMedia(coverFile)).url;
      }

      const page = await authed<SocialPage>("/pages", {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name")).trim(),
          category: String(form.get("category")).trim(),
          description: String(form.get("description")).trim() || undefined,
          avatar: avatar || undefined,
          cover: cover || undefined,
        }),
      });

      setPages([page, ...pages]);
      setMyPages([page, ...myPages]);
      formElement.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function updatePage(event: FormEvent<HTMLFormElement>, page: SocialPage) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const avatarFile = form.get("avatarFile");
    const coverFile = form.get("coverFile");
    let avatar = page.avatar || "";
    let cover = page.cover || "";

    setLoading(true);
    setError("");

    try {
      if (avatarFile instanceof File && avatarFile.size > 0) {
        avatar = (await uploadMedia(avatarFile)).url;
      }

      if (coverFile instanceof File && coverFile.size > 0) {
        cover = (await uploadMedia(coverFile)).url;
      }

      const updated = await authed<SocialPage>(`/pages/${page.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: String(form.get("name")).trim(),
          category: String(form.get("category")).trim(),
          description: String(form.get("description")).trim() || undefined,
          avatar: avatar || undefined,
          cover: cover || undefined,
        }),
      });

      setSelectedPage(updated);
      setPages((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMyPages((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      await refreshSocialData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function togglePageFollow(pageId: string) {
    setError("");

    try {
      await authed(`/pages/${pageId}/follow`, { method: "POST" });
      await refreshSocialData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  function openPage(page: SocialPage) {
    setSelectedPage(page);
    setView("pageDetail");
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const coverFile = form.get("coverFile");
    let cover = "";

    setLoading(true);
    setError("");
    try {
      if (coverFile instanceof File && coverFile.size > 0) {
        cover = (await uploadMedia(coverFile)).url;
      }
      const group = await authed<SocialGroup>("/groups", {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name")).trim(),
          description: String(form.get("description")).trim() || undefined,
          privacy: String(form.get("privacy") || "PUBLIC"),
          cover: cover || undefined,
        }),
      });
      setGroups([group, ...groups]);
      setMyGroups([group, ...myGroups]);
      formElement.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function createMarketplaceProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const imageFile = form.get("imageFile");
    let imageUrl = "";

    setLoading(true);
    setError("");
    try {
      if (imageFile instanceof File && imageFile.size > 0) {
        imageUrl = (await uploadMedia(imageFile)).url;
      }
      const product = await authed<MarketplaceProduct>("/marketplace", {
        method: "POST",
        body: JSON.stringify({
          title: String(form.get("title")).trim(),
          category: String(form.get("category")).trim() || "General",
          description: String(form.get("description")).trim() || undefined,
          priceCents: Math.round(Number(form.get("price") || 0) * 100),
          location: String(form.get("location")).trim(),
          imageUrl: imageUrl || undefined,
        }),
      });
      setMarketplaceProducts([product, ...marketplaceProducts]);
      formElement.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const imageFile = form.get("imageFile");
    let imageUrl = "";

    setLoading(true);
    setError("");
    try {
      if (imageFile instanceof File && imageFile.size > 0) {
        imageUrl = (await uploadMedia(imageFile)).url;
      }
      const socialEvent = await authed<SocialEvent>("/events", {
        method: "POST",
        body: JSON.stringify({
          title: String(form.get("title")).trim(),
          description: String(form.get("description")).trim() || undefined,
          location: String(form.get("location")).trim(),
          startsAt: new Date(String(form.get("startsAt"))).toISOString(),
          imageUrl: imageUrl || undefined,
          pageId: String(form.get("pageId") || "") || undefined,
          groupId: String(form.get("groupId") || "") || undefined,
        }),
      });
      if (socialEvent) setEvents([socialEvent, ...events]);
      formElement.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function rsvpEvent(eventId: string, status: "GOING" | "INTERESTED") {
    setError("");
    try {
      await authed(`/events/${eventId}/rsvp`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      setEvents(await authed<SocialEvent[]>("/events"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  async function inviteToEvent(event: FormEvent<HTMLFormElement>, eventId: string) {
    event.preventDefault();
    const userId = String(new FormData(event.currentTarget).get("userId") || "");
    if (!userId) return;
    setError("");
    try {
      await authed(`/events/${eventId}/invites`, {
        method: "POST",
        body: JSON.stringify({ userIds: [userId] }),
      });
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  async function toggleGroupJoin(group: SocialGroup) {
    try {
      await authed(`/groups/${group.id}/${group.joinedByMe ? "leave" : "join"}`, {
        method: group.joinedByMe ? "DELETE" : "POST",
      });
      await refreshSocialData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  function openGroup(group: SocialGroup) {
    setSelectedGroup(group);
    setView("groupDetail");
  }

  async function markNotificationsRead() {
    try {
      await authed("/notifications/read", { method: "PATCH" });
      setNotifications((current) => ({
        unreadCount: 0,
        notifications: current.notifications.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? new Date().toISOString(),
        })),
      }));
    } catch {
      // Non-critical; notifications will refresh with the next data load.
    }
  }

  async function openNotification(notification: NotificationItem) {
    if (!notification.entityType || !notification.entityId) {
      return;
    }

    setError("");
    try {
      if (notification.entityType === "Page") {
        openPage(await authed<SocialPage>(`/pages/${notification.entityId}`));
        return;
      }
      if (notification.entityType === "Group") {
        openGroup(await authed<SocialGroup>(`/groups/${notification.entityId}`));
        return;
      }
      if (notification.entityType === "User") {
        await openUserProfile(notification.entityId);
        return;
      }
      if (notification.entityType === "Conversation") {
        const nextConversations = await authed<Conversation[]>("/messages/conversations");
        setConversations(nextConversations);
        const conversation = nextConversations.find((item) => item.id === notification.entityId);
        if (conversation) {
          await selectConversation(conversation);
        }
        setView("messages");
        return;
      }
      if (notification.entityType === "FriendRequest") {
        setView("friends");
        return;
      }
      if (notification.entityType === "Post" || notification.entityType === "DirectMessage") {
        setView(notification.entityType === "Post" ? "home" : "messages");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  async function runSearch(query: string) {
    const clean = query.trim();
    if (clean.length < 2) {
      return;
    }

    setError("");
    try {
      const results = await authed<SearchResults>(`/search?q=${encodeURIComponent(clean)}`);
      const history = [clean, ...searchHistory.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
      setSearchResults(results);
      setSearchHistory(history);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
      setView("search");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  async function openConversation(peerId: string, draft = "") {
    setError("");
    setMessageDraft(draft);
    try {
      const { id } = await authed<{ id: string }>("/messages/conversations", {
        method: "POST",
        body: JSON.stringify({ peerId }),
      });
      const nextConversations = await authed<Conversation[]>("/messages/conversations");
      const conversation = nextConversations.find((item) => item.id === id) ?? null;
      setConversations(nextConversations);
      setActiveConversation(conversation);
      setDirectMessages(await authed<DirectMessage[]>(`/messages/conversations/${id}`));
      setView("messages");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  async function selectConversation(conversation: Conversation) {
    setActiveConversation(conversation);
    setDirectMessages(await authed<DirectMessage[]>(`/messages/conversations/${conversation.id}`));
  }

  async function sendDirectMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeConversation) {
      return;
    }

    const formElement = event.currentTarget;
    const content = String(new FormData(formElement).get("content")).trim();
    if (!content) {
      return;
    }

    await authed(`/messages/conversations/${activeConversation.id}`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    formElement.reset();
    setMessageDraft("");
    setDirectMessages(await authed<DirectMessage[]>(`/messages/conversations/${activeConversation.id}`));
    setConversations(await authed<Conversation[]>("/messages/conversations"));
  }

  async function startLive(title: string) {
    setLoading(true);
    setError("");

    try {
      setLives([
        await authed<LiveSession>("/lives", {
          method: "POST",
          body: JSON.stringify({ title }),
        }),
        ...lives,
      ]);
      await refreshSocialData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function endLive(id: string, recordingUrl?: string) {
    setError("");

    try {
      await authed(`/lives/${id}/end`, {
        method: "PATCH",
        body: JSON.stringify({ recordingUrl }),
      });
      await refreshSocialData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  async function updateLiveFrame(id: string, file: File) {
    if (!session) {
      return;
    }

    const form = new FormData();
    form.append("file", file);

    try {
      await apiFetch(`/lives/${id}/frame`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.accessToken}` },
        body: form,
      });
    } catch {
      // Frame updates are best-effort; the live should continue even if one frame fails.
    }
  }

  async function sendLiveMessage(event: FormEvent<HTMLFormElement>, liveId: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const content = String(form.get("message")).trim();

    if (!content) {
      return;
    }

    setError("");
    try {
      const message = await authed<LiveChatMessage>(`/lives/${liveId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setLiveMessages((current) => ({
        ...current,
        [liveId]: [...(current[liveId] ?? []), message],
      }));
      formElement.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      return;
    }

    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);

    try {
      const avatarFile = form.get("avatarFile");
      const coverFile = form.get("coverFile");
      let avatar = String(form.get("avatar") || session.user.avatar || "");
      let cover = String(form.get("cover") || session.user.cover || "");

      if (avatarFile instanceof File && avatarFile.size > 0) {
        avatar = (await uploadMedia(avatarFile)).url;
      }

      if (coverFile instanceof File && coverFile.size > 0) {
        cover = (await uploadMedia(coverFile)).url;
      }

      const user = await authed<User>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: String(form.get("name")).trim(),
          avatar: avatar || null,
          cover: cover || null,
          bio: String(form.get("bio")) || null,
        }),
      });

      saveStoredSession({ ...session, user });
      setView("profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function addFriend(userId: string) {
    setError("");

    try {
      await authed("/friends/requests", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      if (publicProfile?.user.id === userId) {
        setPublicProfile({ ...publicProfile, relationship: "REQUEST_SENT" });
      }
      await refreshSocialData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  async function openUserProfile(userId: string) {
    if (session?.user.id === userId) {
      setView("profile");
      return;
    }

    setError("");
    try {
      const profile = await authed<PublicProfile>(`/friends/users/${userId}/profile`);
      setPublicProfile(profile);
      setView("publicProfile");
      await refreshLiveMessages(profile.lives);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  async function blockUser(userId: string) {
    setError("");
    try {
      await authed(`/friends/users/${userId}/block`, { method: "POST" });
      setPublicProfile(null);
      setView("friends");
      await refreshSocialData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  async function respondToRequest(id: string, action: "accept" | "reject") {
    setError("");

    try {
      await authed(`/friends/requests/${id}/${action}`, { method: "PATCH" });
      await refreshSocialData();
      setNotifications((current) => {
        const notifications = current.notifications.filter((notification) => notification.entityType !== "FriendRequest" || notification.entityId !== id);
        return { unreadCount: notifications.filter((notification) => !notification.readAt).length, notifications };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  async function toggleReaction(postId: string, reactionType = "LIKE") {
    setError("");

    try {
      await authed(`/posts/${postId}/reactions`, { method: "POST", body: JSON.stringify({ reactionType }) });
      await refreshSocialData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  async function commentOnPost(event: FormEvent<HTMLFormElement>, postId: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const content = String(form.get("comment")).trim();

    if (!content) {
      return;
    }

    setError("");

    try {
      await authed(`/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      formElement.reset();
      await refreshSocialData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  function editPost(post: Post) {
    setEditTarget({ kind: "post", id: post.id, title: "Edit post", value: post.content });
  }

  function deletePost(postId: string) {
    setDeleteTarget({
      kind: "post",
      id: postId,
      title: "Delete post",
      description: "This post will be removed from your profile and feed.",
    });
  }

  function editComment(comment: Post["comments"][number]) {
    setEditTarget({ kind: "comment", id: comment.id, title: "Edit comment", value: comment.content });
  }

  function deleteComment(commentId: string) {
    setDeleteTarget({
      kind: "comment",
      id: commentId,
      title: "Delete comment",
      description: "This comment will be removed from the post.",
    });
  }

  function editLive(live: LiveSession) {
    setEditTarget({ kind: "live", id: live.id, title: "Edit live", value: live.title });
  }

  function deleteLive(liveId: string) {
    setDeleteTarget({
      kind: "live",
      id: liveId,
      title: "Delete live",
      description: "This live will be removed from your profile.",
    });
  }

  async function sharePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shareTarget) {
      return;
    }
    const form = new FormData(event.currentTarget);

    setLoading(true);
    setError("");
    try {
      await authed(`/posts/${shareTarget.id}/share`, {
        method: "POST",
        body: JSON.stringify({
          content: String(form.get("content")).trim(),
          pageId: String(form.get("pageId") || "") || undefined,
        }),
      });
      setShareTarget(null);
      await refreshSocialData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function sharePostByMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shareTarget) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const peerId = String(form.get("peerId") || "");
    if (!peerId) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { id } = await authed<{ id: string }>("/messages/conversations", {
        method: "POST",
        body: JSON.stringify({ peerId }),
      });
      await authed(`/messages/conversations/${id}`, {
        method: "POST",
        body: JSON.stringify({
          content: `${String(form.get("content")).trim() || "Sharing this post with you"}\n\n${shareTarget.content}`,
        }),
      });
      setShareTarget(null);
      setView("messages");
      await refreshSocialData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function reportPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reportTarget) {
      return;
    }
    const reason = String(new FormData(event.currentTarget).get("reason") || "").trim();
    if (!reason) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      await authed(`/posts/${reportTarget.id}/report`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setReportTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const value = String(form.get("value") ?? "");
    const path =
      editTarget.kind === "post"
        ? `/posts/${editTarget.id}`
        : editTarget.kind === "comment"
          ? `/posts/comments/${editTarget.id}`
        : editTarget.kind === "story"
          ? `/stories/${editTarget.id}`
          : `/lives/${editTarget.id}`;
    const body =
      editTarget.kind === "post"
        ? { content: value }
        : editTarget.kind === "comment"
          ? { content: value }
        : editTarget.kind === "story"
          ? { caption: value }
          : { title: value };

    setLoading(true);
    setError("");
    try {
      await authed(path, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setEditTarget(null);
      await refreshSocialData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    const path =
      deleteTarget.kind === "post"
        ? `/posts/${deleteTarget.id}`
        : deleteTarget.kind === "comment"
          ? `/posts/comments/${deleteTarget.id}`
        : deleteTarget.kind === "story"
          ? `/stories/${deleteTarget.id}`
          : `/lives/${deleteTarget.id}`;

    setLoading(true);
    setError("");
    try {
      await authed(path, { method: "DELETE" });
      setDeleteTarget(null);
      await refreshSocialData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    saveStoredSession(null);
    setPosts([]);
    setStories([]);
    setLives([]);
    setProfileLives([]);
    setPages([]);
    setMyPages([]);
    setGroups([]);
    setMyGroups([]);
    setSelectedGroup(null);
    setMarketplaceProducts([]);
    setEvents([]);
    setNotifications({ unreadCount: 0, notifications: [] });
    setSuggestions([]);
    setFriends([]);
    setRequests([]);
    setWallet(null);
    try {
      disconnect();
    } catch {
      // The wallet extension can already have disconnected its connector.
    }
  }

  if (!session) {
    return (
      <main className="nexo-app nexo-auth min-h-screen text-[#17211f]">
        <div className="mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-5 py-8 md:grid-cols-[1fr_420px] md:items-center">
          <section>
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-[#d8d1c3] bg-white/70 px-4 py-2 text-sm font-semibold text-[#49625b]">
              <span className="size-2 rounded-full bg-[#d89d35]" />
              Onchain social network
            </div>
            <h1 className="max-w-2xl text-5xl font-black tracking-tight text-[#17211f] md:text-7xl">
              Nexo
            </h1>
            <p className="mt-5 max-w-xl text-xl leading-8 text-[#53645f]">
              A clean space to post, connect, and bring your social identity to Sepolia.
            </p>
          </section>

          <section className="rounded-2xl border border-[#ded7c9] bg-white p-5 shadow-[0_24px_80px_rgba(32,28,20,0.12)]">
            <AuthForm
              error={error}
              loading={loading}
              mode={mode}
              onModeChange={setMode}
              onSubmit={authenticate}
              walletLoading={walletLoading}
            />
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="nexo-app text-[#17211f]">
      <TopBar
        notifications={notifications}
        user={session.user}
        view={view}
        onMarkNotificationsRead={markNotificationsRead}
        onOpenNotification={openNotification}
        onAcceptFriendRequest={(id) => respondToRequest(id, "accept")}
        onRejectFriendRequest={(id) => respondToRequest(id, "reject")}
        onNavigate={setView}
        onSearch={runSearch}
        onLogout={logout}
        onProfile={() => setView("profile")}
      />
      <MobileDock view={view} onNavigate={setView} />

      <div
        className={`nexo-workbench mx-auto grid w-full gap-5 px-4 ${
          view === "profile"
            ? "lg:grid-cols-1"
            : view === "home"
              ? "lg:grid-cols-[260px_minmax(0,700px)_330px]"
              : view === "friends"
                ? "nexo-friends-workbench !gap-0 !p-0 lg:grid-cols-[300px_minmax(0,1fr)]"
              : "lg:grid-cols-[260px_minmax(0,1fr)]"
        }`}
        style={view === "friends" ? { maxWidth: "none" } : undefined}
      >
        {view !== "profile" && (
          <LeftRail user={session.user} view={view} onNavigate={setView} />
        )}

        {view === "profile" ? (
          <ProfilePage
            error={error}
            friends={friends}
            lives={profileLives}
            liveMessages={liveMessages}
            loading={loading}
            myGroups={myGroups}
            myPages={myPages}
            posts={posts.filter((post) => post.author.id === session.user.id)}
            session={session}
            onDeleteLive={deleteLive}
            onDeletePost={deletePost}
            onEditLive={editLive}
            onEditPost={editPost}
            onOpenProfile={openUserProfile}
            onSendLiveMessage={sendLiveMessage}
            onSubmit={updateProfile}
          />
        ) : view === "publicProfile" && publicProfile ? (
          <PublicProfilePage
            liveMessages={liveMessages}
            profile={publicProfile}
            viewerId={session.user.id}
            onAddFriend={addFriend}
            onBlock={blockUser}
            onOpenProfile={openUserProfile}
            onSendLiveMessage={sendLiveMessage}
          />
        ) : view === "friends" ? (
          <FriendsPage
            friends={friends}
            requests={requests}
            suggestions={suggestions}
            onAccept={(id) => respondToRequest(id, "accept")}
            onAdd={addFriend}
            onMessage={openConversation}
            onOpenProfile={openUserProfile}
            onReject={(id) => respondToRequest(id, "reject")}
          />
        ) : view === "messages" ? (
          <MessagesPage
            activeConversation={activeConversation}
            conversations={conversations}
            draft={messageDraft}
            friends={friends}
            messages={directMessages}
            viewerId={session.user.id}
            onDraftChange={setMessageDraft}
            onOpenConversation={openConversation}
            onSelectConversation={selectConversation}
            onSendMessage={sendDirectMessage}
          />
        ) : view === "search" ? (
          <SearchPage
            history={searchHistory}
            results={searchResults}
            onOpenGroup={(groupId) => {
              const group = groups.find((item) => item.id === groupId);
              if (group) {
                openGroup(group);
              } else {
                void authed<SocialGroup>(`/groups/${groupId}`).then(openGroup).catch(() => undefined);
              }
            }}
            onOpenPage={(pageId) => {
              const page = pages.find((item) => item.id === pageId);
              if (page) {
                openPage(page);
              } else {
                void authed<SocialPage>(`/pages/${pageId}`).then(openPage).catch(() => undefined);
              }
            }}
            onOpenProfile={openUserProfile}
            onOpenPost={() => setView("home")}
            onOpenLive={() => setView("lives")}
            onSearch={runSearch}
          />
        ) : view === "groups" ? (
          <GroupsPage
            groups={groups}
            loading={loading}
            myGroups={myGroups}
            onCreate={createGroup}
            onOpenGroup={openGroup}
            onToggleJoin={toggleGroupJoin}
          />
        ) : view === "marketplace" ? (
          <MarketplacePage
            loading={loading}
            products={marketplaceProducts}
            viewerId={session.user.id}
            onContactSeller={openConversation}
            onOpenProfile={openUserProfile}
            onSubmit={createMarketplaceProduct}
          />
        ) : view === "events" ? (
          <EventsPage
            events={events}
            friends={friends}
            loading={loading}
            myGroups={myGroups}
            myPages={myPages}
            onInvite={inviteToEvent}
            onOpenProfile={openUserProfile}
            onRsvp={rsvpEvent}
            onSubmit={createEvent}
          />
        ) : view === "groupDetail" && selectedGroup ? (
          <GroupDetail
            group={selectedGroup}
            posts={posts.filter((post) => post.group?.id === selectedGroup.id)}
            viewerId={session.user.id}
            onBack={() => setView("groups")}
            onCommentPost={commentOnPost}
            onCommentDelete={deleteComment}
            onCommentEdit={editComment}
            onCreatePost={createPost}
            onDeletePost={deletePost}
            onEditPost={editPost}
            onOpenProfile={openUserProfile}
            onReact={toggleReaction}
            onReportPost={setReportTarget}
            onShare={setShareTarget}
            onToggleJoin={toggleGroupJoin}
          />
        ) : view === "pages" ? (
          <PagesPage
            loading={loading}
            myPages={myPages}
            onOpenPage={openPage}
            pages={pages}
            onFollow={togglePageFollow}
            onSubmit={createPage}
          />
        ) : view === "pageDetail" && selectedPage ? (
          <PageDetail
            page={selectedPage}
            posts={posts.filter((post) => post.page?.id === selectedPage.id)}
            viewerId={session.user.id}
            onBack={() => setView("pages")}
            onCommentPost={commentOnPost}
            onCommentDelete={deleteComment}
            onCommentEdit={editComment}
            onCreatePost={createPost}
            onDeletePost={deletePost}
            onEditPost={editPost}
            onFollow={togglePageFollow}
            onOpenProfile={openUserProfile}
            onReact={toggleReaction}
            onReportPost={setReportTarget}
            onShare={setShareTarget}
            onUpdate={updatePage}
          />
        ) : view === "lives" ? (
          <LivesPage
            lives={lives}
            liveMessages={liveMessages}
            viewerId={session.user.id}
            onDelete={deleteLive}
            onEdit={editLive}
            onOpenProfile={openUserProfile}
            onSendMessage={sendLiveMessage}
          />
        ) : (
          <section className="space-y-4">
            <Stories
              loading={loading}
              stories={stories}
              user={session.user}
              onSubmit={createStory}
            />
            <Composer
            lives={lives}
            liveMessages={liveMessages}
            loading={loading}
            myPages={myPages}
            onUploadMedia={uploadMedia}
            user={session.user}
            onEndLive={endLive}
            onSendLiveMessage={sendLiveMessage}
              onStartLive={startLive}
              onSubmit={createPost}
              onUpdateLiveFrame={updateLiveFrame}
            />
            {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {posts.length === 0 ? (
              <p className="rounded-2xl border border-[#ded7c9] bg-white p-8 text-center text-sm text-[#6d746f] shadow-sm">
                There are no posts yet. Create the first one.
              </p>
            ) : (
              posts.map((post) => (
                <FeedPost
                  key={post.id}
                  post={post}
                  viewerId={session.user.id}
                  onComment={commentOnPost}
                  onCommentDelete={deleteComment}
                  onCommentEdit={editComment}
                  onDelete={deletePost}
                  onEdit={editPost}
                  onOpenProfile={openUserProfile}
                  onReact={toggleReaction}
                  onReport={setReportTarget}
                  onShare={setShareTarget}
                />
              ))
            )}
          </section>
        )}

        {view === "home" && (
          <RightRail
            friends={friends}
            requests={requests}
            suggestions={suggestions}
            wallet={wallet}
            onAccept={(id) => respondToRequest(id, "accept")}
            onAdd={addFriend}
            onOpenProfile={openUserProfile}
            onReject={(id) => respondToRequest(id, "reject")}
          />
        )}
      </div>
      {editTarget && (
        <EditContentModal
          loading={loading}
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSubmit={submitEdit}
        />
      )}
      {deleteTarget && (
        <ConfirmDeleteModal
          loading={loading}
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
      {shareTarget && (
        <SharePostModal
          friends={friends}
          loading={loading}
          myPages={myPages}
          post={shareTarget}
          onClose={() => setShareTarget(null)}
          onMessenger={sharePostByMessage}
          onShare={sharePost}
        />
      )}
      {reportTarget && (
        <ReportPostModal
          loading={loading}
          post={reportTarget}
          onClose={() => setReportTarget(null)}
          onReport={reportPost}
        />
      )}
    </main>
  );
}

function MobileDock({ view, onNavigate }: { view: AppView; onNavigate: (view: AppView) => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const items: { label: string; view: AppView }[] = [
    { label: "Home", view: "home" },
    { label: "Friends", view: "friends" },
    { label: "Messages", view: "messages" },
    { label: "Market", view: "marketplace" },
  ];
  const moreItems: { label: string; view: AppView; description: string }[] = [
    { label: "Pages", view: "pages", description: "Create and manage public pages" },
    { label: "Groups", view: "groups", description: "Join and create communities" },
    { label: "Events", view: "events", description: "Discover what is happening" },
    { label: "Lives", view: "lives", description: "Watch and start live sessions" },
    { label: "Profile", view: "profile", description: "Your posts and account" },
  ];
  const isMoreActive = moreItems.some((item) => item.view === view);

  function navigate(itemView: AppView) {
    onNavigate(itemView);
    setMoreOpen(false);
  }

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-30 bg-black/35 px-3 pt-20" role="presentation" onClick={() => setMoreOpen(false)}>
          <section
            aria-label="More destinations"
            className="mx-auto w-full max-w-md rounded-2xl border border-[#ded7c9] bg-white p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between px-2">
              <h2 className="text-lg font-black text-[#17211f]">More</h2>
              <button aria-label="Close menu" className="grid size-9 place-items-center rounded-full bg-[#ece7dc] text-lg" type="button" onClick={() => setMoreOpen(false)}>×</button>
            </div>
            <div className="grid gap-1">
              {moreItems.map((item) => (
                <button className="rounded-xl px-3 py-3 text-left hover:bg-[#f4f0e8]" key={item.view} type="button" onClick={() => navigate(item.view)}>
                  <span className="block text-sm font-black text-[#17211f]">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-[#65736f]">{item.description}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      <nav aria-label="Mobile navigation" className="nexo-mobile-dock">
        {items.map((item) => (
          <button
            aria-current={view === item.view ? "page" : undefined}
            className={view === item.view ? "is-active" : ""}
            key={item.view}
            onClick={() => navigate(item.view)}
            type="button"
          >
            {item.label}
          </button>
        ))}
        <button aria-expanded={moreOpen} className={isMoreActive ? "is-active" : ""} type="button" onClick={() => setMoreOpen(true)}>More</button>
      </nav>
    </>
  );
}

function TopBar({
  notifications,
  onAcceptFriendRequest,
  onMarkNotificationsRead,
  onOpenNotification,
  onRejectFriendRequest,
  user,
  view,
  onNavigate,
  onSearch,
  onLogout,
  onProfile,
}: {
  notifications: NotificationState;
  onAcceptFriendRequest: (id: string) => void;
  onMarkNotificationsRead: () => void;
  onOpenNotification: (notification: NotificationItem) => void;
  onRejectFriendRequest: (id: string) => void;
  user: User;
  view: AppView;
  onNavigate: (view: AppView) => void;
  onSearch: (query: string) => void;
  onLogout: () => void;
  onProfile: () => void;
}) {
  const navItems: { label: string; view: AppView }[] = [
    { label: "Home", view: "home" },
    { label: "Friends", view: "friends" },
    { label: "Messages", view: "messages" },
    { label: "Pages", view: "pages" },
    { label: "Groups", view: "groups" },
    { label: "Marketplace", view: "marketplace" },
    { label: "Events", view: "events" },
    { label: "Lives", view: "lives" },
    { label: "Profile", view: "profile" },
  ];
  const primaryNavItems = navItems.slice(0, 5);
  const moreNavItems = navItems.slice(5);

  return (
    <header className="nexo-topbar sticky top-0 z-20 border bg-[#fffdf8]/90 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1464px] items-center gap-3 px-4">
        <div className="grid size-10 place-items-center rounded-xl bg-[#17211f] text-lg font-black text-[#f2c166]">
          N
        </div>
        <form
          className="hidden md:block"
          onSubmit={(event) => {
            event.preventDefault();
            const query = String(new FormData(event.currentTarget).get("query") || "");
            onSearch(query);
          }}
        >
          <input
            className="h-10 w-64 rounded-xl border border-[#ded7c9] bg-white px-4 text-sm outline-none focus:border-[#49625b]"
            name="query"
            placeholder="Search Nexo"
          />
        </form>
        <nav className="mx-auto hidden h-full items-center gap-2 md:flex">
          {primaryNavItems.map((item) => (
            <button
              className={`h-11 rounded-xl px-6 text-sm font-semibold hover:bg-[#ece7dc] ${
                view === item.view ? "bg-[#17211f] text-white" : "text-[#65736f]"
              }`}
              key={item.view}
              onClick={() => onNavigate(item.view)}
            >
              {item.label}
            </button>
          ))}
          <details className="nexo-nav-more">
            <summary className="h-11 cursor-pointer rounded-xl px-4 py-3 text-sm font-semibold text-[#65736f] hover:bg-[#ece7dc]">
              More
            </summary>
            <div role="menu">
              {moreNavItems.map((item) => (
                <button
                  className={`rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-[#ece7dc] ${
                    view === item.view ? "bg-[#17211f] text-white" : "text-[#53645f]"
                  }`}
                  key={item.view}
                  onClick={() => onNavigate(item.view)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </details>
        </nav>
        <details className="relative">
          <summary
            className="grid size-10 cursor-pointer list-none place-items-center rounded-xl bg-[#ece7dc] text-sm font-black text-[#17211f] hover:bg-[#ded7c9]"
            onClick={() => {
              if (notifications.unreadCount > 0) {
                window.setTimeout(onMarkNotificationsRead, 250);
              }
            }}
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" className="size-5 stroke-current"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
            {notifications.unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">
                {notifications.unreadCount}
              </span>
            )}
          </summary>
          <div className="fixed inset-x-3 top-20 z-30 max-h-[calc(100dvh-6rem)] overflow-hidden rounded-xl border border-[#ded7c9] bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:max-h-96 sm:w-80">
            <div className="border-b border-[#eee8dc] p-3">
              <h2 className="text-sm font-black">Notifications</h2>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.notifications.length === 0 ? (
                <p className="p-4 text-sm text-[#6d746f]">You have no notifications.</p>
              ) : (
                notifications.notifications.map((notification) => {
                  const requestId = notification.type === "FRIEND_REQUEST" && notification.entityType === "FriendRequest" ? notification.entityId : null;
                  return <div className={`border-b border-[#f0ece3] p-3 text-left text-sm ${notification.readAt ? "bg-white" : "bg-[#fff8e8]"}`} key={notification.id}>
                    <button className="block w-full text-left hover:opacity-75" onClick={() => onOpenNotification(notification)} type="button">
                      <p className="font-black text-[#17211f]">{notification.title}</p>
                      <p className="mt-1 text-[#53645f]">{notification.body}</p>
                      <p className="mt-1 text-[11px] text-[#8a8f8b]">{new Date(notification.createdAt).toLocaleString()}</p>
                    </button>
                    {requestId && <div className="mt-3 grid grid-cols-2 gap-2"><button className={primaryButtonClass} type="button" onClick={() => onAcceptFriendRequest(requestId)}>Confirm</button><button className={secondaryButtonClass} type="button" onClick={() => onRejectFriendRequest(requestId)}>Delete</button></div>}
                  </div>;
                })
              )}
            </div>
          </div>
        </details>
        <button
          className="ml-auto flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-[#ece7dc]"
          onClick={onProfile}
        >
          <Avatar name={user.name} src={user.avatar} size="sm" />
          <span className="hidden text-sm font-semibold sm:block">{user.name}</span>
        </button>
        <button
          className="rounded-xl bg-[#17211f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#263532]"
          onClick={onLogout}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

function LeftRail({
  user,
  view,
  onNavigate,
}: {
  user: User;
  view: AppView;
  onNavigate: (view: AppView) => void;
}) {
  const items: { label: string; view: AppView }[] = [
    { label: "Home", view: "home" },
    { label: "Friends", view: "friends" },
    { label: "Messages", view: "messages" },
    { label: "Pages", view: "pages" },
    { label: "Groups", view: "groups" },
    { label: "Marketplace", view: "marketplace" },
    { label: "Events", view: "events" },
    { label: "Lives", view: "lives" },
    { label: "Profile", view: "profile" },
  ];

  if (view === "friends") {
    return (
      <aside className="nexo-left-rail nexo-friends-sidebar sticky top-[4.25rem] hidden h-[calc(100dvh-4.25rem)] overflow-y-auto border-r border-[#ded7c9] bg-white px-2 py-4 lg:block">
        <div className="mb-3 flex items-center justify-between px-3">
          <h1 className="text-2xl font-black tracking-tight text-[#17211f]">Friends</h1>
          <span aria-label="Friend settings" className="grid size-9 place-items-center rounded-full bg-[#ece7dc] text-lg">⚙</span>
        </div>
        <nav className="space-y-1" aria-label="Friends navigation">
          <a className="block w-full rounded-lg bg-[#eef3ff] px-4 py-3 text-left text-sm font-bold text-[#1877f2]" href="#friend-suggestions">People you may know</a>
          <a className="block w-full rounded-lg px-4 py-3 text-left text-sm font-semibold text-[#17211f] hover:bg-[#f0f2f5]" href="#friend-requests">Friend requests</a>
          <a className="block w-full rounded-lg px-4 py-3 text-left text-sm font-semibold text-[#17211f] hover:bg-[#f0f2f5]" href="#my-friends">All friends</a>
          <button className="block w-full rounded-lg px-4 py-3 text-left text-sm font-semibold text-[#17211f] hover:bg-[#f0f2f5]" type="button" onClick={() => onNavigate("home")}>Home</button>
        </nav>
      </aside>
    );
  }

  return (
    <aside className="nexo-left-rail sticky top-24 hidden h-[calc(100dvh-7rem)] space-y-2 overflow-y-auto lg:block">
      <button
        className="flex w-full items-center gap-3 rounded-xl border border-[#ded7c9] bg-white p-3 text-left font-semibold shadow-sm hover:bg-[#fffaf0]"
        onClick={() => onNavigate("profile")}
      >
        <Avatar name={user.name} src={user.avatar} size="sm" />
        {user.name}
      </button>
      {items.map((item) => (
        <button
          className={`block w-full rounded-xl px-3 py-3 text-left text-sm font-semibold hover:bg-[#ece7dc] ${
            view === item.view ? "bg-[#17211f] text-white" : "text-[#53645f]"
          }`}
          key={item.view}
          onClick={() => onNavigate(item.view)}
        >
          {item.label}
        </button>
      ))}
    </aside>
  );
}

function Stories({
  loading,
  stories,
  user,
  onSubmit,
}: {
  loading: boolean;
  stories: Story[];
  user: User;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [previewStory, setPreviewStory] = useState<Story | null>(null);
  const [draftPreview, setDraftPreview] = useState("");
  const [draftType, setDraftType] = useState<"IMAGE" | "VIDEO">("IMAGE");
  const [now, setNow] = useState(() => Date.now());
  const activeStories = stories.filter((story) => isActiveStory(story, now));
  const activePreviewStory =
    previewStory && isActiveStory(previewStory, now) ? previewStory : null;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  function closeCreate() {
    if (draftPreview) {
      URL.revokeObjectURL(draftPreview);
    }

    setCreating(false);
    setDraftPreview("");
    setDraftType("IMAGE");
  }

  function previewFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    if (draftPreview) {
      URL.revokeObjectURL(draftPreview);
    }

    setDraftPreview(URL.createObjectURL(file));
    setDraftType(file.type.startsWith("video/") ? "VIDEO" : "IMAGE");
  }

  return (
    <section className="nexo-stories rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm">
      {creating && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#17211f]/75 px-4 backdrop-blur-sm">
          <form
            className="grid max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl md:grid-cols-[320px_1fr]"
            onSubmit={(event) => {
              void onSubmit(event);
              closeCreate();
            }}
          >
            <aside className="border-b border-[#ded7c9] p-5 md:border-b-0 md:border-r">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black">Create story</h2>
                <button className={secondaryButtonClass} type="button" onClick={closeCreate}>
                  Close
                </button>
              </div>
              <div className="mt-5 grid gap-3">
                <input
                  accept="image/*,video/*"
                  className={inputClass}
                  name="mediaFile"
                  onChange={previewFile}
                  required
                  type="file"
                />
                <input
                  className={inputClass}
                  name="caption"
                  placeholder={`Text for your story, ${user.name}`}
                />
              </div>
              <button className={`${primaryButtonClass} mt-5 w-full`} disabled={!draftPreview || loading} type="submit">
                {loading ? "Publishing..." : "Share to story"}
              </button>
            </aside>

            <div className="grid min-h-[520px] place-items-center bg-[#111816] p-6">
              <div className="relative h-[480px] w-full max-w-[270px] overflow-hidden rounded-2xl bg-black shadow-2xl">
                {draftPreview ? (
                  draftType === "VIDEO" ? (
                    <video className="size-full object-cover" controls src={draftPreview} />
                  ) : (
                    <img alt="" className="size-full object-cover" src={draftPreview} />
                  )
                ) : (
                  <div className="grid size-full place-items-center px-8 text-center text-sm font-bold text-white/60">
                    Select a photo or video to preview.
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="nexo-story-row">
        <button
          className="nexo-story-card relative overflow-hidden rounded-2xl border border-dashed border-[#b8ad9b] bg-[#fffaf0] text-left"
          onClick={() => setCreating(true)}
          type="button"
        >
          <div className="grid h-28 place-items-center bg-[#17211f]">
            <span className="grid size-11 place-items-center rounded-full bg-[#f2c166] text-2xl font-black text-[#17211f]">
              +
            </span>
          </div>
          <div className="p-3">
            <p className="text-sm font-black">Create story</p>
            <p className="mt-1 text-xs text-[#6d746f]">Photo or video</p>
          </div>
        </button>

        {activeStories.slice(0, 7).map((story) => (
            <div
              className="nexo-story-card relative overflow-hidden rounded-2xl bg-[#17211f] text-white"
              key={story.id}
            >
            <button
              className="size-full text-left"
              onClick={() => {
                document.querySelectorAll("details[open]").forEach((element) => {
                  if (element instanceof HTMLDetailsElement) {
                    element.open = false;
                  }
                });
                setPreviewStory(story);
              }}
              type="button"
            >
              {story.mediaType === "IMAGE" ? (
                <img alt="" className="size-full object-cover" src={mediaSrc(story.mediaUrl)} />
              ) : (
                <div className="grid size-full place-items-center bg-[#263532] px-4 text-center text-sm font-bold">
                  {story.mediaType === "VIDEO" ? "Video" : "Stream"}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-12">
                <p className="text-sm font-bold">{story.authorName}</p>
                {story.caption && <p className="line-clamp-2 text-xs">{story.caption}</p>}
              </div>
            </button>
          </div>
        ))}
      </div>

      {activePreviewStory && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#111816]/90 px-4">
          <button
            className="absolute left-5 top-5 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
            onClick={() => setPreviewStory(null)}
            type="button"
          >
            Close
          </button>
          <div className="relative h-[86vh] w-full max-w-[430px] overflow-hidden rounded-2xl bg-black shadow-2xl">
            {activePreviewStory.mediaType === "VIDEO" ? (
              <video className="size-full object-contain" controls src={mediaSrc(activePreviewStory.mediaUrl)} />
            ) : (
              <img alt="" className="size-full object-contain" src={mediaSrc(activePreviewStory.mediaUrl)} />
            )}
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-4">
              <div className="flex items-center gap-3 text-white">
                <Avatar name={activePreviewStory.authorName} src={activePreviewStory.authorAvatar} size="sm" />
                <div>
                  <p className="text-sm font-black">{activePreviewStory.authorName}</p>
                  <p className="text-xs text-white/70">
                    {new Date(activePreviewStory.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            {activePreviewStory.caption && (
              <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-5 pt-16 text-sm font-semibold text-white">
                {activePreviewStory.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Composer({
  lives,
  liveMessages,
  loading,
  myPages,
  onUploadMedia,
  user,
  onEndLive,
  onSendLiveMessage,
  onStartLive,
  onSubmit,
  onUpdateLiveFrame,
}: {
  lives: LiveSession[];
  liveMessages: Record<string, LiveChatMessage[]>;
  loading: boolean;
  myPages: SocialPage[];
  onUploadMedia: (file: File) => Promise<{ url: string; mediaType: "IMAGE" | "VIDEO" }>;
  user: User;
  onEndLive: (id: string, recordingUrl?: string) => void;
  onSendLiveMessage: (event: FormEvent<HTMLFormElement>, liveId: string) => void;
  onStartLive: (title: string) => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateLiveFrame: (id: string, file: File) => Promise<void>;
}) {
  const [liveOpen, setLiveOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const finalizingLiveRef = useRef(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const frameUploadBusyRef = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [addOptionsOpen, setAddOptionsOpen] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [postFeeling, setPostFeeling] = useState("");
  const [postLocation, setPostLocation] = useState("");
  const [feelingOpen, setFeelingOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const myLive = lives.find((live) => live.hostId === user.id);
  const myLiveMessages = myLive ? liveMessages[myLive.id] ?? [] : [];

  useEffect(() => {
    if (liveVideoRef.current && liveStreamRef.current) {
      liveVideoRef.current.srcObject = liveStreamRef.current;
    }
  }, [liveOpen, cameraReady]);

  async function enableCamera() {
    setCameraError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      liveStreamRef.current = stream;
      setCameraReady(true);

      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError("Could not access camera or microphone.");
    }
  }

  function stopCamera() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    liveStreamRef.current?.getTracks().forEach((track) => track.stop());
    liveStreamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setCameraReady(false);
  }

  async function submitLive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = String(new FormData(event.currentTarget).get("title")).trim();

    if (title && cameraReady) {
      await onStartLive(title);
      startRecording();
    }
  }

  function startRecording() {
    const stream = liveStreamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") {
      return;
    }

    chunksRef.current = [];
    const options = MediaRecorder.isTypeSupported("video/webm")
      ? { mimeType: "video/webm" }
      : undefined;
    const recorder = new MediaRecorder(stream, options);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.start(1000);
    recorderRef.current = recorder;
  }

  async function finishLive(id: string) {
    if (finalizingLiveRef.current) {
      return;
    }

    finalizingLiveRef.current = true;
    setCameraError("");
    try {
      const recordingUrl = await stopRecordingAndUpload();
      if (!recordingUrl) {
        setCameraError("The recording could not be saved. The live is still active so you can try again.");
        return;
      }

      await onEndLive(id, recordingUrl);
      stopCamera();
      setLiveOpen(false);
    } finally {
      finalizingLiveRef.current = false;
    }
  }

  const publishFrame = useCallback(async (liveId: string) => {
    const video = liveVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight || frameUploadBusyRef.current) {
      return;
    }

    frameUploadBusyRef.current = true;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = Math.round((video.videoHeight / video.videoWidth) * canvas.width);
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.62));
      if (!blob) {
        return;
      }

      const file = new File([blob], `live-frame-${Date.now()}.jpg`, { type: "image/jpeg" });
      await onUpdateLiveFrame(liveId, file);
    } catch {
      // Best-effort preview frame.
    } finally {
      frameUploadBusyRef.current = false;
    }
  }, [onUpdateLiveFrame]);

  useEffect(() => {
    if (!myLive || !cameraReady) {
      return;
    }

    const id = window.setInterval(() => {
      void publishFrame(myLive.id);
    }, 1000);
    void publishFrame(myLive.id);

    return () => window.clearInterval(id);
  }, [myLive, cameraReady, publishFrame]);

  function stopRecordingAndUpload() {
    return new Promise<string | undefined>((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(undefined);
        return;
      }

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        chunksRef.current = [];

        if (!blob.size) {
          resolve(undefined);
          return;
        }

        try {
          const file = new File([blob], `live-${Date.now()}.webm`, { type: "video/webm" });
          const uploaded = await onUploadMedia(file);
          resolve(uploaded.url);
        } catch {
          setCameraError("Could not save the live recording.");
          resolve(undefined);
        }
      };
      recorder.stop();
    });
  }

  function clearMedia() {
    setSelectedMedia(null);
    if (mediaInputRef.current) {
      mediaInputRef.current.value = "";
    }
  }

  function closeComposer() {
    setExpanded(false);
    setAddOptionsOpen(false);
    setFeelingOpen(false);
    setLocationOpen(false);
  }

  return (
    <>
      {!expanded ? <section className="nexo-composer rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm">
        <div className="nexo-composer-main">
          <Avatar name={user.name} src={user.avatar} size="md" />
          <button className="nexo-composer-prompt text-left" type="button" onClick={() => setExpanded(true)}>
            What&apos;s on your mind, {user.name}?
          </button>
          <div className="nexo-composer-actions">
            <button aria-label="Add video" className="nexo-composer-action nexo-composer-video" type="button" onClick={() => setExpanded(true)}>
              <ComposerIcon type="video" />
            </button>
            <button aria-label="Add photo" className="nexo-composer-action nexo-composer-photo" type="button" onClick={() => setExpanded(true)}>
              <ComposerIcon type="photo" />
            </button>
            <button aria-label="Start live" className="nexo-composer-action nexo-composer-live" onClick={() => setLiveOpen(true)} type="button">
              <ComposerIcon type="feeling" />
            </button>
          </div>
        </div>
      </section> : <form className="fixed inset-0 z-50 grid place-items-start bg-black/55 p-4 sm:place-items-center" onSubmit={(event) => {
        void onSubmit(event);
        clearMedia();
        setPostContent("");
        setPostFeeling("");
        setPostLocation("");
        closeComposer();
      }}>
        <section aria-modal="true" className="nexo-post-modal-card max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
          <header className="nexo-composer-modal-header">
            <h2>Create post</h2>
            <button aria-label="Close" type="button" onClick={closeComposer}>×</button>
          </header>
          <div className="nexo-post-modal-body">
            <div className="nexo-composer-main">
              <Avatar name={user.name} src={user.avatar} size="md" />
              <div className="nexo-composer-identity">
                <strong>{user.name}</strong>
                <select aria-label="Audience" name="audience" defaultValue="PUBLIC">
                  <option value="PUBLIC">Public</option><option value="FRIENDS">Friends</option><option value="ONLY_ME">Only me</option>
                </select>
                {myPages.length > 0 && <select aria-label="Post as" name="pageId"><option value="">Post as {user.name}</option>{myPages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}</select>}
              </div>
            </div>
            <textarea autoFocus className="nexo-post-modal-text" name="content" onChange={(event) => setPostContent(event.currentTarget.value)} placeholder={`What's on your mind, ${user.name}?`} value={postContent} />
            <div className="nexo-composer-fields">
            <input
              ref={mediaInputRef}
              accept="image/*,video/*"
              className="hidden"
              name="mediaFile"
              type="file"
              onChange={(event) => setSelectedMedia(event.currentTarget.files?.[0] ?? null)}
            />
            {selectedMedia && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#ded7c9] bg-[#fffdf8] px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-bold text-[#17211f]">{selectedMedia.name}</p>
                  <p className="text-xs text-[#6d746f]">
                    Selected {selectedMedia.type.startsWith("video/") ? "video" : "photo"}
                  </p>
                </div>
                <button className="rounded-lg bg-[#ece7dc] px-3 py-1.5 text-xs font-bold hover:bg-[#ded7c9]" type="button" onClick={clearMedia}>
                  Remove
                </button>
              </div>
            )}
            {feelingOpen && <label className="block text-sm font-bold text-[#17211f]">Feeling or activity<select className={`${inputClass} mt-2`} name="feeling" value={postFeeling} onChange={(event) => setPostFeeling(event.currentTarget.value)}><option value="">Choose a feeling</option><option value="Feeling grateful">Feeling grateful</option><option value="Feeling excited">Feeling excited</option><option value="Feeling happy">Feeling happy</option><option value="Celebrating">Celebrating</option><option value="Working">Working</option></select></label>}
            {locationOpen && <label className="block text-sm font-bold text-[#17211f]">Location<input className={`${inputClass} mt-2`} name="location" placeholder="Where are you?" value={postLocation} onChange={(event) => setPostLocation(event.currentTarget.value)} /></label>}
            {!feelingOpen && postFeeling && <input name="feeling" type="hidden" value={postFeeling} />}
            {!locationOpen && postLocation && <input name="location" type="hidden" value={postLocation} />}
            </div>
            <section className="nexo-composer-add-bar">
          <strong>Add to your post</strong>
          <div>
            <button aria-label="Photo or video" className="nexo-composer-photo" type="button" onClick={() => mediaInputRef.current?.click()}><ComposerIcon type="photo" /></button>
            <button aria-label="Tag people" className="nexo-composer-tag" type="button"><ComposerIcon type="tag" /></button>
            <button aria-label="Feeling or activity" className="nexo-composer-live" type="button" onClick={() => setFeelingOpen((open) => !open)}><ComposerIcon type="feeling" /></button>
            <button aria-label="Location" className="nexo-composer-location" type="button" onClick={() => setLocationOpen((open) => !open)}><ComposerIcon type="location" /></button>
            <button aria-label="GIF" className="nexo-composer-gif" type="button"><ComposerIcon type="gif" /></button>
            <button aria-label="More post options" className="nexo-composer-more" type="button" onClick={() => setAddOptionsOpen(true)}>•••</button>
          </div>
            </section>
            <div className="nexo-composer-submit">
          <button disabled={loading || !postContent.trim()} type="submit">
            {loading ? "Publishing..." : "Post"}
          </button>
            </div>
          </div>
          {addOptionsOpen && <ComposerAddOptions onBack={() => setAddOptionsOpen(false)} onLive={() => { closeComposer(); setLiveOpen(true); }} onPhoto={() => { setAddOptionsOpen(false); mediaInputRef.current?.click(); }} />}
        </section>
      </form>}

      {myLive && (
        <section className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
          <div className="grid lg:grid-cols-[1fr_320px]">
            <div className="bg-[#090b0b] p-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-black uppercase">
                    <span className="size-2 rounded-full bg-white" />
                    Live
                  </p>
                  <h2 className="mt-3 text-xl font-black">{myLive.title}</h2>
                  <p className="mt-1 text-xs text-white/60">
                    Started {new Date(myLive.startedAt).toLocaleTimeString()}
                  </p>
                </div>
                <button className="rounded-xl bg-white px-4 py-2 text-sm font-black text-[#111816]" type="button" onClick={() => void finishLive(myLive.id)}>
                  Finalizar
                </button>
              </div>
              <div className="mt-4 grid aspect-video place-items-center rounded-2xl border border-white/10 bg-black text-sm font-bold text-white/50">
                Live broadcast panel
              </div>
            </div>
            <LiveChatPanel
              live={myLive}
              messages={myLiveMessages}
              onSend={onSendLiveMessage}
            />
          </div>
        </section>
      )}

      {liveOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#111816]/85 px-4 backdrop-blur-sm">
          <div
            className={`grid max-h-[92vh] w-full overflow-hidden rounded-2xl bg-white shadow-2xl ${
              myLive ? "max-w-7xl md:grid-cols-[1fr_300px_340px]" : "max-w-5xl md:grid-cols-[1fr_320px]"
            }`}
          >
            <div className="bg-[#111816] p-5">
              <div className="relative overflow-hidden rounded-2xl bg-black">
                {cameraReady ? (
                  <video
                    ref={liveVideoRef}
                    autoPlay
                    className="aspect-video w-full object-cover"
                    muted
                    playsInline
                  />
                ) : (
                  <div className="grid aspect-video place-items-center px-8 text-center text-sm font-bold text-white/60">
                    Turn on the camera to preview your live.
                  </div>
                )}
                <div className="absolute left-4 top-4 rounded-full bg-red-600 px-3 py-1 text-xs font-black uppercase text-white">
                  {myLive ? "Live" : "Live preview"}
                </div>
              </div>
            </div>

            <form className="grid content-between gap-4 p-5" onSubmit={submitLive}>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-black">{myLive ? "Live panel" : "Create live"}</h2>
                  <button
                    className={secondaryButtonClass}
                    type="button"
                    onClick={() => {
                      if (!myLive) {
                        stopCamera();
                      }
                      setLiveOpen(false);
                    }}
                  >
                    Close
                  </button>
                </div>
                <p className="mt-2 text-sm text-[#6d746f]">
                  {myLive
                    ? "Manage your broadcast and chat in real time."
                    : "Broadcast from your camera. The session is registered as an active live in the app."}
                </p>
                {myLive ? (
                  <div className="mt-5 rounded-2xl bg-red-50 p-4">
                    <p className="text-xs font-black uppercase text-red-700">Transmitiendo</p>
                    <h3 className="mt-1 text-base font-black">{myLive.title}</h3>
                    <p className="mt-1 text-xs text-[#6d746f]">
                      Started {new Date(myLive.startedAt).toLocaleTimeString()}
                    </p>
                  </div>
                ) : (
                  <input className={`${inputClass} mt-5`} name="title" placeholder="Title del live" required />
                )}
                {cameraError && <p className="mt-3 text-sm font-semibold text-red-700">{cameraError}</p>}
              </div>

              <div className="grid gap-2">
                <button className={secondaryButtonClass} type="button" onClick={cameraReady ? stopCamera : enableCamera}>
                  {cameraReady ? "Turn off camera" : "Turn on camera"}
                </button>
                {myLive ? (
                  <button className={primaryButtonClass} type="button" onClick={() => void finishLive(myLive.id)}>
                    Finalizar live
                  </button>
                ) : (
                  <button className={primaryButtonClass} disabled={!cameraReady || loading} type="submit">
                    {loading ? "Starting..." : "Start broadcast"}
                  </button>
                )}
              </div>
            </form>

            {myLive && (
              <LiveChatPanel
                live={myLive}
                messages={myLiveMessages}
                onSend={onSendLiveMessage}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ComposerIcon({ type }: { type: "video" | "photo" | "feeling" | "tag" | "location" | "gif" }) {
  if (type === "video") {
    return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h8A2.5 2.5 0 0 1 16 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 3 16.5v-9Zm14 3.2 3.3-2.1A.45.45 0 0 1 21 9v6a.45.45 0 0 1-.7.4L17 13.3v-2.6Z" /></svg>;
  }

  if (type === "photo") {
    return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4.5 3h15A2.5 2.5 0 0 1 22 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 18.5v-13A2.5 2.5 0 0 1 4.5 3ZM6 17h12l-3.7-4.5-2.6 3.1-1.8-2.1L6 17Zm2-8.2a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4Z" /></svg>;
  }

  if (type === "tag") {
    return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8.2 11.4a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM2.5 19a5.7 5.7 0 0 1 11.4 0v1.5H2.5V19Zm13.2-8.6a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4Zm-.6 2.2a4.8 4.8 0 0 1 6.4 4.5v1.4h-5.3A7.7 7.7 0 0 0 15.1 12.6Z" /></svg>;
  }

  if (type === "location") {
    return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2.8a7.2 7.2 0 0 0-7.2 7.2c0 5.3 7.2 11.2 7.2 11.2s7.2-5.9 7.2-11.2A7.2 7.2 0 0 0 12 2.8Zm0 10a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6Z" /></svg>;
  }

  if (type === "gif") {
    return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4.5 4h15A2.5 2.5 0 0 1 22 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 17.5v-11A2.5 2.5 0 0 1 4.5 4Zm2.2 4v8H12v-2H9v-1h2v-1H6.7V8Zm6.8 0v8h2V8h-2Zm3.5 0v8h2v-3h2v-2h-2V10h2V8h-4Z" /></svg>;
  }

  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Zm-3 6.2a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Zm6 0a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Zm-7 4.5h8a4.2 4.2 0 0 1-8 0Z" /></svg>;
}

function ComposerAddOptions({ onBack, onLive, onPhoto }: { onBack: () => void; onLive: () => void; onPhoto: () => void }) {
  const options: { label: string; type: "photo" | "tag" | "feeling" | "location" | "gif" | "video"; onClick?: () => void }[] = [
    { label: "Photo/video", type: "photo", onClick: onPhoto },
    { label: "Tag people", type: "tag" },
    { label: "Feeling/activity", type: "feeling" },
    { label: "Check in", type: "location" },
    { label: "GIF", type: "gif" },
    { label: "Live video", type: "video", onClick: onLive },
  ];

  return <section className="nexo-composer-add-sheet">
    <header><button aria-label="Back" type="button" onClick={onBack}>←</button><h2>Add to your post</h2></header>
    <div>{options.map((option) => <button key={option.label} type="button" onClick={option.onClick}><ComposerIcon type={option.type} /><span>{option.label}</span></button>)}</div>
  </section>;
}

function FeedPost({
  post,
  viewerId,
  onComment,
  onCommentDelete,
  onCommentEdit,
  onDelete,
  onEdit,
  onOpenProfile,
  onReact,
  onReport,
  onShare,
}: {
  post: Post;
  viewerId: string;
  onComment: (event: FormEvent<HTMLFormElement>, postId: string) => void;
  onCommentDelete: (commentId: string) => void;
  onCommentEdit: (comment: Post["comments"][number]) => void;
  onDelete: (postId: string) => void;
  onEdit: (post: Post) => void;
  onOpenProfile: (userId: string) => void;
  onReact: (postId: string, reactionType?: Post["reactionTypeByMe"] extends null ? never : NonNullable<Post["reactionTypeByMe"]>) => void;
  onReport: (post: Post) => void;
  onShare: (post: Post) => void;
}) {
  const canManage = post.author.id === viewerId;
  const [commentOpen, setCommentOpen] = useState(false);
  const [reactionOpen, setReactionOpen] = useState(false);
  const reactionPressTimer = useRef<number | null>(null);
  const suppressReactionClick = useRef(false);
  const commentLabel = post.commentCount === 1 ? "comment" : "comments";
  const actor = post.page ?? post.author;
  const reactions: { type: NonNullable<Post["reactionTypeByMe"]>; label: string; symbol: string }[] = [
    { type: "LIKE", label: "Like", symbol: "👍" },
    { type: "LOVE", label: "Love", symbol: "❤️" },
    { type: "CARE", label: "Care", symbol: "🤗" },
    { type: "HAHA", label: "Haha", symbol: "😆" },
    { type: "WOW", label: "Wow", symbol: "😮" },
    { type: "SAD", label: "Sad", symbol: "😢" },
    { type: "ANGRY", label: "Angry", symbol: "😡" },
  ];
  const activeReaction = reactions.find((reaction) => reaction.type === post.reactionTypeByMe);

  function startReactionPress() {
    suppressReactionClick.current = false;
    reactionPressTimer.current = window.setTimeout(() => {
      suppressReactionClick.current = true;
      setReactionOpen(true);
      reactionPressTimer.current = null;
    }, 450);
  }

  function endReactionPress() {
    if (reactionPressTimer.current !== null) {
      window.clearTimeout(reactionPressTimer.current);
      reactionPressTimer.current = null;
    }
  }

  return (
    <article className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-3 text-left" type="button" onClick={() => onOpenProfile(post.author.id)}>
            <Avatar name={actor.name} src={actor.avatar} size="md" />
          <div>
            <h2 className="text-sm font-semibold">{actor.name}</h2>
            <p className="text-xs text-[#6d746f]">
              {post.page ? `${post.page.category || "Page"} · ` : ""}
              {new Date(post.createdAt).toLocaleString()}
            </p>
          </div>
          </button>
        </div>
        <ActionMenu
          items={canManage ? [
            {
              icon: "E",
              label: "Edit post",
              description: "Change this post text.",
              onClick: () => onEdit(post),
            },
            {
              destructive: true,
              icon: "D",
              label: "Delete post",
              description: "Remove it from your profile and feed.",
              onClick: () => onDelete(post.id),
            },
          ] : [
            {
              destructive: true,
              icon: "R",
              label: "Report post",
              description: "Send this post to moderation.",
              onClick: () => onReport(post),
            },
          ]}
        />
      </div>
      <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-[#6d746f]">
        {post.audience === "FRIENDS" ? "Friends" : post.audience === "ONLY_ME" ? "Only me" : "Public"}
      </p>
      <p className="mt-4 whitespace-pre-wrap text-[15px] leading-6">{post.content}</p>
      {(post.metadata.feeling || post.metadata.location) && <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[#53645f]">{post.metadata.feeling && <span>😊 {post.metadata.feeling}</span>}{post.metadata.location && <span>📍 {post.metadata.location}</span>}</p>}
      {post.mediaUrl && <PostMedia type={post.mediaType} url={post.mediaUrl} />}
      {post.sharedPost && (
        <div className="mt-4 rounded-xl border border-[#ded7c9] bg-[#fffdf8] p-3">
          <div className="mb-2 flex items-center gap-2">
            <Avatar name={post.sharedPost.author.name} src={post.sharedPost.author.avatar} size="sm" />
            <span className="text-sm font-black">{post.sharedPost.author.name}</span>
          </div>
          {post.sharedPost.content && <p className="whitespace-pre-wrap text-sm text-[#53645f]">{post.sharedPost.content}</p>}
          {post.sharedPost.mediaUrl && <PostMedia type={post.sharedPost.mediaType} url={post.sharedPost.mediaUrl} />}
        </div>
      )}
      {post.signature && (
        <p className="mt-3 rounded-xl border border-[#e7decd] bg-[#fff8e8] px-3 py-2 text-xs text-[#6d5b32]">
          Firmado por app signer {post.signerAddress?.slice(0, 6)}...
          {post.signerAddress?.slice(-4)}
        </p>
      )}
      <div className="mt-3 flex justify-between border-t border-[#eee8dc] pt-3 text-xs text-[#6d746f]">
        <span>{post.reactionCount} reactions</span>
        <span>{post.shareCount} shares</span>
        <button
          className="font-semibold hover:underline"
          type="button"
          onClick={() => setCommentOpen((open) => !open)}
        >
          {post.commentCount} {commentLabel}
        </button>
      </div>
      <div className="mt-4 flex border-t border-[#eee8dc] pt-2 text-sm text-[#65736f]">
        <div className="relative flex flex-1">
          <button
            aria-expanded={reactionOpen}
            className={`min-w-0 flex-1 rounded-xl py-2 font-semibold hover:bg-[#ece7dc] ${post.reactedByMe ? "text-[#b8741a]" : ""}`}
            type="button"
            onClick={() => {
              if (suppressReactionClick.current) {
                suppressReactionClick.current = false;
                return;
              }
              onReact(post.id, activeReaction?.type ?? "LIKE");
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              endReactionPress();
              setReactionOpen(true);
            }}
            onPointerCancel={endReactionPress}
            onPointerDown={startReactionPress}
            onPointerLeave={endReactionPress}
            onPointerUp={endReactionPress}
          >
            {activeReaction ? `${activeReaction.symbol} ${activeReaction.label}` : "Like"}
          </button>
          {reactionOpen && (
            <div className="absolute bottom-11 left-0 z-10 flex rounded-full border border-[#ded7c9] bg-white p-1 shadow-xl">
              {reactions.map((reaction) => <button aria-label={reaction.label} className="grid size-9 place-items-center rounded-full text-lg hover:bg-[#f4efe5]" key={reaction.type} type="button" onClick={() => { onReact(post.id, reaction.type); setReactionOpen(false); }}>{reaction.symbol}</button>)}
            </div>
          )}
        </div>
        <button
          className="flex-1 rounded-xl py-2 font-semibold hover:bg-[#ece7dc]"
          type="button"
          onClick={() => setCommentOpen((open) => !open)}
        >
          Comment
        </button>
        <button className="flex-1 rounded-xl py-2 font-semibold hover:bg-[#ece7dc]" type="button" onClick={() => onShare(post)}>
          Share
        </button>
      </div>
      <div className="mt-3 space-y-3">
        {post.comments.map((comment) => (
          <div className="flex gap-2" key={comment.id}>
            <button type="button" onClick={() => onOpenProfile(comment.author.id)}>
              <Avatar name={comment.author.name} src={comment.author.avatar} size="sm" />
            </button>
            <div className="rounded-xl bg-[#f4efe5] px-3 py-2">
              <p className="text-xs font-semibold">{comment.author.name}</p>
              <p className="text-sm">{comment.content}</p>
              <p className="mt-1 text-[11px] text-[#6d746f]">
                firmado {comment.signerAddress.slice(0, 6)}...
                {comment.signerAddress.slice(-4)}
              </p>
            </div>
            {comment.author.id === viewerId && (
              <ActionMenu
                items={[
                  {
                    icon: "E",
                    label: "Edit comment",
                    description: "Change this comment text.",
                    onClick: () => onCommentEdit(comment),
                  },
                  {
                    destructive: true,
                    icon: "D",
                    label: "Delete comment",
                    description: "Remove this comment.",
                    onClick: () => onCommentDelete(comment.id),
                  },
                ]}
              />
            )}
          </div>
        ))}
        {commentOpen && (
          <form className="flex gap-2" onSubmit={(event) => onComment(event, post.id)}>
            <input
              autoFocus
              className="min-w-0 flex-1 rounded-xl border border-[#ded7c9] bg-[#fffdf8] px-4 py-2 text-sm outline-none focus:border-[#49625b] focus:ring-2 focus:ring-[#49625b]/10"
              name="comment"
              placeholder="Write a comment..."
            />
            <button className={secondaryButtonClass} type="submit">
              Send
            </button>
          </form>
        )}
      </div>
    </article>
  );
}

function PostMedia({
  type,
  url,
}: {
  type: Post["mediaType"];
  url: string;
}) {
  if (type === "VIDEO") {
    return (
      <video
        className="mt-4 max-h-[520px] w-full rounded-2xl bg-black object-contain"
        controls
        src={mediaSrc(url)}
      />
    );
  }

  if (type === "STREAM") {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#ded7c9] bg-[#17211f]">
        <div className="flex items-center justify-between px-4 py-3 text-white">
          <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-black uppercase">Live</span>
          <a className="text-sm font-bold text-[#f2c166]" href={mediaSrc(url)} rel="noreferrer" target="_blank">
            Open stream
          </a>
        </div>
        <div className="grid min-h-48 place-items-center px-6 pb-6 text-center text-sm text-white/80">
          External stream connected to this post.
        </div>
      </div>
    );
  }

  return (
    <img
      alt=""
      className="mt-4 max-h-[620px] w-full rounded-2xl object-cover"
      src={mediaSrc(url)}
    />
  );
}

function RightRail({
  friends,
  onOpenProfile,
  requests,
  suggestions,
  wallet,
  onAccept,
  onAdd,
  onReject,
}: {
  friends: User[];
  onOpenProfile: (userId: string) => void;
  requests: FriendRequest[];
  suggestions: User[];
  wallet: WalletAccount | null;
  onAccept: (id: string) => void;
  onAdd: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <aside className="hidden space-y-4 xl:block">
      <Panel title="Cuenta onchain">
        {wallet ? (
          <OnchainIdentity wallet={wallet} />
        ) : (
          <EmptyText>Wallet pendiente.</EmptyText>
        )}
      </Panel>

      <Panel title="Friend requests">
        {requests.length === 0 ? (
          <EmptyText>No pending requests.</EmptyText>
        ) : (
          requests.map((request) => (
            <div className="space-y-2" key={request.id}>
              <PersonRow user={request.requester} onOpenProfile={onOpenProfile} />
              <div className="grid grid-cols-2 gap-2">
                <button className={primaryButtonClass} onClick={() => onAccept(request.id)}>
                  Confirm
                </button>
                <button className={secondaryButtonClass} onClick={() => onReject(request.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </Panel>

      <Panel title="People you may know">
        {suggestions.length === 0 ? (
          <EmptyText>No suggestions yet.</EmptyText>
        ) : (
          suggestions.map((user) => (
            <div className="flex items-center justify-between gap-3" key={user.id}>
              <PersonRow user={user} onOpenProfile={onOpenProfile} />
              <button className={secondaryButtonClass} onClick={() => onAdd(user.id)}>
                Add
              </button>
            </div>
          ))
        )}
      </Panel>

      <Panel title="Contacts">
        {friends.length === 0 ? (
          <EmptyText>You have not added any friends yet.</EmptyText>
        ) : (
          friends.map((friend) => <PersonRow key={friend.id} user={friend} onOpenProfile={onOpenProfile} />)
        )}
      </Panel>
    </aside>
  );
}

function FriendsPage({
  friends,
  onMessage,
  onOpenProfile,
  requests,
  suggestions,
  onAccept,
  onAdd,
  onReject,
}: {
  friends: User[];
  onMessage: (userId: string) => void;
  onOpenProfile: (userId: string) => void;
  requests: FriendRequest[];
  suggestions: User[];
  onAccept: (id: string) => void;
  onAdd: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <section className="nexo-friends-page space-y-9 p-5 sm:p-8">
      <section id="friend-suggestions">
        <div className="mb-4 flex items-center justify-between gap-4 sm:hidden">
          <h1 className="text-2xl font-black tracking-tight text-[#17211f]">Friends</h1>
          <button aria-label="Search friends" className="grid size-10 place-items-center rounded-full bg-[#e4e6eb] text-xl" type="button">⌕</button>
        </div>
        <nav className="mb-6 flex gap-2 overflow-x-auto sm:hidden" aria-label="Friends sections">
          <a className="shrink-0 rounded-full bg-[#e4e6eb] px-4 py-1.5 text-sm font-bold text-[#17211f]" href="#friend-requests">Friend requests</a>
          <a className="shrink-0 rounded-full bg-[#e4e6eb] px-4 py-1.5 text-sm font-bold text-[#17211f]" href="#my-friends">Your friends</a>
        </nav>
        <div className="mb-4 hidden items-center justify-between gap-4 sm:flex">
          <h2 className="text-xl font-black tracking-tight text-[#17211f]">People you may know</h2>
          <button className="text-sm font-bold text-[#1877f2] hover:underline" type="button">See all</button>
        </div>
        <h2 className="mb-2 text-base font-black text-[#17211f] sm:hidden">People you may know</h2>
        {suggestions.length === 0 ? <EmptyText>No suggestions yet.</EmptyText> : (
          <div className="grid grid-cols-1 gap-0 sm:grid-cols-[repeat(auto-fill,minmax(min(100%,11.5rem),1fr))] sm:gap-3">
            {suggestions.map((user) => <FriendSuggestionCard key={user.id} user={user} onAdd={onAdd} onOpenProfile={onOpenProfile} />)}
          </div>
        )}
      </section>

      <section id="friend-requests">
        <h2 className="mb-4 text-xl font-black tracking-tight text-[#17211f]">Friend requests</h2>
        {requests.length === 0 ? <EmptyText>No pending requests.</EmptyText> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {requests.map((request) => (
              <div className="rounded-xl border border-[#ded7c9] bg-white p-3 shadow-sm" key={request.id}>
                <PersonRow user={request.requester} onOpenProfile={onOpenProfile} />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className={primaryButtonClass} type="button" onClick={() => onAccept(request.id)}>Confirm</button>
                  <button className={secondaryButtonClass} type="button" onClick={() => onReject(request.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="my-friends">
        <h2 className="mb-4 text-xl font-black tracking-tight text-[#17211f]">All friends</h2>
        {friends.length === 0 ? <EmptyText>You have not added any friends yet.</EmptyText> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {friends.map((friend) => (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#ded7c9] bg-white p-3 shadow-sm" key={friend.id}>
                <PersonRow user={friend} onOpenProfile={onOpenProfile} />
                <button className={secondaryButtonClass} type="button" onClick={() => onMessage(friend.id)}>Message</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function FriendSuggestionCard({ onAdd, onOpenProfile, user }: { onAdd: (userId: string) => void; onOpenProfile: (userId: string) => void; user: User }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <article className="flex !rounded-none !shadow-none items-center gap-3 border-b border-[#e4e6eb] bg-white py-2 sm:block sm:!rounded-xl sm:overflow-hidden sm:border-[#ded7c9] sm:p-0 sm:!shadow-sm">
      <button aria-label={`Open ${user.name}'s profile`} className="size-16 shrink-0 overflow-hidden rounded-full bg-[#eceff3] sm:block sm:aspect-square sm:size-auto sm:w-full sm:rounded-none" type="button" onClick={() => onOpenProfile(user.id)}>
        {user.avatar ? <img alt="" className="size-full object-cover" src={mediaSrc(user.avatar)} /> : <span className="grid size-full place-items-center bg-[#17211f] text-2xl font-black text-[#f2c166]">{user.name.slice(0, 1).toUpperCase()}</span>}
      </button>
      <div className="min-w-0 flex-1 sm:p-3">
        <button className="block w-full truncate text-left text-base font-black text-[#17211f] hover:underline" type="button" onClick={() => onOpenProfile(user.id)}>{user.name}</button>
        <p className="mt-1 hidden truncate text-sm text-[#65736f] sm:block">Suggested for you</p>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:mt-3 sm:grid-cols-1">
          <button className="!min-h-0 rounded-lg bg-[#e7f3ff] px-3 py-1.5 text-xs font-bold text-[#1877f2] hover:bg-[#d8ebff] sm:py-2 sm:text-sm" type="button" onClick={() => onAdd(user.id)}>Add friend</button>
          <button className="!min-h-0 rounded-lg bg-[#e4e6eb] px-3 py-1.5 text-xs font-bold text-[#17211f] hover:bg-[#d8dade] sm:py-2 sm:text-sm" type="button" onClick={() => setDismissed(true)}>Remove</button>
        </div>
      </div>
    </article>
  );
}

function MessagesPage({
  activeConversation,
  conversations,
  draft,
  friends,
  messages,
  onDraftChange,
  onOpenConversation,
  onSelectConversation,
  onSendMessage,
  viewerId,
}: {
  activeConversation: Conversation | null;
  conversations: Conversation[];
  draft: string;
  friends: User[];
  messages: DirectMessage[];
  onDraftChange: (draft: string) => void;
  onOpenConversation: (userId: string) => void;
  onSelectConversation: (conversation: Conversation) => void;
  onSendMessage: (event: FormEvent<HTMLFormElement>) => void;
  viewerId: string;
}) {
  return (
    <section className="grid min-h-[calc(100vh-110px)] overflow-hidden rounded-2xl border border-[#ded7c9] bg-white shadow-sm lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="border-r border-[#eee8dc]">
        <div className="border-b border-[#eee8dc] p-4">
          <h1 className="text-2xl font-black">Messages</h1>
          <p className="mt-1 text-xs text-[#6d746f]">Direct messages signed by the app signer.</p>
        </div>
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-3">
          {conversations.map((conversation) => (
            <button
              className={`mb-2 flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-[#f7f5ef] ${
                activeConversation?.id === conversation.id ? "bg-[#f7f5ef]" : ""
              }`}
              key={conversation.id}
              type="button"
              onClick={() => void onSelectConversation(conversation)}
            >
              <Avatar name={conversation.peerName} src={conversation.peerAvatar} size="sm" />
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm font-black">{conversation.peerName}{conversation.unreadCount > 0 && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#1877f2] text-[10px] text-white">{conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}</span>}</p>
                <p className="truncate text-xs text-[#6d746f]">{conversation.lastMessage || "No messages yet"}</p>
              </div>
            </button>
          ))}
          {friends.length > 0 && (
            <div className="mt-4 border-t border-[#eee8dc] pt-3">
              <p className="mb-2 text-xs font-black uppercase text-[#65736f]">Start chat</p>
              {friends.map((friend) => (
                <button
                  className="mb-2 flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-[#f7f5ef]"
                  key={friend.id}
                  type="button"
                  onClick={() => void onOpenConversation(friend.id)}
                >
                  <Avatar name={friend.name} src={friend.avatar} size="sm" />
                  <span className="text-sm font-bold">{friend.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
      <div className="flex min-h-[560px] flex-col">
        {activeConversation ? (
          <>
            <header className="flex items-center gap-3 border-b border-[#eee8dc] p-4">
              <Avatar name={activeConversation.peerName} src={activeConversation.peerAvatar} size="sm" />
              <div>
                <h2 className="font-black">{activeConversation.peerName}</h2>
                <p className="text-xs text-[#6d746f]">Signed private chat</p>
              </div>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto bg-[#f7f5ef] p-4">
              {messages.map((message) => {
                const mine = message.senderId === viewerId;
                return (
                  <div className={`flex ${mine ? "justify-end" : "justify-start"}`} key={message.id}>
                    <div className={`max-w-[72%] rounded-2xl px-4 py-2 text-sm shadow-sm ${mine ? "bg-[#17211f] text-white" : "bg-white text-[#17211f]"}`}>
                      <p>{message.content}</p>
                      {message.signerAddress && (
                        <p className={`mt-1 text-[10px] ${mine ? "text-white/60" : "text-[#6d746f]"}`}>
                          firmado {message.signerAddress.slice(0, 6)}...{message.signerAddress.slice(-4)}
                        </p>
                      )}
                      {mine && message.readAt && <p className="mt-1 text-right text-[10px] text-white/60">Seen</p>}
                    </div>
                  </div>
                );
              })}
            </div>
            <form className="flex gap-2 border-t border-[#eee8dc] p-3" onSubmit={onSendMessage}>
              <input
                className="min-w-0 flex-1 rounded-full border border-[#ded7c9] px-4 py-3 text-sm outline-none focus:border-[#49625b]"
                name="content"
                onChange={(event) => onDraftChange(event.currentTarget.value)}
                placeholder="Write a message..."
                value={draft}
              />
              <button className={primaryButtonClass} type="submit">
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="grid flex-1 place-items-center p-8 text-center text-sm text-[#6d746f]">
            Select a conversation or start one from your friends.
          </div>
        )}
      </div>
    </section>
  );
}

function SearchPage({
  history,
  onOpenGroup,
  onOpenLive,
  onOpenPage,
  onOpenPost,
  onOpenProfile,
  onSearch,
  results,
}: {
  history: string[];
  onOpenGroup: (groupId: string) => void;
  onOpenLive: (liveId: string) => void;
  onOpenPage: (pageId: string) => void;
  onOpenPost: (postId: string) => void;
  onOpenProfile: (userId: string) => void;
  onSearch: (query: string) => void;
  results: SearchResults | null;
}) {
  return (
    <section className="space-y-4">
      <PageHeader
        kicker="Search"
        title={results ? `Results for "${results.query}"` : "Global search"}
        subtitle="Find people, pages, groups, posts, and lives in one place."
      />
      {history.length > 0 && (
        <div className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black uppercase text-[#65736f]">Busquedas recientes</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {history.map((item) => (
              <button className={secondaryButtonClass} key={item} type="button" onClick={() => onSearch(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
      {!results ? (
        <EmptyText>Escribe algo en la barra superior y presiona Enter.</EmptyText>
      ) : (
        <>
          <SearchSection title="Personas" empty="No encontramos personas.">
            {results.people.map((person) => (
              <button className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-[#f7f5ef]" key={person.id} type="button" onClick={() => onOpenProfile(person.id)}>
                <Avatar name={person.name} src={person.avatar} size="md" />
                <span>
                  <span className="block font-black">{person.name}</span>
                  {person.bio && <span className="block text-sm text-[#6d746f]">{person.bio}</span>}
                </span>
              </button>
            ))}
          </SearchSection>
          <SearchSection title="Pages" empty="No pages found.">
            {results.pages.map((page) => (
              <button className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-[#f7f5ef]" key={page.id} type="button" onClick={() => onOpenPage(page.id)}>
                <Avatar name={page.name} src={page.avatar} size="md" />
                <span>
                  <span className="block font-black">{page.name}</span>
                  <span className="block text-sm text-[#b8741a]">{page.category}</span>
                </span>
              </button>
            ))}
          </SearchSection>
          <SearchSection title="Groups" empty="No groups found.">
            {results.groups.map((group) => (
              <button className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-[#f7f5ef]" key={group.id} type="button" onClick={() => onOpenGroup(group.id)}>
                <div className="size-11 overflow-hidden rounded-xl bg-[#17211f]">
                  {group.cover && <img alt="" className="size-full object-cover" src={mediaSrc(group.cover)} />}
                </div>
                <span>
                  <span className="block font-black">{group.name}</span>
                  <span className="block text-sm text-[#6d746f]">{group.privacy}</span>
                </span>
              </button>
            ))}
          </SearchSection>
          <SearchSection title="Posts" empty="No posts found.">
            {results.posts.map((post) => (
              <button className="block w-full rounded-xl p-3 text-left hover:bg-[#f7f5ef]" key={post.id} type="button" onClick={() => onOpenPost(post.id)}>
                <span className="block text-sm font-black">{post.authorName}</span>
                <span className="mt-1 line-clamp-2 block text-sm text-[#53645f]">{post.content}</span>
              </button>
            ))}
          </SearchSection>
          <SearchSection title="Lives" empty="No encontramos lives.">
            {results.lives.map((live) => (
              <button className="block w-full rounded-xl p-3 text-left hover:bg-[#f7f5ef]" key={live.id} type="button" onClick={() => onOpenLive(live.id)}>
                <span className="block text-sm font-black">{live.title}</span>
                <span className="mt-1 block text-xs text-[#6d746f]">{live.hostName} · {live.status === "LIVE" ? "Live" : "Replay"}</span>
              </button>
            ))}
          </SearchSection>
        </>
      )}
    </section>
  );
}

function SearchSection({ children, empty, title }: { children: ReactNode; empty: string; title: string }) {
  const list = Children.toArray(children).filter(Boolean);
  return (
    <section className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm">
      <h2 className="text-sm font-black uppercase text-[#65736f]">{title}</h2>
      <div className="mt-3 space-y-1">{list.length ? list : <p className="text-sm text-[#6d746f]">{empty}</p>}</div>
    </section>
  );
}

function EventsPage({
  events,
  friends,
  loading,
  myGroups,
  myPages,
  onInvite,
  onOpenProfile,
  onRsvp,
  onSubmit,
}: {
  events: SocialEvent[];
  friends: User[];
  loading: boolean;
  myGroups: SocialGroup[];
  myPages: SocialPage[];
  onInvite: (event: FormEvent<HTMLFormElement>, eventId: string) => void;
  onOpenProfile: (userId: string) => void;
  onRsvp: (eventId: string, status: "GOING" | "INTERESTED") => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <section className="space-y-4">
      <PageHeader
        action={<button className={primaryButtonClass} type="button" onClick={() => setCreating(true)}>Create event</button>}
        kicker="Events"
        title="Events"
        subtitle="Create personal, page, or group events; invite friends and mark attendance or interest."
      />
      <CreateModal open={creating} title="Create event" onClose={() => setCreating(false)}>
        <form className="space-y-3" onSubmit={(event) => { void onSubmit(event); setCreating(false); }}>
          <div className="mt-4 space-y-3">
            <input className={inputClass} name="title" placeholder="Event name" required />
            <input className={inputClass} name="location" placeholder="Location" required />
            <input className={inputClass} name="startsAt" required type="datetime-local" />
            <textarea className={`${inputClass} min-h-24 resize-none`} name="description" placeholder="Description" />
            <select className={inputClass} name="pageId">
              <option value="">Personal event</option>
              {myPages.map((page) => <option key={page.id} value={page.id}>Page event: {page.name}</option>)}
            </select>
            <select className={inputClass} name="groupId">
              <option value="">No group</option>
              {myGroups.map((group) => <option key={group.id} value={group.id}>Group event: {group.name}</option>)}
            </select>
            <label className="block rounded-xl border border-dashed border-[#c9bfad] bg-[#f7f5ef] p-3 text-sm font-semibold text-[#53645f]">
              Event image
              <input className="mt-2 block w-full text-xs" name="imageFile" type="file" accept="image/*" />
            </label>
          </div>
          <button className={`${primaryButtonClass} mt-4 w-full`} disabled={loading} type="submit">
            Create event
          </button>
        </form>
      </CreateModal>
      <div>
        {events.length === 0 ? (
          <EmptyText>There are no events yet.</EmptyText>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {events.map((event) => (
              <article className="overflow-hidden rounded-2xl border border-[#ded7c9] bg-white shadow-sm" key={event.id}>
                <div className="grid aspect-video place-items-center bg-[#17211f] text-sm font-black text-white/60">
                  {event.imageUrl ? <img alt="" className="size-full object-cover" src={mediaSrc(event.imageUrl)} /> : "Event"}
                </div>
                <div className="p-4">
                  <p className="text-xs font-black uppercase text-[#b8741a]">
                    {event.pageName ? `Page: ${event.pageName}` : event.groupName ? `Group: ${event.groupName}` : "Personal event"}
                  </p>
                  <h2 className="mt-1 text-xl font-black">{event.title}</h2>
                  <p className="mt-1 text-sm text-[#6d746f]">{new Date(event.startsAt).toLocaleString()} · {event.location}</p>
                  {event.description && <p className="mt-3 text-sm text-[#53645f]">{event.description}</p>}
                  <button className="mt-4" type="button" onClick={() => onOpenProfile(event.hostId)}>
                    <PersonRow user={{ id: event.hostId, name: event.hostName, avatar: event.hostAvatar }} />
                  </button>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button className={event.myStatus === "GOING" ? primaryButtonClass : secondaryButtonClass} type="button" onClick={() => onRsvp(event.id, "GOING")}>
                      Going ({event.goingCount})
                    </button>
                    <button className={event.myStatus === "INTERESTED" ? primaryButtonClass : secondaryButtonClass} type="button" onClick={() => onRsvp(event.id, "INTERESTED")}>
                      Interested ({event.interestedCount})
                    </button>
                  </div>
                  <form className="mt-3 flex gap-2" onSubmit={(formEvent) => onInvite(formEvent, event.id)}>
                    <select className={`${inputClass} min-w-0 flex-1`} name="userId" required>
                      <option value="">Invite friend...</option>
                      {friends.map((friend) => <option key={friend.id} value={friend.id}>{friend.name}</option>)}
                    </select>
                    <button className={secondaryButtonClass}>Invite</button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MarketplacePage({
  loading,
  onContactSeller,
  onOpenProfile,
  onSubmit,
  products,
  viewerId,
}: {
  loading: boolean;
  onContactSeller: (sellerId: string, draft?: string) => void;
  onOpenProfile: (userId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  products: MarketplaceProduct[];
  viewerId: string;
}) {
  const categories = Array.from(new Set(products.map((product) => product.category))).sort();
  const [creating, setCreating] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const visibleProducts = products.filter((product) => {
    const matchesCategory = category === "All" || product.category === category;
    const searchable = `${product.title} ${product.description ?? ""} ${product.location} ${product.sellerName}`.toLowerCase();
    return matchesCategory && searchable.includes(query.trim().toLowerCase());
  });

  return (
    <section className="space-y-4">
      <PageHeader
        action={<button className={primaryButtonClass} type="button" onClick={() => setCreating(true)}>Sell product</button>}
        kicker="Marketplace"
        title="Marketplace"
        subtitle="List products with a photo, price, category, and location. Contact happens through Messenger in the app."
      />
      <CreateModal open={creating} title="Sell product" onClose={() => setCreating(false)}>
        <form className="space-y-3" onSubmit={(event) => { void onSubmit(event); setCreating(false); }}>
          <div className="mt-4 space-y-3">
            <input className={inputClass} name="title" placeholder="Product" required />
            <input className={inputClass} name="category" placeholder="Category" />
            <input className={inputClass} min="0" name="price" placeholder="Price" required step="0.01" type="number" />
            <input className={inputClass} name="location" placeholder="Location" required />
            <textarea className={`${inputClass} min-h-24 resize-none`} name="description" placeholder="Description" />
            <label className="block rounded-xl border border-dashed border-[#c9bfad] bg-[#f7f5ef] p-3 text-sm font-semibold text-[#53645f]">
              Product photo
              <input className="mt-2 block w-full text-xs" name="imageFile" type="file" accept="image/*" />
            </label>
          </div>
          <button className={`${primaryButtonClass} mt-4 w-full`} disabled={loading} type="submit">
            Post product
          </button>
        </form>
      </CreateModal>
      <div>
        <div className="space-y-4">
          {categories.length > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
              <input aria-label="Search Marketplace" className="min-w-0 flex-1 rounded-xl border border-[#ded7c9] bg-[#fffdf8] px-4 py-2 text-sm outline-none focus:border-[#49625b]" placeholder="Search Marketplace" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
              <div className="flex gap-2 overflow-x-auto pb-1 sm:max-w-[55%] sm:pb-0">
                {["All", ...categories].map((item) => (
                  <button className={`shrink-0 rounded-full px-3 py-2 text-xs font-black ${category === item ? "bg-[#17211f] text-white" : "bg-[#ece7dc] text-[#53645f] hover:bg-[#ded7c9]"}`} key={item} type="button" onClick={() => setCategory(item)}>{item}</button>
                ))}
              </div>
            </div>
          )}
          {visibleProducts.length === 0 ? (
            <EmptyText>{products.length ? "No products match your search." : "There are no products yet."}</EmptyText>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleProducts.map((product) => (
                <article className="overflow-hidden rounded-2xl border border-[#ded7c9] bg-white shadow-sm" key={product.id}>
                  <button aria-label={`View ${product.title}`} className="grid aspect-square w-full place-items-center bg-[#17211f] text-sm font-black text-white/60" type="button" onClick={() => setSelectedProduct(product)}>
                    {product.imageUrl ? <img alt="" className="size-full object-cover" src={mediaSrc(product.imageUrl)} /> : "No photo"}
                  </button>
                  <div className="p-4">
                    <p className="text-xs font-black uppercase text-[#b8741a]">{product.category}</p>
                    <button className="mt-1 block text-left text-lg font-black hover:underline" type="button" onClick={() => setSelectedProduct(product)}>{product.title}</button>
                    <p className="mt-1 text-xl font-black text-[#17211f]">{formatMoney(product.priceCents)}</p>
                    <p className="mt-1 text-sm text-[#6d746f]">{product.location}</p>
                    {product.description && <p className="mt-3 line-clamp-3 text-sm text-[#53645f]">{product.description}</p>}
                    <button className="mt-4 flex items-center gap-2 text-left" type="button" onClick={() => onOpenProfile(product.sellerId)}>
                      <Avatar name={product.sellerName} src={product.sellerAvatar} size="sm" />
                      <span className="text-sm font-semibold">{product.sellerName}</span>
                    </button>
                    {product.sellerId !== viewerId && (
                      <button className={`${primaryButtonClass} mt-4 w-full`} type="button" onClick={() => onContactSeller(product.sellerId, `Hi, is \"${product.title}\" still available?`)}>
                        Send message
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
      {selectedProduct && <MarketplaceDetailModal product={selectedProduct} viewerId={viewerId} onClose={() => setSelectedProduct(null)} onContactSeller={onContactSeller} onOpenProfile={onOpenProfile} />}
    </section>
  );
}

function MarketplaceDetailModal({ onClose, onContactSeller, onOpenProfile, product, viewerId }: { onClose: () => void; onContactSeller: (sellerId: string, draft?: string) => void; onOpenProfile: (userId: string) => void; product: MarketplaceProduct; viewerId: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-3 sm:p-6" role="presentation" onMouseDown={onClose}>
      <section aria-modal="true" className="max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl overflow-y-auto rounded-xl bg-white shadow-2xl" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[#e4e6eb] bg-white px-4">
          <p className="truncate text-sm font-bold text-[#65676b]">Marketplace</p>
          <button aria-label="Close" className="grid size-9 place-items-center rounded-full bg-[#e4e6eb] text-xl font-black text-[#17211f] hover:bg-[#d8dade]" type="button" onClick={onClose}>×</button>
        </header>
        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
          <div className="grid min-h-72 place-items-center bg-[#171717] sm:min-h-[32rem]">
            {product.imageUrl ? <img alt={product.title} className="max-h-[64dvh] w-full object-contain" src={mediaSrc(product.imageUrl)} /> : <span className="text-sm font-bold text-white/60">No photo available</span>}
          </div>
          <aside className="min-w-0 divide-y divide-[#e4e6eb]">
            <div className="p-5">
              <p className="text-3xl font-black text-[#050505]">{formatMoney(product.priceCents)}</p>
              <h2 className="mt-2 break-words text-2xl font-bold text-[#050505]">{product.title}</h2>
              <p className="mt-2 text-sm text-[#65676b]">{product.location}</p>
              <p className="mt-3 inline-flex rounded-full bg-[#f0f2f5] px-3 py-1 text-xs font-bold text-[#53645f]">{product.category}</p>
            </div>
            {product.description && <div className="p-5"><h3 className="text-base font-bold text-[#050505]">Description</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#1c1e21]">{product.description}</p></div>}
            <div className="p-5">
              <h3 className="text-base font-bold text-[#050505]">Seller information</h3>
              <button className="mt-3 flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-[#f0f2f5]" type="button" onClick={() => onOpenProfile(product.sellerId)}>
                <Avatar name={product.sellerName} src={product.sellerAvatar} size="md" />
                <span className="min-w-0"><span className="block truncate font-bold text-[#050505]">{product.sellerName}</span><span className="block text-sm text-[#65676b]">View profile</span></span>
              </button>
              {product.sellerId !== viewerId && <button className="mt-4 w-full rounded-lg bg-[#1877f2] px-4 py-3 text-sm font-bold text-white hover:bg-[#166fe5]" type="button" onClick={() => { onClose(); onContactSeller(product.sellerId, `Hi, is \"${product.title}\" still available?`); }}>Message seller</button>}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function formatMoney(priceCents: number) {
  return new Intl.NumberFormat("es-MX", { currency: "MXN", style: "currency" }).format(priceCents / 100);
}

function GroupsPage({
  groups,
  loading,
  myGroups,
  onCreate,
  onOpenGroup,
  onToggleJoin,
}: {
  groups: SocialGroup[];
  loading: boolean;
  myGroups: SocialGroup[];
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onOpenGroup: (group: SocialGroup) => void;
  onToggleJoin: (group: SocialGroup) => void;
}) {
  const myGroupIds = new Set(myGroups.map((group) => group.id));
  const [creating, setCreating] = useState(false);

  return (
    <section className="space-y-4">
      <PageHeader action={<button className={primaryButtonClass} type="button" onClick={() => setCreating(true)}>Create group</button>} kicker="Communities" title="Groups" subtitle="Create communities, join groups, and post in them." />
      <CreateModal open={creating} title="Create group" onClose={() => setCreating(false)}>
        <form className="space-y-3" onSubmit={(event) => { void onCreate(event); setCreating(false); }}>
          <div className="mt-4 space-y-3">
            <input className={inputClass} name="name" placeholder="Group name" required />
            <textarea className="min-h-28 w-full resize-none rounded-xl border border-[#ded7c9] bg-white px-4 py-3 text-sm outline-none focus:border-[#49625b]" name="description" placeholder="Description" />
            <select className={inputClass} name="privacy">
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
            <label className="block rounded-xl border border-dashed border-[#c9bfad] bg-[#f7f5ef] p-3 text-sm font-semibold text-[#53645f]">
              Cover
              <input className="mt-2 block w-full text-xs" name="coverFile" type="file" accept="image/*" />
            </label>
          </div>
          <button className={`${primaryButtonClass} mt-4 w-full`} disabled={loading} type="submit">
            Create group
          </button>
        </form>
      </CreateModal>
      <div className="space-y-4">
          <section className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-wide text-[#65736f]">Your groups</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {myGroups.length === 0 ? <EmptyText>You do not belong to any groups yet.</EmptyText> : myGroups.map((group) => (
                <GroupCard key={group.id} group={group} onOpen={onOpenGroup} onToggleJoin={onToggleJoin} />
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-wide text-[#65736f]">Explore groups</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {groups.length === 0 ? <EmptyText>There are no groups yet.</EmptyText> : groups.map((group) => (
                <GroupCard key={group.id} group={{ ...group, joinedByMe: group.joinedByMe || myGroupIds.has(group.id) }} onOpen={onOpenGroup} onToggleJoin={onToggleJoin} />
              ))}
            </div>
          </section>
      </div>
    </section>
  );
}

function GroupCard({
  group,
  onOpen,
  onToggleJoin,
}: {
  group: SocialGroup;
  onOpen: (group: SocialGroup) => void;
  onToggleJoin: (group: SocialGroup) => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[#ded7c9] bg-[#fffdf8] shadow-sm">
      <button className="block h-28 w-full bg-[#17211f] text-left" type="button" onClick={() => onOpen(group)}>
        {group.cover && <img alt="" className="size-full object-cover" src={mediaSrc(group.cover)} />}
      </button>
      <div className="p-4">
        <button className="block text-left" type="button" onClick={() => onOpen(group)}>
          <h3 className="text-lg font-black">{group.name}</h3>
        </button>
        <p className="mt-1 text-xs font-black uppercase text-[#b8741a]">{group.privacy}</p>
        {group.description && <p className="mt-2 line-clamp-3 text-sm text-[#6d746f]">{group.description}</p>}
        <p className="mt-3 text-xs text-[#8a8f8b]">{group.memberCount} miembros · {group.ownerName}</p>
        <button className={`${group.joinedByMe ? secondaryButtonClass : primaryButtonClass} mt-3 w-full`} type="button" onClick={() => onToggleJoin(group)}>
          {group.joinedByMe ? "Miembro" : "Unirme"}
        </button>
      </div>
    </article>
  );
}

function GroupDetail({
  group,
  onBack,
  onCommentDelete,
  onCommentEdit,
  onCommentPost,
  onCreatePost,
  onDeletePost,
  onEditPost,
  onOpenProfile,
  onReact,
  onReportPost,
  onShare,
  onToggleJoin,
  posts,
  viewerId,
}: {
  group: SocialGroup;
  onBack: () => void;
  onCommentDelete: (commentId: string) => void;
  onCommentEdit: (comment: Post["comments"][number]) => void;
  onCommentPost: (event: FormEvent<HTMLFormElement>, postId: string) => void;
  onCreatePost: (event: FormEvent<HTMLFormElement>) => void;
  onDeletePost: (postId: string) => void;
  onEditPost: (post: Post) => void;
  onOpenProfile: (userId: string) => void;
  onReact: (postId: string) => void;
  onReportPost: (post: Post) => void;
  onShare: (post: Post) => void;
  onToggleJoin: (group: SocialGroup) => void;
  posts: Post[];
  viewerId: string;
}) {
  return (
    <section className="mx-auto w-full max-w-[1100px] space-y-4">
      <button className={secondaryButtonClass} type="button" onClick={onBack}>Back to groups</button>
      <div className="overflow-hidden rounded-2xl border border-[#ded7c9] bg-white shadow-sm">
        <div className="h-64 bg-[#17211f]">{group.cover && <img alt="" className="size-full object-cover" src={mediaSrc(group.cover)} />}</div>
        <div className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-black">{group.name}</h1>
              <p className="mt-1 text-sm text-[#6d746f]">{group.memberCount} miembros · {group.privacy}</p>
              {group.description && <p className="mt-3 max-w-3xl text-sm leading-6 text-[#53645f]">{group.description}</p>}
            </div>
            <button className={group.joinedByMe ? secondaryButtonClass : primaryButtonClass} type="button" onClick={() => onToggleJoin(group)}>
              {group.joinedByMe ? "Miembro" : "Unirme"}
            </button>
          </div>
        </div>
      </div>
      {group.joinedByMe && <GroupPostComposer group={group} onSubmit={onCreatePost} />}
      {posts.length === 0 ? (
        <p className="rounded-2xl border border-[#ded7c9] bg-white p-8 text-center text-sm text-[#6d746f] shadow-sm">This group has no posts yet.</p>
      ) : (
        <div className="space-y-4">{posts.map((post) => (
          <FeedPost
            key={post.id}
            post={post}
            viewerId={viewerId}
            onComment={onCommentPost}
            onCommentDelete={onCommentDelete}
            onCommentEdit={onCommentEdit}
            onDelete={onDeletePost}
            onEdit={onEditPost}
            onOpenProfile={onOpenProfile}
            onReact={onReact}
            onReport={onReportPost}
            onShare={onShare}
          />
        ))}</div>
      )}
    </section>
  );
}

function GroupPostComposer({ group, onSubmit }: { group: SocialGroup; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm" onSubmit={onSubmit}>
      <input name="groupId" type="hidden" value={group.id} />
      <textarea className="min-h-24 w-full resize-none rounded-xl border border-[#ded7c9] bg-[#fffdf8] px-4 py-3 text-sm outline-none focus:border-[#49625b]" name="content" placeholder={`Post in ${group.name}`} />
      <div className="mt-3 flex justify-end border-t border-[#eee8dc] pt-3">
        <button className={primaryButtonClass} type="submit">Post</button>
      </div>
    </form>
  );
}

function PagesPage({
  loading,
  myPages,
  onFollow,
  onOpenPage,
  pages,
  onSubmit,
}: {
  loading: boolean;
  myPages: SocialPage[];
  onFollow: (pageId: string) => void;
  onOpenPage: (page: SocialPage) => void;
  pages: SocialPage[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const managedPageIds = new Set(myPages.map((page) => page.id));
  const [creating, setCreating] = useState(false);

  return (
    <section className="space-y-4">
      <PageHeader
        action={<button className={primaryButtonClass} type="button" onClick={() => setCreating(true)}>Create page</button>}
        kicker="Comunidad"
        title="Pages"
        subtitle="Create a presence for brands, creators, businesses, or projects with a cover, photo, and public information."
      />

      <CreateModal open={creating} title="Create page" onClose={() => setCreating(false)}>
        <form className="space-y-3" onSubmit={(event) => { void onSubmit(event); setCreating(false); }}>
          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded-xl border border-[#ded7c9] bg-white px-4 py-3 text-sm outline-none focus:border-[#49625b]"
              name="name"
              placeholder="Page name"
              required
            />
            <input
              className="w-full rounded-xl border border-[#ded7c9] bg-white px-4 py-3 text-sm outline-none focus:border-[#49625b]"
              name="category"
              placeholder="Category"
              required
            />
            <textarea
              className="min-h-28 w-full resize-none rounded-xl border border-[#ded7c9] bg-white px-4 py-3 text-sm outline-none focus:border-[#49625b]"
              name="description"
              placeholder="Description"
            />
            <label className="block rounded-xl border border-dashed border-[#c9bfad] bg-[#f7f5ef] p-3 text-sm font-semibold text-[#53645f]">
              Profile photo
              <input className="mt-2 block w-full text-xs" name="avatarFile" type="file" accept="image/*" />
            </label>
            <label className="block rounded-xl border border-dashed border-[#c9bfad] bg-[#f7f5ef] p-3 text-sm font-semibold text-[#53645f]">
              Cover
              <input className="mt-2 block w-full text-xs" name="coverFile" type="file" accept="image/*" />
            </label>
          </div>
          <button className={`${primaryButtonClass} mt-4 w-full`} disabled={loading} type="submit">
            Create page
          </button>
        </form>
      </CreateModal>

      <div className="space-y-4">
          <section className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-wide text-[#65736f]">Your pages</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {myPages.length === 0 ? (
                <EmptyText>You do not manage any pages yet.</EmptyText>
              ) : (
                myPages.map((page) => <PageCard key={page.id} page={page} managed onOpen={onOpenPage} />)
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-wide text-[#65736f]">Explore pages</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {pages.length === 0 ? (
                <EmptyText>There are no pages yet.</EmptyText>
              ) : (
                pages.map((page) => (
                  <PageCard
                    key={page.id}
                    page={page}
                    managed={managedPageIds.has(page.id)}
                    onFollow={onFollow}
                    onOpen={onOpenPage}
                  />
                ))
              )}
            </div>
          </section>
        </div>
    </section>
  );
}

function PageCard({
  managed = false,
  onFollow,
  onOpen,
  page,
}: {
  managed?: boolean;
  onFollow?: (pageId: string) => void;
  onOpen: (page: SocialPage) => void;
  page: SocialPage;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[#ded7c9] bg-[#fffdf8] shadow-sm">
      <button className="block h-28 w-full bg-[#17211f] text-left" type="button" onClick={() => onOpen(page)}>
        {page.cover && <img alt="" className="size-full object-cover" src={mediaSrc(page.cover)} />}
      </button>
      <div className="p-4">
        <button className="-mt-12 flex items-end gap-3 text-left" type="button" onClick={() => onOpen(page)}>
          <Avatar name={page.name} src={page.avatar} size="lg" />
          {managed && (
            <span className="mb-1 rounded-full bg-[#f2c166] px-3 py-1 text-xs font-black text-[#17211f]">
              Administrada por ti
            </span>
          )}
        </button>
        <button className="mt-3 block text-left" type="button" onClick={() => onOpen(page)}>
          <h3 className="text-lg font-black">{page.name}</h3>
        </button>
        <p className="text-sm font-semibold text-[#b8741a]">{page.category}</p>
        {page.description && <p className="mt-2 line-clamp-3 text-sm text-[#6d746f]">{page.description}</p>}
        <p className="mt-3 text-xs text-[#8a8f8b]">
          {page.followerCount} seguidores · Creada por {page.ownerName}
        </p>
        {!managed && onFollow && (
          <button className={`${page.followedByMe ? secondaryButtonClass : primaryButtonClass} mt-3 w-full`} type="button" onClick={() => onFollow(page.id)}>
            {page.followedByMe ? "Siguiendo" : "Seguir"}
          </button>
        )}
      </div>
    </article>
  );
}

function PageDetail({
  onBack,
  onCommentDelete,
  onCommentEdit,
  onCommentPost,
  onCreatePost,
  onDeletePost,
  onEditPost,
  onFollow,
  onOpenProfile,
  onReact,
  onReportPost,
  onShare,
  onUpdate,
  page,
  posts,
  viewerId,
}: {
  onBack: () => void;
  onCommentDelete: (commentId: string) => void;
  onCommentEdit: (comment: Post["comments"][number]) => void;
  onCommentPost: (event: FormEvent<HTMLFormElement>, postId: string) => void;
  onCreatePost: (event: FormEvent<HTMLFormElement>) => void;
  onDeletePost: (postId: string) => void;
  onEditPost: (post: Post) => void;
  onFollow: (pageId: string) => void;
  onOpenProfile: (userId: string) => void;
  onReact: (postId: string) => void;
  onReportPost: (post: Post) => void;
  onShare: (post: Post) => void;
  onUpdate: (event: FormEvent<HTMLFormElement>, page: SocialPage) => void;
  page: SocialPage;
  posts: Post[];
  viewerId: string;
}) {
  const managed = page.ownerId === viewerId;

  return (
    <section className="mx-auto w-full max-w-[1100px] space-y-4">
      <button className={secondaryButtonClass} type="button" onClick={onBack}>
        Back to pages
      </button>
      <div className="overflow-hidden rounded-2xl border border-[#ded7c9] bg-white shadow-sm">
        <div className="h-64 bg-[#17211f]">
          {page.cover && <img alt="" className="size-full object-cover" src={mediaSrc(page.cover)} />}
        </div>
        <div className="-mt-14 px-6 pb-6">
          <div className="flex flex-col gap-4 border-b border-[#eee8dc] pb-5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-end gap-4">
              <Avatar name={page.name} src={page.avatar} size="lg" />
              <div className="pb-2">
                <h1 className="text-3xl font-black text-[#17211f]">{page.name}</h1>
                <p className="text-sm font-semibold text-[#b8741a]">{page.category}</p>
                <p className="mt-1 text-sm text-[#6d746f]">
                  {page.followerCount} seguidores · Administrada por {page.ownerName}
                </p>
              </div>
            </div>
            {managed ? (
              <span className="rounded-xl bg-[#f2c166] px-4 py-2 text-sm font-black text-[#17211f]">
                You manage this page
              </span>
            ) : (
              <button
                className={page.followedByMe ? secondaryButtonClass : primaryButtonClass}
                type="button"
                onClick={() => onFollow(page.id)}
              >
                {page.followedByMe ? "Siguiendo" : "Seguir"}
              </button>
            )}
          </div>
          {page.description && <p className="mt-4 max-w-3xl text-sm leading-6 text-[#53645f]">{page.description}</p>}
        </div>
      </div>

      {managed && (
        <>
          <details className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm">
            <summary className="cursor-pointer list-none text-sm font-black text-[#17211f]">
              Edit page information
            </summary>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(event) => onUpdate(event, page)}>
              <input
                className={inputClass}
                defaultValue={page.name}
                name="name"
                placeholder="Name"
                required
              />
              <input
                className={inputClass}
                defaultValue={page.category}
                name="category"
                placeholder="Category"
                required
              />
              <textarea
                className={`${inputClass} min-h-24 resize-none md:col-span-2`}
                defaultValue={page.description || ""}
                name="description"
                placeholder="Description"
              />
              <label className="block rounded-xl border border-dashed border-[#c9bfad] bg-[#f7f5ef] p-3 text-sm font-semibold text-[#53645f]">
                Change profile photo
                <input className="mt-2 block w-full text-xs" name="avatarFile" type="file" accept="image/*" />
              </label>
              <label className="block rounded-xl border border-dashed border-[#c9bfad] bg-[#f7f5ef] p-3 text-sm font-semibold text-[#53645f]">
                Cambiar portada
                <input className="mt-2 block w-full text-xs" name="coverFile" type="file" accept="image/*" />
              </label>
              <button className={`${primaryButtonClass} md:col-span-2`} type="submit">
                Save changes
              </button>
            </form>
          </details>
          <PagePostComposer page={page} onSubmit={onCreatePost} />
        </>
      )}

      {posts.length === 0 ? (
        <p className="rounded-2xl border border-[#ded7c9] bg-white p-8 text-center text-sm text-[#6d746f] shadow-sm">
          This page has no posts yet.
        </p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <FeedPost
              key={post.id}
              post={post}
              viewerId={viewerId}
              onComment={onCommentPost}
              onCommentDelete={onCommentDelete}
              onCommentEdit={onCommentEdit}
              onDelete={onDeletePost}
              onEdit={onEditPost}
              onOpenProfile={onOpenProfile}
              onReact={onReact}
              onReport={onReportPost}
              onShare={onShare}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PagePostComposer({
  onSubmit,
  page,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  page: SocialPage;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  return (
    <form
      className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm"
      onSubmit={(event) => {
        void onSubmit(event);
        setFileName("");
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      }}
    >
      <input name="pageId" type="hidden" value={page.id} />
      <div className="flex gap-3">
        <Avatar name={page.name} src={page.avatar} size="md" />
        <textarea
          className="min-h-24 flex-1 resize-none rounded-xl border border-[#ded7c9] bg-[#fffdf8] px-4 py-3 text-sm outline-none focus:border-[#49625b]"
          name="content"
          placeholder={`Post como ${page.name}`}
        />
      </div>
      <input
        ref={inputRef}
        accept="image/*,video/*"
        className="hidden"
        name="mediaFile"
        type="file"
        onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? "")}
      />
      {fileName && <p className="mt-3 rounded-xl bg-[#f7f5ef] px-3 py-2 text-xs font-semibold text-[#53645f]">{fileName}</p>}
      <div className="mt-3 flex items-center justify-between border-t border-[#eee8dc] pt-3">
        <div className="flex gap-2">
          <button className={secondaryButtonClass} type="button" onClick={() => inputRef.current?.click()}>
            Photo/video
          </button>
        </div>
        <button className={primaryButtonClass} type="submit">
          Post
        </button>
      </div>
    </form>
  );
}

function LivesPage({
  lives,
  liveMessages,
  onOpenProfile,
  viewerId,
  onDelete,
  onEdit,
  onSendMessage,
}: {
  lives: LiveSession[];
  liveMessages: Record<string, LiveChatMessage[]>;
  onOpenProfile: (userId: string) => void;
  viewerId: string;
  onDelete: (liveId: string) => void;
  onEdit: (live: LiveSession) => void;
  onSendMessage: (event: FormEvent<HTMLFormElement>, liveId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filteredLives = lives.filter((live) => {
    const text = `${live.title} ${live.hostName}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

  return (
    <section className="space-y-4">
      <PageHeader
        kicker="Video"
        title="Lives activos"
        subtitle="Busca personas que esten transmitiendo ahora y entra al chat en vivo."
      />
      <input
        className="w-full rounded-2xl border border-[#ded7c9] bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-[#49625b]"
        placeholder="Search by live name or title..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {filteredLives.length === 0 ? (
        <p className="rounded-2xl border border-[#ded7c9] bg-white p-8 text-center text-sm text-[#6d746f] shadow-sm">
          No active lives match your search.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredLives.map((live) => (
            <LiveCard
              key={live.id}
              live={live}
              messages={liveMessages[live.id] ?? []}
              onOpenProfile={onOpenProfile}
              viewerId={viewerId}
              onDelete={onDelete}
              onEdit={onEdit}
              onSendMessage={onSendMessage}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PageHeader({
  action,
  kicker,
  title,
  subtitle,
}: {
  action?: ReactNode;
  kicker: string;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="rounded-2xl border border-[#ded7c9] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#b8741a]">{kicker}</p>
          <h1 className="mt-1 text-3xl font-black">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#6d746f]">{subtitle}</p>
        </div>
        {action}
      </div>
    </header>
  );
}

function LiveCard({
  live,
  messages = [],
  onOpenProfile,
  viewerId,
  onDelete,
  onEdit,
  onSendMessage,
}: {
  live: LiveSession;
  messages?: LiveChatMessage[];
  onOpenProfile?: (userId: string) => void;
  viewerId?: string;
  onDelete?: (liveId: string) => void;
  onEdit?: (live: LiveSession) => void;
  onSendMessage?: (event: FormEvent<HTMLFormElement>, liveId: string) => void;
}) {
  const canManage = viewerId === live.hostId;

  return (
    <article className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <PersonRow
          user={{ id: live.hostId, name: live.hostName, avatar: live.hostAvatar }}
          onOpenProfile={onOpenProfile}
        />
        <div className="flex items-center gap-2">
          {canManage && (
            <ActionMenu
              items={[
                {
                  icon: "E",
                  label: "Edit live",
                  description: "Change this live title.",
                  onClick: () => onEdit?.(live),
                },
                {
                  destructive: true,
                  icon: "D",
                  label: "Delete live",
                  description: "Delete this live from your profile.",
                  onClick: () => onDelete?.(live.id),
                },
              ]}
            />
          )}
          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
            live.status === "LIVE" ? "bg-red-600 text-white" : "bg-[#ece7dc] text-[#17211f]"
          }`}>
            {live.status === "LIVE" ? "Live" : "Replay"}
          </span>
        </div>
      </div>
      {live.recordingUrl ? (
        <video
          className="aspect-video w-full rounded-xl bg-black object-contain"
          controls
          src={mediaSrc(live.recordingUrl)}
        />
      ) : live.latestFrameUrl ? (
        <img
          alt=""
          className="aspect-video w-full rounded-xl bg-black object-cover"
          src={mediaSrc(live.latestFrameUrl)}
        />
      ) : (
        <div className="grid aspect-video place-items-center rounded-xl bg-[#17211f] text-sm font-bold text-white/70">
          {live.status === "LIVE" ? "Waiting for live image" : "No recording"}
        </div>
      )}
      <h2 className="mt-3 font-black">{live.title}</h2>
      <p className="mt-1 text-xs text-[#6d746f]">{new Date(live.startedAt).toLocaleString()}</p>
      <div className="mt-4 border-t border-[#eee8dc] pt-3">
        <LiveChatPanel
          compact
          live={live}
          messages={messages}
          onOpenProfile={onOpenProfile}
          onSend={onSendMessage}
        />
      </div>
    </article>
  );
}

function LiveChatPanel({
  compact = false,
  live,
  messages,
  onOpenProfile,
  onSend,
}: {
  compact?: boolean;
  live: LiveSession;
  messages: LiveChatMessage[];
  onOpenProfile?: (userId: string) => void;
  onSend?: (event: FormEvent<HTMLFormElement>, liveId: string) => void;
}) {
  const canSend = live.status === "LIVE" && Boolean(onSend);
  const visibleMessages = compact ? messages.slice(-5) : messages;

  return (
    <section className={compact ? "" : "flex h-full min-h-[360px] flex-col bg-[#f8faf9]"}>
      <div className={compact ? "mb-2 flex items-center justify-between" : "border-b border-[#e4e6eb] p-4"}>
        <h3 className="text-sm font-black text-[#050505]">Chat en vivo</h3>
        <p className="text-xs font-semibold text-[#65676b]">{messages.length} messages</p>
      </div>
      <div className={`${compact ? "max-h-44" : "min-h-0 flex-1"} space-y-3 overflow-y-auto ${compact ? "" : "p-4"}`}>
        {visibleMessages.length === 0 ? (
          <p className="rounded-xl bg-white p-3 text-sm text-[#65676b]">
            There are no messages in this live yet.
          </p>
        ) : (
          visibleMessages.map((message) => (
            <div className="flex gap-2" key={message.id}>
              <button type="button" onClick={() => onOpenProfile?.(message.authorId)}>
                <Avatar name={message.authorName} src={message.authorAvatar} size="sm" />
              </button>
              <div className="min-w-0 rounded-xl bg-white px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <p className="truncate text-xs font-black text-[#050505]">{message.authorName}</p>
                  <span className="text-[11px] font-semibold text-[#8a8d91]">
                    {formatLiveOffset(message.offsetMs)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#1c1e21]">{message.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
      {canSend && (
        <form className={`${compact ? "mt-3" : "border-t border-[#e4e6eb] p-3"} flex gap-2`} onSubmit={(event) => onSend?.(event, live.id)}>
          <input
            className="min-w-0 flex-1 rounded-full border border-[#ccd0d5] bg-white px-4 py-2 text-sm outline-none focus:border-[#1877f2]"
            name="message"
            placeholder="Escribe en el chat..."
          />
          <button className="rounded-full bg-[#1877f2] px-4 py-2 text-sm font-black text-white" type="submit">
            Send
          </button>
        </form>
      )}
    </section>
  );
}

function formatLiveOffset(offsetMs: number) {
  const totalSeconds = Math.max(0, Math.floor(offsetMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function OnchainIdentity({ wallet }: { wallet: WalletAccount }) {
  const { address, chainId } = useAccount();
  const { switchChainAsync, isPending: switchingChain } = useSwitchChain();
  const [txError, setTxError] = useState("");
  const idReady = Boolean(CONTRACTS.idRegistry);
  const keyReady = Boolean(CONTRACTS.keyRegistry);
  const storageReady = Boolean(CONTRACTS.storageRegistry);
  const appSigner = wallet.appSigners.find((signer) => signer.active)?.address as
    | Address
    | undefined;
  const signerKey = appSigner ? padHex(appSigner, { size: 32 }) : undefined;
  const { data: socialId, refetch: refetchSocialId } = useReadContract({
    abi: idRegistryAbi,
    address: CONTRACTS.idRegistry,
    functionName: "idOf",
    args: [address ?? zeroAddress],
    query: { enabled: Boolean(idReady && address) },
  });
  const hasSocialId = Boolean(socialId && socialId > ZERO_BIGINT);
  const { data: keyRegistered, refetch: refetchKey } = useReadContract({
    abi: keyRegistryAbi,
    address: CONTRACTS.keyRegistry,
    functionName: "keyOf",
    args: [socialId ?? ZERO_BIGINT, signerKey ?? padHex(zeroAddress, { size: 32 })],
    query: { enabled: Boolean(keyReady && hasSocialId && signerKey) },
  });
  const { data: unitPrice } = useReadContract({
    abi: storageRegistryAbi,
    address: CONTRACTS.storageRegistry,
    functionName: "unitPrice",
    query: { enabled: storageReady },
  });
  const { data: paidUntil, refetch: refetchPaidUntil } = useReadContract({
    abi: storageRegistryAbi,
    address: CONTRACTS.storageRegistry,
    functionName: "paidUntil",
    args: [socialId ?? ZERO_BIGINT],
    query: { enabled: Boolean(storageReady && hasSocialId) },
  });
  const { data: hash, isPending, writeContractAsync } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (!isSuccess) {
      return;
    }

    void refetchSocialId();
    void refetchKey();
    void refetchPaidUntil();
  }, [isSuccess, refetchKey, refetchPaidUntil, refetchSocialId]);

  async function registerIdentity() {
    const idRegistry = CONTRACTS.idRegistry;
    if (!idRegistry) {
      return;
    }

    await runOnchainAction(() =>
      writeContractAsync({
        abi: idRegistryAbi,
        address: idRegistry,
        functionName: "register",
        args: [zeroAddress],
      }),
    );
  }

  async function addAppSigner() {
    const id = socialId;
    const keyRegistry = CONTRACTS.keyRegistry;
    if (!keyRegistry || !id || id <= ZERO_BIGINT || !signerKey) {
      return;
    }

    await runOnchainAction(() =>
      writeContractAsync({
        abi: keyRegistryAbi,
        address: keyRegistry,
        functionName: "addKey",
        args: [id, signerKey],
      }),
    );
  }

  async function rentStorage() {
    const id = socialId;
    const storageRegistry = CONTRACTS.storageRegistry;
    if (!storageRegistry || !id || id <= ZERO_BIGINT) {
      return;
    }

    await runOnchainAction(() =>
      writeContractAsync({
        abi: storageRegistryAbi,
        address: storageRegistry,
        functionName: "rent",
        args: [id],
        value: unitPrice ?? ZERO_BIGINT,
      }),
    );
  }

  async function runOnchainAction(action: () => Promise<unknown>) {
    setTxError("");

    try {
      await action();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transaccion rechazada";
      setTxError(
        message.toLowerCase().includes("insufficient funds")
          ? "Your wallet does not have enough Sepolia ETH for gas."
          : message.split("\n")[0],
      );
    }
  }

  const busy = isPending || confirming;
  const wrongChain = Boolean(address && chainId !== SEPOLIA_CHAIN_ID);
  const paidUntilDate =
    paidUntil && paidUntil > ZERO_BIGINT
      ? new Date(Number(paidUntil) * 1000).toLocaleDateString()
      : "No storage";
  const socialIdText =
    socialId && socialId > ZERO_BIGINT ? socialId.toString() : "Not registered";

  return (
    <div className="space-y-3 rounded-2xl border border-[#ded7c9] bg-white p-3 shadow-sm">
      <div>
        <p className="text-xs font-semibold text-[#6d746f]">Wallet conectada</p>
        <p className="break-all text-xs font-semibold">{address ?? "No wallet"}</p>
      </div>
      <div>
        <p className="text-xs font-semibold text-[#6d746f]">Custody wallet</p>
        <p className="break-all text-xs">{wallet.address}</p>
      </div>
      <div>
        <p className="text-xs font-semibold text-[#6d746f]">App signer</p>
        <p className="break-all text-xs">{appSigner ?? "No signer"}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="rounded-xl bg-[#f4efe5] p-2">
          ID: {socialIdText}
        </span>
        <span className="rounded-xl bg-[#f4efe5] p-2">
          Key: {keyRegistered ? "Registered" : "Pending"}
        </span>
        <span className="col-span-2 rounded-xl bg-[#f4efe5] p-2">
          Storage: {paidUntilDate}
        </span>
      </div>
      <div className="grid gap-2">
        {(!idReady || !keyReady || !storageReady) && (
          <p className="rounded-xl bg-[#fff4d6] p-2 text-xs font-semibold text-[#6b4b00]">
            Configure the missing Sepolia contracts to enable all onchain actions.
          </p>
        )}
        {wrongChain && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p>Your wallet is connected to a different network. Nexo contracts use Ethereum Sepolia.</p>
            <button
              className={`${secondaryButtonClass} mt-2 w-full`}
              disabled={switchingChain}
              type="button"
              onClick={() => void switchChainAsync({ chainId: SEPOLIA_CHAIN_ID }).catch(() => setTxError("Switch your wallet to Ethereum Sepolia and try again."))}
            >
              {switchingChain ? "Switching..." : "Switch to Sepolia"}
            </button>
          </div>
        )}
        {txError && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-2 text-xs font-semibold text-red-700">
            {txError}
          </p>
        )}
        {!hasSocialId && (
          <button
            className={primaryButtonClass}
            disabled={!idReady || !address || busy || wrongChain}
            onClick={registerIdentity}
          >
            Register ID
          </button>
        )}
        <button
          className={secondaryButtonClass}
          disabled={!keyReady || !hasSocialId || !signerKey || Boolean(keyRegistered) || busy || wrongChain}
          onClick={addAppSigner}
        >
          Register signer
        </button>
        <button
          className={secondaryButtonClass}
          disabled={!storageReady || !hasSocialId || busy || wrongChain}
          onClick={rentStorage}
        >
          Rentar storage
        </button>
      </div>
      {hash && (
        <a
          className="block break-all text-xs font-semibold text-[#2f6f62]"
          href={`${EXPLORER_BASE}/tx/${hash}`}
          rel="noreferrer"
          target="_blank"
        >
          Ver transaccion
        </a>
      )}
    </div>
  );
}

function ProfileMediaGrid({ empty, posts }: { empty: string; posts: Post[] }) {
  if (posts.length === 0) {
    return <p className="rounded-lg bg-white p-8 text-center text-sm text-[#65676b] shadow-sm">{empty}</p>;
  }

  return (
    <section className="rounded-lg bg-white p-4 shadow-sm">
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
        {posts.map((post) => (
          post.mediaType === "VIDEO" ? (
            <video className="aspect-square w-full rounded-lg bg-black object-cover" controls key={post.id} src={mediaSrc(post.mediaUrl as string)} />
          ) : (
            <img alt="" className="aspect-square w-full rounded-lg object-cover" key={post.id} src={mediaSrc(post.mediaUrl as string)} />
          )
        ))}
      </div>
    </section>
  );
}

function ProfileList({ children, empty }: { children: ReactNode; empty: string }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <section className="rounded-lg bg-white p-4 shadow-sm">
      {items.length ? <div className="grid gap-3 md:grid-cols-2">{items}</div> : <p className="p-4 text-center text-sm text-[#65676b]">{empty}</p>}
    </section>
  );
}

function ProfilePage({
  error,
  friends,
  lives,
  liveMessages,
  loading,
  myGroups,
  myPages,
  onDeleteLive,
  onDeletePost,
  onEditLive,
  onEditPost,
  onOpenProfile,
  onSendLiveMessage,
  posts,
  session,
  onSubmit,
}: {
  error: string;
  friends: User[];
  lives: LiveSession[];
  liveMessages: Record<string, LiveChatMessage[]>;
  loading: boolean;
  myGroups: SocialGroup[];
  myPages: SocialPage[];
  onDeleteLive: (liveId: string) => void;
  onDeletePost: (postId: string) => void;
  onEditLive: (live: LiveSession) => void;
  onEditPost: (post: Post) => void;
  onOpenProfile: (userId: string) => void;
  onSendLiveMessage: (event: FormEvent<HTMLFormElement>, liveId: string) => void;
  posts: Post[];
  session: Session;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState<"posts" | "photos" | "videos" | "friends" | "pages" | "groups" | "lives">("posts");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const cover = coverPreview || (session.user.cover ? mediaSrc(session.user.cover) : "");
  const avatar = avatarPreview || session.user.avatar;
  const profileName = session.user.name.startsWith("0x") ? `${session.user.name.slice(0, 6)}...${session.user.name.slice(-4)}` : session.user.name;

  function preview(setter: (value: string | null) => void) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      setter(file ? URL.createObjectURL(file) : null);
    };
  }

  return (
    <section className="mx-auto w-full min-w-0 max-w-[1100px] space-y-4 pb-24 sm:pb-0">
      <div className="overflow-hidden bg-white shadow-sm sm:rounded-b-lg">
        <div className="relative h-[180px] bg-[#d8dce3] sm:h-[260px] md:h-[360px]">
          {cover ? (
            <img alt="" className="size-full object-cover" src={cover} />
          ) : (
            <div className="size-full bg-gradient-to-b from-[#eef1f5] to-[#9aa5b5]" />
          )}
          <label className="absolute bottom-3 right-3 cursor-pointer rounded-md bg-white px-3 py-2 text-xs font-bold text-[#1c1e21] shadow hover:bg-[#f0f2f5] sm:bottom-4 sm:right-4 sm:px-4 sm:text-sm">
            Edit cover photo
            <input className="hidden" form="profile-edit-form" name="coverFile" type="file" accept="image/*" onChange={preview(setCoverPreview)} />
          </label>
        </div>

        <div className="px-4 pb-0 md:px-8">
          <div className="-mt-14 flex w-full min-w-0 flex-col gap-3 border-b border-[#dadde1] pb-4 sm:-mt-12 md:flex-row md:items-end md:justify-between">
            <div className="flex w-full min-w-0 flex-col items-center gap-3 text-center md:flex-row md:text-left">
              <div className="relative">
                <Avatar name={session.user.name} src={avatar} size="lg" />
                <label className="absolute bottom-2 right-2 grid size-9 cursor-pointer place-items-center rounded-full bg-[#e4e6eb] text-lg font-black text-[#1c1e21] shadow hover:bg-[#d8dadf]">
                  +
                  <input className="hidden" form="profile-edit-form" name="avatarFile" type="file" accept="image/*" onChange={preview(setAvatarPreview)} />
                </label>
              </div>
              <div className="w-full min-w-0 pb-2">
                <h1 className="w-full break-words text-3xl font-black text-[#050505] md:text-4xl">{profileName}</h1>
                <p className="text-sm font-semibold text-[#65676b]">
                  {posts.length} posts · {lives.length} lives
                </p>
                {session.user.bio && <p className="mt-2 max-w-2xl break-words text-[15px] text-[#050505]">{session.user.bio}</p>}
              </div>
            </div>
            <button className="w-full rounded-md bg-[#1877f2] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#166fe5] md:w-auto" type="button" onClick={() => setEditOpen(true)}>
              Edit profile
            </button>
          </div>

          <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 py-1 text-sm font-bold text-[#65676b] md:mx-0 md:px-0">
            <button className={`shrink-0 rounded-md px-5 py-3 ${tab === "posts" ? "text-[#1877f2]" : "hover:bg-[#f0f2f5]"}`} type="button" onClick={() => setTab("posts")}>
              Posts
            </button>
            <button className={`shrink-0 rounded-md px-5 py-3 ${tab === "photos" ? "text-[#1877f2]" : "hover:bg-[#f0f2f5]"}`} type="button" onClick={() => setTab("photos")}>
              Photos
            </button>
            <button className={`shrink-0 rounded-md px-5 py-3 ${tab === "videos" ? "text-[#1877f2]" : "hover:bg-[#f0f2f5]"}`} type="button" onClick={() => setTab("videos")}>
              Videos
            </button>
            <button className={`shrink-0 rounded-md px-5 py-3 ${tab === "friends" ? "text-[#1877f2]" : "hover:bg-[#f0f2f5]"}`} type="button" onClick={() => setTab("friends")}>
              Friends
            </button>
            <button className={`shrink-0 rounded-md px-5 py-3 ${tab === "pages" ? "text-[#1877f2]" : "hover:bg-[#f0f2f5]"}`} type="button" onClick={() => setTab("pages")}>
              Pages
            </button>
            <button className={`shrink-0 rounded-md px-5 py-3 ${tab === "groups" ? "text-[#1877f2]" : "hover:bg-[#f0f2f5]"}`} type="button" onClick={() => setTab("groups")}>
              Groups
            </button>
            <button className={`shrink-0 rounded-md px-5 py-3 ${tab === "lives" ? "text-[#1877f2]" : "hover:bg-[#f0f2f5]"}`} type="button" onClick={() => setTab("lives")}>
              Lives
            </button>
          </nav>
        </div>
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/55 p-4">
          <form id="profile-edit-form" className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-4 shadow-2xl" onSubmit={onSubmit}>
            <div className="mb-4 flex items-center justify-between border-b border-[#dadde1] pb-3">
              <h2 className="text-xl font-black text-[#050505]">Edit profile</h2>
              <button className="grid size-9 place-items-center rounded-full bg-[#e4e6eb] text-lg font-black" type="button" onClick={() => setEditOpen(false)}>
                x
              </button>
            </div>
            <input name="avatar" type="hidden" value={session.user.avatar ?? ""} />
            <input name="cover" type="hidden" value={session.user.cover ?? ""} />
            <label className="text-sm font-bold text-[#050505]">
              Name
              <input className={inputClass} defaultValue={session.user.name} name="name" required />
            </label>
            <label className="mt-3 block text-sm font-bold text-[#050505]">
              Bio
              <textarea className={`${inputClass} min-h-28 resize-none`} defaultValue={session.user.bio ?? ""} name="bio" />
            </label>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className={secondaryButtonClass}>
                Upload profile photo
                <input className="hidden" name="avatarFile" type="file" accept="image/*" onChange={preview(setAvatarPreview)} />
              </label>
              <label className={secondaryButtonClass}>
                Subir portada
                <input className="hidden" name="coverFile" type="file" accept="image/*" onChange={preview(setCoverPreview)} />
              </label>
            </div>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <button className="mt-4 w-full rounded-md bg-[#1877f2] px-5 py-3 text-sm font-bold text-white hover:bg-[#166fe5]" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </button>
          </form>
        </div>
      )}

      {tab === "photos" ? (
        <ProfileMediaGrid empty="You have no photos yet." posts={posts.filter((post) => post.mediaType === "IMAGE" && post.mediaUrl)} />
      ) : tab === "videos" ? (
        <ProfileMediaGrid empty="You have no videos yet." posts={posts.filter((post) => post.mediaType === "VIDEO" && post.mediaUrl)} />
      ) : tab === "friends" ? (
        <ProfileList empty="You have not added any friends yet.">
          {friends.map((friend) => (
            <PersonRow key={friend.id} user={friend} onOpenProfile={onOpenProfile} />
          ))}
        </ProfileList>
      ) : tab === "pages" ? (
        <ProfileList empty="You do not manage any pages yet.">
          {myPages.map((page) => (
            <div className="flex items-center gap-3" key={page.id}>
              <Avatar name={page.name} src={page.avatar} size="md" />
              <div>
                <p className="font-black">{page.name}</p>
                <p className="text-sm text-[#6d746f]">{page.category}</p>
              </div>
            </div>
          ))}
        </ProfileList>
      ) : tab === "groups" ? (
        <ProfileList empty="You do not belong to any groups yet.">
          {myGroups.map((group) => (
            <div className="flex items-center gap-3" key={group.id}>
              <div className="grid size-11 place-items-center rounded-xl bg-[#17211f] text-sm font-black text-[#f2c166]">G</div>
              <div>
                <p className="font-black">{group.name}</p>
                <p className="text-sm text-[#6d746f]">{group.memberCount} miembros</p>
              </div>
            </div>
          ))}
        </ProfileList>
      ) : tab === "posts" ? (
        <div className="grid gap-4 md:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-lg bg-white p-4 shadow-sm">
              <h2 className="text-xl font-black text-[#050505]">Intro</h2>
              <p className="mt-3 text-center text-[15px] text-[#050505]">
                {session.user.bio || "Add a bio to tell more about yourself."}
              </p>
              <button className="mt-4 w-full rounded-md bg-[#e4e6eb] py-2 text-sm font-bold text-[#050505]" type="button" onClick={() => setEditOpen(true)}>
                Edit details
              </button>
            </section>
            <section className="rounded-lg bg-white p-4 shadow-sm">
              <h2 className="text-xl font-black text-[#050505]">Photos</h2>
              <div className="mt-3 grid grid-cols-3 gap-1 overflow-hidden rounded-lg">
                {posts.filter((post) => post.mediaType === "IMAGE" && post.mediaUrl).slice(0, 9).map((post) => (
                  <img alt="" className="aspect-square w-full object-cover" key={post.id} src={mediaSrc(post.mediaUrl as string)} />
                ))}
              </div>
            </section>
          </aside>
          <div className="space-y-4">
            {posts.length === 0 ? (
              <p className="rounded-lg bg-white p-8 text-center text-sm text-[#65676b] shadow-sm">
                You have no posts yet.
              </p>
            ) : (
              posts.map((post) => (
                <ProfilePostCard
                  key={post.id}
                  post={post}
                  onDelete={onDeletePost}
                  onEdit={onEditPost}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lives.length === 0 ? (
            <p className="rounded-lg bg-white p-8 text-center text-sm text-[#65676b] shadow-sm">
              You have no saved lives yet.
            </p>
          ) : (
            lives.map((live) => (
              <LiveCard
                key={live.id}
                live={live}
                messages={liveMessages[live.id] ?? []}
                onOpenProfile={onOpenProfile}
                viewerId={session.user.id}
                onDelete={onDeleteLive}
                onEdit={onEditLive}
                onSendMessage={onSendLiveMessage}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}

function PublicProfilePage({
  liveMessages,
  profile,
  viewerId,
  onAddFriend,
  onBlock,
  onOpenProfile,
  onSendLiveMessage,
}: {
  liveMessages: Record<string, LiveChatMessage[]>;
  profile: PublicProfile;
  viewerId: string;
  onAddFriend: (userId: string) => void;
  onBlock: (userId: string) => void;
  onOpenProfile: (userId: string) => void;
  onSendLiveMessage: (event: FormEvent<HTMLFormElement>, liveId: string) => void;
}) {
  const relationshipText = {
    SELF: "Your profile",
    FRIEND: "Friends",
    REQUEST_SENT: "Request sent",
    REQUEST_RECEIVED: "Sent you a request",
    NONE: "Add friend",
  }[profile.relationship];

  return (
    <section className="mx-auto w-full max-w-[1100px] space-y-4">
      <div className="overflow-hidden rounded-b-lg bg-white shadow-sm">
        <div className="h-[240px] bg-gradient-to-b from-[#dfe5ea] to-[#8c98a6]" />
        <div className="-mt-12 px-6 pb-5">
          <div className="flex flex-col gap-4 border-b border-[#dadde1] pb-4 md:flex-row md:items-end md:justify-between">
            <div className="flex items-end gap-4">
              <Avatar name={profile.user.name} src={profile.user.avatar} size="lg" />
              <div className="pb-2">
                <h1 className="text-3xl font-black text-[#050505]">{profile.user.name}</h1>
                {profile.user.bio && <p className="mt-1 text-sm text-[#65676b]">{profile.user.bio}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className={profile.relationship === "NONE" ? "rounded-md bg-[#1877f2] px-5 py-2.5 text-sm font-bold text-white" : "rounded-md bg-[#e4e6eb] px-5 py-2.5 text-sm font-bold text-[#050505]"}
                disabled={profile.relationship !== "NONE"}
                type="button"
                onClick={() => onAddFriend(profile.user.id)}
              >
                {relationshipText}
              </button>
              {profile.relationship !== "SELF" && (
                <button
                  className="rounded-md bg-red-50 px-5 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100"
                  type="button"
                  onClick={() => onBlock(profile.user.id)}
                >
                  Block
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-lg bg-white p-4 shadow-sm">
            <h2 className="text-xl font-black text-[#050505]">Intro</h2>
            <p className="mt-3 text-[15px] text-[#050505]">{profile.user.bio || "No bio yet."}</p>
          </section>
          <section className="rounded-lg bg-white p-4 shadow-sm">
            <h2 className="text-xl font-black text-[#050505]">Lives</h2>
            <p className="mt-2 text-sm text-[#65676b]">{profile.lives.length} lives publicados</p>
          </section>
        </aside>
        <div className="space-y-4">
          {profile.lives.map((live) => (
            <LiveCard
              key={live.id}
              live={live}
              messages={liveMessages[live.id] ?? []}
              onOpenProfile={onOpenProfile}
              viewerId={viewerId}
              onSendMessage={onSendLiveMessage}
            />
          ))}
          {profile.posts.length === 0 ? (
            <p className="rounded-lg bg-white p-8 text-center text-sm text-[#65676b] shadow-sm">
              This person has no posts yet.
            </p>
          ) : (
            profile.posts.map((post) => (
              <article className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm" key={post.id}>
                <button className="flex items-center gap-3 text-left" type="button" onClick={() => onOpenProfile(post.author.id)}>
                  <Avatar name={(post.page ?? post.author).name} src={(post.page ?? post.author).avatar} size="md" />
                  <div>
                    <h2 className="text-sm font-semibold">{(post.page ?? post.author).name}</h2>
                    <p className="text-xs text-[#6d746f]">
                      {post.page ? `${post.page.category || "Page"} · ` : ""}
                      {new Date(post.createdAt).toLocaleString()}
                    </p>
                  </div>
                </button>
                {post.content && <p className="mt-4 whitespace-pre-wrap text-[15px] leading-6">{post.content}</p>}
                {post.mediaUrl && <PostMedia type={post.mediaType} url={post.mediaUrl} />}
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function ProfilePostCard({
  post,
  onDelete,
  onEdit,
}: {
  post: Post;
  onDelete: (postId: string) => void;
  onEdit: (post: Post) => void;
}) {
  const actor = post.page ?? post.author;

  return (
    <article className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={actor.name} src={actor.avatar} size="md" />
          <div>
            <h2 className="text-sm font-semibold">{actor.name}</h2>
            <p className="text-xs text-[#6d746f]">
              {post.page ? `${post.page.category || "Page"} · ` : ""}
              {new Date(post.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <ActionMenu
          items={[
            {
              icon: "E",
              label: "Edit post",
              description: "Change this post text.",
              onClick: () => onEdit(post),
            },
            {
              destructive: true,
              icon: "D",
              label: "Delete post",
              description: "Remove it from your profile and feed.",
              onClick: () => onDelete(post.id),
            },
          ]}
        />
      </div>
      {post.content && <p className="mt-4 whitespace-pre-wrap text-[15px] leading-6">{post.content}</p>}
      {post.mediaUrl && <PostMedia type={post.mediaType} url={post.mediaUrl} />}
    </article>
  );
}

function AuthForm({
  error,
  loading,
  mode,
  onModeChange,
  onSubmit,
  walletLoading,
}: {
  error: string;
  loading: boolean;
  mode: "login" | "register";
  onModeChange: (mode: "login" | "register") => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  walletLoading: boolean;
}) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className={walletLoading ? "pointer-events-none opacity-60" : ""}>
        {createElement("appkit-button")}
      </div>
      {walletLoading && (
        <p className="text-center text-sm text-[#6d746f]">Signing in...</p>
      )}
      <div className="flex items-center gap-3 text-xs font-semibold uppercase text-[#6d746f]">
        <span className="h-px flex-1 bg-[#ded7c9]" />
        o
        <span className="h-px flex-1 bg-[#ded7c9]" />
      </div>
      {mode === "register" && (
        <input className={inputClass} name="name" placeholder="Name" required />
      )}
      <input className={inputClass} name="email" placeholder="Email" required type="email" />
      <input
        className={inputClass}
        minLength={8}
        name="password"
        placeholder="Password"
        required
        type="password"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className={`${primaryButtonClass} w-full`} disabled={loading}>
        {loading ? "Sending..." : mode === "login" ? "Sign in" : "Create account"}
      </button>
      <div className="border-t border-[#ded7c9] pt-4 text-center">
        <button
          className="rounded-xl bg-[#2f6f62] px-4 py-3 text-sm font-bold text-white hover:bg-[#285f54]"
          type="button"
          onClick={() => onModeChange(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Create a new account" : "I already have an account"}
        </button>
      </div>
    </form>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="px-2 text-sm font-black uppercase tracking-wide text-[#65736f]">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function PersonRow({
  user,
  onOpenProfile,
}: {
  user: Pick<User, "id" | "name" | "avatar"> | Pick<User, "name" | "avatar">;
  onOpenProfile?: (userId: string) => void;
}) {
  const content = (
    <>
      <Avatar name={user.name} src={user.avatar} size="sm" />
      <p className="truncate text-sm font-semibold">{user.name}</p>
    </>
  );

  if ("id" in user && onOpenProfile) {
    return (
      <button className="flex min-w-0 items-center gap-3 text-left" type="button" onClick={() => onOpenProfile(user.id)}>
        {content}
      </button>
    );
  }

  return <div className="flex min-w-0 items-center gap-3">{content}</div>;
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="px-2 text-sm text-[#6d746f]">{children}</p>;
}

function CreateModal({
  children,
  onClose,
  open,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="create-modal-title" aria-modal="true" className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 border-b border-[#dadde1] pb-3">
          <h2 className="text-xl font-black text-[#050505]" id="create-modal-title">{title}</h2>
          <button aria-label="Close" className="grid size-9 place-items-center rounded-full bg-[#e4e6eb] text-lg font-black" type="button" onClick={onClose}>×</button>
        </div>
        <div className="pt-1">{children}</div>
      </section>
    </div>
  );
}

function EditContentModal({
  loading,
  target,
  onClose,
  onSubmit,
}: {
  loading: boolean;
  target: EditableTarget;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const multiline = target.kind !== "live";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4">
      <form className="w-full max-w-lg rounded-lg bg-white p-4 shadow-2xl" onSubmit={onSubmit}>
        <div className="flex items-center justify-between border-b border-[#dadde1] pb-3">
          <h2 className="text-xl font-black text-[#050505]">{target.title}</h2>
          <button className="grid size-9 place-items-center rounded-full bg-[#e4e6eb] text-lg font-black" type="button" onClick={onClose}>
            x
          </button>
        </div>
        {multiline ? (
          <textarea
            autoFocus
            className="mt-4 min-h-36 w-full resize-none rounded-lg border border-[#ccd0d5] bg-white px-3 py-3 text-[15px] outline-none focus:border-[#1877f2]"
            defaultValue={target.value}
            name="value"
            placeholder="Escribe el texto..."
          />
        ) : (
          <input
            autoFocus
            className="mt-4 w-full rounded-lg border border-[#ccd0d5] bg-white px-3 py-3 text-[15px] outline-none focus:border-[#1877f2]"
            defaultValue={target.value}
            name="value"
            placeholder="Title"
            required
          />
        )}
        <div className="mt-4 flex justify-end gap-2 border-t border-[#dadde1] pt-3">
          <button className="rounded-md bg-[#e4e6eb] px-4 py-2 text-sm font-bold text-[#050505]" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="rounded-md bg-[#1877f2] px-4 py-2 text-sm font-bold text-white disabled:opacity-60" disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SharePostModal({
  friends,
  loading,
  myPages,
  onClose,
  onMessenger,
  onShare,
  post,
}: {
  friends: User[];
  loading: boolean;
  myPages: SocialPage[];
  onClose: () => void;
  onMessenger: (event: FormEvent<HTMLFormElement>) => void;
  onShare: (event: FormEvent<HTMLFormElement>) => void;
  post: Post;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4">
      <section className="w-full max-w-xl rounded-lg bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#dadde1] pb-3">
          <h2 className="text-xl font-black text-[#050505]">Share post</h2>
          <button className="grid size-9 place-items-center rounded-full bg-[#e4e6eb] text-lg font-black" type="button" onClick={onClose}>
            x
          </button>
        </div>
        <div className="mt-4 rounded-xl border border-[#ded7c9] bg-[#fffdf8] p-3">
          <p className="text-sm font-black">{(post.page ?? post.author).name}</p>
          <p className="mt-1 line-clamp-3 text-sm text-[#53645f]">{post.content || "Post with media"}</p>
        </div>
        <form className="mt-4 space-y-3" onSubmit={onShare}>
          <textarea className={`${inputClass} min-h-24 resize-none`} name="content" placeholder="Add a comment..." />
          <select className={inputClass} name="pageId">
            <option value="">Share to my profile</option>
            {myPages.map((page) => (
              <option key={page.id} value={page.id}>Share como {page.name}</option>
            ))}
          </select>
          <button className={`${primaryButtonClass} w-full`} disabled={loading}>
            Share
          </button>
        </form>
        <form className="mt-4 border-t border-[#dadde1] pt-4" onSubmit={onMessenger}>
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <input className={inputClass} name="content" placeholder="Message opcional" />
            <select className={inputClass} name="peerId" required>
              <option value="">Send a...</option>
              {friends.map((friend) => (
                <option key={friend.id} value={friend.id}>{friend.name}</option>
              ))}
            </select>
          </div>
          <button className={`${secondaryButtonClass} mt-3 w-full`} disabled={loading}>
            Send por Messenger
          </button>
        </form>
      </section>
    </div>
  );
}

function ReportPostModal({
  loading,
  onClose,
  onReport,
  post,
}: {
  loading: boolean;
  onClose: () => void;
  onReport: (event: FormEvent<HTMLFormElement>) => void;
  post: Post;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4">
      <section className="w-full max-w-md rounded-lg bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#dadde1] pb-3">
          <h2 className="text-xl font-black text-[#050505]">Report post</h2>
          <button className="grid size-9 place-items-center rounded-full bg-[#e4e6eb] text-lg font-black" type="button" onClick={onClose}>
            x
          </button>
        </div>
        <p className="mt-3 line-clamp-3 rounded-xl border border-[#ded7c9] bg-[#fffdf8] p-3 text-sm text-[#53645f]">
          {post.content || "Post with media"}
        </p>
        <form className="mt-4 space-y-3" onSubmit={onReport}>
          <textarea className={`${inputClass} min-h-24 resize-none`} name="reason" placeholder="Describe the issue..." required />
          <div className="flex justify-end gap-2">
            <button className="rounded-md bg-[#e4e6eb] px-4 py-2 text-sm font-bold text-[#050505]" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60" disabled={loading}>
              {loading ? "Sending..." : "Reportar"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ConfirmDeleteModal({
  loading,
  target,
  onClose,
  onConfirm,
}: {
  loading: boolean;
  target: DeleteTarget;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4">
      <section className="w-full max-w-md rounded-lg bg-white p-4 shadow-2xl">
        <h2 className="text-xl font-black text-[#050505]">{target.title}</h2>
        <p className="mt-2 text-sm text-[#65676b]">{target.description}</p>
        <div className="mt-5 flex justify-end gap-2 border-t border-[#dadde1] pt-3">
          <button className="rounded-md bg-[#e4e6eb] px-4 py-2 text-sm font-bold text-[#050505]" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            disabled={loading}
            type="button"
            onClick={onConfirm}
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </section>
    </div>
  );
}

type ActionMenuItem = {
  description: string;
  destructive?: boolean;
  icon: string;
  label: string;
  onClick: () => void;
};

function ActionMenu({
  align = "right",
  items,
  variant = "light",
}: {
  align?: "left" | "right";
  items: ActionMenuItem[];
  variant?: "dark" | "light";
}) {
  const [open, setOpen] = useState(false);

  return (
    <details
      className="group relative"
      open={open}
      onToggle={(event) => {
        if (event.currentTarget.open) {
          document.querySelectorAll("details[open]").forEach((element) => {
            if (element !== event.currentTarget && element instanceof HTMLDetailsElement) {
              element.open = false;
            }
          });
        }

        setOpen(event.currentTarget.open);
      }}
    >
      <summary
        className={`grid size-8 cursor-pointer list-none place-items-center rounded-full text-base font-black leading-none marker:hidden ${
          variant === "dark"
            ? "bg-white/15 text-white hover:bg-white/25"
            : "bg-[#f0f2f5] text-[#050505] hover:bg-[#e4e6eb]"
        }`}
      >
        ...
      </summary>
      <div
        className={`absolute top-9 z-50 w-56 max-w-[calc(100vw-32px)] rounded-lg border border-[#dadde1] bg-white p-1.5 text-[#050505] shadow-[0_8px_24px_rgba(0,0,0,0.2)] ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {items.map((item) => (
          <button
            className="flex w-full gap-2 rounded-md p-2 text-left hover:bg-[#f0f2f5]"
            key={item.label}
            onClick={() => {
              setOpen(false);
              item.onClick();
            }}
            type="button"
          >
            <span
              className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-black ${
                item.destructive ? "bg-red-50 text-red-600" : "bg-[#e4e6eb] text-[#050505]"
              }`}
            >
              {item.icon}
            </span>
            <span className="min-w-0">
              <span className={`block text-sm font-bold ${item.destructive ? "text-red-600" : ""}`}>
                {item.label}
              </span>
              <span className="block text-[11px] leading-4 text-[#65676b]">{item.description}</span>
            </span>
          </button>
        ))}
      </div>
    </details>
  );
}

function Avatar({
  name,
  src,
  size,
}: {
  name: string;
  src?: string | null;
  size: "sm" | "md" | "lg";
}) {
  const sizeClass = {
    sm: "size-9 text-sm",
    md: "size-10 text-sm",
    lg: "size-28 border-4 border-white text-4xl",
  }[size];

  if (src) {
    return (
      <img
        alt=""
        className={`${sizeClass} shrink-0 rounded-xl bg-[#ece7dc] object-cover`}
        src={mediaSrc(src)}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} grid shrink-0 place-items-center rounded-xl bg-[#17211f] font-bold text-[#f2c166]`}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

const inputClass =
  "mt-1 w-full rounded-xl border border-[#ded7c9] bg-[#fffdf8] px-3 py-3 text-sm outline-none focus:border-[#49625b] focus:ring-2 focus:ring-[#49625b]/10";

const primaryButtonClass =
  "rounded-xl bg-[#17211f] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#263532] disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClass =
  "rounded-xl bg-[#ece7dc] px-3 py-2 text-sm font-bold text-[#17211f] hover:bg-[#ded7c9]";

function createSiweMessage({
  address,
  chainId,
  nonce,
}: {
  address: string;
  chainId: number;
  nonce: string;
}) {
  const domain = window.location.host;
  const uri = window.location.origin;
  return `${domain} wants you to sign in with your Ethereum account:
${address}

Sign in to Social Network.

URI: ${uri}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${new Date().toISOString()}`;
}
