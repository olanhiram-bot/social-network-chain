export type User = {
  id: string
  name: string
  email: string
  avatar?: string
  createdAt: Date
}

export type Post = {
  id: string
  userId: string
  content: string
  createdAt: Date
}