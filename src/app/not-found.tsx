import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ 
      padding: '40px 20px', 
      textAlign: 'center',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#f7fafc'
    }}>
      <h1 style={{ 
        fontSize: '72px', 
        color: '#e53e3e', 
        margin: '0 0 20px 0',
        fontWeight: 'bold'
      }}>
        404
      </h1>
      <h2 style={{ 
        color: '#2d3748', 
        marginBottom: '20px',
        fontSize: '28px'
      }}>
        Sayfa Bulunamadı
      </h2>
      <p style={{ 
        color: '#4a5568', 
        marginBottom: '30px', 
        maxWidth: '500px',
        fontSize: '16px',
        lineHeight: '1.6'
      }}>
        Aradığınız sayfa mevcut değil veya taşınmış olabilir. 
        Ana sayfaya dönerek istediğiniz içeriği bulabilirsiniz.
      </p>
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/" style={{
          padding: '12px 24px',
          backgroundColor: '#3182ce',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '6px',
          fontSize: '16px',
          display: 'inline-block'
        }}>
          Ana Sayfaya Dön
        </Link>
        <Link href="/" style={{ 
          padding: '12px 24px', 
          backgroundColor: '#718096', 
          color: 'white', 
          textDecoration: 'none',
          borderRadius: '6px', 
          fontSize: '16px',
          display: 'inline-block'
        }}>
          Ana Sayfa
        </Link>
      </div>
      <div style={{ 
        marginTop: '40px', 
        padding: '20px', 
        backgroundColor: 'white', 
        borderRadius: '8px', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        maxWidth: '600px'
      }}>
        <h3 style={{ color: '#2d3748', marginBottom: '15px' }}>One Piece Proxy Baskı Sitesi</h3>
        <p style={{ color: '#4a5568', lineHeight: '1.6', marginBottom: '15px' }}>
          One Piece TCG kartları için profesyonel proxy baskı aracı. 
          Deck'inizi yükleyin, önizleyin ve baskıya hazır PDF oluşturun.
        </p>
        <Link href="/" style={{
          color: '#3182ce',
          textDecoration: 'underline',
          fontWeight: '500'
        }}>
          Hemen Başlayın →
        </Link>
      </div>
    </div>
  );
}
