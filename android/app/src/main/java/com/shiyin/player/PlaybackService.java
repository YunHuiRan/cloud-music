package com.shiyin.player;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.drawable.Icon;
import android.media.AudioAttributes;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;

/**
 * Owns the Android media session and the media-style notification.
 *
 * The WebView remains the audio engine; this service mirrors its state into
 * MediaSession so the lock screen, Bluetooth and Android's media controls can
 * see and control playback.
 */
public class PlaybackService extends Service {

    private static final String CHANNEL_ID = "cloudmusic-playback";
    private static final int NOTIFICATION_ID = 4201;

    static final String ACTION_SYNC = "com.shiyin.player.PLAYBACK_SYNC";
    static final String ACTION_STOP = "com.shiyin.player.PLAYBACK_STOP";
    static final String ACTION_PREVIOUS = "com.shiyin.player.PLAYBACK_PREVIOUS";
    static final String ACTION_TOGGLE = "com.shiyin.player.PLAYBACK_TOGGLE";
    static final String ACTION_NEXT = "com.shiyin.player.PLAYBACK_NEXT";

    private static PlaybackService instance;
    private static String title = "";
    private static String artist = "";
    private static boolean playing;
    private static long positionMs;
    private static long durationMs;
    private static boolean canNext;
    private static boolean canPrev;

    private MediaSession session;
    private NotificationManager notificationManager;

    static void push(
        Context context,
        String nextTitle,
        String nextArtist,
        boolean nextPlaying,
        long nextPositionMs,
        long nextDurationMs,
        boolean nextCanNext,
        boolean nextCanPrev
    ) {
        title = nextTitle == null ? "" : nextTitle;
        artist = nextArtist == null ? "" : nextArtist;
        playing = nextPlaying;
        positionMs = Math.max(0, nextPositionMs);
        durationMs = Math.max(0, nextDurationMs);
        canNext = nextCanNext;
        canPrev = nextCanPrev;

        if (instance != null) {
            try {
                instance.applyState();
            } catch (Exception ignored) {
                // Never let a notification/MediaSession glitch crash playback.
            }
            return;
        }

        try {
            Intent intent = new Intent(context, PlaybackService.class).setAction(ACTION_SYNC);
            ContextCompat.startForegroundService(context, intent);
        } catch (Exception ignored) {
            // A foreground service cannot always start from the background.
        }
    }

    static void stop(Context context) {
        try {
            context.stopService(new Intent(context, PlaybackService.class));
        } catch (Exception ignored) {
            // Nothing to stop.
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Playback",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Cloud Music playback controls");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            notificationManager.createNotificationChannel(channel);
        }

        session = new MediaSession(this, "CloudMusic");
        session.setFlags(
            MediaSession.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build();
        session.setPlaybackToLocal(attributes);
        session.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                ShiyinPlaybackPlugin.dispatchAction("play", -1);
            }

            @Override
            public void onPause() {
                ShiyinPlaybackPlugin.dispatchAction("pause", -1);
            }

            @Override
            public void onSkipToNext() {
                ShiyinPlaybackPlugin.dispatchAction("next", -1);
            }

            @Override
            public void onSkipToPrevious() {
                ShiyinPlaybackPlugin.dispatchAction("previous", -1);
            }

            @Override
            public void onSeekTo(long position) {
                ShiyinPlaybackPlugin.dispatchAction("seek", position);
            }

            @Override
            public void onStop() {
                ShiyinPlaybackPlugin.dispatchAction("stop", -1);
            }
        });
        session.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            ShiyinPlaybackPlugin.dispatchAction("stop", -1);
            stopSelf();
            return START_NOT_STICKY;
        }
        if (ACTION_PREVIOUS.equals(action)) {
            ShiyinPlaybackPlugin.dispatchAction("previous", -1);
            return START_STICKY;
        }
        if (ACTION_TOGGLE.equals(action)) {
            ShiyinPlaybackPlugin.dispatchAction(playing ? "pause" : "play", -1);
            return START_STICKY;
        }
        if (ACTION_NEXT.equals(action)) {
            ShiyinPlaybackPlugin.dispatchAction("next", -1);
            return START_STICKY;
        }

        try {
            applyState();
        } catch (Exception ignored) {
            // If the OS refuses the foreground notification, stop cleanly.
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    private void applyState() {
        if (session == null) return;

        long safeDuration = Math.max(durationMs, positionMs);
        MediaMetadata metadata = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, title.isEmpty() ? "Cloud Music" : title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, safeDuration)
            .build();
        session.setMetadata(metadata);

        long actions =
            PlaybackState.ACTION_PLAY |
            PlaybackState.ACTION_PAUSE |
            PlaybackState.ACTION_PLAY_PAUSE |
            PlaybackState.ACTION_SKIP_TO_NEXT |
            PlaybackState.ACTION_SKIP_TO_PREVIOUS |
            PlaybackState.ACTION_SEEK_TO |
            PlaybackState.ACTION_STOP;

        PlaybackState playbackState = new PlaybackState.Builder()
            .setActions(actions)
            .setState(
                playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED,
                positionMs,
                playing ? 1f : 0f
            )
            .setBufferedPosition(safeDuration)
            .build();
        session.setPlaybackState(playbackState);

        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        notificationManager.notify(NOTIFICATION_ID, notification);
    }

    private PendingIntent serviceIntent(String action, int requestCode) {
        Intent intent = new Intent(this, PlaybackService.class).setAction(action);
        return PendingIntent.getService(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private PendingIntent contentIntent() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private Notification buildNotification() {
        Notification.Action previousAction = new Notification.Action.Builder(
            Icon.createWithResource(this, android.R.drawable.ic_media_previous),
            "Previous",
            serviceIntent(ACTION_PREVIOUS, 11)
        ).build();

        Notification.Action toggleAction = new Notification.Action.Builder(
            Icon.createWithResource(
                this,
                playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play
            ),
            playing ? "Pause" : "Play",
            serviceIntent(ACTION_TOGGLE, 12)
        ).build();

        Notification.Action nextAction = new Notification.Action.Builder(
            Icon.createWithResource(this, android.R.drawable.ic_media_next),
            "Next",
            serviceIntent(ACTION_NEXT, 13)
        ).build();

        Notification.Builder builder = new Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_music)
            .setContentTitle(title.isEmpty() ? "Cloud Music" : title)
            .setContentText(artist)
            .setContentIntent(contentIntent())
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setOngoing(playing)
            .setShowWhen(false)
            .addAction(previousAction)
            .addAction(toggleAction)
            .addAction(nextAction)
            .setStyle(
                new Notification.MediaStyle()
                    .setMediaSession(session.getSessionToken())
                    .setShowActionsInCompactView(0, 1, 2)
            );

        return builder.build();
    }

    @Override
    public void onDestroy() {
        if (session != null) {
            session.setActive(false);
            session.release();
            session = null;
        }
        stopForeground(true);
        if (notificationManager != null) {
            notificationManager.cancel(NOTIFICATION_ID);
        }
        instance = null;
        super.onDestroy();
    }
}
