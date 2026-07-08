"use client";

import {
  ChangeEvent,
  FormEvent,
  createElement,
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
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

type User = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
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
  createdAt: string;
  signerAddress: string | null;
  messageHash: string | null;
  signature: string | null;
  author: Pick<User, "id" | "name" | "avatar">;
  reactionCount: number;
  commentCount: number;
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
  hostId: string;
  hostName: string;
  hostAvatar: string | null;
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

type AppView = "home" | "profile" | "friends" | "lives";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const SESSION_KEY = "social-network-session";
const SESSION_EVENT = "social-network-session-change";
const ZERO_BIGINT = BigInt(0);
const EXPLORER_BASE = process.env.NEXT_PUBLIC_CHAIN_EXPLORER_URL ?? "https://sepolia.etherscan.io";
const optionalAddress = (value: string | undefined) =>
  value && isAddress(value) ? (value as Address) : undefined;
const mediaSrc = (url: string) => (url.startsWith("/") ? `${API_URL}${url}` : url);
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
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [wallet, setWallet] = useState<WalletAccount | null>(null);
  const [view, setView] = useState<AppView>("home");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const walletSyncStarted = useRef(false);
  const { address, chainId, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
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
    const response = await fetch(`${API_URL}/media`, {
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

    const [nextPosts, nextStories, nextLives, nextProfileLives, nextSuggestions, nextFriends, nextRequests, nextWallet] =
      await Promise.all([
      authed<Post[]>("/posts"),
        authed<Story[]>("/stories"),
        authed<LiveSession[]>("/lives"),
        authed<LiveSession[]>("/lives/mine"),
        authed<User[]>("/friends/suggestions"),
        authed<User[]>("/friends"),
        authed<FriendRequest[]>("/friends/requests"),
        authed<WalletAccount | null>("/wallet/me"),
      ]);

    setPosts(nextPosts);
    setStories(nextStories);
    setLives(nextLives);
    setProfileLives(nextProfileLives);
    setSuggestions(nextSuggestions);
    setFriends(nextFriends);
    setRequests(nextRequests);
    setWallet(nextWallet);
  }

  useEffect(() => {
    if (!session) {
      return;
    }

    let cancelled = false;

    async function loadSocialData() {
      try {
        const [nextPosts, nextStories, nextLives, nextProfileLives, nextSuggestions, nextFriends, nextRequests, nextWallet] =
          await Promise.all([
          authed<Post[]>("/posts"),
            authed<Story[]>("/stories"),
            authed<LiveSession[]>("/lives"),
            authed<LiveSession[]>("/lives/mine"),
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
          setSuggestions(nextSuggestions);
          setFriends(nextFriends);
          setRequests(nextRequests);
          setWallet(nextWallet);
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
        const signature = await signMessageAsync({ message });
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

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      return;
    }

    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);

    try {
      const user = await authed<User>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: String(form.get("name")),
          avatar: String(form.get("avatar")) || null,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  async function toggleReaction(postId: string) {
    setError("");

    try {
      await authed(`/posts/${postId}/reactions`, { method: "POST" });
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

  function logout() {
    saveStoredSession(null);
    setPosts([]);
    setStories([]);
    setLives([]);
    setProfileLives([]);
    setSuggestions([]);
    setFriends([]);
    setRequests([]);
    setWallet(null);
    void disconnect();
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#f7f5ef] text-[#17211f]">
        <div className="mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-5 py-8 md:grid-cols-[1fr_420px] md:items-center">
          <section>
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-[#d8d1c3] bg-white/70 px-4 py-2 text-sm font-semibold text-[#49625b]">
              <span className="size-2 rounded-full bg-[#d89d35]" />
              Red social con identidad onchain
            </div>
            <h1 className="max-w-2xl text-5xl font-black tracking-tight text-[#17211f] md:text-7xl">
              Nexo
            </h1>
            <p className="mt-5 max-w-xl text-xl leading-8 text-[#53645f]">
              Un espacio limpio para publicar, conectar y llevar tu identidad social a Sepolia.
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
    <main className="min-h-screen bg-[#f7f5ef] text-[#17211f]">
      <TopBar
        user={session.user}
        view={view}
        onNavigate={setView}
        onLogout={logout}
        onProfile={() => setView("profile")}
      />

      <div
        className={`mx-auto grid w-full max-w-[1464px] gap-5 px-4 py-5 ${
          view === "home"
            ? "lg:grid-cols-[260px_minmax(0,700px)_330px]"
            : "lg:grid-cols-[260px_minmax(0,1fr)]"
        }`}
      >
        <LeftRail user={session.user} view={view} onNavigate={setView} />

        {view === "profile" ? (
          <ProfilePage
            error={error}
            lives={profileLives}
            loading={loading}
            posts={posts.filter((post) => post.author.id === session.user.id)}
            session={session}
            onSubmit={updateProfile}
          />
        ) : view === "friends" ? (
          <FriendsPage
            friends={friends}
            requests={requests}
            suggestions={suggestions}
            onAccept={(id) => respondToRequest(id, "accept")}
            onAdd={addFriend}
            onReject={(id) => respondToRequest(id, "reject")}
          />
        ) : view === "lives" ? (
          <LivesPage lives={profileLives} />
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
            loading={loading}
            onUploadMedia={uploadMedia}
            user={session.user}
            onEndLive={endLive}
              onStartLive={startLive}
              onSubmit={createPost}
            />
            {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {posts.length === 0 ? (
              <p className="rounded-2xl border border-[#ded7c9] bg-white p-8 text-center text-sm text-[#6d746f] shadow-sm">
                Todavia no hay publicaciones. Crea la primera.
              </p>
            ) : (
              posts.map((post) => (
                <FeedPost
                  key={post.id}
                  post={post}
                  onComment={commentOnPost}
                  onReact={toggleReaction}
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
            onReject={(id) => respondToRequest(id, "reject")}
          />
        )}
      </div>
    </main>
  );
}

function TopBar({
  user,
  view,
  onNavigate,
  onLogout,
  onProfile,
}: {
  user: User;
  view: AppView;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
  onProfile: () => void;
}) {
  const navItems: { label: string; view: AppView }[] = [
    { label: "Inicio", view: "home" },
    { label: "Amigos", view: "friends" },
    { label: "Lives", view: "lives" },
    { label: "Perfil", view: "profile" },
  ];

  return (
    <header className="sticky top-0 z-20 h-16 border-b border-[#ded7c9] bg-[#fffdf8]/90 shadow-sm backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1464px] items-center gap-3 px-4">
        <div className="grid size-10 place-items-center rounded-xl bg-[#17211f] text-lg font-black text-[#f2c166]">
          N
        </div>
        <input
          className="hidden h-10 w-64 rounded-xl border border-[#ded7c9] bg-white px-4 text-sm outline-none focus:border-[#49625b] md:block"
          placeholder="Buscar en Nexo"
        />
        <nav className="mx-auto hidden h-full items-center gap-2 md:flex">
          {navItems.map((item) => (
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
        </nav>
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
          Salir
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
    { label: "Inicio", view: "home" },
    { label: "Amigos", view: "friends" },
    { label: "Lives", view: "lives" },
    { label: "Perfil", view: "profile" },
  ];

  return (
    <aside className="sticky top-20 hidden h-[calc(100vh-80px)] space-y-2 overflow-y-auto lg:block">
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
    <section className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm">
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
                <h2 className="text-xl font-black">Crear historia</h2>
                <button className={secondaryButtonClass} type="button" onClick={closeCreate}>
                  Cerrar
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
                  placeholder={`Texto para tu historia, ${user.name}`}
                />
              </div>
              <button className={`${primaryButtonClass} mt-5 w-full`} disabled={!draftPreview || loading} type="submit">
                {loading ? "Publicando..." : "Compartir en historia"}
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
                    Selecciona una foto o video para previsualizar.
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          className="relative h-48 overflow-hidden rounded-2xl border border-dashed border-[#b8ad9b] bg-[#fffaf0] text-left"
          onClick={() => setCreating(true)}
          type="button"
        >
          <div className="grid h-28 place-items-center bg-[#17211f]">
            <span className="grid size-11 place-items-center rounded-full bg-[#f2c166] text-2xl font-black text-[#17211f]">
              +
            </span>
          </div>
          <div className="p-3">
            <p className="text-sm font-black">Crear historia</p>
            <p className="mt-1 text-xs text-[#6d746f]">Foto o video</p>
          </div>
        </button>

        {stories.slice(0, 7).map((story) => (
            <button
              className="relative h-48 overflow-hidden rounded-2xl bg-[#17211f] text-white"
              key={story.id}
              onClick={() => setPreviewStory(story)}
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
        ))}
      </div>

      {previewStory && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#111816]/90 px-4">
          <button
            className="absolute right-5 top-5 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
            onClick={() => setPreviewStory(null)}
            type="button"
          >
            Cerrar
          </button>
          <div className="relative h-[86vh] w-full max-w-[430px] overflow-hidden rounded-2xl bg-black shadow-2xl">
            {previewStory.mediaType === "VIDEO" ? (
              <video className="size-full object-contain" controls src={mediaSrc(previewStory.mediaUrl)} />
            ) : (
              <img alt="" className="size-full object-contain" src={mediaSrc(previewStory.mediaUrl)} />
            )}
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-4">
              <div className="flex items-center gap-3 text-white">
                <Avatar name={previewStory.authorName} src={previewStory.authorAvatar} size="sm" />
                <div>
                  <p className="text-sm font-black">{previewStory.authorName}</p>
                  <p className="text-xs text-white/70">
                    {new Date(previewStory.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            {previewStory.caption && (
              <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-5 pt-16 text-sm font-semibold text-white">
                {previewStory.caption}
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
  loading,
  onUploadMedia,
  user,
  onEndLive,
  onStartLive,
  onSubmit,
}: {
  lives: LiveSession[];
  loading: boolean;
  onUploadMedia: (file: File) => Promise<{ url: string; mediaType: "IMAGE" | "VIDEO" }>;
  user: User;
  onEndLive: (id: string, recordingUrl?: string) => void;
  onStartLive: (title: string) => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [liveOpen, setLiveOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const myLive = lives.find((live) => live.hostId === user.id);

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
      setCameraError("No se pudo acceder a camara o microfono.");
    }
  }

  function stopCamera() {
    recorderRef.current?.stop();
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
    const recordingUrl = await stopRecordingAndUpload();
    await onEndLive(id, recordingUrl);
    stopCamera();
  }

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

        const file = new File([blob], `live-${Date.now()}.webm`, { type: "video/webm" });
        const uploaded = await onUploadMedia(file);
        resolve(uploaded.url);
      };
      recorder.stop();
    });
  }

  return (
    <>
      <form className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm" onSubmit={onSubmit}>
        <div className="flex gap-3">
          <Avatar name={user.name} src={user.avatar} size="md" />
          <div className="grid flex-1 gap-3">
            <textarea
              className="min-h-24 resize-none rounded-xl border border-[#ded7c9] bg-[#fffdf8] px-4 py-3 text-sm outline-none focus:border-[#49625b] focus:ring-2 focus:ring-[#49625b]/10"
              name="content"
              placeholder={`Que estas pensando, ${user.name}?`}
            />
            <div className="grid gap-2">
              <input
                accept="image/*,video/*"
                className={inputClass}
                name="mediaFile"
                type="file"
              />
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[#eee8dc] pt-3">
          <div className="flex gap-2 text-xs font-bold text-[#65736f]">
            <span className="rounded-xl bg-[#f4efe5] px-3 py-2">Foto</span>
            <span className="rounded-xl bg-[#f4efe5] px-3 py-2">Video</span>
            <button
              className="rounded-xl bg-red-50 px-3 py-2 text-red-700 hover:bg-red-100"
              onClick={() => setLiveOpen(true)}
              type="button"
            >
              Live
            </button>
          </div>
          <button className={primaryButtonClass} disabled={loading} type="submit">
            {loading ? "Publicando..." : "Publicar"}
          </button>
        </div>
      </form>

      {myLive && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-red-700">En vivo</p>
              <h2 className="text-base font-black">{myLive.title}</h2>
            </div>
            <button className={primaryButtonClass} type="button" onClick={() => void finishLive(myLive.id)}>
              Finalizar live
            </button>
          </div>
        </section>
      )}

      {liveOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#111816]/85 px-4 backdrop-blur-sm">
          <form
            className="grid max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl md:grid-cols-[1fr_320px]"
            onSubmit={submitLive}
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
                    Enciende la camara para previsualizar tu live.
                  </div>
                )}
                <div className="absolute left-4 top-4 rounded-full bg-red-600 px-3 py-1 text-xs font-black uppercase text-white">
                  Live preview
                </div>
              </div>
            </div>

            <aside className="grid content-between gap-4 p-5">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-black">Crear live</h2>
                  <button
                    className={secondaryButtonClass}
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setLiveOpen(false);
                    }}
                  >
                    Cerrar
                  </button>
                </div>
                <p className="mt-2 text-sm text-[#6d746f]">
                  Transmite desde tu camara. La sesion queda registrada como live activo en la app.
                </p>
                <input className={`${inputClass} mt-5`} name="title" placeholder="Titulo del live" required />
                {cameraError && <p className="mt-3 text-sm font-semibold text-red-700">{cameraError}</p>}
              </div>

              <div className="grid gap-2">
                <button className={secondaryButtonClass} type="button" onClick={cameraReady ? stopCamera : enableCamera}>
                  {cameraReady ? "Apagar camara" : "Encender camara"}
                </button>
                {myLive ? (
                  <button className={primaryButtonClass} type="button" onClick={() => void finishLive(myLive.id)}>
                    Finalizar live
                  </button>
                ) : (
                  <button className={primaryButtonClass} disabled={!cameraReady || loading} type="submit">
                    {loading ? "Iniciando..." : "Iniciar transmision"}
                  </button>
                )}
              </div>
            </aside>
          </form>
        </div>
      )}
    </>
  );
}

function FeedPost({
  post,
  onComment,
  onReact,
}: {
  post: Post;
  onComment: (event: FormEvent<HTMLFormElement>, postId: string) => void;
  onReact: (postId: string) => void;
}) {
  return (
    <article className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar name={post.author.name} src={post.author.avatar} size="md" />
        <div>
          <h2 className="text-sm font-semibold">{post.author.name}</h2>
          <p className="text-xs text-[#6d746f]">
            {new Date(post.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-[15px] leading-6">{post.content}</p>
      {post.mediaUrl && <PostMedia type={post.mediaType} url={post.mediaUrl} />}
      {post.signature && (
        <p className="mt-3 rounded-xl border border-[#e7decd] bg-[#fff8e8] px-3 py-2 text-xs text-[#6d5b32]">
          Firmado por app signer {post.signerAddress?.slice(0, 6)}...
          {post.signerAddress?.slice(-4)}
        </p>
      )}
      <div className="mt-3 flex justify-between border-t border-[#eee8dc] pt-3 text-xs text-[#6d746f]">
        <span>{post.reactionCount} apoyos</span>
        <span>{post.commentCount} comentarios</span>
      </div>
      <div className="mt-4 flex border-t border-[#eee8dc] pt-2 text-sm text-[#65736f]">
        <button
          className={`flex-1 rounded-xl py-2 font-semibold hover:bg-[#ece7dc] ${
            post.reactedByMe ? "text-[#b8741a]" : ""
          }`}
          onClick={() => onReact(post.id)}
        >
          Apoyar
        </button>
        <button className="flex-1 rounded-xl py-2 font-semibold hover:bg-[#ece7dc]">
          Comentar
        </button>
        <button className="flex-1 rounded-xl py-2 font-semibold hover:bg-[#ece7dc]">
          Compartir
        </button>
      </div>
      <div className="mt-3 space-y-3">
        {post.comments.map((comment) => (
          <div className="flex gap-2" key={comment.id}>
            <Avatar name={comment.author.name} src={comment.author.avatar} size="sm" />
            <div className="rounded-xl bg-[#f4efe5] px-3 py-2">
              <p className="text-xs font-semibold">{comment.author.name}</p>
              <p className="text-sm">{comment.content}</p>
              <p className="mt-1 text-[11px] text-[#6d746f]">
                firmado {comment.signerAddress.slice(0, 6)}...
                {comment.signerAddress.slice(-4)}
              </p>
            </div>
          </div>
        ))}
        <form className="flex gap-2" onSubmit={(event) => onComment(event, post.id)}>
          <input
            className="min-w-0 flex-1 rounded-xl border border-[#ded7c9] bg-[#fffdf8] px-4 py-2 text-sm outline-none focus:border-[#49625b] focus:ring-2 focus:ring-[#49625b]/10"
            name="comment"
            placeholder="Escribe un comentario..."
          />
          <button className={secondaryButtonClass} type="submit">
            Enviar
          </button>
        </form>
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
            Abrir stream
          </a>
        </div>
        <div className="grid min-h-48 place-items-center px-6 pb-6 text-center text-sm text-white/80">
          Stream externo conectado a esta publicacion.
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
  requests,
  suggestions,
  wallet,
  onAccept,
  onAdd,
  onReject,
}: {
  friends: User[];
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

      <Panel title="Solicitudes de amistad">
        {requests.length === 0 ? (
          <EmptyText>No hay solicitudes pendientes.</EmptyText>
        ) : (
          requests.map((request) => (
            <div className="space-y-2" key={request.id}>
              <PersonRow user={request.requester} />
              <div className="grid grid-cols-2 gap-2">
                <button className={primaryButtonClass} onClick={() => onAccept(request.id)}>
                  Confirmar
                </button>
                <button className={secondaryButtonClass} onClick={() => onReject(request.id)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </Panel>

      <Panel title="Personas que quizas conozcas">
        {suggestions.length === 0 ? (
          <EmptyText>No hay sugerencias por ahora.</EmptyText>
        ) : (
          suggestions.map((user) => (
            <div className="flex items-center justify-between gap-3" key={user.id}>
              <PersonRow user={user} />
              <button className={secondaryButtonClass} onClick={() => onAdd(user.id)}>
                Agregar
              </button>
            </div>
          ))
        )}
      </Panel>

      <Panel title="Contactos">
        {friends.length === 0 ? (
          <EmptyText>Aun no tienes amigos agregados.</EmptyText>
        ) : (
          friends.map((friend) => <PersonRow key={friend.id} user={friend} />)
        )}
      </Panel>
    </aside>
  );
}

function FriendsPage({
  friends,
  requests,
  suggestions,
  onAccept,
  onAdd,
  onReject,
}: {
  friends: User[];
  requests: FriendRequest[];
  suggestions: User[];
  onAccept: (id: string) => void;
  onAdd: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <section className="space-y-4 lg:col-span-2">
      <PageHeader
        kicker="Red"
        title="Amigos"
        subtitle="Administra solicitudes, sugerencias y contactos desde una vista completa."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-wide text-[#65736f]">Solicitudes</h2>
          <div className="mt-4 grid gap-3">
            {requests.length === 0 ? (
              <EmptyText>No hay solicitudes pendientes.</EmptyText>
            ) : (
              requests.map((request) => (
                <div className="rounded-xl bg-[#f7f5ef] p-3" key={request.id}>
                  <PersonRow user={request.requester} />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className={primaryButtonClass} onClick={() => onAccept(request.id)}>
                      Confirmar
                    </button>
                    <button className={secondaryButtonClass} onClick={() => onReject(request.id)}>
                      Rechazar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-wide text-[#65736f]">Sugerencias</h2>
          <div className="mt-4 grid gap-3">
            {suggestions.length === 0 ? (
              <EmptyText>No hay sugerencias por ahora.</EmptyText>
            ) : (
              suggestions.map((user) => (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f5ef] p-3" key={user.id}>
                  <PersonRow user={user} />
                  <button className={secondaryButtonClass} onClick={() => onAdd(user.id)}>
                    Agregar
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-wide text-[#65736f]">Contactos</h2>
          <div className="mt-4 grid gap-3">
            {friends.length === 0 ? (
              <EmptyText>Aun no tienes amigos agregados.</EmptyText>
            ) : (
              friends.map((friend) => (
                <div className="rounded-xl bg-[#f7f5ef] p-3" key={friend.id}>
                  <PersonRow user={friend} />
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function LivesPage({ lives }: { lives: LiveSession[] }) {
  return (
    <section className="space-y-4 lg:col-span-2">
      <PageHeader
        kicker="Video"
        title="Lives"
        subtitle="Tus transmisiones activas y grabaciones quedan guardadas para volver a verlas."
      />
      {lives.length === 0 ? (
        <p className="rounded-2xl border border-[#ded7c9] bg-white p-8 text-center text-sm text-[#6d746f] shadow-sm">
          Aun no tienes lives. Inicia uno desde el compositor del inicio.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lives.map((live) => (
            <LiveCard key={live.id} live={live} />
          ))}
        </div>
      )}
    </section>
  );
}

function PageHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="rounded-2xl border border-[#ded7c9] bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-[#b8741a]">{kicker}</p>
      <h1 className="mt-1 text-3xl font-black">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#6d746f]">{subtitle}</p>
    </header>
  );
}

function LiveCard({ live }: { live: LiveSession }) {
  return (
    <article className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <PersonRow user={{ name: live.hostName, avatar: live.hostAvatar }} />
        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
          live.status === "LIVE" ? "bg-red-600 text-white" : "bg-[#ece7dc] text-[#17211f]"
        }`}>
          {live.status === "LIVE" ? "En vivo" : "Replay"}
        </span>
      </div>
      {live.recordingUrl ? (
        <video
          className="aspect-video w-full rounded-xl bg-black object-contain"
          controls
          src={mediaSrc(live.recordingUrl)}
        />
      ) : (
        <div className="grid aspect-video place-items-center rounded-xl bg-[#17211f] text-sm font-bold text-white/70">
          {live.status === "LIVE" ? "Live activo" : "Sin grabacion"}
        </div>
      )}
      <h2 className="mt-3 font-black">{live.title}</h2>
      <p className="mt-1 text-xs text-[#6d746f]">{new Date(live.startedAt).toLocaleString()}</p>
    </article>
  );
}

function OnchainIdentity({ wallet }: { wallet: WalletAccount }) {
  const { address } = useAccount();
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
          ? "Tu wallet no tiene suficiente Sepolia ETH para pagar gas."
          : message.split("\n")[0],
      );
    }
  }

  const busy = isPending || confirming;
  const paidUntilDate =
    paidUntil && paidUntil > ZERO_BIGINT
      ? new Date(Number(paidUntil) * 1000).toLocaleDateString()
      : "Sin storage";
  const socialIdText =
    socialId && socialId > ZERO_BIGINT ? socialId.toString() : "No registrado";

  return (
    <div className="space-y-3 rounded-2xl border border-[#ded7c9] bg-white p-3 shadow-sm">
      <div>
        <p className="text-xs font-semibold text-[#6d746f]">Wallet conectada</p>
        <p className="break-all text-xs font-semibold">{address ?? "Sin wallet"}</p>
      </div>
      <div>
        <p className="text-xs font-semibold text-[#6d746f]">Custody wallet</p>
        <p className="break-all text-xs">{wallet.address}</p>
      </div>
      <div>
        <p className="text-xs font-semibold text-[#6d746f]">App signer</p>
        <p className="break-all text-xs">{appSigner ?? "Sin signer"}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="rounded-xl bg-[#f4efe5] p-2">
          ID: {socialIdText}
        </span>
        <span className="rounded-xl bg-[#f4efe5] p-2">
          Key: {keyRegistered ? "Registrada" : "Pendiente"}
        </span>
        <span className="col-span-2 rounded-xl bg-[#f4efe5] p-2">
          Storage: {paidUntilDate}
        </span>
      </div>
      <div className="grid gap-2">
        {(!idReady || !keyReady || !storageReady) && (
          <p className="rounded-xl bg-[#fff4d6] p-2 text-xs font-semibold text-[#6b4b00]">
            Configura contratos Sepolia faltantes para habilitar todas las acciones onchain.
          </p>
        )}
        {txError && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-2 text-xs font-semibold text-red-700">
            {txError}
          </p>
        )}
        {!hasSocialId && (
          <button
            className={primaryButtonClass}
            disabled={!idReady || !address || busy}
            onClick={registerIdentity}
          >
            Registrar ID
          </button>
        )}
        <button
          className={secondaryButtonClass}
          disabled={!keyReady || !hasSocialId || !signerKey || Boolean(keyRegistered) || busy}
          onClick={addAppSigner}
        >
          Registrar signer
        </button>
        <button
          className={secondaryButtonClass}
          disabled={!storageReady || !hasSocialId || busy}
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

function ProfilePage({
  error,
  lives,
  loading,
  posts,
  session,
  onSubmit,
}: {
  error: string;
  lives: LiveSession[];
  loading: boolean;
  posts: Post[];
  session: Session;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="space-y-4 lg:col-span-2">
      <div className="overflow-hidden rounded-2xl border border-[#ded7c9] bg-white shadow-sm">
        <div className="h-64 bg-[#17211f]" />
        <div className="-mt-16 px-6 pb-6">
          <div className="flex flex-col gap-4 border-b border-[#eee8dc] pb-5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-end gap-4">
              <Avatar name={session.user.name} src={session.user.avatar} size="lg" />
              <div className="pb-3">
                <h1 className="text-3xl font-black">{session.user.name}</h1>
                <p className="text-sm text-[#6d746f]">{session.user.email}</p>
                {session.user.bio && <p className="mt-2 max-w-2xl text-sm">{session.user.bio}</p>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-[#6d746f]">
              <span className="rounded-xl bg-[#f4efe5] px-4 py-3">{posts.length} posts</span>
              <span className="rounded-xl bg-[#f4efe5] px-4 py-3">{lives.length} lives</span>
              <span className="rounded-xl bg-[#f4efe5] px-4 py-3">Sepolia</span>
            </div>
          </div>

          <form className="mt-5 grid gap-3 rounded-2xl bg-[#f7f5ef] p-4" onSubmit={onSubmit}>
            <h2 className="text-sm font-black uppercase tracking-wide text-[#65736f]">Editar perfil</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-semibold">
                Nombre
                <input className={inputClass} defaultValue={session.user.name} name="name" required />
              </label>
              <label className="text-sm font-semibold">
                Avatar URL
                <input className={inputClass} defaultValue={session.user.avatar ?? ""} name="avatar" type="url" />
              </label>
            </div>
            <label className="text-sm font-semibold">
              Bio
              <textarea className={`${inputClass} min-h-24 resize-none`} defaultValue={session.user.bio ?? ""} name="bio" />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className={`${primaryButtonClass} w-full md:w-fit`} disabled={loading}>
              {loading ? "Guardando..." : "Guardar cambios"}
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <h2 className="px-2 text-sm font-black uppercase tracking-wide text-[#65736f]">Publicaciones</h2>
          {posts.length === 0 ? (
            <p className="rounded-2xl border border-[#ded7c9] bg-white p-8 text-center text-sm text-[#6d746f] shadow-sm">
              Aun no tienes publicaciones.
            </p>
          ) : (
            posts.map((post) => <ProfilePostCard key={post.id} post={post} />)
          )}
        </div>

        <div className="space-y-3">
          <h2 className="px-2 text-sm font-black uppercase tracking-wide text-[#65736f]">Lives</h2>
          {lives.length === 0 ? (
            <p className="rounded-2xl border border-[#ded7c9] bg-white p-5 text-sm text-[#6d746f] shadow-sm">
              Aun no tienes lives guardados.
            </p>
          ) : (
            lives.map((live) => <LiveCard key={live.id} live={live} />)
          )}
        </div>
      </div>
    </section>
  );
}

function ProfilePostCard({ post }: { post: Post }) {
  return (
    <article className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar name={post.author.name} src={post.author.avatar} size="md" />
        <div>
          <h2 className="text-sm font-semibold">{post.author.name}</h2>
          <p className="text-xs text-[#6d746f]">{new Date(post.createdAt).toLocaleString()}</p>
        </div>
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
        <p className="text-center text-sm text-[#6d746f]">Firmando acceso...</p>
      )}
      <div className="flex items-center gap-3 text-xs font-semibold uppercase text-[#6d746f]">
        <span className="h-px flex-1 bg-[#ded7c9]" />
        o
        <span className="h-px flex-1 bg-[#ded7c9]" />
      </div>
      {mode === "register" && (
        <input className={inputClass} name="name" placeholder="Nombre" required />
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
        {loading ? "Enviando..." : mode === "login" ? "Iniciar sesion" : "Crear cuenta"}
      </button>
      <div className="border-t border-[#ded7c9] pt-4 text-center">
        <button
          className="rounded-xl bg-[#2f6f62] px-4 py-3 text-sm font-bold text-white hover:bg-[#285f54]"
          type="button"
          onClick={() => onModeChange(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Crear cuenta nueva" : "Ya tengo cuenta"}
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

function PersonRow({ user }: { user: User | Pick<User, "name" | "avatar"> }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={user.name} src={user.avatar} size="sm" />
      <p className="truncate text-sm font-semibold">{user.name}</p>
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="px-2 text-sm text-[#6d746f]">{children}</p>;
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
        src={src}
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
