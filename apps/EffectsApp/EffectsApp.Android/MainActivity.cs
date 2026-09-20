using Android.App;
using Android.Content.PM;
using Android.OS;
using Android.Views;
using Android.Webkit;
using Android.Widget;
using Android.Graphics;

namespace EffectsApp.Android;

/// <summary>
/// Full-screen host for the offline 3D MV. The whole experience is a canvas
/// page shipped inside the APK's assets, so the activity is just a WebView
/// pointed at file:///android_asset/Web/index.html.
/// </summary>
[Activity(
    Label = "Effects 3D MV",
    Theme = "@style/MyTheme.NoActionBar",
    Icon = "@drawable/Icon",
    MainLauncher = true,
    ScreenOrientation = ScreenOrientation.FullUser,
    ConfigurationChanges = ConfigChanges.Orientation | ConfigChanges.ScreenSize
                         | ConfigChanges.ScreenLayout | ConfigChanges.UiMode
                         | ConfigChanges.KeyboardHidden)]
public class MainActivity : Activity
{
    private const string EntryUrl = "file:///android_asset/Web/index.html";
    private WebView? _web;

    protected override void OnCreate(Bundle? savedInstanceState)
    {
        base.OnCreate(savedInstanceState);

        // The visuals run at 60fps — keep the screen alive and go edge to edge.
        Window?.AddFlags(WindowManagerFlags.KeepScreenOn);
        GoImmersive();

        _web = new WebView(this);
        var s = _web.Settings;
        s.JavaScriptEnabled = true;
        s.DomStorageEnabled = true;                    // the lyric sync editor uses localStorage
        s.MediaPlaybackRequiresUserGesture = false;    // a tap on a song card starts audio
        s.AllowFileAccess = true;
        s.AllowContentAccess = true;
#pragma warning disable CA1422                          // needed for file:// sub-resources
        s.AllowFileAccessFromFileURLs = true;
        s.AllowUniversalAccessFromFileURLs = true;
#pragma warning restore CA1422
        s.CacheMode = CacheModes.NoCache;
        s.SetSupportZoom(false);
        s.BuiltInZoomControls = false;
        s.LoadWithOverviewMode = true;
        s.UseWideViewPort = true;

        _web.SetBackgroundColor(Color.ParseColor("#04050C"));
        _web.SetWebViewClient(new LocalWebViewClient());
        _web.SetWebChromeClient(new WebChromeClient());
        _web.LoadUrl(EntryUrl);

        SetContentView(_web, new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MatchParent, ViewGroup.LayoutParams.MatchParent));
    }

    private void GoImmersive()
    {
        if (Window is null) return;
        Window.DecorView.SystemUiFlags =
            SystemUiFlags.LayoutStable | SystemUiFlags.LayoutHideNavigation |
            SystemUiFlags.LayoutFullscreen | SystemUiFlags.HideNavigation |
            SystemUiFlags.Fullscreen | SystemUiFlags.ImmersiveSticky;
    }

    public override void OnWindowFocusChanged(bool hasFocus)
    {
        base.OnWindowFocusChanged(hasFocus);
        if (hasFocus) GoImmersive();
    }

    public override void OnBackPressed()
    {
        if (_web is { } w && w.CanGoBack()) w.GoBack();
        else base.OnBackPressed();
    }

    protected override void OnPause()
    {
        _web?.OnPause();
        base.OnPause();
    }

    protected override void OnResume()
    {
        base.OnResume();
        _web?.OnResume();
    }

    protected override void OnDestroy()
    {
        _web?.Destroy();
        _web = null;
        base.OnDestroy();
    }

    /// <summary>Keeps every navigation inside the bundled site.</summary>
    private sealed class LocalWebViewClient : WebViewClient
    {
        public override bool ShouldOverrideUrlLoading(WebView? view, IWebResourceRequest? request)
            => false;

        public override void OnReceivedError(WebView? view, IWebResourceRequest? request,
                                             WebResourceError? error)
        {
            base.OnReceivedError(view, request, error);
            if (view?.Context is { } ctx && request?.IsForMainFrame == true)
                Toast.MakeText(ctx, "無法載入內容", ToastLength.Long)?.Show();
        }
    }
}
