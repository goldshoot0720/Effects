using System;
using System.IO;

namespace EffectsApp;

/// <summary>
/// Locates the offline web experience packaged by each platform host.
/// </summary>
public static class EffectsWebContent
{
    private static readonly Uri AndroidEntryUri = new("file:///android_asset/Web/index.html");

    public static Uri EntryUri => OperatingSystem.IsAndroid()
        ? AndroidEntryUri
        : new Uri(Path.Combine(AppContext.BaseDirectory, "Web", "index.html"));
}
