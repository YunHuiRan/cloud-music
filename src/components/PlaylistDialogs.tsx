import { useState, type FormEvent } from "react";
import { Check, Plus } from "lucide-react";
import type { Track } from "../types";
import { useLibrary } from "../lib/store";
import { formatCount } from "../lib/format";
import { toast } from "../lib/toast";
import { Artwork } from "./Artwork";
import { Dialog } from "./Dialog";

interface AddToPlaylistDialogProps {
  track: Track;
  onClose: () => void;
}

export function AddToPlaylistDialog({ track, onClose }: AddToPlaylistDialogProps) {
  const playlists = useLibrary((state) => state.playlists);
  const createPlaylist = useLibrary((state) => state.createPlaylist);
  const togglePlaylistTrack = useLibrary((state) => state.togglePlaylistTrack);
  const [creating, setCreating] = useState(playlists.length === 0);
  const [name, setName] = useState("");
  const contains = new Set(
    playlists.filter((playlist) => playlist.trackIds.includes(track.id)).map((playlist) => playlist.id),
  );

  const create = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    createPlaylist(name, [track.id]);
    toast(`已添加到「${name.trim()}」`);
    onClose();
  };

  return (
    <Dialog
      title="添加到歌单"
      description={track.title}
      onClose={onClose}
      footer={
        creating ? undefined : (
          <button
            type="button"
            className="button button-quiet"
            onClick={() => setCreating(true)}
          >
            <Plus size={15} />
            新建歌单
          </button>
        )
      }
    >
      {creating ? (
        <form className="inline-create" onSubmit={create}>
          <input
            className="text-input"
            placeholder="歌单名称"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            autoFocus
          />
          <div className="inline-create-actions">
            {playlists.length > 0 && (
              <button
                type="button"
                className="button"
                onClick={() => setCreating(false)}
              >
                返回
              </button>
            )}
            <button type="submit" className="button button-primary" disabled={!name.trim()}>
              创建
            </button>
          </div>
        </form>
      ) : (
        <div className="playlist-picker">
          {playlists.map((playlist) => (
            <button
              type="button"
              key={playlist.id}
              className="playlist-picker-row"
              onClick={() => {
                const added = togglePlaylistTrack(playlist.id, track.id);
                toast(
                  added
                    ? `已添加到「${playlist.name}」`
                    : `已从「${playlist.name}」移除`,
                );
              }}
            >
              <Artwork seed={playlist.name} size={36} kind="playlist" />
              <span className="playlist-picker-text">
                <strong>{playlist.name}</strong>
                <small>{formatCount(playlist.trackIds.length)}</small>
              </span>
              <span className={`picker-check ${contains.has(playlist.id) ? "is-on" : ""}`}>
                {contains.has(playlist.id) && <Check size={15} />}
              </span>
            </button>
          ))}
        </div>
      )}
    </Dialog>
  );
}

interface NewPlaylistDialogProps {
  onClose: () => void;
  onCreated: (id: string) => void;
  trackIds?: string[];
}

export function NewPlaylistDialog({
  onClose,
  onCreated,
  trackIds = [],
}: NewPlaylistDialogProps) {
  const createPlaylist = useLibrary((state) => state.createPlaylist);
  const [name, setName] = useState("");

  const create = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const id = createPlaylist(name, trackIds);
    toast(`已创建「${name.trim()}」`);
    onCreated(id);
  };

  return (
    <Dialog
      title="新建歌单"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={!name.trim()}
            onClick={() => {
              if (!name.trim()) return;
              const id = createPlaylist(name, trackIds);
              toast(`已创建「${name.trim()}」`);
              onCreated(id);
            }}
          >
            创建
          </button>
        </>
      }
    >
      <form onSubmit={create}>
        <input
          className="text-input"
          placeholder="例如：深夜循环"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          autoFocus
        />
        <p className="field-hint">
          {trackIds.length > 0
            ? `将把选中的 ${trackIds.length} 首歌放进这个新歌单。`
            : "歌单只保存在本机，随时可以改名或删除。"}
        </p>
      </form>
    </Dialog>
  );
}
