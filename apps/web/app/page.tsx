"use client";

import { useLogin, usePrivy, useWallets } from "@privy-io/react-auth";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

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
  const [privyLoading, setPrivyLoading] = useState(false);
  const privySyncStarted = useRef(false);
  const {
    ready: privyReady,
    authenticated: privyAuthenticated,
    user: privyUser,
    getAccessToken,
  } = usePrivy();
  const { login: loginWithPrivy } = useLogin();
  const { wallets: privyWallets } = useWallets();

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
    if (!privyReady || !privyAuthenticated || session || privySyncStarted.current) {
      return;
    }

    privySyncStarted.current = true;
    async function syncPrivySession() {
      setPrivyLoading(true);
      setError("");

      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error("Privy token missing");
        }

        const linkedUser = privyUser as {
          email?: { address?: string };
          google?: { email?: string; name?: string };
          wallet?: { address?: string };
        } | null;
        const email = linkedUser?.email?.address ?? linkedUser?.google?.email;
        const name =
          linkedUser?.google?.name ??
          email?.split("@")[0] ??
          (privyWallets[0]?.address
            ? `${privyWallets[0].address.slice(0, 6)}...${privyWallets[0].address.slice(-4)}`
            : undefined);
        const walletAddress =
          privyWallets[0]?.address ?? linkedUser?.wallet?.address;

        const nextSession = await request<Session>("/auth/privy", {
          method: "POST",
          body: JSON.stringify({ accessToken, email, name, walletAddress }),
        });

        saveStoredSession(nextSession);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Privy login failed");
      } finally {
        setPrivyLoading(false);
        privySyncStarted.current = false;
      }
    }

    void syncPrivySession();
  }, [
    getAccessToken,
    privyAuthenticated,
    privyReady,
    privyUser,
    privyWallets,
    session,
  ]);

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
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#f0f2f5] text-[#1c1e21]">
        <div className="mx-auto grid min-h-screen w-full max-w-5xl gap-8 px-5 py-8 md:grid-cols-[1fr_396px] md:items-center">
          <section>
            <h1 className="text-6xl font-bold tracking-tight text-[#1877f2]">
              facebook
            </h1>
            <p className="mt-4 max-w-xl text-2xl leading-9">
              Conecta con amigos y el mundo que te rodea en Social Network.
            </p>
          </section>

          <section className="rounded-lg bg-white p-4 shadow-xl">
            <AuthForm
              error={error}
              loading={loading}
              mode={mode}
              onModeChange={setMode}
              onPrivyLogin={loginWithPrivy}
              onSubmit={authenticate}
              privyLoading={privyLoading}
              privyReady={privyReady}
            />
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f0f2f5] text-[#050505]">
      <TopBar
        user={session.user}
        onLogout={logout}
        onProfile={() => setProfileOpen(true)}
      />

      <div className="mx-auto grid w-full max-w-[1464px] gap-4 px-4 py-4 lg:grid-cols-[280px_minmax(0,680px)_320px]">
        <LeftRail user={session.user} onProfile={() => setProfileOpen(true)} />

        <section className="space-y-4">
          <Stories user={session.user} suggestions={suggestions.slice(0, 4)} />
          <Composer loading={loading} user={session.user} onSubmit={createPost} />
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {posts.length === 0 ? (
            <p className="rounded-lg bg-white p-8 text-center text-sm text-[#65676b] shadow-sm">
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
    <header className="sticky top-0 z-20 h-14 border-b border-[#dddfe2] bg-white shadow-sm">
      <div className="flex h-full items-center gap-3 px-4">
        <div className="grid size-10 place-items-center rounded-full bg-[#1877f2] text-2xl font-bold text-white">
          f
        </div>
        <input
          className="hidden h-10 w-64 rounded-full bg-[#f0f2f5] px-4 text-sm outline-none md:block"
          placeholder="Buscar en Facebook"
        />
        <nav className="mx-auto hidden h-full items-center gap-2 md:flex">
          {["Inicio", "Video", "Grupos", "Juegos"].map((item) => (
            <button
              className="h-12 rounded-lg px-8 text-sm font-semibold text-[#65676b] hover:bg-[#f0f2f5]"
              key={item}
            >
              {item}
            </button>
          ))}
        </nav>
        <button
          className="ml-auto flex items-center gap-2 rounded-full px-2 py-1 hover:bg-[#f0f2f5]"
          onClick={onProfile}
        >
          <Avatar name={user.name} src={user.avatar} size="sm" />
          <span className="hidden text-sm font-semibold sm:block">{user.name}</span>
        </button>
        <button
          className="rounded-full bg-[#e4e6eb] px-4 py-2 text-sm font-semibold hover:bg-[#d8dadf]"
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
    <aside className="sticky top-18 hidden h-[calc(100vh-72px)] space-y-1 overflow-y-auto lg:block">
      <button
        className="flex w-full items-center gap-3 rounded-lg p-2 text-left font-semibold hover:bg-[#e4e6eb]"
        onClick={onProfile}
      >
        <Avatar name={user.name} src={user.avatar} size="sm" />
        {user.name}
      </button>
      {items.map((item) => (
        <button
          className="block w-full rounded-lg px-3 py-3 text-left text-sm font-semibold hover:bg-[#e4e6eb]"
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
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {[user, ...suggestions].slice(0, 5).map((person, index) => (
        <div
          className="relative h-44 overflow-hidden rounded-xl bg-gradient-to-br from-[#1877f2] to-[#42b72a] p-3 text-white shadow-sm"
          key={`${person.id}-${index}`}
        >
          <Avatar name={person.name} src={person.avatar} size="sm" />
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
    <form className="rounded-lg bg-white p-4 shadow-sm" onSubmit={onSubmit}>
      <div className="flex gap-3">
        <Avatar name={user.name} src={user.avatar} size="md" />
        <textarea
          className="min-h-20 flex-1 resize-none rounded-3xl bg-[#f0f2f5] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#1877f2]/20"
          name="content"
          placeholder={`Que estas pensando, ${user.name}?`}
        />
      </div>
      <div className="mt-3 flex justify-end border-t border-[#e4e6eb] pt-3">
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
    <article className="rounded-lg bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar name={post.author.name} src={post.author.avatar} size="md" />
        <div>
          <h2 className="text-sm font-semibold">{post.author.name}</h2>
          <p className="text-xs text-[#65676b]">
            {new Date(post.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-[15px] leading-6">{post.content}</p>
      {post.signature && (
        <p className="mt-3 rounded-md bg-[#f0f2f5] px-3 py-2 text-xs text-[#65676b]">
          Firmado por app signer {post.signerAddress?.slice(0, 6)}...
          {post.signerAddress?.slice(-4)}
        </p>
      )}
      <div className="mt-3 flex justify-between border-t border-[#e4e6eb] pt-3 text-xs text-[#65676b]">
        <span>{post.reactionCount} Me gusta</span>
        <span>{post.commentCount} comentarios</span>
      </div>
      <div className="mt-4 flex border-t border-[#e4e6eb] pt-2 text-sm text-[#65676b]">
        <button
          className={`flex-1 rounded-lg py-2 font-semibold hover:bg-[#f0f2f5] ${
            post.reactedByMe ? "text-[#1877f2]" : ""
          }`}
          onClick={() => onReact(post.id)}
        >
          Me gusta
        </button>
        <button className="flex-1 rounded-lg py-2 font-semibold hover:bg-[#f0f2f5]">
          Comentar
        </button>
        <button className="flex-1 rounded-lg py-2 font-semibold hover:bg-[#f0f2f5]">
          Compartir
        </button>
      </div>
      <div className="mt-3 space-y-3">
        {post.comments.map((comment) => (
          <div className="flex gap-2" key={comment.id}>
            <Avatar name={comment.author.name} src={comment.author.avatar} size="sm" />
            <div className="rounded-2xl bg-[#f0f2f5] px-3 py-2">
              <p className="text-xs font-semibold">{comment.author.name}</p>
              <p className="text-sm">{comment.content}</p>
              <p className="mt-1 text-[11px] text-[#65676b]">
                firmado {comment.signerAddress.slice(0, 6)}...
                {comment.signerAddress.slice(-4)}
              </p>
            </div>
          </div>
        ))}
        <form className="flex gap-2" onSubmit={(event) => onComment(event, post.id)}>
          <input
            className="min-w-0 flex-1 rounded-full bg-[#f0f2f5] px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1877f2]/20"
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
          <div className="space-y-2 rounded-lg bg-white p-3 shadow-sm">
            <p className="text-xs font-semibold text-[#65676b]">Wallet</p>
            <p className="break-all text-xs font-semibold">{wallet.address}</p>
            <p className="pt-2 text-xs font-semibold text-[#65676b]">App signer</p>
            <p className="break-all text-xs">
              {wallet.appSigners.find((signer) => signer.active)?.address ?? "Sin signer"}
            </p>
          </div>
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
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/40 px-4">
      <form
        className="w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-2xl"
        onSubmit={onSubmit}
      >
        <div className="h-36 bg-gradient-to-r from-[#1877f2] to-[#42b72a]" />
        <div className="-mt-10 px-5 pb-5">
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <Avatar name={session.user.name} src={session.user.avatar} size="lg" />
              <div className="pb-2">
                <h2 className="text-2xl font-bold">{session.user.name}</h2>
                <p className="text-sm text-[#65676b]">{session.user.email}</p>
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
  onPrivyLogin,
  onSubmit,
  privyLoading,
  privyReady,
}: {
  error: string;
  loading: boolean;
  mode: "login" | "register";
  onModeChange: (mode: "login" | "register") => void;
  onPrivyLogin: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  privyLoading: boolean;
  privyReady: boolean;
}) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <button
        className={`${primaryButtonClass} w-full bg-[#1877f2]`}
        disabled={!privyReady || privyLoading}
        onClick={onPrivyLogin}
        type="button"
      >
        {privyLoading ? "Conectando..." : "Continuar con Privy"}
      </button>
      <div className="flex items-center gap-3 text-xs font-semibold uppercase text-[#65676b]">
        <span className="h-px flex-1 bg-[#dadde1]" />
        o
        <span className="h-px flex-1 bg-[#dadde1]" />
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
      <div className="border-t border-[#dadde1] pt-4 text-center">
        <button
          className="rounded-md bg-[#42b72a] px-4 py-3 text-sm font-bold text-white hover:bg-[#36a420]"
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
      <h2 className="px-2 text-base font-semibold text-[#65676b]">{title}</h2>
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
  return <p className="px-2 text-sm text-[#65676b]">{children}</p>;
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
        className={`${sizeClass} shrink-0 rounded-full bg-[#e4e6eb] object-cover`}
        src={src}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} grid shrink-0 place-items-center rounded-full bg-[#1877f2] font-bold text-white`}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

const inputClass =
  "mt-1 w-full rounded-md border border-[#dddfe2] bg-white px-3 py-3 text-sm outline-none focus:border-[#1877f2] focus:ring-2 focus:ring-[#1877f2]/10";

const primaryButtonClass =
  "rounded-md bg-[#1877f2] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#166fe5] disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClass =
  "rounded-md bg-[#e4e6eb] px-3 py-2 text-sm font-bold text-[#050505] hover:bg-[#d8dadf]";
