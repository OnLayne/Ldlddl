import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Wrench } from 'lucide-react';
import { ServiceList } from './pages/ServiceList';
import { NewService } from './pages/NewService';
import { ServiceDetail } from './pages/ServiceDetail';
import { PublicSign } from './pages/PublicSign';
import { Dashboard } from './pages/Dashboard';
import { MapRoute } from './pages/MapRoute';
import { Calculator } from './pages/Calculator';
import { Accounting } from './pages/Accounting';
import { UserManagement } from './pages/UserManagement';
import { StockManagement } from './pages/StockManagement';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, login } = useAuth();
  if (loading) return null;
  
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-28 h-28 mb-4 flex items-center justify-center">
          <img 
            src="/logo.png" 
            alt="BMS PRO Logo" 
            className="w-full h-full object-contain rounded-2xl drop-shadow-2xl"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              const nextEl = (e.target as HTMLImageElement).nextElementSibling;
              if (nextEl) nextEl.classList.remove('hidden');
            }}
          />
          <div className="hidden w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center rotate-3 shadow-2xl">
            <Wrench className="w-10 h-10 text-primary -rotate-45" />
          </div>
        </div>
        <h1 className="text-3xl font-black tracking-tighter mb-2 italic">BMS/PRO</h1>
        <p className="text-muted-foreground text-sm mb-8 font-medium uppercase tracking-[0.3em]">Teknik Servis Paneli</p>
        
        <div className="bg-card border border-border p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
          <h2 className="text-xl font-bold mb-6">Yönetici Girişi</h2>
          <Button onClick={login} className="w-full h-12 bg-primary text-black font-black text-sm tracking-wide gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
            GOOGLE İLE OTURUM AÇ
          </Button>
          <p className="mt-4 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Yalnızca yetkili personel erişebilir</p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
};

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, login } = useAuth();
  
  // Custom header based on route
  const isDashboard = location.pathname === '/';
  const isList = location.pathname === '/list';
  const isDetail = location.pathname.startsWith('/service/');
  const isSign = location.pathname.startsWith('/sign/');
  const isNew = location.pathname === '/new';
  const isOther = ['/map', '/calculator', '/accounting', '/users', '/stock'].includes(location.pathname);
  
  const serviceIdFromUrl = isDetail ? location.pathname.split('/').pop() : '';

  if (isSign) return null;
  
  return (
    <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
      {isDetail || isNew || isList || isOther ? (
        <button 
          onClick={() => {
            if (isList) {
              navigate('/');
            } else {
              navigate(-1);
            }
          }} 
          className="text-muted-foreground text-sm flex items-center gap-1 font-bold"
        >
          &larr; {isList ? 'Panel' : 'Geri'}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <img 
            src="/logo.png" 
            alt="Logo" 
            className="h-8 w-8 object-contain rounded-full" 
            onError={(e) => { 
              (e.target as HTMLImageElement).style.display = 'none'; 
              const nextEl = (e.target as HTMLImageElement).nextElementSibling;
              if (nextEl) nextEl.classList.remove('hidden'); 
            }} 
          />
          <div className="hidden text-primary font-black text-xs tracking-tighter italic">BMS/PRO</div>
        </div>
      )}
      
      <div className="font-bold flex items-center justify-center absolute left-1/2 -translate-x-1/2 uppercase text-[10px] tracking-widest whitespace-nowrap">
        {isDetail ? (
          <div className="flex items-center gap-1.5"><Wrench className="w-3 h-3 text-primary"/> SERVİS DETAY</div>
        ) : isNew ? (
          <div className="flex items-center gap-1.5"><span className="text-primary text-base leading-none">+</span> YENİ SERVİS</div>
        ) : isList ? (
          <div className="flex items-center gap-1.5 flex-col leading-none">
             <span className="text-xs">SERVİS LİSTESİ</span>
             <span className="text-[8px] font-normal opacity-50 tracking-tighter">TEKNİK PROGRAMI</span>
          </div>
        ) : isOther ? (
          <div className="flex items-center gap-1.5">
             <span className="text-xs uppercase">{
                location.pathname === '/map' ? 'Harita & Yol Tarifi' : 
                location.pathname === '/calculator' ? 'Yüzde Hesaplama' : 
                location.pathname === '/accounting' ? 'Muhasebe' : 
                location.pathname === '/stock' ? 'Stok Yönetimi' : 'Kullanıcı Yönetimi'
             }</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5"><span className="text-primary">⚡</span> DASHBOARD</div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {user?.isAnonymous ? (
          <Button onClick={login} size="sm" variant="outline" className="h-7 text-[10px] px-2 border-primary/50 text-primary">GİRİŞ</Button>
        ) : null}
        
        {isDetail && serviceIdFromUrl ? (
          <div className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">
            ID:{serviceIdFromUrl.slice(-6)}
          </div>
        ) : isNew ? (
           <div className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-mono uppercase">
            YENI
          </div>
        ) : isDashboard ? (
          <Button onClick={() => navigate('/list')} size="sm" variant="ghost" className="text-muted-foreground hover:text-primary px-2 h-8 text-[10px] font-bold">
            LİSTE
          </Button>
        ) : (
          <Button onClick={() => navigate('/new')} size="sm" variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10 px-2 h-8 font-bold">
            + YENİ
          </Button>
        )}
      </div>
    </header>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen max-w-2xl mx-auto flex flex-col bg-background relative shadow-2xl">
      <Header />
      <main className="flex-1 overflow-x-hidden p-4 pb-24">
        {children}
      </main>
    </div>
  );
};

function AppContent() {
  return (
    <Routes>
      <Route path="/sign/:id" element={<PublicSign />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/list"
        element={
          <ProtectedRoute>
            <Layout>
              <ServiceList />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/new"
        element={
          <ProtectedRoute>
            <Layout>
              <NewService />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/service/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <ServiceDetail />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/map"
        element={
          <ProtectedRoute>
            <Layout>
              <MapRoute />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/calculator"
        element={
          <ProtectedRoute>
            <Layout>
              <Calculator />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounting"
        element={
          <ProtectedRoute>
            <Layout>
              <Accounting />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <Layout>
              <UserManagement />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/stock"
        element={
          <ProtectedRoute>
            <Layout>
              <StockManagement />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
        <Toaster theme="dark" />
      </BrowserRouter>
    </AuthProvider>
  );
}
