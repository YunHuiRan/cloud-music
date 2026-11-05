import { useEffect } from "react";
import { usePlayer } from "./player";

/**
 * Registers the tracks currently rendered by a view so the transport bar can
 * start "order / shuffle" from exactly what the user is looking at.
 */
export function useVisibleTrackIds(tracks: readonly { id: string }[]): void {
  const key = tracks.map((track) => track.id).join("\u0001");

  useEffect(() => {
    usePlayer.getState().setVisibleIds(key ? key.split("\u0001") : []);
  }, [key]);
}
