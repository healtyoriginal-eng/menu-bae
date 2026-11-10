"use client";

import { useSyncExternalStore } from "react";

let currentTimestamp = 0;
const listeners = new Set<() => void>();
let timerId: ReturnType<typeof setInterval> | null = null;

function subscribeTime(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  listeners.add(callback);

  if (currentTimestamp === 0) {
    currentTimestamp = Date.now();
  }

  if (timerId === null) {
    timerId = setInterval(() => {
      currentTimestamp = Date.now();
      listeners.forEach((listener) => listener());
    }, 1000);
  }

  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  };
}

function getTimeSnapshot(): number {
  if (currentTimestamp === 0 && typeof window !== "undefined") {
    currentTimestamp = Date.now();
  }
  return currentTimestamp;
}

function getServerTimeSnapshot(): number {
  return 0;
}

export function useOnlineDateTime() {
  const nowMs = useSyncExternalStore(
    subscribeTime,
    getTimeSnapshot,
    getServerTimeSnapshot
  );

  if (!nowMs) {
    return {
      dayDateString: "",
      timeString: "",
      date: null,
    };
  }

  const date = new Date(nowMs);

  const dayDateString = date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const timeString =
    date
      .toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
      .replace(/\./g, ":") + " WIB";

  return {
    dayDateString,
    timeString,
    date,
  };
}
