import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { ServiceRecord } from '../types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MapPin, Phone, Wrench, Calendar, Banknote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const StatusBadge = ({ status }: { status: string }) => {
  let colorClass = 'border-border text-muted-foreground';
  if (status.includes('Yönlendir')) colorClass = 'border-orange-500/30 text-orange-400 hover:bg-orange-500/10';
  else if (status.includes('Atölye')) colorClass = 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10';
  else if (status.includes('Tamamlandı') || status.includes('Bakım Yapıldı')) colorClass = 'border-green-500/30 text-green-400 hover:bg-green-500/10';
  
  return (
    <Badge variant="outline" className={`rounded-full px-3 py-1 text-xs font-normal bg-transparent ${colorClass}`}>
      {status}
    </Badge>
  );
};

export function ServiceList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Tümü');
  
  const tabs = ['Tümü', 'Yönlendir', 'Atölye', 'Tamamlandı', 'Beklemede'];

  useEffect(() => {
    if (!user) return;
    
    // Fetch user's service records
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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'serviceRecords');
    });

    return unsubscribe;
  }, [user]);

  const filteredRecords = records.filter(r => {
    const matchesSearch = r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.customerPhone1.includes(searchTerm) ||
                          r.deviceBrand.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'Tümü') return matchesSearch;
    if (activeTab === 'Tamamlandı') return matchesSearch && (r.status.includes('Tamamlandı') || r.status.includes('Yapıldı'));
    return matchesSearch && r.status.toLowerCase().includes(activeTab.toLowerCase());
  });

  const stats = {
    total: records.length,
    pending: records.filter(r => r.status.includes('Yönlendir')).length,
    workshop: records.filter(r => r.status.includes('Atölye')).length,
    completed: records.filter(r => r.status.includes('Tamamlandı')).length,
    today: records.filter(r => r.createdAt && format(new Date(r.createdAt), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length
  };

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border p-3 rounded-2xl space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Bugün</p>
          <p className="text-2xl font-bold text-primary">{stats.today}</p>
        </div>
        <div className="bg-card border border-border p-3 rounded-2xl space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Yönlenen</p>
          <p className="text-2xl font-bold text-orange-400">{stats.pending}</p>
        </div>
        <div className="bg-card border border-border p-3 rounded-2xl space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Atölyede</p>
          <p className="text-2xl font-bold text-purple-400">{stats.workshop}</p>
        </div>
        <div className="bg-card border border-border p-3 rounded-2xl space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Tamamlanan</p>
          <p className="text-2xl font-bold text-green-400">{stats.completed}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        </div>
        <Input 
          className="pl-11 bg-card border-border rounded-2xl h-14 text-base focus-visible:ring-primary/20 transition-all shadow-inner" 
          placeholder="İsim, telefon, marka ara..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>
      
      {/* Tabs */}
      <div className="relative">
        <ScrollArea className="w-full whitespace-nowrap -mx-4 px-4">
          <div className="flex w-max space-x-2 pb-1">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
                  activeTab === tab 
                    ? 'bg-primary text-black shadow-lg shadow-primary/20 scale-105' 
                    : 'bg-card text-muted-foreground border border-border hover:bg-muted/50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>
      </div>

      {/* List */}
      <div className="space-y-4">
        {filteredRecords.length === 0 ? (
          <div className="py-20 text-center space-y-4 bg-muted/20 rounded-3xl border border-dashed border-border">
            <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto opacity-50">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground font-medium">Kayıt bulunamadı</p>
              <p className="text-xs text-muted-foreground/60">Farklı bir arama terimi deneyin veya filtreyi değiştirin.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setSearchTerm(''); setActiveTab('Tümü'); }}>Filtreleri Temizle</Button>
          </div>
        ) : (
          filteredRecords.map(record => (
            <div 
              key={record.id} 
              onClick={() => navigate(`/service/${record.id}`)}
              className="bg-card border border-border rounded-2xl p-5 space-y-4 cursor-pointer hover:border-primary transition-all hover:translate-y-[-2px] active:scale-[0.98] shadow-sm hover:shadow-xl hover:shadow-primary/5"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-foreground text-lg leading-tight">{record.customerName}</h3>
                    {format(new Date(record.createdAt), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && (
                      <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3"/> {record.customerPhone1}</span>
                    <span className="flex items-center gap-1 text-primary/80"><MapPin className="w-3 h-3"/> {record.customerDistrict || record.customerCity}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-primary font-mono text-xs font-bold bg-primary/10 px-2 py-1 rounded">#{record.serviceId}</div>
                </div>
              </div>
              
              <div className="flex justify-between items-center py-3 border-y border-border/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <Wrench className="w-4 h-4 text-primary"/> 
                  </div>
                  <div className="text-sm font-bold">
                    <div className="text-foreground">{record.deviceBrand}</div>
                    <div className="text-muted-foreground text-[10px] uppercase font-normal">{record.deviceType}</div>
                  </div>
                </div>
                <StatusBadge status={record.status} />
              </div>
              
              <div className="flex items-center justify-between text-[11px] font-medium">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 opacity-50"/> 
                  {format(new Date(record.createdAt), 'dd MMM yyyy')}
                </div>
                <div className="flex items-center gap-1.5 text-foreground font-bold px-3 py-1 bg-muted rounded-full">
                  <Banknote className="w-3.5 h-3.5 text-green-500"/> 
                  {record.repairPrice.toLocaleString('tr-TR')} ₺
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {filteredRecords.length > 0 && (
        <div className="text-center text-[10px] text-muted-foreground/50 pb-8 uppercase tracking-widest font-bold">
          TOPLAM {filteredRecords.length} SERVİS KAYDI LİSTELENDİ
        </div>
      )}
    </div>
  );
}
