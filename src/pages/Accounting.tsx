import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowDownRight, ArrowUpRight, Plus, Calendar, Trash2 } from 'lucide-react';
import { format, startOfDay, startOfMonth, startOfWeek } from 'date-fns';

export function Accounting() {
  const { user, profile } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [type, setType] = useState('gelir');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState('bugun');

  useEffect(() => {
    if (!user || profile?.role !== 'ADMIN') return;
    
    // We filter locally based on timestamp because of firestore index requirements
    const q = query(
      collection(db, 'accountingRecords'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecords(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'accountingRecords');
    });

    return unsubscribe;
  }, [user]);

  const handleAdd = async (e: any) => {
    e.preventDefault();
    if (!amount || !description || !user) return;
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'accountingRecords'), {
        userId: user.uid,
        type,
        amount: parseFloat(amount),
        description,
        createdAt: serverTimestamp()
      });
      
      setAmount('');
      setDescription('');
      toast.success('Kayıt eklendi');
    } catch (e) {
      console.error(e);
      toast.error('Kayıt eklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (recordId: string) => {
    if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    try {
      await deleteDoc(doc(db, 'accountingRecords', recordId));
      toast.success('Kayıt silindi');
    } catch (e) {
      console.error(e);
      toast.error('Kayıt silinirken hata oluştu');
    }
  };

  const getFilteredRecords = () => {
    const now = new Date();
    return records.filter(r => {
      const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
      if (dateFilter === 'bugun') return d >= startOfDay(now);
      if (dateFilter === 'hafta') return d >= startOfWeek(now);
      if (dateFilter === 'ay') return d >= startOfMonth(now);
      return true;
    });
  };

  const filtered = getFilteredRecords();
  const totalIncome = filtered.filter(r => r.type === 'gelir').reduce((a, b) => a + b.amount, 0);
  const totalExpense = filtered.filter(r => r.type === 'gider').reduce((a, b) => a + b.amount, 0);
  const net = totalIncome - totalExpense;

  if (profile?.role !== 'ADMIN') {
    return <div className="p-8 text-center text-red-500 font-bold uppercase tracking-widest text-xs">Yetkisiz Erişim</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <h1 className="text-2xl font-bold">Muhasebe</h1>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-32 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bugun">Bugün</SelectItem>
            <SelectItem value="hafta">Bu Hafta</SelectItem>
            <SelectItem value="ay">Bu Ay</SelectItem>
            <SelectItem value="yıl">Tümü</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
          <div className="bg-green-500/10 p-3 rounded-lg text-green-500">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Gelir</p>
            <p className="font-bold text-lg text-foreground">{totalIncome.toLocaleString('tr-TR')} ₺</p>
          </div>
        </div>
        
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
          <div className="bg-red-500/10 p-3 rounded-lg text-red-500">
            <ArrowDownRight className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Gider</p>
            <p className="font-bold text-lg text-foreground">{totalExpense.toLocaleString('tr-TR')} ₺</p>
          </div>
        </div>
      </div>

      <div className={`p-4 rounded-xl border shadow-sm text-center ${net >= 0 ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
        <p className="text-xs uppercase font-bold tracking-widest opacity-80 mb-1">Net Durum</p>
        <p className="text-2xl font-black">{Math.abs(net).toLocaleString('tr-TR')} ₺ {net >= 0 ? '(+)' : '(-)'}</p>
      </div>

      <form onSubmit={handleAdd} className="bg-card p-4 rounded-xl border border-border shadow-sm space-y-4">
        <h3 className="text-sm font-bold tracking-wider uppercase flex items-center gap-2 text-muted-foreground">
          <Plus className="w-4 h-4" /> Yeni Ekle
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-bold tracking-wider opacity-70">Tür</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gelir">Gelir</SelectItem>
                <SelectItem value="gider">Gider</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-bold tracking-wider opacity-70">Tutar (₺)</Label>
            <Input 
              type="number" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              placeholder="Örn: 500"
              className="bg-background"
              required
            />
          </div>
        </div>
        
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase font-bold tracking-wider opacity-70">Açıklama</Label>
          <Input 
            value={description} 
            onChange={e => setDescription(e.target.value)} 
            placeholder="Örn: Yakıt, Parça satışı..."
            className="bg-background"
            required
          />
        </div>
        
        <Button type="submit" disabled={loading} className="w-full bg-primary text-black font-bold h-11 rounded-lg">
          KAYDET
        </Button>
      </form>
      
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest pl-1 mt-6">Son İşlemler</h3>
        <div className="space-y-2">
          {filtered.length === 0 ? (
             <div className="text-center p-8 bg-card border border-border rounded-xl text-muted-foreground text-xs">
                Seçili döneme ait işlem bulunamadı.
             </div>
          ) : (
            filtered.map((r: any) => (
              <div key={r.id} className="flex justify-between items-center p-3.5 bg-card border border-border rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${r.type === 'gelir' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    {r.type === 'gelir' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{r.description}</h4>
                    <span className="text-[10px] text-muted-foreground">{r.createdAt?.toDate ? format(r.createdAt.toDate(), 'dd.MM.yyyy HH:mm') : '-'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`font-black tracking-tight ${r.type === 'gelir' ? 'text-green-500' : 'text-red-500'}`}>
                    {r.type === 'gelir' ? '+' : '-'}{r.amount.toLocaleString('tr-TR')} ₺
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-red-500"
                    onClick={() => handleDelete(r.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
    </div>
  );
}
