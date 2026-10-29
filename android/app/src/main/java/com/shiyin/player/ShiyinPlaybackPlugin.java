package com.shiyin.player;

import android.os.Handler;
import android.os.Looper;
import androidx.annotation.Nullable;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ShiyinPlayback")
public class ShiyinPlaybackPlugin extends Plugin {

    private static ShiyinPlaybackPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    @PluginMethod
    public void update(PluginCall call) {
        String title = call.getString("title", "");
        String artist = call.getString("artist", "");
        boolean playing = Boolean.TRUE.equals(call.getBoolean("isPlaying", false));
        long positionMs = Math.max(0, Math.round((call.getDouble("position", 0.0)) * 1000));
        long durationMs = Math.max(0, Math.round((call.getDouble("duration", 0.0)) * 1000));
        boolean canNext = Boolean.TRUE.equals(call.getBoolean("canNext", false));
        boolean canPrev = Boolean.TRUE.equals(call.getBoolean("canPrev", false));

        PlaybackService.push(
            getContext(),
            title,
            artist,
            playing,
            positionMs,
            durationMs,
            canNext,
            canPrev
        );
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        PlaybackService.stop(getContext());
        call.resolve();
    }

    static void dispatchAction(String action, long position) {
        final ShiyinPlaybackPlugin plugin = instance;
        if (plugin == null) return;

        new Handler(Looper.getMainLooper()).post(() -> {
            JSObject data = new JSObject();
            data.put("action", action);
            if (position >= 0) {
                data.put("position", position);
            }
            plugin.notifyListeners("mediaAction", data);
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) {
            instance = null;
        }
        super.handleOnDestroy();
    }
}
