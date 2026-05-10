import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation } from 'lucide-react';

export function MapRoute() {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
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
      })) as any[];
      // Filter active ones
      const pending = data.filter(r => r.status.includes('Yönlendir') || r.status.includes('Bekle'));
      setRecords(pending);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'serviceRecords');
    });

    return unsubscribe;
  }, [user]);

  const openGoogleMaps = (targetAddress: string) => {
    if (!targetAddress) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(targetAddress)}`;
    window.open(url, '_blank');
  };

  if (loading) return <div className="p-8 text-center animate-pulse text-muted-foreground uppercase tracking-widest text-xs">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold border-b border-border pb-4">Harita & Yol Tarifi</h1>
      
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Aktif Servis Rotaları ({records.length})</p>
        
        {records.length === 0 ? (
          <div className="bg-card p-8 rounded-xl border border-border text-center">
             <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
             <p className="text-muted-foreground text-sm">Aktif yol tarifi oluşturulacak servis kaydı bulunmamaktadır.</p>
          </div>
        ) : (
          records.map(r => (
            <div key={r.id} className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-foreground">{r.customerName}</span>
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">{r.deviceBrand}</span>
                </div>
                <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{r.customerAddress || 'Adres bilgisi yok'}</span>
                </div>
              </div>
              
              <Button 
                onClick={() => openGoogleMaps(r.customerAddress)} 
                disabled={!r.customerAddress}
                variant={r.customerAddress ? 'default' : 'secondary'}
                className={`w-full font-bold h-11 gap-2 ${r.customerAddress ? 'bg-[#4285F4] hover:bg-[#4285F4]/90 text-white' : ''}`}
              >
                <Navigation className="w-4 h-4" /> 
                {r.customerAddress ? 'GOOGLE MAPS İLE GİT' : 'ADRES EKSİK'}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
