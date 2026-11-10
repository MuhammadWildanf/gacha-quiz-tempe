using System;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

public class QrWebSocketClient : MonoBehaviour
{
    public event Action OnConnected;
    public event Action OnDisconnected;
    public event Action<string> OnMessage;

    [SerializeField] private string serverUrl = "ws://192.168.1.10:3012";
    [SerializeField] private float reconnectDelay = 3f;

    private ClientWebSocket _socket;
    private CancellationTokenSource _cts;
    private readonly ConcurrentQueue<Action> _mainThreadJobs = new ConcurrentQueue<Action>();
    private bool _connected;
    private bool _manualClose;

    public bool IsConnected => _connected;

    private void Update()
    {
        while (_mainThreadJobs.TryDequeue(out Action job))
        {
            try { job(); }
            catch (Exception e) { Debug.LogException(e); }
        }
    }

    public void Connect(string url)
    {
        Debug.Log($"[WS] Menghubungkan ke {url} ...");
        serverUrl = url;
        Restart();
    }

    public void Disconnect()
    {
        _manualClose = true;
        if (_cts != null)
        {
            _cts.Cancel();
            _cts.Dispose();
            _cts = null;
        }
    }

    public bool Send(string json)
    {
        if (_socket == null || _socket.State != WebSocketState.Open)
        {
            Debug.LogWarning("[WS] ❌ Gagal kirim: socket belum OPEN (server putus?).");
            return false;
        }
        byte[] bytes = Encoding.UTF8.GetBytes(json);
        CancellationToken token = _cts != null ? _cts.Token : CancellationToken.None;
        _ = Task.Run(async () =>
        {
            try
            {
                await _socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, token);
            }
            catch (Exception e) { Debug.LogWarning("[WS] Gagal kirim: " + e.Message); }
        }, token);
        return true;
    }

    private void Restart()
    {
        _manualClose = false;
        if (_cts != null)
        {
            _cts.Cancel();
            _cts.Dispose();
        }
        _cts = new CancellationTokenSource();
        _ = Task.Run(() => RunConnectionLoop(_cts.Token));
    }

    private async Task RunConnectionLoop(CancellationToken token)
    {
        while (!token.IsCancellationRequested)
        {
            bool manual = false;
            try
            {
                _socket = new ClientWebSocket();
                await _socket.ConnectAsync(new Uri(serverUrl), token);
                if (_socket.State == WebSocketState.Open)
                {
                    RunOnMainThread(() =>
                    {
                        _connected = true;
                        OnConnected?.Invoke();
                    });
                    await ReceiveLoopAsync(_socket, token);
                }
            }
            catch (OperationCanceledException)
            {
                return;
            }
            catch (Exception e)
            {
                Debug.LogWarning("[WS] ❌ Koneksi gagal/retry: " + e.Message);
            }
            finally
            {
                try { _socket?.Dispose(); } catch { }
                manual = _manualClose;
            }

            RunOnMainThread(() =>
            {
                bool wasConnected = _connected;
                _connected = false;
                if (wasConnected) OnDisconnected?.Invoke();
                else Debug.Log($"[WS] ⏳ Belum tersambung — coba lagi {reconnectDelay}s...");
            });

            if (manual || token.IsCancellationRequested) return;
            try { await Task.Delay(TimeSpan.FromSeconds(reconnectDelay), token); }
            catch (OperationCanceledException) { return; }
        }
    }

    private async Task ReceiveLoopAsync(ClientWebSocket socket, CancellationToken token)
    {
        var buffer = new byte[8192];
        while (socket.State == WebSocketState.Open && !token.IsCancellationRequested)
        {
            var sb = new StringBuilder();
            WebSocketReceiveResult result;
            do
            {
                result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), token);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    try { await socket.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, "", token); } catch { }
                    return;
                }
                sb.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));
            } while (!result.EndOfMessage);

            string json = sb.ToString();
            RunOnMainThread(() => OnMessage?.Invoke(json));
        }
    }

    private void RunOnMainThread(Action action)
    {
        _mainThreadJobs.Enqueue(action);
    }

    private void OnDestroy()
    {
        Disconnect();
    }
}