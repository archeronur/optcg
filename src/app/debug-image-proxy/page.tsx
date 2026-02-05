'use client';

import { useState } from 'react';
import { getImageAsDataUri } from '@/utils/imageDataUri';
import { getSiteOrigin, toAbsoluteUrl } from '@/utils/url';

export default function DebugImageProxyPage() {
  const [testUrl, setTestUrl] = useState('https://en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png');
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  };

  const testProxy = async () => {
    setLoading(true);
    setLogs([]);
    setResult(null);

    try {
      addLog('=== Starting Image Proxy Test ===');
      
      // Test 1: Site Origin
      const siteOrigin = getSiteOrigin();
      addLog(`Site Origin: ${siteOrigin}`);
      addLog(`Window Location: ${typeof window !== 'undefined' ? window.location.origin : 'N/A'}`);
      
      // Test 2: URL Normalization
      const absoluteUrl = toAbsoluteUrl(testUrl);
      addLog(`Input URL: ${testUrl}`);
      addLog(`Absolute URL: ${absoluteUrl}`);
      
      // Test 3: Proxy URL Construction
      const proxyPath = `/api/image-proxy?url=${encodeURIComponent(absoluteUrl)}`;
      const proxyUrl = toAbsoluteUrl(proxyPath, siteOrigin);
      addLog(`Proxy Path: ${proxyPath}`);
      addLog(`Proxy URL: ${proxyUrl}`);
      
      // Test 4: Direct Fetch Test
      addLog('--- Testing Direct Fetch ---');
      try {
        const directResponse = await fetch(testUrl, {
          method: 'GET',
          headers: { 'Accept': 'image/*' },
        });
        addLog(`Direct Fetch Status: ${directResponse.status} ${directResponse.statusText}`);
        addLog(`Direct Fetch Content-Type: ${directResponse.headers.get('content-type')}`);
        addLog(`Direct Fetch CORS: ${directResponse.headers.get('access-control-allow-origin') || 'none'}`);
      } catch (directError: any) {
        addLog(`Direct Fetch Error: ${directError.message}`);
      }
      
      // Test 5: Proxy Fetch Test
      addLog('--- Testing Proxy Fetch ---');
      try {
        const proxyResponse = await fetch(proxyUrl, {
          method: 'GET',
          headers: { 'Accept': 'image/*' },
        });
        addLog(`Proxy Fetch Status: ${proxyResponse.status} ${proxyResponse.statusText}`);
        addLog(`Proxy Fetch Content-Type: ${proxyResponse.headers.get('content-type')}`);
        addLog(`Proxy Fetch CORS: ${proxyResponse.headers.get('access-control-allow-origin') || 'none'}`);
        
        if (!proxyResponse.ok) {
          const errorText = await proxyResponse.text();
          addLog(`Proxy Error Response: ${errorText.substring(0, 200)}`);
          setResult({ error: `Proxy returned ${proxyResponse.status}: ${errorText.substring(0, 200)}` });
          return;
        }
        
        const arrayBuffer = await proxyResponse.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        addLog(`Proxy Response Size: ${bytes.length} bytes`);
        addLog(`Proxy Response First Bytes: ${Array.from(bytes.slice(0, 10)).join(', ')}`);
        
        if (bytes.length < 1000) {
          const text = new TextDecoder().decode(bytes);
          addLog(`Proxy Response Text (too small): ${text.substring(0, 200)}`);
          setResult({ error: `Response too small: ${bytes.length} bytes, text: ${text.substring(0, 100)}` });
          return;
        }
      } catch (proxyError: any) {
        addLog(`Proxy Fetch Error: ${proxyError.message}`);
        addLog(`Proxy Fetch Error Name: ${proxyError.name}`);
        setResult({ error: `Proxy fetch failed: ${proxyError.message}` });
        return;
      }
      
      // Test 6: getImageAsDataUri Test
      addLog('--- Testing getImageAsDataUri ---');
      try {
        const imageResult = await getImageAsDataUri(testUrl, {
          preferProxy: true,
          timeoutMs: 30000,
          cache: false,
        });
        
        addLog(`Image Result Via: ${imageResult.via}`);
        addLog(`Image Result Content-Type: ${imageResult.contentType}`);
        addLog(`Image Result Bytes: ${imageResult.bytes.length}`);
        addLog(`Image Result Data URI Preview: ${imageResult.dataUri.substring(0, 50)}...`);
        
        setResult({
          success: true,
          via: imageResult.via,
          contentType: imageResult.contentType,
          bytes: imageResult.bytes.length,
          dataUriPreview: imageResult.dataUri.substring(0, 100),
        });
      } catch (imageError: any) {
        addLog(`getImageAsDataUri Error: ${imageError.message}`);
        addLog(`getImageAsDataUri Stack: ${imageError.stack}`);
        setResult({ error: `getImageAsDataUri failed: ${imageError.message}` });
      }
      
      addLog('=== Test Complete ===');
    } catch (error: any) {
      addLog(`Fatal Error: ${error.message}`);
      addLog(`Stack: ${error.stack}`);
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Image Proxy Debug Tool</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <label>
          Test Image URL:
          <input
            type="text"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '8px' }}
          />
        </label>
      </div>
      
      <button
        onClick={testProxy}
        disabled={loading}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: loading ? '#ccc' : '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Testing...' : 'Run Test'}
      </button>
      
      {result && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: result.error ? '#fee' : '#efe', borderRadius: '4px' }}>
          <h2>Result:</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
      
      <div style={{ marginTop: '20px' }}>
        <h2>Logs:</h2>
        <div
          style={{
            backgroundColor: '#f5f5f5',
            padding: '15px',
            borderRadius: '4px',
            maxHeight: '600px',
            overflow: 'auto',
            fontFamily: 'monospace',
            fontSize: '12px',
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: '#999' }}>No logs yet. Click "Run Test" to start.</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} style={{ marginBottom: '4px' }}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
