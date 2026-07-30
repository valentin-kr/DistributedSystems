import { useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import { api } from "../api/client";
import type { Media, Message, SessionUser } from "../types";

type FormSubmitEvent = SyntheticEvent<HTMLFormElement>;

type UseRoomComposerOptions = {
  currentRoomId: number | null;
  currentUser: SessionUser | null;
  usernameFor: (userId: number) => string;
  reloadThread: () => Promise<void>;
};

export function useRoomComposer({
  currentRoomId,
  currentUser,
  usernameFor,
  reloadThread,
}: UseRoomComposerOptions) {
  const [messageText, setMessageText] = useState("");
  const [messageError, setMessageError] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [recordStatus, setRecordStatus] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  function clearMessageError() {
    setMessageError("");
  }

  async function sendMessage(event: FormSubmitEvent) {
    event.preventDefault();
    if (!currentRoomId || !currentUser || !messageText.trim()) return;
    setMessageError("");
    try {
      await api<Message>(`/chatrooms/${currentRoomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: messageText, userId: currentUser.id }),
      });
      setMessageText("");
      await reloadThread();
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : "Message failed");
    }
  }

  async function deleteMessage(messageId: number) {
    if (!currentRoomId || !currentUser) return;
    await api<void>(
      `/chatrooms/${currentRoomId}/messages/${messageId}?requesterId=${currentUser.id}`,
      {
        method: "DELETE",
      },
    );
    await reloadThread();
  }

  async function uploadMediaBlob(blob: Blob, filename: string) {
    if (!currentRoomId || !currentUser) return;
    setMediaError("");
    const formData = new FormData();
    formData.append("file", blob, filename);
    const username = encodeURIComponent(usernameFor(currentUser.id));

    try {
      await api<Media>(
        `/chatrooms/${currentRoomId}/media?userId=${currentUser.id}&username=${username}`,
        {
          method: "POST",
          body: formData,
        },
      );
      await reloadThread();
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function toggleRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        setRecordStatus("Uploading voice message...");
        const blob = new Blob(recordedChunksRef.current, {
          type: "audio/webm",
        });
        await uploadMediaBlob(blob, `voice-${Date.now()}.webm`);
        setRecordStatus("");
      };

      recorder.start();
      setIsRecording(true);
      setRecordStatus("Recording...");
    } catch (err) {
      setRecordStatus(
        `Microphone error: ${err instanceof Error ? err.message : "Unable to start recording"}`,
      );
    }
  }

  return {
    messageText,
    messageError,
    mediaError,
    recordStatus,
    isRecording,
    fileInputRef,
    sendMessage,
    deleteMessage,
    uploadMediaBlob,
    toggleRecording,
    clearMessageError,
    setMessageText,
  };
}
