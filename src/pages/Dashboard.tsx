import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { ServiceRecord } from '../types';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { 
  TrendingUp, 
  Users, 
  Wrench, 
  Clock, 
  Banknote, 
  ChevronRight, 
  AlertCircle,
  CheckCircle2,
  CalendarDays
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'serviceRecords'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ServiceRecord[];
      setRecords(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'serviceRecords');
    });

    return unsubscribe;
  }, [user]);

  if (loading) return <div className="p-8 text-center animate-pulse text-muted-foreground uppercase tracking-widest text-xs">Veriler Hazırlanıyor...</div>;

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  
  const stats = {
    total: records.length,
    monthly: records.filter(r => isWithinInterval(new Date(r.createdAt), { start: monthStart, end: monthEnd })).length,
    pending: records.filter(r => r.status.includes('Yönlendir')).length,
    completed: records.filter(r => r.status.includes('Tamamlandı')).length,
    revenue: records.reduce((acc, r) => acc + (r.repairPrice || 0), 0),
    monthlyRevenue: records
      .filter(r => isWithinInterval(new Date(r.createdAt), { start: monthStart, end: monthEnd }))
      .reduce((acc, r) => acc + (r.repairPrice || 0), 0)
  };

  const pendingServices = records.filter(r => r.status.includes('Yönlendir')).slice(0, 5);
  const recentActivities = records.slice(0, 5);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Hero / Welcome */}
      <div className="relative overflow-hidden bg-primary/10 rounded-3xl p-6 border border-primary/20">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold text-foreground">Hoş Geldiniz, {user?.email?.split('@')[0]}</h1>
          <p className="text-muted-foreground text-sm mt-1">Bugün operasyonlarınızı buradan yönetebilirsiniz.</p>
          <div className="mt-6 flex gap-3">
            <Button onClick={() => navigate('/new')} className="bg-primary text-black font-bold rounded-xl h-11 border-b-2 border-primary/50">
              + Yeni Servis Kaydı
            </Button>
            <Button variant="outline" onClick={() => navigate('/list')} className="bg-background border-border rounded-xl h-11">
              Liste Görünümü
            </Button>
          </div>
        </div>
        <Wrench className="absolute -right-4 -bottom-4 w-32 h-32 text-primary/10 -rotate-12" />
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          icon={<TrendingUp className="w-4 h-4" />} 
          label="Aylık Servis" 
          value={stats.monthly} 
          trend="+5%" 
          color="primary"
        />
        <StatCard 
          icon={<Banknote className="w-4 h-4" />} 
          label="Aylık Ciro" 
          value={`${stats.monthlyRevenue.toLocaleString('tr-TR')} ₺`} 
          color="green"
        />
        <StatCard 
          icon={<Clock className="w-4 h-4" />} 
          label="Sıradaki" 
          value={stats.pending} 
          color="orange"
        />
        <StatCard 
          icon={<CheckCircle2 className="w-4 h-4" />} 
          label="Tamamlanan" 
          value={stats.completed} 
          color="purple"
        />
      </div>

      {/* Quick View Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Active/Pending Focus */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-sm tracking-widest text-muted-foreground uppercase flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" /> Bekleyen Servisler
            </h2>
            <Button variant="link" className="text-xs text-primary" onClick={() => navigate('/list')}>Hepsini Gör</Button>
          </div>
          <div className="space-y-2">
            {pendingServices.map(s => (
              <div 
                key={s.id} 
                onClick={() => navigate(`/service/${s.id}`)}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-transparent hover:border-primary/30 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 font-bold text-xs uppercase">
                    {s.deviceBrand.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{s.customerName}</p>
                    <p className="text-[10px] text-muted-foreground">{s.deviceBrand} - {s.deviceType}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            ))}
            {pendingServices.length === 0 && <p className="text-center py-6 text-xs text-muted-foreground">Aktif servis bulunamadı.</p>}
          </div>
        </div>

        {/* Progress Card */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-6 shadow-sm overflow-hidden relative">
          <h2 className="font-bold text-sm tracking-widest text-muted-foreground uppercase flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" /> Operasyon Özeti
          </h2>
          <div className="space-y-4 relative z-10">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-muted-foreground uppercase">Çözüm Oranı</span>
                <span className="text-primary">{Math.round((stats.completed / (stats.total || 1)) * 100)}%</span>
              </div>
              <Progress value={(stats.completed / (stats.total || 1)) * 100} className="h-2 bg-primary/10" />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-3 rounded-xl bg-muted/50 border border-border">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Toplam Ciro</p>
                <p className="text-lg font-bold text-foreground leading-tight">{stats.revenue.toLocaleString('tr-TR')} ₺</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 border border-border">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Toplam Kayıt</p>
                <p className="text-lg font-bold text-foreground leading-tight">{stats.total}</p>
              </div>
            </div>
          </div>
          <Banknote className="absolute -right-2 -bottom-2 w-24 h-24 text-green-500/5 rotate-12" />
        </div>

      </div>

      {/* List Transition */}
      <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-4">
        <h3 className="font-bold text-lg">Servis Listesine Git</h3>
        <p className="text-sm text-muted-foreground">Bütün detaylı kayıtlara, arama ve filtreleme seçenekleriyle ulaşın.</p>
        <Button onClick={() => navigate('/list')} className="w-full bg-foreground text-background font-bold h-12 rounded-xl">
          TÜM SERVİS KAYITLARINI LİSTELE
        </Button>
      </div>

      <div className="text-[10px] text-center text-muted-foreground/30 uppercase tracking-[0.3em] py-8">
        Bölge Merkez Servisi Dashboard v1.1
      </div>

    </div>
  );
}

function StatCard({ icon, label, value, trend, color }: any) {
  const colors: any = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
  };

  return (
    <div className={`p-4 rounded-2xl border ${colors[color]} space-y-3 shadow-sm`}>
      <div className="flex justify-between items-center">
        <div className="p-2 bg-background/50 rounded-lg backdrop-blur-sm">
          {icon}
        </div>
        {trend && <span className="text-[10px] bg-background/50 px-1.5 py-0.5 rounded-full font-bold">{trend}</span>}
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold tracking-wider opacity-70">{label}</p>
        <p className="text-xl font-bold tracking-tight text-foreground">{value}</p>
      </div>
    </div>
  );
}
