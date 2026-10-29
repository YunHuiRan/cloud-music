package com.shiyin.player;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "ShiyinLibrary")
public class ShiyinLibraryPlugin extends Plugin {

    private static final Set<String> AUDIO_EXTENSIONS = new HashSet<>(Arrays.asList(
            "mp3", "flac", "m4a", "aac", "ogg", "oga", "opus", "wav", "wave",
            "webm", "aiff", "aif", "wma", "mka", "m4b"
    ));
    private static final Set<String> SKIP_DIRS = new HashSet<>(Arrays.asList(
            "Android", "node_modules", "$RECYCLE.BIN", "System Volume Information"
    ));
    private static final int MAX_TRACKS = 20000;
    private static final int MAX_DEPTH = 24;
    private static final String[] DOCUMENT_PROJECTION = new String[] {
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_SIZE
    };

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "pickFolderResult");
    }

    @ActivityCallback
    private void pickFolderResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.resolve();
            return;
        }

        Intent data = result.getData();
        Uri uri = data.getData();
        if (uri == null) {
            call.reject("没有选择文件夹");
            return;
        }

        int flags = data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, flags & Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (SecurityException ignored) {
            // Some providers grant access for the current process only.
        }
        JSObject payload = new JSObject();
        payload.put("folder", uri.toString());
        call.resolve(payload);
    }

    @PluginMethod
    public void scanFolder(PluginCall call) {
        String folder = call.getString("folder");
        if (folder == null || folder.isEmpty()) {
            call.reject("文件夹地址为空");
            return;
        }

        Uri treeUri = Uri.parse(folder);
        executor.execute(() -> {
            try {
                DocumentFile root = DocumentFile.fromTreeUri(getContext(), treeUri);
                if (root == null || !root.isDirectory()) {
                    call.reject("无法读取这个文件夹");
                    return;
                }

                List<JSObject> tracks = new ArrayList<>();
                walkTree(treeUri, root, tracks);
                tracks.sort((a, b) -> {
                    String left = a.getString("relativePath", "");
                    String right = b.getString("relativePath", "");
                    return left.compareToIgnoreCase(right);
                });

                JSArray array = new JSArray();
                for (JSObject track : tracks) {
                    array.put(track);
                }
                JSObject result = new JSObject();
                result.put("tracks", array);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("读取文件夹失败：" + error.getMessage(), error);
            }
        });
    }

    @PluginMethod
    public void refreshLibrary(PluginCall call) {
        JSArray entries = call.getArray("entries");
        if (entries == null) {
            call.reject("缺少歌曲列表");
            return;
        }

        executor.execute(() -> {
            JSArray valid = new JSArray();
            JSArray missing = new JSArray();
            try {
                for (int index = 0; index < entries.length(); index++) {
                    org.json.JSONObject entry = entries.getJSONObject(index);
                    String id = entry.getString("id");
                    String path = entry.getString("path");
                    if (pathExists(path)) {
                        valid.put(id);
                    } else {
                        missing.put(id);
                    }
                }
                JSObject result = new JSObject();
                result.put("valid", valid);
                result.put("missing", missing);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("刷新歌曲失败：" + error.getMessage(), error);
            }
        });
    }

    /**
     * A single ContentResolver query per directory returns all child metadata.
     * DocumentFile.listFiles() costs one provider round-trip per child, which
     * becomes noticeably slow for libraries with hundreds of files.
     */
    private void walkTree(Uri treeUri, DocumentFile fallbackRoot, List<JSObject> tracks) {
        try {
            String rootId = DocumentsContract.getTreeDocumentId(treeUri);
            walkDocuments(treeUri, rootId, "", tracks, 0);
        } catch (Exception ignored) {
            tracks.clear();
            walk(fallbackRoot, "", tracks, 0);
        }
    }

    private void walkDocuments(
            Uri treeUri,
            String documentId,
            String relativeDir,
            List<JSObject> tracks,
            int depth
    ) {
        if (depth > MAX_DEPTH || tracks.size() >= MAX_TRACKS) {
            return;
        }

        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, documentId);
        try (Cursor cursor = getContext().getContentResolver().query(
                childrenUri, DOCUMENT_PROJECTION, null, null, null)) {
            if (cursor == null) {
                throw new IllegalStateException("Folder provider returned no cursor");
            }
            int idColumn = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID);
            int nameColumn = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME);
            int mimeColumn = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_MIME_TYPE);
            int sizeColumn = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_SIZE);

            while (cursor.moveToNext() && tracks.size() < MAX_TRACKS) {
                String childId = cursor.getString(idColumn);
                String name = cursor.getString(nameColumn);
                String mime = cursor.getString(mimeColumn);
                if (childId == null || name == null || name.isEmpty() || name.startsWith(".")) {
                    continue;
                }

                boolean isDirectory = DocumentsContract.Document.MIME_TYPE_DIR.equals(mime);
                String nextRelative = relativeDir.isEmpty() ? name : relativeDir + "/" + name;
                if (isDirectory) {
                    if (SKIP_DIRS.contains(name)) {
                        continue;
                    }
                    walkDocuments(treeUri, childId, nextRelative, tracks, depth + 1);
                    continue;
                }

                if (!isAudioFile(name)) {
                    continue;
                }

                long size = cursor.isNull(sizeColumn) ? 0 : cursor.getLong(sizeColumn);
                Uri path = DocumentsContract.buildDocumentUriUsingTree(treeUri, childId);
                JSObject track = new JSObject();
                track.put("id", "android:" + nextRelative + ":" + size + ":" + path);
                track.put("path", path.toString());
                track.put("fileName", name);
                track.put("relativePath", nextRelative);
                track.put("size", size);
                tracks.add(track);
            }
        }
    }

    private void walk(DocumentFile directory, String relativeDir, List<JSObject> tracks, int depth) {
        if (depth > MAX_DEPTH || tracks.size() >= MAX_TRACKS) {
            return;
        }

        DocumentFile[] children = directory.listFiles();
        for (DocumentFile child : children) {
            if (tracks.size() >= MAX_TRACKS) {
                return;
            }
            String name = child.getName();
            if (name == null || name.startsWith(".")) {
                continue;
            }

            if (child.isDirectory()) {
                if (SKIP_DIRS.contains(name)) {
                    continue;
                }
                String nextRelative = relativeDir.isEmpty() ? name : relativeDir + "/" + name;
                walk(child, nextRelative, tracks, depth + 1);
                continue;
            }

            if (!child.isFile() || !isAudioFile(name)) {
                continue;
            }

            String relativePath = relativeDir.isEmpty() ? name : relativeDir + "/" + name;
            long size = child.length();
            String path = child.getUri().toString();
            JSObject track = new JSObject();
            track.put("id", "android:" + relativePath + ":" + size + ":" + path);
            track.put("path", path);
            track.put("fileName", name);
            track.put("relativePath", relativePath);
            track.put("size", size);
            tracks.add(track);
        }
    }

    private boolean pathExists(String path) {
        if (path == null || path.isEmpty()) {
            return false;
        }
        try {
            Uri uri = Uri.parse(path);
            String scheme = uri.getScheme();
            if (ContentResolver.SCHEME_FILE.equals(scheme)) {
                return new File(uri.getPath()).isFile();
            }
            if (ContentResolver.SCHEME_CONTENT.equals(scheme)) {
                try (Cursor cursor = getContext().getContentResolver().query(
                        uri,
                        new String[] { DocumentsContract.Document.COLUMN_DOCUMENT_ID },
                        null,
                        null,
                        null
                )) {
                    return cursor != null && cursor.moveToFirst();
                }
            }
            return false;
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean isAudioFile(String name) {
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) {
            return false;
        }
        return AUDIO_EXTENSIONS.contains(name.substring(dot + 1).toLowerCase(Locale.ROOT));
    }
}
