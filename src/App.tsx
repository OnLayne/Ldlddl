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

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
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
  
  const serviceIdFromUrl = isDetail ? location.pathname.split('/').pop() : '';

  if (isSign) return null;
  
  return (
    <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
      {isDetail || isNew || isList ? (
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
        <div className="text-primary font-black text-xs tracking-tighter italic">BMS/PRO</div>
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
