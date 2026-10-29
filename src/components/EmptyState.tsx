import type { ReactNode } from "react";
import {
  FolderPlus,
  Heart,
  ListMusic,
  Loader2,
  Music2,
  SearchX,
} from "lucide-react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  actions?: ReactNode;
  hint?: ReactNode;
  compact?: boolean;
}

function EmptyState({
  icon,
  title,
  description,
  actions,
  hint,
  compact = false,
}: EmptyStateProps) {
  return (
    <div className={`empty-state ${compact ? "is-compact" : ""}`}>
      <div className="empty-icon" aria-hidden="true">
        {icon}
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {actions && <div className="empty-actions">{actions}</div>}
      {hint && <div className="empty-hint">{hint}</div>}
    </div>
  );
}

interface EmptyLibraryProps {
  isNative: boolean;
  importing: boolean;
  onImport: () => void;
}

export function EmptyLibrary({
  isNative,
  importing,
  onImport,
}: EmptyLibraryProps) {
  return (
    <div className="empty-library">
      <div className="empty-orbit" aria-hidden="true">
        <span className="orbit-disc orbit-one" />
        <span className="orbit-disc orbit-two" />
        <span className="orbit-disc orbit-three">
          <Music2 size={26} strokeWidth={1.4} />
        </span>
      </div>
      <EmptyState
        icon={<Music2 size={22} strokeWidth={1.6} />}
        title="把音乐放进来"
        description={
          isNative
            ? "选择一个文件夹，Cloud Music 会递归读取其中的音频文件。"
            : "在浏览器里选择本地音频文件，立即开始播放。"
        }
        actions={
          <>
            <button
              type="button"
              className="button button-primary"
              onClick={onImport}
              disabled={importing}
            >
              {importing ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <FolderPlus size={16} />
              )}
              {isNative ? "导入文件夹" : "选择文件"}
            </button>
          </>
        }
        hint={
          <>
            <span className="hint-label">命名方式</span>
            <code>歌曲名—歌手1&amp;歌手2&amp;歌手3.mp3</code>
            <span className="hint-note">
              用长破折号“—”分隔歌曲名与歌手，歌手之间用 &amp; 连接。
            </span>
          </>
        }
      />
    </div>
  );
}

export function EmptyFilter({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState
      compact
      icon={<SearchX size={21} />}
      title="没有找到相符的歌曲"
      description="换个关键词，或清除当前的歌手筛选。"
      actions={
        <button type="button" className="button" onClick={onClear}>
          清除筛选
        </button>
      }
    />
  );
}

export function EmptyPlaylist({ onBrowse }: { onBrowse: () => void }) {
  return (
    <EmptyState
      compact
      icon={<ListMusic size={22} />}
      title="这个歌单还是空的"
      description="在歌曲右侧点「+」，就可以把它收进这里。"
      actions={
        <button type="button" className="button" onClick={onBrowse}>
          去资料库看看
        </button>
      }
    />
  );
}

export function EmptyLiked({ onBrowse }: { onBrowse: () => void }) {
  return (
    <EmptyState
      compact
      icon={<Heart size={22} />}
      title="还没有喜欢的歌"
      description="点一下歌曲右侧的心形，它会留在这里。"
      actions={
        <button type="button" className="button" onClick={onBrowse}>
          去资料库看看
        </button>
      }
    />
  );
}

export function EmptyArtists({ onBrowse }: { onBrowse: () => void }) {
  return (
    <EmptyState
      compact
      icon={<Music2 size={22} />}
      title="还没有可分类的歌手"
      description="导入音乐后，文件名里的歌手会自动汇总到这里。"
      actions={
        <button type="button" className="button" onClick={onBrowse}>
          去资料库
        </button>
      }
    />
  );
}
