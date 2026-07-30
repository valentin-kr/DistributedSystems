export type Screen =
  | "choice"
  | "auth"
  | "create-room"
  | "join-room"
  | "room-list"
  | "room";

export type FlowIntent = "create" | "join" | null;

export type SessionUser = {
  id: number;
  username: string;
  displayName: string;
  phoneNumber?: string;
  token?: string;
};

export type ApiUser = {
  id: number;
  username: string;
  display_name?: string | null;
  phone_number?: string;
  last_active?: string | null;
  zitadel_sub?: string | null;
};

export type Chatroom = {
  id: number;
  name: string;
  description?: string | null;
  creatorId: number;
  joinCode: string;
  seqId: number;
  createdAt: string;
  expiryDate: string;
  active: boolean;
  memberIds: number[];
};

export type Message = {
  id: number;
  seqId: number;
  text: string;
  authorID: number;
  timestamp: string;
};

export type Media = {
  id: number;
  filename: string;
  contentType?: string | null;
  uploaderId: number;
  uploaderName: string;
  uploadedAt: string;
};

export type ThreadItem =
  | {
      kind: "message";
      id: number;
      authorId: number;
      text: string;
      timestamp: string;
    }
  | {
      kind: "media";
      id: number;
      authorId: number;
      filename: string;
      contentType?: string | null;
      timestamp: string;
    };
