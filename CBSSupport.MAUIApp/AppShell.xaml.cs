using CBSSupport.MAUIApp.Views;

namespace CBSSupport.MAUIApp;

public partial class AppShell : Shell
{
    public AppShell()
    {
        InitializeComponent();
        Routing.RegisterRoute(nameof(TestPage), typeof(TestPage));
    }
}
