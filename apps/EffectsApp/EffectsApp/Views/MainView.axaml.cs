
using System;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Markup.Xaml;
using EffectsApp;

namespace EffectsApp.Views;

public partial class MainView : UserControl
{
    public MainView()
    {
        InitializeComponent();
        var effectsWebView = this.FindControl<NativeWebView>("EffectsWebView")
            ?? throw new InvalidOperationException("Effects web view was not created.");
        effectsWebView.Source = EffectsWebContent.EntryUri;
    }

    private void InitializeComponent() => AvaloniaXamlLoader.Load(this);
}
