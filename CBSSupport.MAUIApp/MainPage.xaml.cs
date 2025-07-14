namespace CBSSupport.MAUIApp;

public partial class MainPage : ContentPage
{
    public MainPage()
    {
        InitializeComponent();
        SetWebViewSource();
    }

    private void SetWebViewSource()
    {
        string chatUrl;

        // IMPORTANT: Find the correct port from CBSSupport.API/Properties/launchSettings.json
        // and replace '7123' with YOUR port number.
        const string port = "7243 || 5075";

#if ANDROID
        chatUrl = $"http://10.0.2.2:{port}/Chat";
#else
        chatUrl = $"http://localhost:{port}/Chat";
#endif

        ChatWebView.Source = new UrlWebViewSource { Url = chatUrl };
    }

    private void OnToggleChatClicked(object sender, EventArgs e)
    {
        ChatWebView.IsVisible = !ChatWebView.IsVisible;
        ToggleChatButton.Text = ChatWebView.IsVisible ? "Hide Chat" : "Show Chat";
    }
}