using System.ComponentModel;
using System.Runtime.CompilerServices;
using Microsoft.Maui.Controls;

namespace CBSSupport.Shared.ViewModels
{
    public class TestViewModel : INotifyPropertyChanged
    {
        private string _testMessage = string.Empty;
        private int _clickCount;

        public string TestMessage
        {
            get => _testMessage;
            set
            {
                if (_testMessage != value)
                {
                    _testMessage = value;
                    OnPropertyChanged();
                }
            }
        }

        public int ClickCount
        {
            get => _clickCount;
            set
            {
                if (_clickCount != value)
                {
                    _clickCount = value;
                    OnPropertyChanged();
                }
            }
        }

        public Command TestCommand { get; }

        public TestViewModel()
        {
            TestMessage = "Project Structure Test Page";
            ClickCount = 0;
            TestCommand = new Command(ExecuteTestCommand);
        }

        private void ExecuteTestCommand()
        {
            ClickCount++;
            TestMessage = $"Button clicked {ClickCount} times!";
        }

        public event PropertyChangedEventHandler? PropertyChanged;

        protected virtual void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
}