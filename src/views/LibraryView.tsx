import { useMemo, useState } from "react";
import { ArrowUpDown, ListChecks, Plus, Trash2 } from "lucide-react";
import type { SortMode, Track } from "../types";
import { useLibrary } from "../lib/store";
import { usePlayer } from "../lib/player";
import { useVisibleTrackIds } from "../lib/visible";
import { collectArtists } from "../lib/artists";
import { normalizeQuery } from "../lib/format";
import { compareArtists } from "../lib/parser";
import { toast } from "../lib/toast";
import { ArtistChips } from "../components/ArtistChips";
import { TrackList } from "../components/TrackList";
import { ConfirmDialog } from "../components/Dialog";
import { EmptyFilter, EmptyLibrary } from "../components/EmptyState";

interface LibraryViewProps {
  query: string;
  selectedArtists: string[];
  isNative: boolean;
  importing: boolean;
  onToggleArtist: (artist: string) => void;
  onClearArtists: () => void;
  onOpenArtists: () => void;
  onArtistClick: (artist: string) => void;
  onAdd: (track: Track) => void;
  onCreatePlaylist: (trackIds: string[]) => void;
  onImport: () => void;
  onClearFilters: () => void;
}

const SORT_LABEL: Record<SortMode, string> = {
  title: "标题",
  artist: "歌手",
  added: "最近添加",
};

const SORT_ORDER: SortMode[] = ["title", "artist", "added"];

export function LibraryView({
  query,
  selectedArtists,
  isNative,
  importing,
  onToggleArtist,
  onClearArtists,
  onOpenArtists,
  onArtistClick,
  onAdd,
  onCreatePlaylist,
  onImport,
  onClearFilters,
}: LibraryViewProps) {
  const tracks = useLibrary((state) => state.tracks);
  const sort = useLibrary((state) => state.sort);
  const setSort = useLibrary((state) => state.setSort);
  const removeTracks = useLibrary((state) => state.removeTracks);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ ids: string[]; label: string } | null>(
    null,
  );

  const artists = useMemo(() => collectArtists(tracks), [tracks]);

  const filtered = useMemo(() => {
    const tokens = normalizeQuery(query).split(/\s+/).filter(Boolean);
    const matches = tracks.filter((track) => {
      if (
        selectedArtists.length > 0 &&
        !selectedArtists.some((artist) => track.artists.includes(artist))
      ) {
        return false;
      }
      if (tokens.length === 0) return true;
      const haystack = normalizeQuery(`${track.title} ${track.artists.join(" ")}`);
      return tokens.every((token) => haystack.includes(token));
    });

    return matches.sort((a, b) => {
      if (sort === "title") {
        return (
          compareArtists(a.title, b.title) ||
          compareArtists(a.artists[0] ?? "", b.artists[0] ?? "")
        );
      }
      if (sort === "artist") {
        return (
          compareArtists(a.artists[0] ?? "", b.artists[0] ?? "") ||
          compareArtists(a.title, b.title)
        );
      }
      return b.addedAt - a.addedAt;
    });
  }, [tracks, query, selectedArtists, sort]);

  useVisibleTrackIds(filtered);

  const cycleSort = () => {
    const index = SORT_ORDER.indexOf(sort);
    setSort(SORT_ORDER[(index + 1) % SORT_ORDER.length]);
  };

  const toggleSelected = (track: Track) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(track.id)) next.delete(track.id);
      else next.add(track.id);
      return next;
    });
  };

  const allSelected =
    filtered.length > 0 && filtered.every((track) => selected.has(track.id));

  const toggleAll = () => {
    setSelected((current) => {
      if (filtered.every((track) => current.has(track.id))) {
        const next = new Set(current);
        filtered.forEach((track) => next.delete(track.id));
        return next;
      }
      const next = new Set(current);
      filtered.forEach((track) => next.add(track.id));
      return next;
    });
  };

  const finishSelection = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const remove = (ids: string[], label: string) => {
    if (ids.length === 0) return;
    setConfirm({ ids, label });
  };

  const doRemove = () => {
    if (!confirm) return;
    removeTracks(confirm.ids);
    usePlayer.getState().pruneQueue(confirm.ids);
    toast(
      confirm.ids.length > 1
        ? `已移除 ${confirm.ids.length} 首歌`
        : `已移除「${confirm.label}」`,
    );
    setConfirm(null);
    setSelected(new Set());
    if (tracks.length === confirm.ids.length) setSelecting(false);
  };

  if (tracks.length === 0) {
    return (
      <div className="view">
        <EmptyLibrary
          isNative={isNative}
          importing={importing}
          onImport={onImport}
        />
      </div>
    );
  }

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <h1>全部歌曲</h1>
          <p className="view-sub">
            {filtered.length === tracks.length
              ? `${tracks.length} 首歌`
              : `${filtered.length} / ${tracks.length} 首`}
            {selectedArtists.length > 0 && ` · 涉及 ${selectedArtists.join(" & ")}`}
          </p>
        </div>
        <div className="view-tools">
          <button
            type="button"
            className={`text-button ${selecting ? "is-active" : ""}`}
            onClick={() => (selecting ? finishSelection() : setSelecting(true))}
          >
            <ListChecks size={15} />
            {selecting ? "完成" : "选择"}
          </button>
          <button
            type="button"
            className="sort-button"
            onClick={cycleSort}
            title="切换排序方式"
          >
            <ArrowUpDown size={15} />
            {SORT_LABEL[sort]}
          </button>
        </div>
      </header>

      <ArtistChips
        artists={artists}
        selected={selectedArtists}
        onToggle={onToggleArtist}
        onClear={onClearArtists}
        onOpenArtists={onOpenArtists}
      />

      {selecting && (
        <div className="selection-bar">
          <strong>已选 {selected.size} 首</strong>
          <button type="button" className="text-button" onClick={toggleAll}>
            {allSelected ? "取消全选" : "全选当前"}
          </button>
          <span className="selection-spacer" />
          <button
            type="button"
            className="text-button"
            disabled={selected.size === 0}
            onClick={() => {
              onCreatePlaylist(Array.from(selected));
              finishSelection();
            }}
          >
            <Plus size={15} />
            新建歌单
          </button>
          <button
            type="button"
            className="text-button is-danger"
            disabled={selected.size === 0}
            onClick={() => remove(Array.from(selected), "选中的歌曲")}
          >
            <Trash2 size={15} />
            移除
          </button>
          <button
            type="button"
            className="text-button is-danger"
            onClick={() =>
              remove(
                tracks.map((track) => track.id),
                "全部歌曲",
              )
            }
          >
            移除全部
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyFilter onClear={onClearFilters} />
      ) : (
        <TrackList
          tracks={filtered}
          onArtistClick={onArtistClick}
          onAdd={onAdd}
          onRemove={(track) => remove([track.id], track.title)}
          selectable={selecting}
          selectedIds={selected}
          onSelect={toggleSelected}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title="从曲库移除"
          description={`将从曲库移除 ${
            confirm.ids.length > 1 ? `${confirm.ids.length} 首歌` : "这首歌"
          }，本地文件不会被删除。`}
          confirmLabel="移除"
          danger
          onConfirm={doRemove}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
