using System.Collections.Concurrent;

namespace StreamerHub.Core.Host;

/// <summary>
/// Enforces a single running instance of Streamer Hub per user session using a named Mutex,
/// and allows secondary instances to notify the primary instance to restore its window.
/// </summary>
public sealed class SingleInstanceCoordinator : IDisposable
{
    public const string DefaultMutexName = "StreamerHub_SingleInstance_Mutex";
    public const string DefaultEventName = "StreamerHub_SingleInstance_ShowEvent";

    private static readonly ConcurrentDictionary<string, byte> s_activeMutexes = new(StringComparer.OrdinalIgnoreCase);

    private readonly string _mutexName;
    private readonly Mutex? _mutex;
    private readonly EventWaitHandle? _showEvent;
    private RegisteredWaitHandle? _registeredWaitHandle;
    private readonly bool _ownsMutex;
    private bool _disposed;

    public bool IsPrimary { get; }

    public SingleInstanceCoordinator(
        string mutexName = DefaultMutexName,
        string eventName = DefaultEventName)
    {
        _mutexName = mutexName;

        if (!s_activeMutexes.TryAdd(mutexName, 0))
        {
            IsPrimary = false;
            _ownsMutex = false;
            return;
        }

        bool createdNew = false;
        try
        {
            _mutex = new Mutex(true, mutexName, out createdNew);
        }
        catch (AbandonedMutexException)
        {
            createdNew = true;
        }

        if (!createdNew && _mutex != null)
        {
            try
            {
                createdNew = _mutex.WaitOne(TimeSpan.Zero);
            }
            catch (AbandonedMutexException)
            {
                createdNew = true;
            }
        }

        if (!createdNew)
        {
            s_activeMutexes.TryRemove(mutexName, out _);
        }

        _ownsMutex = createdNew;
        IsPrimary = createdNew;

        if (IsPrimary)
        {
            try
            {
                _showEvent = new EventWaitHandle(false, EventResetMode.AutoReset, eventName, out _);
            }
            catch
            {
                // Fallback if event handle creation encounters an environment restriction
            }
        }
    }

    /// <summary>
    /// Registers a callback to be invoked whenever a secondary launch attempts to run.
    /// </summary>
    public void RegisterShowHandler(Action onShowRequested)
    {
        if (!IsPrimary || _showEvent == null || _disposed) return;

        _registeredWaitHandle?.Unregister(null);
        _registeredWaitHandle = ThreadPool.RegisterWaitForSingleObject(
            _showEvent,
            (_, _) => onShowRequested(),
            null,
            -1,
            false);
    }

    /// <summary>
    /// Signals the primary instance to bring its window to the foreground.
    /// </summary>
    public static bool NotifyPrimary(string eventName = DefaultEventName)
    {
        try
        {
            using var showEvent = EventWaitHandle.OpenExisting(eventName);
            return showEvent.Set();
        }
        catch
        {
            return false;
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        _registeredWaitHandle?.Unregister(null);
        _showEvent?.Dispose();

        if (_ownsMutex)
        {
            s_activeMutexes.TryRemove(_mutexName, out _);
            if (_mutex != null)
            {
                try
                {
                    _mutex.ReleaseMutex();
                }
                catch (ApplicationException)
                {
                }
            }
        }

        _mutex?.Dispose();
    }
}
