import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs, doc, setDoc, addDoc, deleteDoc, where, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Plus, Trash2, Edit, PackageOpen, ArrowUpRight, ArrowDownRight, Box } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function StockManagement() {
  const { user, profile } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // Modal 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("genel");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form
  const [formData, setFormData] = useState({
    productCode: "",
    productName: "",
    category: "",
    price: "",
    currency: "TRY",
    isActive: "1",
    quantity: 0
  });

  // Movements
  const [movements, setMovements] = useState<any[]>([]);
  const [movementForm, setMovementForm] = useState({
    type: "in",
    quantity: "",
    description: "",
    price: ""
  });

  useEffect(() => {
    if (!user || (profile?.role === 'CAGRI_MERKEZI')) return;
    const q = query(collection(db, 'stockRecords'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      setRecords(data);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'stockRecords'));
    return unsubscribe;
  }, [user, profile]);

  useEffect(() => {
    if (!user || !editingId || activeTab !== 'hareketler') return;
    const q = query(collection(db, 'stockMovements'), where('stockId', '==', editingId), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      setMovements(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'stockMovements'));
    return unsubscribe;
  }, [user, editingId, activeTab]);

  const handleOpenModal = (item?: any) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        productCode: item.productCode || "",
        productName: item.productName || "",
        category: item.category || "",
        price: item.price?.toString() || "",
        currency: item.currency || "TRY",
        isActive: item.isActive === false ? "0" : "1",
        quantity: item.quantity || 0
      });
    } else {
      setEditingId(null);
      setFormData({
        productCode: "",
        productName: "",
        category: "",
        price: "",
        currency: "TRY",
        isActive: "1",
        quantity: 0
      });
    }
    setActiveTab("genel");
    setIsModalOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!user || !formData.productName) {
      toast.error("Ürün adı zorunludur");
      return;
    }
    
    try {
      const payload = {
        userId: user.uid,
        productCode: formData.productCode,
        productName: formData.productName,
        category: formData.category,
        price: parseFloat(formData.price || "0"),
        currency: formData.currency,
        isActive: formData.isActive === "1",
        quantity: formData.quantity,
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await setDoc(doc(db, 'stockRecords', editingId), payload, { merge: true });
        toast.success("Ürün güncellendi");
      } else {
        await addDoc(collection(db, 'stockRecords'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        toast.success("Yeni ürün eklendi");
        setIsModalOpen(false);
      }
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'stockRecords');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Silmek istediğinize emin misiniz? Daha önce kullanılan işlemlerden çıkartılabilir.")) return;
    try {
      await deleteDoc(doc(db, 'stockRecords', id));
      toast.success("Ürün silindi");
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stockRecords/${id}`);
    }
  };

  const handleAddMovement = async () => {
    if (!user || !editingId || !movementForm.quantity) return;
    
    try {
      const mQty = parseFloat(movementForm.quantity);
      const isOut = movementForm.type === 'out';
      
      const payload = {
        userId: user.uid,
        stockId: editingId,
        type: movementForm.type,
        quantity: mQty,
        description: movementForm.description,
        price: parseFloat(movementForm.price || "0"),
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'stockMovements'), payload);

      const newQty = (formData.quantity || 0) + (isOut ? -mQty : mQty);
      await setDoc(doc(db, 'stockRecords', editingId), { quantity: newQty, updatedAt: serverTimestamp() }, { merge: true });
      
      setFormData(prev => ({ ...prev, quantity: newQty }));
      setMovementForm({ type: "in", quantity: "", description: "", price: "" });
      toast.success("Stok hareketi eklendi");

    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'stockMovements');
    }
  };

  const handleDeleteMovement = async (mov: any) => {
    if (!confirm("Hareket kaydını silmek istediğinize emin misiniz?")) return;
    try {
      await deleteDoc(doc(db, 'stockMovements', mov.id));
      
      const mQty = mov.quantity;
      const isOut = mov.type === 'out';
      const newQty = (formData.quantity || 0) + (isOut ? mQty : -mQty);
      
      await setDoc(doc(db, 'stockRecords', editingId!), { quantity: newQty, updatedAt: serverTimestamp() }, { merge: true });
      setFormData(prev => ({ ...prev, quantity: newQty }));
      
      toast.success("Hareket silindi");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stockMovements/${mov.id}`);
    }
  };

  const filteredRecords = records.filter(r => {
    const matchSearch = (r.productName?.toLowerCase() || "").includes(search.toLowerCase()) || 
                        (r.productCode?.toLowerCase() || "").includes(search.toLowerCase());
    if (statusFilter === "1") return matchSearch && r.isActive !== false;
    if (statusFilter === "0") return matchSearch && r.isActive === false;
    return matchSearch;
  });

  if (profile?.role === 'CAGRI_MERKEZI') {
    return <div className="p-8 text-center text-red-500 font-bold uppercase tracking-widest text-xs">Yetkisiz Erişim</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-4 gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
           <PackageOpen className="w-6 h-6 text-primary" />
           Stok Yönetimi
        </h1>
      </div>
      
      <div className="bg-card p-4 rounded-xl border border-border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="flex items-center gap-3">
             <Button onClick={() => handleOpenModal()} className="bg-green-600 hover:bg-green-700 text-white font-bold h-10 gap-2">
               <Plus className="w-4 h-4" /> Yeni Ürün Ekle
             </Button>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] bg-background">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hepsi</SelectItem>
                <SelectItem value="1">Aktif</SelectItem>
                <SelectItem value="0">Pasif</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ürün Kodu veya Adı..." 
                className="pl-9 bg-background h-10"
              />
            </div>
          </div>
        </div>
        
        {loading ? (
           <div className="p-8 text-center animate-pulse text-muted-foreground text-xs">Yükleniyor...</div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground text-xs uppercase font-bold">
                <tr>
                  <th className="px-4 py-3 border-b">Stok Kodu</th>
                  <th className="px-4 py-3 border-b">Ürün Adı</th>
                  <th className="px-4 py-3 border-b">Kategori</th>
                  <th className="px-4 py-3 border-b">Miktar</th>
                  <th className="px-4 py-3 border-b">Fiyat</th>
                  <th className="px-4 py-3 border-b text-center">Durum</th>
                  <th className="px-4 py-3 border-b text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {filteredRecords.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground italic">Kayıt bulunamadı.</td></tr>
                ) : (
                  filteredRecords.map((r: any) => (
                    <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{r.productCode || '-'}</td>
                      <td className="px-4 py-3 font-bold">{r.productName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.category || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold bg-muted px-2 py-0.5 rounded ${r.quantity > 0 ? 'text-primary' : 'text-red-500'}`}>
                          {r.quantity || 0} Adet
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {r.price ? `${r.price.toLocaleString('tr-TR')} ${r.currency}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.isActive !== false ? 
                          <span className="bg-green-500/10 text-green-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Aktif</span> : 
                          <span className="bg-red-500/10 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Pasif</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button onClick={() => handleOpenModal(r)} variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-full md:w-[90%] p-0 overflow-hidden bg-background">
          <DialogHeader className="px-6 pt-6 pb-2 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10 w-full rounded-t-lg">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Box className="w-5 h-5 text-primary" /> {editingId ? 'Stok Kartı Düzenle' : 'Yeni Stok Kartı'}
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-6 pt-4 space-y-6">
            {editingId && (
              <div className="flex gap-2 border-b border-border pb-2 w-full overflow-x-auto scrollbar-hide shrink-0">
                <button 
                  onClick={() => setActiveTab('genel')} 
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all border shrink-0 ${activeTab === 'genel' ? 'bg-card text-foreground shadow-sm border-border' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
                >
                  Genel Bilgiler
                </button>
                <button 
                  onClick={() => setActiveTab('hareketler')} 
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all border shrink-0 ${activeTab === 'hareketler' ? 'bg-card text-foreground shadow-sm border-border' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
                >
                  Stok Hareketleri
                </button>
              </div>
            )}

            {activeTab === 'genel' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 flex flex-col">
                    <Label className="text-muted-foreground font-bold text-xs uppercase">Stok Kodu</Label>
                    <Input value={formData.productCode} onChange={e => setFormData({...formData, productCode: e.target.value})} placeholder="Örn: PR-1234" />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <Label className="text-muted-foreground font-bold text-xs uppercase">Stok Adı <span className="text-red-500">*</span></Label>
                    <Input value={formData.productName} onChange={e => setFormData({...formData, productName: e.target.value})} placeholder="Örn: Motor Pompası" />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <Label className="text-muted-foreground font-bold text-xs uppercase">Kategori</Label>
                    <Input value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="Örn: Bulaşık Makinesi" />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <Label className="text-muted-foreground font-bold text-xs uppercase">Durum</Label>
                    <Select value={formData.isActive} onValueChange={v => setFormData({...formData, isActive: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Aktif</SelectItem>
                        <SelectItem value="0">Pasif</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-xl border border-border">
                  <div className="space-y-1.5 flex flex-col">
                    <Label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Satış Fiyatı</Label>
                    <Input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="0.00" />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <Label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Para Birimi</Label>
                    <Select value={formData.currency} onValueChange={v => setFormData({...formData, currency: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRY">TRY (₺)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 col-span-2 md:col-span-1 flex flex-col">
                    <Label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Mevcut Stok Miktarı</Label>
                    <div className="h-10 px-3 bg-card border border-border rounded-lg flex items-center justify-center font-black text-lg text-primary">
                      {formData.quantity}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-border mt-4">
                  {editingId ? (
                     <Button onClick={() => handleDeleteProduct(editingId)} variant="destructive" size="sm" className="gap-2">
                       <Trash2 className="w-4 h-4" /> Sil
                     </Button>
                  ) : <div></div>}
                  <Button onClick={handleSaveProduct} className="font-bold gap-2 bg-primary text-black hover:bg-primary/90">
                    {editingId ? 'GÜNCELLE' : 'KAYDET'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end bg-muted p-4 rounded-xl border border-border w-full">
                  <div className="space-y-1.5 flex flex-col">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">İşlem Yönü</Label>
                    <Select value={movementForm.type} onValueChange={(v: "in"|"out") => setMovementForm({...movementForm, type: v})}>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in">Alış (Giriş)</SelectItem>
                        <SelectItem value="out">Satış/Servis (Çıkış)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Açıklama / Fiş No</Label>
                    <Input className="bg-background" value={movementForm.description} onChange={e => setMovementForm({...movementForm, description: e.target.value})} placeholder="Örn: Fatura No" />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Miktar (Adet)</Label>
                    <Input type="number" className="bg-background" value={movementForm.quantity} onChange={e => setMovementForm({...movementForm, quantity: e.target.value})} placeholder="0" />
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Birim Fiyat ({formData.currency})</Label>
                    <Input type="number" step="0.01" className="bg-background" value={movementForm.price} onChange={e => setMovementForm({...movementForm, price: e.target.value})} placeholder="0.00" />
                  </div>
                  <div className="sm:col-span-2 pt-1 h-full w-full max-h-10">
                     <Button onClick={handleAddMovement} className="w-full gap-2 font-bold h-10" disabled={!movementForm.quantity}>
                       <Plus className="w-4 h-4" /> HAREKET EKLE
                     </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                      <tr>
                        <th className="px-3 py-2 border-b">Yön</th>
                        <th className="px-3 py-2 border-b">Tarih</th>
                        <th className="px-3 py-2 border-b">Açıklama</th>
                        <th className="px-3 py-2 border-b">Miktar</th>
                        <th className="px-3 py-2 border-b">Fiyat</th>
                        <th className="px-3 py-2 border-b text-right">Sil</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card">
                      {movements.length === 0 ? (
                         <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-xs italic">Henüz hareket bulunmuyor.</td></tr>
                      ) : (
                        movements.map((mov: any) => (
                          <tr key={mov.id} className="hover:bg-muted/50 transition-colors">
                            <td className="px-3 py-2">
                               {mov.type === 'in' ? 
                                 <span className="flex items-center gap-1 text-green-500 font-bold bg-green-500/10 px-1.5 py-0.5 rounded text-[10px] uppercase w-fit"><ArrowDownRight className="w-3 h-3"/> Alış</span> : 
                                 <span className="flex items-center gap-1 text-red-500 font-bold bg-red-500/10 px-1.5 py-0.5 rounded text-[10px] uppercase w-fit"><ArrowUpRight className="w-3 h-3"/> Çıkış</span> 
                               }
                            </td>
                            <td className="px-3 py-2 text-[10px] font-mono text-muted-foreground">{mov.createdAt?.toDate ? format(mov.createdAt.toDate(), 'dd.MM.yyyy HH:mm') : '-'}</td>
                            <td className="px-3 py-2 truncate max-w-[120px]" title={mov.description}>{mov.description || '-'}</td>
                            <td className="px-3 py-2 font-bold">{mov.quantity}</td>
                            <td className="px-3 py-2">{mov.price ? `${mov.price} ${formData.currency}` : '-'}</td>
                            <td className="px-3 py-2 text-right">
                               <Button onClick={() => handleDeleteMovement(mov)} variant="ghost" size="icon" className="h-6 w-6 hover:text-red-500 hover:bg-red-500/10">
                                 <Trash2 className="w-3 h-3" />
                               </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

