package com.shiyin.player;

import android.graphics.Color;
import android.view.Window;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ShiyinTheme")
public class ShiyinThemePlugin extends Plugin {

    @PluginMethod
    public void setSystemBarsColor(PluginCall call) {
        String color = call.getString("color", "#F5F7FC");
        getActivity().runOnUiThread(() -> {
            int parsed;
            try {
                parsed = Color.parseColor(color);
            } catch (IllegalArgumentException error) {
                parsed = Color.WHITE;
            }

            Window window = getActivity().getWindow();
            window.addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(parsed));
            window.getDecorView().setBackgroundColor(parsed);
            window.setStatusBarColor(parsed);
            window.setNavigationBarColor(parsed);
            window.setNavigationBarDividerColor(parsed);
            call.resolve();
        });
    }
}
