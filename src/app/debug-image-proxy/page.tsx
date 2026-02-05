'use client';

import { useState, useEffect } from 'react';
import { getImageAsDataUri } from '@/utils/imageDataUri';
import { getSiteOrigin, toAbsoluteUrl } from '@/utils/url';

export default function DebugImageProxyPage() {
  const [testUrl, setTestUrl] = useState('https://en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png');
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [envInfo, setEnvInfo] = useState<any>(null);

  // Collect environment info on mount
  useEffect(() => {
    const info = {
      windowOrigin: typeof window !== 'undefined' ? window.location.origin : 'N/A',
      windowHref: typeof window !== 'undefined' ? window.location.href : 'N/A',
      getSiteOrigin: getSiteOrigin(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 100) : 'N/A',
      timestamp: new Date().toISOString(),
    };
    setEnvInfo(info);
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[DEBUG] ${message}`);
  };

  const clearLogs = () => {
    setLogs([]);
    setResult(null);
    setImagePreview(null);
  };

  // Test 1: Direct API endpoint test
  const testApiEndpoint = async () => {
    setLoading(true);
    clearLogs();

    try {
      addLog('=== TEST 1: Direct API Endpoint Test ===');
      
      const siteOrigin = getSiteOrigin();
      addLog(`Site Origin: ${siteOrigin}`);
      
      const absoluteSourceUrl = toAbsoluteUrl(testUrl);
      addLog(`Source URL: ${absoluteSourceUrl}`);
      
      const proxyUrl = `${siteOrigin}/api/image-proxy?url=${encodeURIComponent(absoluteSourceUrl)}`;
      addLog(`Proxy URL: ${proxyUrl}`);
      
      addLog('Fetching from proxy...');
      const startTime = Date.now();
      
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: { 'Accept': 'image/*' },
        cache: 'no-store',
      });
      
      const elapsed = Date.now() - startTime;
      addLog(`Response received in ${elapsed}ms`);
      addLog(`Status: ${response.status} ${response.statusText}`);
      addLog(`Content-Type: ${response.headers.get('content-type')}`);
      addLog(`Content-Length: ${response.headers.get('content-length')}`);
      addLog(`X-Image-Proxy-Status: ${response.headers.get('x-image-proxy-status') || 'N/A'}`);
      addLog(`X-Image-Size: ${response.headers.get('x-image-size') || 'N/A'}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        addLog(`ERROR: Non-OK response`);
        addLog(`Error Body: ${errorText.substring(0, 500)}`);
        
        try {
          const errorJson = JSON.parse(errorText);
          setResult({ success: false, error: errorJson });
        } catch {
          setResult({ success: false, error: errorText.substring(0, 200) });
        }
        return;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      addLog(`Received ${bytes.length} bytes`);
      addLog(`First 8 bytes: [${Array.from(bytes.slice(0, 8)).join(', ')}]`);
      
      // Check image signature
      const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8;
      const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50;
      addLog(`Image format: ${isJPEG ? 'JPEG' : isPNG ? 'PNG' : 'UNKNOWN'}`);
      
      if (bytes.length < 1000) {
        const text = new TextDecoder().decode(bytes);
        addLog(`WARNING: Response too small. Text content: ${text.substring(0, 200)}`);
        setResult({ success: false, error: `Response too small: ${bytes.length} bytes`, text: text.substring(0, 100) });
        return;
      }
      
      // Create preview
      const contentType = response.headers.get('content-type') || 'image/png';
      const blob = new Blob([arrayBuffer], { type: contentType });
      const previewUrl = URL.createObjectURL(blob);
      setImagePreview(previewUrl);
      
      addLog(`SUCCESS: Image loaded and preview created`);
      setResult({
        success: true,
        bytes: bytes.length,
        contentType,
        isJPEG,
        isPNG,
        elapsed,
      });
      
    } catch (error: any) {
      addLog(`FATAL ERROR: ${error.message}`);
      addLog(`Error name: ${error.name}`);
      addLog(`Stack: ${error.stack?.substring(0, 300)}`);
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Test 2: getImageAsDataUri function test
  const testGetImageAsDataUri = async () => {
    setLoading(true);
    clearLogs();

    try {
      addLog('=== TEST 2: getImageAsDataUri Function Test ===');
      addLog(`Input URL: ${testUrl}`);
      
      const startTime = Date.now();
      const result = await getImageAsDataUri(testUrl, {
        preferProxy: true,
        timeoutMs: 30000,
        cache: false,
      });
      const elapsed = Date.now() - startTime;
      
      addLog(`Completed in ${elapsed}ms`);
      addLog(`Via: ${result.via}`);
      addLog(`Content-Type: ${result.contentType}`);
      addLog(`Bytes: ${result.bytes.length}`);
      addLog(`Data URI starts with: ${result.dataUri.substring(0, 50)}...`);
      addLog(`From cache: ${result.fromCache}`);
      
      if (result.dataUri.startsWith('data:image/')) {
        setImagePreview(result.dataUri);
        addLog(`SUCCESS: Valid base64 data URI created`);
        setResult({
          success: true,
          via: result.via,
          bytes: result.bytes.length,
          contentType: result.contentType,
          elapsed,
        });
      } else {
        addLog(`ERROR: Invalid data URI format`);
        setResult({ success: false, error: 'Invalid data URI format' });
      }
      
    } catch (error: any) {
      addLog(`ERROR: ${error.message}`);
      addLog(`Stack: ${error.stack?.substring(0, 300)}`);
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Test 3: Direct fetch (no proxy) to check CORS
  const testDirectFetch = async () => {
    setLoading(true);
    clearLogs();

    try {
      addLog('=== TEST 3: Direct Fetch (No Proxy) - CORS Test ===');
      addLog(`URL: ${testUrl}`);
      addLog('This test checks if direct fetch works (usually blocked by CORS)');
      
      const startTime = Date.now();
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: { 'Accept': 'image/*' },
        mode: 'cors',
      });
      const elapsed = Date.now() - startTime;
      
      addLog(`Response received in ${elapsed}ms`);
      addLog(`Status: ${response.status}`);
      addLog(`CORS header: ${response.headers.get('access-control-allow-origin') || 'NONE'}`);
      
      const arrayBuffer = await response.arrayBuffer();
      addLog(`Received ${arrayBuffer.byteLength} bytes`);
      
      addLog(`SUCCESS: Direct fetch worked (CORS allowed)`);
      setResult({ success: true, message: 'Direct fetch successful', bytes: arrayBuffer.byteLength });
      
    } catch (error: any) {
      addLog(`EXPECTED: Direct fetch blocked by CORS`);
      addLog(`Error: ${error.message}`);
      setResult({ success: false, error: error.message, note: 'This is expected - proxy should be used instead' });
    } finally {
      setLoading(false);
    }
  };

  // Test 4: Check API route health
  const testApiHealth = async () => {
    setLoading(true);
    clearLogs();

    try {
      addLog('=== TEST 4: API Route Health Check ===');
      
      const siteOrigin = getSiteOrigin();
      const healthUrl = `${siteOrigin}/api/image-proxy`;
      addLog(`Testing: ${healthUrl}`);
      
      const response = await fetch(healthUrl, { method: 'GET' });
      addLog(`Status: ${response.status}`);
      
      const text = await response.text();
      addLog(`Response: ${text.substring(0, 200)}`);
      
      // 400 is expected when no URL parameter is provided
      if (response.status === 400) {
        addLog(`SUCCESS: API route is responding (400 = missing URL param, expected)`);
        setResult({ success: true, message: 'API route is deployed and responding' });
      } else {
        addLog(`Unexpected status: ${response.status}`);
        setResult({ success: false, status: response.status, body: text.substring(0, 100) });
      }
      
    } catch (error: any) {
      addLog(`ERROR: API route not accessible`);
      addLog(`This usually means the API route is not deployed correctly`);
      addLog(`Error: ${error.message}`);
      setResult({ success: false, error: error.message, hint: 'API route may not be deployed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ borderBottom: '2px solid #333', paddingBottom: '10px' }}>🔧 Image Proxy Debug Tool</h1>
      
      {/* Environment Info */}
      <div style={{ backgroundColor: '#f0f0f0', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0 }}>Environment Info</h3>
        {envInfo && (
          <pre style={{ fontSize: '12px', overflow: 'auto', margin: 0 }}>
{JSON.stringify(envInfo, null, 2)}
          </pre>
        )}
      </div>
      
      {/* URL Input */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
          Test Image URL:
        </label>
        <input
          type="text"
          value={testUrl}
          onChange={(e) => setTestUrl(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '12px', 
            fontSize: '14px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxSizing: 'border-box',
          }}
        />
      </div>
      
      {/* Test Buttons */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button
          onClick={testApiHealth}
          disabled={loading}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            backgroundColor: loading ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          Test 1: API Health Check
        </button>
        
        <button
          onClick={testApiEndpoint}
          disabled={loading}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          Test 2: Proxy Endpoint
        </button>
        
        <button
          onClick={testGetImageAsDataUri}
          disabled={loading}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            backgroundColor: loading ? '#ccc' : '#6f42c1',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          Test 3: getImageAsDataUri()
        </button>
        
        <button
          onClick={testDirectFetch}
          disabled={loading}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            backgroundColor: loading ? '#ccc' : '#fd7e14',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          Test 4: Direct Fetch (CORS)
        </button>
        
        <button
          onClick={clearLogs}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Clear Logs
        </button>
      </div>
      
      {/* Loading Indicator */}
      {loading && (
        <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fff3cd', borderRadius: '8px', marginBottom: '20px' }}>
          ⏳ Loading... Please wait.
        </div>
      )}
      
      {/* Result */}
      {result && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px', 
          backgroundColor: result.success ? '#d4edda' : '#f8d7da', 
          borderRadius: '8px',
          border: `1px solid ${result.success ? '#c3e6cb' : '#f5c6cb'}`,
        }}>
          <h3 style={{ marginTop: 0, color: result.success ? '#155724' : '#721c24' }}>
            {result.success ? '✅ Success' : '❌ Failed'}
          </h3>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '13px', margin: 0 }}>
{JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
      
      {/* Image Preview */}
      {imagePreview && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Image Preview:</h3>
          <div style={{ border: '1px solid #ddd', padding: '10px', borderRadius: '8px', backgroundColor: '#f8f9fa' }}>
            <img 
              src={imagePreview} 
              alt="Preview" 
              style={{ maxWidth: '300px', maxHeight: '400px', display: 'block' }}
              onError={(e) => {
                addLog('Image preview failed to load');
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        </div>
      )}
      
      {/* Logs */}
      <div>
        <h3>Logs ({logs.length}):</h3>
        <div
          style={{
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            padding: '15px',
            borderRadius: '8px',
            maxHeight: '500px',
            overflow: 'auto',
            fontFamily: 'Consolas, Monaco, monospace',
            fontSize: '12px',
            lineHeight: '1.5',
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: '#808080' }}>No logs yet. Click a test button to start.</div>
          ) : (
            logs.map((log, index) => (
              <div 
                key={index} 
                style={{ 
                  marginBottom: '2px',
                  color: log.includes('ERROR') || log.includes('FATAL') ? '#f48771' : 
                         log.includes('SUCCESS') ? '#89d185' :
                         log.includes('WARNING') ? '#cca700' : '#d4d4d4'
                }}
              >
                {log}
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Instructions */}
      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#e7f3ff', borderRadius: '8px', border: '1px solid #b6d4fe' }}>
        <h3 style={{ marginTop: 0 }}>📋 How to Debug</h3>
        <ol style={{ lineHeight: '1.8' }}>
          <li><strong>Test 1 (API Health):</strong> Checks if the API route is deployed and responding. Should return "400 - missing URL param".</li>
          <li><strong>Test 2 (Proxy Endpoint):</strong> Tests the full proxy flow. Should return image bytes and show a preview.</li>
          <li><strong>Test 3 (getImageAsDataUri):</strong> Tests the JavaScript function that PDF generation uses. Should return base64 data URI.</li>
          <li><strong>Test 4 (Direct Fetch):</strong> Tests direct fetch to image server. Usually fails due to CORS (expected).</li>
        </ol>
        <p><strong>If Test 1 fails:</strong> API route is not deployed correctly. Check Cloudflare Pages deployment logs.</p>
        <p><strong>If Test 2 fails:</strong> Proxy is deployed but can't fetch images. Check allowed domains and HTTPS requirements.</p>
        <p><strong>If Test 3 fails:</strong> JavaScript function has issues. Check browser console for errors.</p>
      </div>
    </div>
  );
}
