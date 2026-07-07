"use client";

import {
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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const SESSION_KEY = "social-network-session";
const SESSION_EVENT = "social-network-session-change";
const ZERO_BIGINT = BigInt(0);
const EXPLORER_BASE = process.env.NEXT_PUBLIC_CHAIN_EXPLORER_URL ?? "https://sepolia.etherscan.io";
const optionalAddress = (value: string | undefined) =>
  value && isAddress(value) ? (value as Address) : undefined;
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
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [wallet, setWallet] = useState<WalletAccount | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
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

  async function refreshSocialData() {
    if (!session) {
      return;
    }

    const [nextPosts, nextSuggestions, nextFriends, nextRequests, nextWallet] =
      await Promise.all([
      authed<Post[]>("/posts"),
        authed<User[]>("/friends/suggestions"),
        authed<User[]>("/friends"),
        authed<FriendRequest[]>("/friends/requests"),
        authed<WalletAccount | null>("/wallet/me"),
      ]);

    setPosts(nextPosts);
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
        const [nextPosts, nextSuggestions, nextFriends, nextRequests, nextWallet] =
          await Promise.all([
          authed<Post[]>("/posts"),
            authed<User[]>("/friends/suggestions"),
            authed<User[]>("/friends"),
            authed<FriendRequest[]>("/friends/requests"),
            authed<WalletAccount | null>("/wallet/me"),
          ]);

        if (!cancelled) {
          setPosts(nextPosts);
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

    if (!content) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      setPosts([
        await authed<Post>("/posts", {
          method: "POST",
          body: JSON.stringify({ content }),
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
      setProfileOpen(false);
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
        onLogout={logout}
        onProfile={() => setProfileOpen(true)}
      />

      <div className="mx-auto grid w-full max-w-[1464px] gap-5 px-4 py-5 lg:grid-cols-[260px_minmax(0,700px)_330px]">
        <LeftRail user={session.user} onProfile={() => setProfileOpen(true)} />

        <section className="space-y-4">
          <Stories user={session.user} suggestions={suggestions.slice(0, 4)} />
          <Composer loading={loading} user={session.user} onSubmit={createPost} />
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

        <RightRail
          friends={friends}
          requests={requests}
          suggestions={suggestions}
          wallet={wallet}
          onAccept={(id) => respondToRequest(id, "accept")}
          onAdd={addFriend}
          onReject={(id) => respondToRequest(id, "reject")}
        />
      </div>

      {profileOpen && (
        <ProfileModal
          error={error}
          loading={loading}
          session={session}
          onClose={() => setProfileOpen(false)}
          onSubmit={updateProfile}
        />
      )}
    </main>
  );
}

function TopBar({
  user,
  onLogout,
  onProfile,
}: {
  user: User;
  onLogout: () => void;
  onProfile: () => void;
}) {
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
          {["Inicio", "Red", "Firmas", "Storage"].map((item) => (
            <button
              className="h-11 rounded-xl px-6 text-sm font-semibold text-[#65736f] hover:bg-[#ece7dc]"
              key={item}
            >
              {item}
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
  onProfile,
}: {
  user: User;
  onProfile: () => void;
}) {
  const items = ["Amigos", "Recuerdos", "Guardados", "Grupos", "Video", "Marketplace"];

  return (
    <aside className="sticky top-20 hidden h-[calc(100vh-80px)] space-y-2 overflow-y-auto lg:block">
      <button
        className="flex w-full items-center gap-3 rounded-xl border border-[#ded7c9] bg-white p-3 text-left font-semibold shadow-sm hover:bg-[#fffaf0]"
        onClick={onProfile}
      >
        <Avatar name={user.name} src={user.avatar} size="sm" />
        {user.name}
      </button>
      {items.map((item) => (
        <button
          className="block w-full rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#53645f] hover:bg-[#ece7dc]"
          key={item}
        >
          {item}
        </button>
      ))}
    </aside>
  );
}

function Stories({ user, suggestions }: { user: User; suggestions: User[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {[user, ...suggestions].slice(0, 5).map((person, index) => (
        <div
          className="relative h-40 overflow-hidden rounded-2xl border border-[#ded7c9] bg-[#17211f] p-3 text-white shadow-sm"
          key={`${person.id}-${index}`}
        >
          <Avatar name={person.name} src={person.avatar} size="sm" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />
          <p className="absolute bottom-3 left-3 right-3 text-sm font-semibold">
            {index === 0 ? "Crear historia" : person.name}
          </p>
        </div>
      ))}
    </div>
  );
}

function Composer({
  loading,
  user,
  onSubmit,
}: {
  loading: boolean;
  user: User;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="rounded-2xl border border-[#ded7c9] bg-white p-4 shadow-sm" onSubmit={onSubmit}>
      <div className="flex gap-3">
        <Avatar name={user.name} src={user.avatar} size="md" />
        <textarea
          className="min-h-24 flex-1 resize-none rounded-xl border border-[#ded7c9] bg-[#fffdf8] px-4 py-3 text-sm outline-none focus:border-[#49625b] focus:ring-2 focus:ring-[#49625b]/10"
          name="content"
          placeholder={`Que estas pensando, ${user.name}?`}
        />
      </div>
      <div className="mt-3 flex justify-end border-t border-[#eee8dc] pt-3">
        <button className={primaryButtonClass} disabled={loading} type="submit">
          {loading ? "Publicando..." : "Publicar"}
        </button>
      </div>
    </form>
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

function OnchainIdentity({ wallet }: { wallet: WalletAccount }) {
  const { address } = useAccount();
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
    if (!CONTRACTS.idRegistry) {
      return;
    }

    await writeContractAsync({
      abi: idRegistryAbi,
      address: CONTRACTS.idRegistry,
      functionName: "register",
      args: [zeroAddress],
    });
  }

  async function addAppSigner() {
    const id = socialId;
    if (!CONTRACTS.keyRegistry || !id || id <= ZERO_BIGINT || !signerKey) {
      return;
    }

    await writeContractAsync({
      abi: keyRegistryAbi,
      address: CONTRACTS.keyRegistry,
      functionName: "addKey",
      args: [id, signerKey],
    });
  }

  async function rentStorage() {
    const id = socialId;
    if (!CONTRACTS.storageRegistry || !id || id <= ZERO_BIGINT) {
      return;
    }

    await writeContractAsync({
      abi: storageRegistryAbi,
      address: CONTRACTS.storageRegistry,
      functionName: "rent",
      args: [id],
      value: unitPrice ?? ZERO_BIGINT,
    });
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

function ProfileModal({
  error,
  loading,
  session,
  onClose,
  onSubmit,
}: {
  error: string;
  loading: boolean;
  session: Session;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-[#17211f]/50 px-4 backdrop-blur-sm">
      <form
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onSubmit={onSubmit}
      >
        <div className="h-36 bg-[#17211f]" />
        <div className="-mt-10 px-5 pb-5">
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <Avatar name={session.user.name} src={session.user.avatar} size="lg" />
              <div className="pb-2">
                <h2 className="text-2xl font-bold">{session.user.name}</h2>
                <p className="text-sm text-[#6d746f]">{session.user.email}</p>
              </div>
            </div>
            <button className={secondaryButtonClass} type="button" onClick={onClose}>
              Cerrar
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            <label className="text-sm font-semibold">
              Nombre
              <input
                className={inputClass}
                defaultValue={session.user.name}
                name="name"
                required
              />
            </label>
            <label className="text-sm font-semibold">
              Avatar URL
              <input
                className={inputClass}
                defaultValue={session.user.avatar ?? ""}
                name="avatar"
                type="url"
              />
            </label>
            <label className="text-sm font-semibold">
              Bio
              <textarea
                className={`${inputClass} min-h-24 resize-none`}
                defaultValue={session.user.bio ?? ""}
                name="bio"
              />
            </label>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <button className={`${primaryButtonClass} mt-5 w-full`} disabled={loading}>
            {loading ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
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
